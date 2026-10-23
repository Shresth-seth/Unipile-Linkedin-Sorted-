import { unipileClient } from "../unipile/unipile.client.js";
import { linkedInPeopleService } from "./people.service.js";
import { db } from "../../db/index.js";
import { linkedinAccounts } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import {
  Person,
  ActionResult,
  PendingRequest,
  IncomingRequest,
} from "../../types/linkedin.types.js";

export class LinkedInConnectionService {
  /**
   * Helper to resolve an active LinkedIn account ID from parameters or database.
   */
  private async resolveAccountId(
    preferredAccountId?: string | undefined,
    userId?: string | undefined,
  ): Promise<string> {
    if (preferredAccountId && preferredAccountId.trim()) {
      return preferredAccountId.trim();
    }
    try {
      if (userId) {
        const [acc] = await db
          .select()
          .from(linkedinAccounts)
          .where(
            and(
              eq(linkedinAccounts.userId, userId),
              eq(linkedinAccounts.isConnected, true),
            ),
          )
          .limit(1);
        if (acc?.unipileAccountId && acc.healthStatus !== "DISCONNECTED") {
          return acc.unipileAccountId;
        }
      }
      const [anyAcc] = await db
        .select()
        .from(linkedinAccounts)
        .where(eq(linkedinAccounts.isConnected, true))
        .limit(1);
      if (anyAcc?.unipileAccountId && anyAcc.healthStatus !== "DISCONNECTED") {
        return anyAcc.unipileAccountId;
      }
    } catch {
      // ignore
    }
    throw new Error(
      "No active LinkedIn account connected. Please connect your LinkedIn account to send connection requests.",
    );
  }

  /**
   * Sends an outbound connection request with an optional note.
   * Target can be a Person object, a provider_id, a public identifier (e.g. "satyanadella"),
   * or a full LinkedIn URL.
   */
  public async sendConnectionRequest(
    target: Person | string,
    message?: string | undefined,
    accountId?: string | undefined,
    userId?: string | undefined,
  ): Promise<ActionResult> {
    if (!unipileClient.isConfigured()) {
      return {
        success: false,
        message:
          "Unipile is not configured. Please set UNIPILE_DSN and UNIPILE_API_KEY in server/.env",
      };
    }

    try {
      const activeAccountId = await this.resolveAccountId(accountId, userId);
      let providerId = "";
      let targetDisplayName = "LinkedIn Member";

      if (typeof target === "object" && target !== null) {
        providerId = (target as any).provider_id || target.linkedin_id;
        targetDisplayName = target.name || targetDisplayName;
      } else if (typeof target === "string") {
        const cleanTarget = target.trim();
        // If it starts with ACo or is an internal provider_id
        if (
          cleanTarget.startsWith("ACo") ||
          cleanTarget.startsWith("urn:li:")
        ) {
          providerId = cleanTarget;
          targetDisplayName = cleanTarget;
        } else {
          // Public identifier or full URL: resolve to provider_id first via Unipile
          try {
            const profile = await linkedInPeopleService.getProfile(
              cleanTarget,
              activeAccountId,
              userId,
            );
            providerId = profile.provider_id || profile.linkedin_id;
            targetDisplayName = profile.name || cleanTarget;
          } catch {
            // Fallback: If cleanTarget is a person's name (e.g. "Kavya Gupta"), search LinkedIn to resolve their provider_id
            const candidates = await linkedInPeopleService.searchPeople(
              { role: cleanTarget, keywords: cleanTarget, limit: 3 },
              activeAccountId,
              userId,
            );
            const bestMatch = candidates?.[0];
            if (bestMatch) {
              providerId =
                (bestMatch as any).provider_id || bestMatch.linkedin_id;
              targetDisplayName = bestMatch.name || cleanTarget;
            }
          }
        }
      }

      if (!providerId) {
        return {
          success: false,
          message:
            "Unable to resolve LinkedIn provider_id for connection invitation.",
        };
      }

      let res: any;
      try {
        res = await unipileClient.sendConnectionRequest(
          activeAccountId,
          providerId,
          message,
        );
      } catch (inviteErr: any) {
        const errStr = String(inviteErr?.message || "");
        // If LinkedIn 422 limit on customized notes was triggered and a message was provided, auto-fallback without note
        if (
          message &&
          (errStr.includes("422") ||
            errStr.includes("provider limit") ||
            errStr.includes("limit") ||
            errStr.includes("quota"))
        ) {
          console.warn(
            "⚠️ [CONNECTION] Custom note quota exceeded (422). Auto-retrying invitation without note...",
          );
          res = await unipileClient.sendConnectionRequest(
            activeAccountId,
            providerId,
            undefined,
          );
          return {
            success: true,
            message: `Connection invite sent to ${targetDisplayName} (sent without note as LinkedIn custom note quota was reached).`,
            data: res,
          };
        }
        throw inviteErr;
      }

      return {
        success: true,
        message: `Connection invite sent to ${targetDisplayName}`,
        data: res,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to send connection invite: ${err.message}`,
      };
    }
  }

  /**
   * Retrieves pending outgoing connection invitations.
   */
  public async getSentRequests(accountId?: string): Promise<PendingRequest[]> {
    if (!unipileClient.isConfigured()) {
      return [];
    }

    try {
      const activeAccId = await this.resolveAccountId(accountId);
      const res = await unipileClient.getSentInvitations(activeAccId);
      const items = res.items || (Array.isArray(res) ? res : []);
      return items.map((item: any) => ({
        id: String(item.id),
        recipient_id: item.invited_user_id || item.user_id || item.id,
        recipient_name:
          item.invited_user || item.user_name || "LinkedIn Member",
        recipient_title:
          item.invited_user_description || item.user_title || "LinkedIn Member",
        recipient_picture_url:
          item.invited_user_profile_picture_url ||
          item.profile_picture_url ||
          undefined,
        recipient_public_id: item.invited_user_public_id || undefined,
        invitation_text: item.invitation_text || null,
        created_at:
          item.parsed_datetime ||
          item.date ||
          item.created_at ||
          new Date().toISOString(),
        status: "PENDING",
      }));
    } catch (err: any) {
      console.warn("Failed to get sent requests from Unipile:", err);
      return [];
    }
  }

  /**
   * Cancels / withdraws a sent connection invitation.
   */
  public async cancelSentRequest(
    invitationId: string,
    accountId?: string,
  ): Promise<ActionResult> {
    if (!unipileClient.isConfigured()) {
      return {
        success: false,
        message: "Unipile is not configured in server/.env",
      };
    }

    try {
      const activeAccId = await this.resolveAccountId(accountId);
      const res = await unipileClient.cancelSentInvitation(
        invitationId,
        activeAccId,
      );
      return {
        success: true,
        message: `Connection invitation ${invitationId} withdrawn successfully.`,
        data: res,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to cancel connection invitation: ${err.message}`,
      };
    }
  }

