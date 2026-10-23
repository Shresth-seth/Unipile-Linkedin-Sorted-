/**
 * Canonical Unipile Message Webhook Normalizer
 *
 * Normalizes disparate payload schemas (e.g. Unipile v1 new-message webhook,
 * chat webhooks, simulated payloads) into a single, strongly-typed, fully-validated structure.
 * Never throws on missing nested properties.
 */

export interface NormalizedUnipileMessageEvent {
  isValid: boolean;
  validationError?: string | undefined;
  event: string;
  accountId: string;
  chatId: string;
  messageId: string;
  text: string;
  senderName: string;
  senderProviderId: string;
  senderProfileUrl?: string | null;
  connectedUserProviderId?: string | null;
  isOwnMessage: boolean;
  attachments: any[];
  timestamp: string;
  rawPayload: any;
}

/**
 * Safely extracts and normalizes Unipile message webhook payload fields.
 * Handles official Unipile v1 format as well as defensive fallbacks.
 *
 * Official Unipile fields:
 * - payload.event (e.g. "message_received")
 * - payload.account_id
 * - payload.account_info.user_id
 * - payload.chat_id
 * - payload.message_id
 * - payload.message
 * - payload.sender.attendee_id
 * - payload.sender.attendee_name
 * - payload.sender.attendee_provider_id
 * - payload.sender.attendee_profile_url
 */
export function normalizeUnipileMessageWebhook(rawPayload: any): NormalizedUnipileMessageEvent {
  const p = rawPayload && typeof rawPayload === "object" ? rawPayload : {};

  const event = String(p.event || p.type || "message_received").toLowerCase().trim();
  const accountId = String(p.account_id || p.accountId || "").trim();
  const chatId = String(p.chat_id || p.chatId || "").trim();
  const messageId = String(p.message_id || p.messageId || p.id || "").trim();

  // In Unipile v1, the message body is in payload.message (or payload.text fallback)
  const text = typeof p.message === "string" ? p.message : typeof p.text === "string" ? p.text : "";

  // Sender extraction with safe fallback
  const senderObj = p.sender && typeof p.sender === "object" ? p.sender : {};
  const senderName = String(
    senderObj.attendee_name ||
    senderObj.name ||
    p.sender_name ||
    p.senderName ||
    "LinkedIn Member"
  ).trim();

  const senderProviderId = String(
    senderObj.attendee_provider_id ||
    senderObj.provider_id ||
    senderObj.attendee_id ||
    p.sender_id ||
    p.senderId ||
    ""
  ).trim();

  const senderProfileUrl = senderObj.attendee_profile_url || senderObj.profile_url || p.profile_url || null;

  // Connected user extraction (our own account on LinkedIn)
  const accountInfo = p.account_info && typeof p.account_info === "object" ? p.account_info : {};
  const connectedUserProviderId = String(
    accountInfo.user_id ||
    p.connected_user_id ||
    p.user_id ||
    ""
  ).trim() || null;

  // Detect whether message was sent by the connected user (outbound echo)
  const isOwnMessage = Boolean(
    connectedUserProviderId &&
    senderProviderId &&
    connectedUserProviderId === senderProviderId
  );

  const attachments = Array.isArray(p.attachments) ? p.attachments : [];
  const timestamp = p.timestamp ? new Date(p.timestamp).toISOString() : new Date().toISOString();

  // Validation: require accountId, chatId, messageId, and senderProviderId
  // Note: text can be empty for attachment-only messages
  let isValid = true;
  let validationError: string | undefined;

  if (!accountId) {
    isValid = false;
    validationError = "Missing required 'account_id' in webhook payload.";
  } else if (!chatId) {
    isValid = false;
    validationError = "Missing required 'chat_id' in webhook payload.";
  } else if (!messageId) {
    isValid = false;
    validationError = "Missing required 'message_id' in webhook payload.";
  } else if (!senderProviderId) {
    isValid = false;
    validationError = "Missing required sender provider identifier ('sender.attendee_provider_id') in webhook payload.";
  }

  return {
    isValid,
    validationError,
    event,
    accountId,
    chatId,
    messageId,
    text,
    senderName,
    senderProviderId,
    senderProfileUrl,
    connectedUserProviderId,
    isOwnMessage,
    attachments,
    timestamp,
    rawPayload: p,
  };
}
