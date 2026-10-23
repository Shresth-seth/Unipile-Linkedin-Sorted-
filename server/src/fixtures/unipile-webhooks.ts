import { UnipileMessageWebhookPayload } from "../services/webhook/unipile-message-agent.service.js";
import { UnipileRelationWebhookPayload } from "../services/webhook/unipile-relation-agent.service.js";

export const FIXTURE_CONNECTED_ACCOUNT_ID = "unipile_acc_test_12345";
export const FIXTURE_CONNECTED_USER_ID = "ACoAAAcDMMQBODyLwZrRcgYhrkCafURGqva0U4E";
export const FIXTURE_PROSPECT_PROVIDER_ID = "ACoAAAEkwwAB9KEc2TrQgOLEQ-vzRyZeCDyc6DQ";

/**
 * Fixture: Standard Incoming Prospect Message
 */
export const fixtureIncomingMessage: UnipileMessageWebhookPayload = {
  account_id: FIXTURE_CONNECTED_ACCOUNT_ID,
  account_type: "LINKEDIN",
  account_info: {
    type: "LINKEDIN",
    feature: "classic",
    user_id: FIXTURE_CONNECTED_USER_ID,
  },
  event: "message_received",
  chat_id: "chat_fixture_thread_001",
  timestamp: new Date().toISOString(),
  webhook_name: "WorkPilot Messages Test",
  message_id: "msg_inbound_test_999",
  message: "Hi! Thanks for reaching out. What kind of AI developer tooling are you building? Would be great to discuss.",
  sender: {
    attendee_id: "att_prospect_999",
    attendee_name: "Alex Rivera",
    attendee_provider_id: FIXTURE_PROSPECT_PROVIDER_ID,
    attendee_profile_url: "https://www.linkedin.com/in/alex-rivera-test/",
  },
};

/**
 * Fixture: Own Outgoing Message (Sent by the connected user from LinkedIn web or phone)
 * Crucial check: account_info.user_id === sender.attendee_provider_id
 */
export const fixtureOwnOutgoingMessage: UnipileMessageWebhookPayload = {
  account_id: FIXTURE_CONNECTED_ACCOUNT_ID,
  account_type: "LINKEDIN",
  account_info: {
    type: "LINKEDIN",
    feature: "classic",
    user_id: FIXTURE_CONNECTED_USER_ID,
  },
  event: "message_received",
  chat_id: "chat_fixture_thread_001",
  timestamp: new Date().toISOString(),
  webhook_name: "WorkPilot Messages Test",
  message_id: "msg_outbound_self_888",
  message: "Hey Alex! Yes, we build autonomous AI coding agents for engineers.",
  sender: {
    attendee_id: "att_self_001",
    attendee_name: "Connected User",
    attendee_provider_id: FIXTURE_CONNECTED_USER_ID, // Exactly matches account_info.user_id
    attendee_profile_url: "https://www.linkedin.com/in/connected-user-test/",
  },
};

/**
 * Fixture: Opt-Out Message from Prospect
 */
export const fixtureOptOutMessage: UnipileMessageWebhookPayload = {
  account_id: FIXTURE_CONNECTED_ACCOUNT_ID,
  account_type: "LINKEDIN",
  account_info: {
    type: "LINKEDIN",
    feature: "classic",
    user_id: FIXTURE_CONNECTED_USER_ID,
  },
  event: "message_received",
  chat_id: "chat_fixture_thread_002",
  timestamp: new Date().toISOString(),
  webhook_name: "WorkPilot Messages Test",
  message_id: "msg_optout_test_777",
  message: "Please stop contacting me. Unsubscribe.",
  sender: {
    attendee_id: "att_prospect_777",
    attendee_name: "Jordan Smith",
    attendee_provider_id: "ACoAAAFksjdf9872k3j4h2k3j4h23",
    attendee_profile_url: "https://www.linkedin.com/in/jordan-smith-test/",
  },
};

/**
 * Fixture: Empty / Reaction Message
 */
export const fixtureEmptyMessage: UnipileMessageWebhookPayload = {
  account_id: FIXTURE_CONNECTED_ACCOUNT_ID,
  account_type: "LINKEDIN",
  account_info: {
    type: "LINKEDIN",
    feature: "classic",
    user_id: FIXTURE_CONNECTED_USER_ID,
  },
  event: "message_reaction",
  chat_id: "chat_fixture_thread_001",
  timestamp: new Date().toISOString(),
  webhook_name: "WorkPilot Messages Test",
  message_id: "msg_empty_test_666",
  message: "",
  sender: {
    attendee_id: "att_prospect_999",
    attendee_name: "Alex Rivera",
    attendee_provider_id: FIXTURE_PROSPECT_PROVIDER_ID,
  },
};

/**
 * Fixture: Accepted Connection (new_relation webhook)
 */
export const fixtureNewRelation: UnipileRelationWebhookPayload = {
  event: "new_relation",
  account_id: FIXTURE_CONNECTED_ACCOUNT_ID,
  account_type: "LINKEDIN",
  webhook_name: "WorkPilot New Relation Test",
  user_full_name: "Alex Rivera",
  user_provider_id: FIXTURE_PROSPECT_PROVIDER_ID,
  user_public_identifier: "alex-rivera-test",
  user_profile_url: "https://www.linkedin.com/in/alex-rivera-test/",
  user_picture_url: "https://media.licdn.com/dms/image/test-avatar.jpg",
};