  /**
   * Retrieves pending incoming connection invitations.
   */
  public async getReceivedRequests(
    accountId?: string,
  ): Promise<IncomingRequest[]> {
    if (!unipileClient.isConfigured()) {
      return [];
    }

    try {
      const activeAccId = await this.resolveAccountId(accountId);
      const res = await unipileClient.getReceivedInvitations(activeAccId);
      const items = res.items || (Array.isArray(res) ? res : []);
      return items.map((item: any) => ({
        id: item.connection_urn || item.id || item.member_id,
        sender_id: item.member_id || item.user_id || item.id,
        sender_name:
          `${item.first_name || ""} ${item.last_name || ""}`.trim() ||
          item.sender_name ||
          item.user_name ||
          "LinkedIn Member",
        sender_title: item.headline || item.user_title || "LinkedIn Member",
        sender_picture_url: item.profile_picture_url || undefined,
        sender_public_id: item.public_identifier || undefined,
        connection_urn: item.connection_urn || undefined,
        created_at: item.created_at
          ? typeof item.created_at === "number"
            ? new Date(item.created_at).toISOString()
            : item.created_at
          : new Date().toISOString(),
      }));
    } catch (err: any) {
      console.warn("Failed to get received requests from Unipile:", err);
      return [];
    }
  }

  /**
   * Accepts an incoming connection request.
   */
  public async acceptConnectionRequest(
    requestId: string,
  ): Promise<ActionResult> {
    if (!unipileClient.isConfigured()) {
      return {
        success: false,
        message:
          "Unipile is not configured. Please set UNIPILE_DSN and UNIPILE_API_KEY in server/.env",
      };
    }

    try {
      const res = await unipileClient.request(
        `/api/v1/users/invitations/${requestId}/accept`,
        {
          method: "POST",
        },
      );
      return {
        success: true,
        message: `Connection request ${requestId} accepted`,
        data: res,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to accept connection request: ${err.message}`,
      };
    }
  }

  /**
   * Declines/ignores an incoming connection request.
   */
  public async declineConnectionRequest(
    requestId: string,
  ): Promise<ActionResult> {
    if (!unipileClient.isConfigured()) {
      return {
        success: false,
        message:
          "Unipile is not configured. Please set UNIPILE_DSN and UNIPILE_API_KEY in server/.env",
      };
    }

    try {
      const res = await unipileClient.request(
        `/api/v1/users/invitations/${requestId}/decline`,
        {
          method: "POST",
        },
      );
      return {
        success: true,
        message: `Connection request ${requestId} declined`,
        data: res,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to decline connection request: ${err.message}`,
      };
    }
  }

  public async checkConnectionStatus(
    personId: string,
    _accountId?: string,
  ): Promise<"PENDING" | "CONNECTED" | "NOT_CONNECTED"> {
    if (!unipileClient.isConfigured()) {
      return "NOT_CONNECTED";
    }

    try {
      const res = await unipileClient.request<any>(`/api/v1/users/${personId}`);
      if (
        res &&
        (res.network_distance === "FIRST_DEGREE" || res.is_connected)
      ) {
        return "CONNECTED";
      }
      return "PENDING";
    } catch {
      return "NOT_CONNECTED";
    }
  }
}

export const linkedInConnectionService = new LinkedInConnectionService();
