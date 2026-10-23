import { Router } from "express";
import {
  getConnectLink,
  getAccountStatus,
  getConnectedLinkedInAccount,
  getProfile,
  getOwnProfile,
  searchPeople,
  sendConnection,
  sendMessage,
  sendRichMessage,
  reactToPost,
  commentOnPost,
  createPost,
  getPublishedPosts,
  deletePost,
  disconnectAccount,
  purgeLinkedInCookies,
  syncConnectedAccount,
  connectWithCredentials,
  connectWithCookie,
  solveCheckpoint,
  resendCheckpoint,
  checkCheckpointStatus,
  cancelSentInvitation,
  getSentInvitations,
  getReceivedInvitations,
  acceptInvitation,
  declineInvitation,
  listConversations,
  syncInbox,
  getConversationMessages,
  markConversationRead,
  getCompany,
  searchCompanies,
  searchJobs,
  getJob,
  handleWebhook,
} from "../controllers/linkedin.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// Account Connectivity & Status (Strictly Authenticated)
router.get("/connect", authenticate, getConnectLink);
router.get("/status", authenticate, getAccountStatus);
router.get("/account", authenticate, getConnectedLinkedInAccount);
router.get("/me", authenticate, getOwnProfile);
router.get("/profile/me", authenticate, getOwnProfile);
router.post("/disconnect", authenticate, disconnectAccount);
router.post("/purge-cookies", authenticate, purgeLinkedInCookies);
router.delete("/cookies", authenticate, purgeLinkedInCookies);
router.delete("/login", authenticate, purgeLinkedInCookies);
router.post("/delete-login", authenticate, purgeLinkedInCookies);
router.post("/sync", authenticate, syncConnectedAccount);
router.post("/callback", authenticate, syncConnectedAccount);

// Native Authentication (ID/Password & Session Cookie - Strictly Authenticated)
router.post("/connect/credentials", authenticate, connectWithCredentials);
router.post("/connect/cookie", authenticate, connectWithCookie);
router.post("/checkpoint/solve", authenticate, solveCheckpoint);
router.post("/checkpoint/resend", authenticate, resendCheckpoint);
router.get(
  "/checkpoint/status/:accountId",
  authenticate,
  checkCheckpointStatus,
);

// LinkedIn People, Profiles & Prospecting (Strictly Authenticated)
router.get("/profile/:identifier", authenticate, getProfile);
router.get("/profile", authenticate, getProfile);
router.get("/search", authenticate, searchPeople);
router.post("/search", authenticate, searchPeople);

// Outbound Connections & Invitations (Strictly Authenticated)
router.post("/connection", authenticate, sendConnection);
router.post("/invite", authenticate, sendConnection);
router.get("/invitations/sent", authenticate, getSentInvitations);
router.delete(
  "/invitations/sent/:invitationId",
  authenticate,
  cancelSentInvitation,
);
router.get("/invitations/received", authenticate, getReceivedInvitations);
router.post(
  "/invitations/:invitationId/accept",
  authenticate,
  acceptInvitation,
);
router.post(
  "/invitations/:invitationId/decline",
  authenticate,
  declineInvitation,
);

// Messaging & Inbox Management (Strictly Authenticated)
router.get("/conversations", authenticate, listConversations);
router.post("/conversations/sync", authenticate, syncInbox);
router.get(
  "/conversations/:conversationId/messages",
  authenticate,
  getConversationMessages,
);
router.post("/message", authenticate, sendMessage);
router.post("/messages/rich", authenticate, sendRichMessage);
router.patch(
  "/conversations/:conversationId/read",
  authenticate,
  markConversationRead,
);

// Feed & Post Engagements (Strictly Authenticated)
router.get("/posts", authenticate, getPublishedPosts);
router.post("/posts", authenticate, createPost);
router.delete("/posts/:postId", authenticate, deletePost);
router.post("/react", authenticate, reactToPost);
router.post("/comment", authenticate, commentOnPost);

// Companies & Lead Extraction (Strictly Authenticated)
router.get("/companies/search", authenticate, searchCompanies);
router.get("/companies/:identifier", authenticate, getCompany);

// Recruiting & Jobs (Strictly Authenticated)
router.get("/jobs/search", authenticate, searchJobs);
router.get("/jobs/:jobId", authenticate, getJob);

// Public Unipile Webhook Handler
router.post("/webhook", handleWebhook);

export default router;
