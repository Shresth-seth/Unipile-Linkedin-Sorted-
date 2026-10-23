import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contacts, Contact, linkedinAccounts } from "../../db/schema.js";
import { linkedInPeopleService } from "../linkedin/people.service.js";
import { actionQueueService } from "../queue/queue.service.js";
import { accountSafetyService } from "../safety/safety.service.js";
import { SearchFilters, Person } from "../../types/linkedin.types.js";

export class ProspectService {
  public async discoverAndIngest(
    userId: string,
    filters: SearchFilters,
    autoEnqueue: boolean = true,
    personalizedNote?: string,
    campaignType: "DISCOVERY" | "ENGAGEMENT" = "DISCOVERY",
  ): Promise<{ contacts: Contact[]; enqueuedCount: number }> {
    const [userAccount] = await db
      .select()
      .from(linkedinAccounts)
      .where(
        and(
          eq(linkedinAccounts.userId, userId),
          eq(linkedinAccounts.isConnected, true),
        ),
      )
      .limit(1);

    if (
      !userAccount ||
      !userAccount.unipileAccountId ||
      userAccount.healthStatus === "DISCONNECTED"
    ) {
      throw new Error(
        "No connected LinkedIn account found for this user. Please connect your LinkedIn account first.",
      );
    }

    const searchFilters: SearchFilters = {
      ...filters,
      accountId: filters.accountId || userAccount.unipileAccountId,
    };

    const people: Person[] =
      await linkedInPeopleService.searchPeople(searchFilters);
    const ingested: Contact[] = [];

    for (const person of people) {
      const [existing] = await db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.userId, userId),
            eq(contacts.linkedinId, person.linkedin_id),
          ),
        )
        .limit(1);

      if (existing) {
        ingested.push(existing);
        continue;
      }

      const [newContact] = await db
        .insert(contacts)
        .values({
          userId,
          name: person.name,
          linkedinId: person.linkedin_id,
          profileUrl: person.profile_url,
          company: person.company,
          designation: person.designation,
          location: person.location,
          industry: person.industry,
          status: "NEW",
        })
        .returning();

      if (newContact) {
        ingested.push(newContact);
      }
    }

    let enqueuedCount = 0;

    if (autoEnqueue && ingested.length > 0) {
      try {
        const health = await accountSafetyService.getAccountHealth(userId);
        const remainingToday =
          health?.dailyLimits?.connections?.remaining ?? 15;
        const targetLimit = Math.min(remainingToday, filters.limit || 15);

        const eligibleContacts = ingested
          .filter((c) => c.status === "NEW")
          .slice(0, targetLimit);

        for (const contact of eligibleContacts) {
          try {
            const payload = {
              person: {
                name: contact.name,
                linkedin_id: contact.linkedinId,
                profile_url: contact.profileUrl || "",
                company: contact.company || "",
                designation: contact.designation || "",
                location: contact.location || "",
                industry: contact.industry || "",
              },
              note: personalizedNote,
            };

            const actionType = campaignType === "ENGAGEMENT" ? "MESSAGE" : "CONNECT";

            await actionQueueService.enqueue(userId, actionType, payload, {
              contactId: contact.id,
              delayMinutes: Math.floor(Math.random() * 6) + 8, // 8-13 mins
              jitterMinutes: 5, // 0-4 mins jitter
            });

            enqueuedCount++;
          } catch (enqueueErr: any) {
            console.warn(
              `[CAMPAIGN AUTO-ENQUEUE] Skipping contact ${contact.id}:`,
              enqueueErr?.message || enqueueErr,
            );
          }
        }
      } catch (safetyErr: any) {
        console.warn(
          "[CAMPAIGN AUTO-ENQUEUE] Safety check notice:",
          safetyErr?.message || safetyErr,
        );
      }
    }

    return {
      contacts: ingested,
      enqueuedCount,
    };
  }

  public async queueConnectionRequest(
    userId: string,
    contactId: string,
    personalizedNote?: string,
    delayMinutes = 10,
  ) {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.userId, userId), eq(contacts.id, contactId)))
      .limit(1);

    if (!contact) {
      throw new Error("Contact not found.");
    }

    const payload = {
      person: {
        name: contact.name,
        linkedin_id: contact.linkedinId,
        profile_url: contact.profileUrl || "",
        company: contact.company || "",
        designation: contact.designation || "",
        location: contact.location || "",
        industry: contact.industry || "",
      },
      note: personalizedNote,
    };

    return actionQueueService.enqueue(userId, "CONNECT", payload, {
      contactId: contact.id,
      delayMinutes,
    });
  }

  public async handleConnectionAccepted(
    userId: string,
    linkedinId: string,
    firstMessageText?: string,
  ): Promise<{ contact: Contact; nextActionQueued?: any }> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(
        and(eq(contacts.userId, userId), eq(contacts.linkedinId, linkedinId)),
      )
      .limit(1);

    if (!contact) {
      throw new Error(`Contact with LinkedIn ID ${linkedinId} not found.`);
    }

    const [updatedContact] = await db
      .update(contacts)
      .set({
        status: "CONNECTED",
        connectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, contact.id))
      .returning();

    let nextAction = null;
    if (firstMessageText) {
      nextAction = await actionQueueService.enqueue(
        userId,
        "MESSAGE",
        {
          recipientId: contact.linkedinId,
          message: firstMessageText,
        },
        {
          contactId: contact.id,
          delayMinutes: 15,
        },
      );
    }

    return {
      contact: updatedContact || contact,
      nextActionQueued: nextAction,
    };
  }
}

export const prospectService = new ProspectService();
