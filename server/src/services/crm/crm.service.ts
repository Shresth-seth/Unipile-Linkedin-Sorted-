import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contacts, Contact } from "../../db/schema.js";

export interface FunnelStats {
  totalLeads: number;
  connectionsSent: number;
  connectionsAccepted: number;
  acceptanceRate: number;
  totalReplies: number;
  replyRate: number;
  activeConversations: number;
  hotLeads: number;
  hotLeadConversionRate: number;
  meetingsBooked: number;
  dealsWon: number;
  stageBreakdown: Record<string, number>;
}

export class CrmService {
  public async getFunnelAnalytics(userId: string): Promise<FunnelStats> {
    const userContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.userId, userId));

    const totalLeads = userContacts.length;
    const stageBreakdown: Record<string, number> = {
      NEW: 0,
      CONTACTED: 0,
      CONNECTED: 0,
      CONVERSATION: 0,
      INTERESTED: 0,
      HOT_LEAD: 0,
      MEETING: 0,
      PROPOSAL: 0,
      WON: 0,
      LOST: 0,
      FOLLOW_UP_LATER: 0,
    };

    for (const c of userContacts) {
      if (stageBreakdown[c.status] !== undefined) {
        stageBreakdown[c.status]! += 1;
      } else {
        stageBreakdown[c.status] = 1;
      }
    }

    const connectionsSent = userContacts.filter(
      (c) => c.status !== "NEW" && c.connectionSentAt !== null,
    ).length;

    const connectionsAccepted = userContacts.filter(
      (c) =>
        c.status === "CONNECTED" ||
        c.status === "CONVERSATION" ||
        c.status === "INTERESTED" ||
        c.status === "HOT_LEAD" ||
        c.status === "MEETING" ||
        c.status === "PROPOSAL" ||
        c.status === "WON",
    ).length;

    const acceptanceRate =
      connectionsSent > 0
        ? Number(((connectionsAccepted / connectionsSent) * 100).toFixed(1))
        : 0;

    const totalReplies = userContacts.filter(
      (c) => c.lastMessageReceivedAt !== null,
    ).length;

    const replyRate =
      connectionsAccepted > 0
        ? Number(((totalReplies / connectionsAccepted) * 100).toFixed(1))
        : 0;

    const activeConversations = userContacts.filter(
      (c) => c.status === "CONVERSATION" || c.status === "INTERESTED",
    ).length;

    const hotLeads = userContacts.filter(
      (c) => c.isHotLead || c.status === "HOT_LEAD",
    ).length;

    const hotLeadConversionRate =
      totalReplies > 0
        ? Number(((hotLeads / totalReplies) * 100).toFixed(1))
        : 0;

    const meetingsBooked = userContacts.filter(
      (c) => c.status === "MEETING",
    ).length;
    const dealsWon = userContacts.filter((c) => c.status === "WON").length;

    return {
      totalLeads,
      connectionsSent,
      connectionsAccepted,
      acceptanceRate,
      totalReplies,
      replyRate,
      activeConversations,
      hotLeads,
      hotLeadConversionRate,
      meetingsBooked,
      dealsWon,
      stageBreakdown,
    };
  }

  public async updateContactStage(
    userId: string,
    contactId: string,
    newStage:
      | "NEW"
      | "CONTACTED"
      | "CONNECTED"
      | "CONVERSATION"
      | "INTERESTED"
      | "HOT_LEAD"
      | "MEETING"
      | "PROPOSAL"
      | "WON"
      | "LOST"
      | "FOLLOW_UP_LATER",
  ): Promise<Contact> {
    const [updated] = await db
      .update(contacts)
      .set({
        status: newStage,
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.userId, userId), eq(contacts.id, contactId)))
      .returning();

    if (!updated) {
      throw new Error(`Contact ${contactId} not found.`);
    }

    return updated;
  }

  public async getContactsByStage(
    userId: string,
    stage?: string,
    limit = 50,
  ): Promise<Contact[]> {
    const conditions = stage
      ? and(eq(contacts.userId, userId), eq(contacts.status, stage))
      : eq(contacts.userId, userId);

    return db
      .select()
      .from(contacts)
      .where(conditions)
      .orderBy(desc(contacts.updatedAt))
      .limit(limit);
  }
}

export const crmService = new CrmService();
