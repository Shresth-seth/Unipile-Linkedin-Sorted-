import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { generateToken } from "../../utils/jwt.util.js";
import { db } from "../../db/index.js";
import { crmService } from "../../services/crm/crm.service.js";
import { linkedInMessageService } from "../../services/linkedin/message.service.js";
import { linkedInAccountService } from "../../services/linkedin/account.service.js";
import { mockUnipileClient } from "../mocks/unipile.mock.js";

describe("Phase 5: HTTP-Level Route Integration Tests (Express App & Router Mount Pipeline)", () => {
  // Synthetic test actors
  const tenantA = {
    userId: "user-tenant-a-uuid",
    email: "tenanta@example.com",
    role: "USER",
    sessionVersion: 0,
  };
  const tokenTenantA = generateToken(tenantA);

  const tenantB = {
    userId: "user-tenant-b-uuid",
    email: "tenantb@example.com",
    role: "USER",
    sessionVersion: 0,
  };
  const tokenTenantB = generateToken(tenantB);

  const adminUser = {
    userId: "user-admin-uuid",
    email: "admin@example.com",
    role: "ADMIN",
    sessionVersion: 0,
  };
  const tokenAdmin = generateToken(adminUser);

  // In-memory synthetic fixtures
  const mockContacts: Record<string, { id: string; userId: string; firstName: string; status: string; conversationMode: string }> = {
    "contact-tenant-a": {
      id: "contact-tenant-a",
      userId: tenantA.userId,
      firstName: "Alice (Tenant A)",
      status: "LEAD",
      conversationMode: "AI",
    },
    "contact-tenant-b": {
      id: "contact-tenant-b",
      userId: tenantB.userId,
      firstName: "Bob (Tenant B)",
      status: "LEAD",
      conversationMode: "AI",
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockUnipileClient.resetCalls();

    // Reset synthetic contact status and conversation mode
    mockContacts["contact-tenant-a"]!.status = "LEAD";
    mockContacts["contact-tenant-a"]!.conversationMode = "AI";
    mockContacts["contact-tenant-b"]!.status = "LEAD";
    mockContacts["contact-tenant-b"]!.conversationMode = "AI";

    // Setup mock for authentication & admin authorization queries in db.select
    vi.spyOn(db, "select").mockImplementation((_fields?: any) => {
      return {
        from: (_table: any) => {
          return {
            where: (_condition: any) => {
              return {
                limit: async (_num: number) => {
                  // User lookup for authenticate middleware or requireAdmin middleware
                  return [
                    {
                      id: tenantA.userId,
                      userId: tenantA.userId,
                      role: tenantA.role,
                      email: tenantA.email,
                      sessionVersion: 0,
                      emailVerifiedAt: new Date(),
                    },
                    {
                      id: tenantB.userId,
                      userId: tenantB.userId,
                      role: tenantB.role,
                      email: tenantB.email,
                      sessionVersion: 0,
                      emailVerifiedAt: new Date(),
                    },
                    {
                      id: adminUser.userId,
                      userId: adminUser.userId,
                      role: adminUser.role,
                      email: adminUser.email,
                      sessionVersion: 0,
                      emailVerifiedAt: new Date(),
                    },
                  ];
                },
                orderBy: (_order: any) => {
                  return {
                    limit: async (_lim: number) => [],
                  };
                },
              };
            },
          };
        },
      } as any;
    });
  });

  // ==========================================================================
  // 1. UNAUTHENTICATED REQUESTS (Auth Middleware Rejection)
  // ==========================================================================
  describe("Group 1: Unauthenticated Access Rejections", () => {
    it("GET /api/dashboard/contacts without token returns 401 Unauthorized", async () => {
      const res = await request(app).get("/api/dashboard/contacts");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Authentication required. Please log in.");
    });

    it("PATCH /api/dashboard/contacts/contact-123/stage without token returns 401 Unauthorized", async () => {
      const res = await request(app)
        .patch("/api/dashboard/contacts/contact-123/stage")
        .send({ stage: "WON" });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Authentication required. Please log in.");
    });

    it("GET /api/conversations/contact-123/messages without token returns 401 Unauthorized", async () => {
      const res = await request(app).get("/api/conversations/contact-123/messages");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Authentication required. Please log in.");
    });

    it("POST /api/conversations/contact-123/reply without token returns 401 Unauthorized", async () => {
      const res = await request(app)
        .post("/api/conversations/contact-123/reply")
        .send({ text: "Hello" });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Authentication required. Please log in.");
    });

    it("GET /api/linkedin/checkpoint/status/acc-123 without token returns 401 Unauthorized", async () => {
      const res = await request(app).get("/api/linkedin/checkpoint/status/acc-123");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Authentication required. Please log in.");
    });

    it("GET /api/admin/users without token returns 401 Unauthorized", async () => {
      const res = await request(app).get("/api/admin/users");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Authentication required. Please log in.");
    });

    it("GET /api/dashboard/contacts with invalid bearer token returns 401 Unauthorized", async () => {
      const res = await request(app)
        .get("/api/dashboard/contacts")
        .set("Authorization", "Bearer invalid-tampered-token");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid or expired token. Please log in again.");
    });

    it("POST /api/conversations/contact-123/takeover without token returns 401 Unauthorized", async () => {
      const res = await request(app).post("/api/conversations/contact-123/takeover");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Authentication required. Please log in.");
    });

    it("POST /api/linkedin/disconnect without token returns 401 Unauthorized", async () => {
      const res = await request(app).post("/api/linkedin/disconnect");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Authentication required. Please log in.");
    });
  });

  // ==========================================================================
  // 2. REGULAR USER VS ADMIN AUTHORIZATION (Admin Route Mounts)
  // ==========================================================================
  describe("Group 2: Regular User vs. Administrator Role Boundaries", () => {
    it("Regular user requesting GET /api/admin/users returns 403 Forbidden", async () => {
      // Mock db.select to resolve caller as regular USER
      vi.spyOn(db, "select").mockImplementation(() => {
        return {
          from: () => ({
            where: () => ({
              limit: async () => [{ id: tenantB.userId, role: "USER", email: tenantB.email, sessionVersion: 0, emailVerifiedAt: new Date() }],
            }),
          }),
        } as any;
      });

      const res = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${tokenTenantB}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Access forbidden. You do not have administrator privileges.");
      expect(res.body.users).toBeUndefined();
    });

    it("Regular user requesting POST /api/admin/settings/unipile returns 403 Forbidden", async () => {
      vi.spyOn(db, "select").mockImplementation(() => {
        return {
          from: () => ({
            where: () => ({
              limit: async () => [{ id: tenantB.userId, role: "USER", email: tenantB.email, sessionVersion: 0, emailVerifiedAt: new Date() }],
            }),
          }),
        } as any;
      });

      const res = await request(app)
        .post("/api/admin/settings/unipile")
        .set("Authorization", `Bearer ${tokenTenantB}`)
        .send({ unipileDsn: "https://tampered.example", unipileApiKey: "hacked" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("do not have administrator privileges");
    });

    it("Regular user requesting POST /api/admin/daily-agent/run/:userId returns 403 Forbidden", async () => {
      vi.spyOn(db, "select").mockImplementation(() => {
        return {
          from: () => ({
            where: () => ({
              limit: async () => [{ id: tenantB.userId, role: "USER", email: tenantB.email, sessionVersion: 0, emailVerifiedAt: new Date() }],
            }),
          }),
        } as any;
      });

      const res = await request(app)
        .post(`/api/admin/daily-agent/run/${tenantA.userId}`)
        .set("Authorization", `Bearer ${tokenTenantB}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("do not have administrator privileges");
    });

    it("Regular user requesting POST /internal/admin/daily-agent/run/:userId returns 403 Forbidden (duplicate mount)", async () => {
      vi.spyOn(db, "select").mockImplementation(() => {
        return {
          from: () => ({
            where: () => ({
              limit: async () => [{ id: tenantB.userId, role: "USER", email: tenantB.email, sessionVersion: 0, emailVerifiedAt: new Date() }],
            }),
          }),
        } as any;
      });

      const res = await request(app)
        .post(`/internal/admin/daily-agent/run/${tenantA.userId}`)
        .set("Authorization", `Bearer ${tokenTenantB}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("do not have administrator privileges");
    });

    it("Admin user requesting GET /api/admin/users succeeds with 200 OK (positive control)", async () => {
      // Return ADMIN user for requireAdmin middleware check, and mock user roster
      vi.spyOn(db, "select").mockImplementation(() => {
        return {
          from: () => ({
            where: () => {
              const p: any = Promise.resolve([{ count: 0 }]);
              p.limit = async () => [
                {
                  id: adminUser.userId,
                  role: "ADMIN",
                  email: adminUser.email,
                  sessionVersion: 0,
                  emailVerifiedAt: new Date(),
                },
              ];
              return p;
            },
            orderBy: () => ({
              limit: () => ({
                offset: async () => [
                  { id: "u-1", email: "user1@example.com", role: "USER", createdAt: new Date() },
                  { id: "u-2", email: "user2@example.com", role: "USER", createdAt: new Date() },
                ],
              }),
            }),
          }),
        } as any;
      });

      const res = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users).toBeDefined();
    });
  });

  // ==========================================================================
  // 3. CROSS-TENANT IDOR ATTEMPTS ACROSS REAL EXPRESS ROUTES
  // ==========================================================================
  describe("Group 3: Cross-Tenant Isolation across Real Express Routes", () => {
    it("GET /api/dashboard/contacts: Tenant B receives only own contacts; zero bytes Tenant A data", async () => {
      vi.spyOn(db, "select").mockImplementation(() => {
        return {
          from: () => ({
            where: () => ({
              limit: async () => [{ id: tenantB.userId, role: "USER", email: tenantB.email, sessionVersion: 0, emailVerifiedAt: new Date() }],
            }),
          }),
        } as any;
      });

      // crmService returns only Tenant B contacts
      vi.spyOn(crmService, "getContactsByStage").mockImplementation(async (userId: string) => {
        if (userId === tenantB.userId) {
          return [mockContacts["contact-tenant-b"]!] as any;
        }
        return [mockContacts["contact-tenant-a"]!] as any;
      });

      const res = await request(app)
        .get("/api/dashboard/contacts")
        .set("Authorization", `Bearer ${tokenTenantB}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe("contact-tenant-b");
      expect(res.body.data[0].firstName).toBe("Bob (Tenant B)");
      // Zero bytes of Tenant A data
      expect(JSON.stringify(res.body)).not.toContain("Alice");
      expect(JSON.stringify(res.body)).not.toContain("contact-tenant-a");
    });

    it("PATCH /api/dashboard/contacts/:id/stage: Tenant B updating Tenant A contact returns 404 (remediated defect); zero mutation", async () => {
      vi.spyOn(db, "select").mockImplementation(() => {
        return {
          from: () => ({
            where: () => ({
              limit: async () => [{ id: tenantB.userId, role: "USER", email: tenantB.email, sessionVersion: 0, emailVerifiedAt: new Date() }],
            }),
          }),
        } as any;
      });

      // crmService throws "Contact not found" when userId does not match contact owner
      vi.spyOn(crmService, "updateContactStage").mockImplementation(async (userId: string, contactId: string, stage: string) => {
        const contact = mockContacts[contactId];
        if (!contact || contact.userId !== userId) {
          throw new Error(`Contact ${contactId} not found.`);
        }
        contact.status = stage;
        return contact as any;
      });

      const res = await request(app)
        .patch("/api/dashboard/contacts/contact-tenant-a/stage")
        .set("Authorization", `Bearer ${tokenTenantB}`)
        .send({ stage: "WON" });

      // Verifies the remediated HTTP 404 response through the Express route pipeline!
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Contact contact-tenant-a not found.");

      // Asserts zero database mutation occurred: Tenant A contact remains "LEAD"
      expect(mockContacts["contact-tenant-a"]!.status).toBe("LEAD");
    });

    it("GET /api/conversations/:contactId/messages: Tenant B reading Tenant A conversation returns 404; zero messages leaked", async () => {
      // Mock db to authenticate Tenant B, but return empty contact for Tenant A's contactId
      vi.spyOn(db, "select").mockImplementation(() => {
        return {
          from: (_table: any) => ({
            where: (_condition: any) => ({
              limit: async () => {
                // Return user account for auth middleware, but empty for contact check
                return [{ id: tenantB.userId, role: "USER", email: tenantB.email, sessionVersion: 0, emailVerifiedAt: new Date() }];
              },
              orderBy: () => ({
                limit: async () => [],
              }),
            }),
          }),
        } as any;
      });

      // When controller queries contacts with `where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)))`
      // we return empty array to simulate non-owned contact
      let callCount = 0;
      vi.spyOn(db, "select").mockImplementation(() => {
        callCount++;
        return {
          from: () => ({
            where: () => ({
              limit: async () => {
                if (callCount === 1) {
                  // Auth middleware user check
                  return [{ id: tenantB.userId, role: "USER", email: tenantB.email, sessionVersion: 0, emailVerifiedAt: new Date() }];
                }
                // Contact ownership check: return empty (not owned)
                return [];
              },
            }),
          }),
        } as any;
      });

      const res = await request(app)
        .get("/api/conversations/contact-tenant-a/messages")
        .set("Authorization", `Bearer ${tokenTenantB}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Contact not found or access denied.");
      expect(res.body.messages).toBeUndefined();
    });

    it("POST /api/conversations/:contactId/reply: Tenant B replying to Tenant A contact returns 404; Unipile mock not called", async () => {
      let callCount = 0;
      vi.spyOn(db, "select").mockImplementation(() => {
        callCount++;
        return {
          from: () => ({
            where: () => ({
              limit: async () => {
                if (callCount === 1) {
                  return [{ id: tenantB.userId, role: "USER", email: tenantB.email, sessionVersion: 0, emailVerifiedAt: new Date() }];
                }
                return []; // Contact not owned
              },
            }),
          }),
        } as any;
      });

      const messageSpy = vi.spyOn(linkedInMessageService, "sendMessage");

      const res = await request(app)
        .post("/api/conversations/contact-tenant-a/reply")
        .set("Authorization", `Bearer ${tokenTenantB}`)
        .send({ text: "Phishing message attempt from Tenant B" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Contact not found or access denied.");
      // Assert zero side effects
      expect(messageSpy).not.toHaveBeenCalled();
      expect(mockUnipileClient.calls).toHaveLength(0);
    });

    it("GET /api/linkedin/checkpoint/status/:accountId: Tenant B inspecting Tenant A checkpoint returns 404; zero hints leaked", async () => {
      let callCount = 0;
      vi.spyOn(db, "select").mockImplementation(() => {
        callCount++;
        return {
          from: () => ({
            where: () => ({
              limit: async () => {
                if (callCount === 1) {
                  return [{ id: tenantB.userId, role: "USER", email: tenantB.email, sessionVersion: 0, emailVerifiedAt: new Date() }];
                }
                return []; // Account not owned
              },
            }),
          }),
        } as any;
      });

      const statusSpy = vi.spyOn(linkedInAccountService, "checkCheckpointStatus");

      const res = await request(app)
        .get("/api/linkedin/checkpoint/status/unipile-acc-tenant-a")
        .set("Authorization", `Bearer ${tokenTenantB}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("LinkedIn account not found or access denied.");
      expect(statusSpy).not.toHaveBeenCalled();
      expect(res.body.checkpointType).toBeUndefined();
    });

    it("POST /api/linkedin/checkpoint/solve: Tenant B solving Tenant A checkpoint returns 404; Unipile mock not called", async () => {
      let callCount = 0;
      vi.spyOn(db, "select").mockImplementation(() => {
        callCount++;
        return {
          from: () => ({
            where: () => ({
              limit: async () => {
                if (callCount === 1) {
                  return [{ id: tenantB.userId, role: "USER", email: tenantB.email, sessionVersion: 0, emailVerifiedAt: new Date() }];
                }
                return []; // Account not owned
              },
            }),
          }),
        } as any;
      });

      const solveSpy = vi.spyOn(linkedInAccountService, "solveCheckpoint");

      const res = await request(app)
        .post("/api/linkedin/checkpoint/solve")
        .set("Authorization", `Bearer ${tokenTenantB}`)
        .send({ accountId: "unipile-acc-tenant-a", code: "123456" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("LinkedIn account not found or access denied.");
      expect(solveSpy).not.toHaveBeenCalled();
      expect(mockUnipileClient.calls).toHaveLength(0);
    });

    it("POST /api/conversations/:contactId/takeover: Tenant B attempting takeover on Tenant A contact returns 404; conversationMode is not updated; 0 mutation", async () => {
      vi.spyOn(db, "select").mockImplementation(() => {
        return {
          from: () => ({
            where: () => ({
              limit: async () => [{ id: tenantB.userId, role: "USER", email: tenantB.email, sessionVersion: 0, emailVerifiedAt: new Date() }],
            }),
          }),
        } as any;
      });

      // db.update returns [] when Tenant B attempts to update Tenant A's contact
      vi.spyOn(db, "update").mockImplementation(() => {
        return {
          set: () => ({
            where: () => ({
              returning: async () => [], // Tenant B does not own contact-tenant-a
            }),
          }),
        } as any;
      });

      const res = await request(app)
        .post("/api/conversations/contact-tenant-a/takeover")
        .set("Authorization", `Bearer ${tokenTenantB}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Contact not found or access denied.");
      // Assert zero mutation: Tenant A's contact remains in AI conversationMode
      expect(mockContacts["contact-tenant-a"]!.conversationMode).toBe("AI");
    });

    it("POST /api/linkedin/disconnect: Tenant B disconnecting LinkedIn account disconnects only Tenant B account, never Tenant A account", async () => {
      vi.spyOn(db, "select").mockImplementation(() => {
        return {
          from: () => ({
            where: () => ({
              limit: async () => [{ id: tenantB.userId, role: "USER", email: tenantB.email, sessionVersion: 0, emailVerifiedAt: new Date() }],
            }),
          }),
        } as any;
      });

      const disconnectSpy = vi.spyOn(linkedInAccountService, "disconnect").mockResolvedValue(undefined as any);

      const res = await request(app)
        .post("/api/linkedin/disconnect")
        .set("Authorization", `Bearer ${tokenTenantB}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("disconnected successfully");
      // Explicit assertion: Disconnect called strictly for Tenant B's userId, never Tenant A's
      expect(disconnectSpy).toHaveBeenCalledTimes(1);
      expect(disconnectSpy).toHaveBeenCalledWith(tenantB.userId);
      expect(disconnectSpy).not.toHaveBeenCalledWith(tenantA.userId);
    });
  });

  // ==========================================================================
  // 4. SAME-TENANT POSITIVE CONTROLS ACROSS REAL EXPRESS ROUTES
  // ==========================================================================
  describe("Group 4: Same-Tenant Positive Controls across Real Express Routes", () => {
    it("Tenant A updating own contact stage succeeds with 200 OK and updates state", async () => {
      vi.spyOn(db, "select").mockImplementation(() => {
        return {
          from: () => ({
            where: () => ({
              limit: async () => [{ id: tenantA.userId, role: "USER", email: tenantA.email, sessionVersion: 0, emailVerifiedAt: new Date() }],
            }),
          }),
        } as any;
      });

      vi.spyOn(crmService, "updateContactStage").mockImplementation(async (userId: string, contactId: string, stage: string) => {
        const contact = mockContacts[contactId];
        if (!contact || contact.userId !== userId) {
          throw new Error(`Contact ${contactId} not found.`);
        }
        contact.status = stage;
        return contact as any;
      });

      const res = await request(app)
        .patch("/api/dashboard/contacts/contact-tenant-a/stage")
        .set("Authorization", `Bearer ${tokenTenantA}`)
        .send({ stage: "CONNECTED" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("CONNECTED");
      // State updated in synthetic store
      expect(mockContacts["contact-tenant-a"]!.status).toBe("CONNECTED");
    });

    it("POST /api/conversations/:contactId/takeover: Tenant A taking over own contact succeeds with 200 OK and activates human takeover", async () => {
      vi.spyOn(db, "select").mockImplementation(() => {
        return {
          from: () => ({
            where: () => ({
              limit: async () => [{ id: tenantA.userId, role: "USER", email: tenantA.email, sessionVersion: 0, emailVerifiedAt: new Date() }],
            }),
          }),
        } as any;
      });

      vi.spyOn(db, "update").mockImplementation(() => {
        return {
          set: () => ({
            where: () => ({
              returning: async () => {
                mockContacts["contact-tenant-a"]!.conversationMode = "MANUAL";
                return [mockContacts["contact-tenant-a"]];
              },
            }),
          }),
        } as any;
      });

      const res = await request(app)
        .post("/api/conversations/contact-tenant-a/takeover")
        .set("Authorization", `Bearer ${tokenTenantA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("Human takeover active");
      expect(mockContacts["contact-tenant-a"]!.conversationMode).toBe("MANUAL");
    });

    it("POST /api/conversations/:contactId/reply: Tenant A replying to own contact succeeds with 200 OK and emits provider call", async () => {
      let callCount = 0;
      vi.spyOn(db, "select").mockImplementation(() => {
        callCount++;
        return {
          from: () => ({
            where: () => ({
              limit: async () => {
                if (callCount === 1) {
                  return [{ id: tenantA.userId, role: "USER", email: tenantA.email, sessionVersion: 0, emailVerifiedAt: new Date() }];
                }
                if (callCount === 2) {
                  return [{ id: "contact-tenant-a", userId: tenantA.userId, linkedinId: "li-alice", status: "LEAD" }];
                }
                return [{ id: "acc-1", userId: tenantA.userId, unipileAccountId: "unipile-acc-tenant-a", isConnected: true }];
              },
            }),
          }),
        } as any;
      });

      vi.spyOn(db, "insert").mockImplementation(() => {
        return {
          values: () => ({
            returning: async () => [{ id: "msg-123", content: "Positive reply text" }],
          }),
        } as any;
      });

      vi.spyOn(db, "update").mockImplementation(() => {
        return {
          set: () => ({
            where: async () => [],
          }),
        } as any;
      });

      const messageSpy = vi.spyOn(linkedInMessageService, "sendMessage").mockResolvedValue({
        success: true,
        message: "Message sent",
      } as any);

      const res = await request(app)
        .post("/api/conversations/contact-tenant-a/reply")
        .set("Authorization", `Bearer ${tokenTenantA}`)
        .send({ text: "Positive reply text" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(messageSpy).toHaveBeenCalledTimes(1);
      expect(messageSpy).toHaveBeenCalledWith("li-alice", "Positive reply text", "unipile-acc-tenant-a");
    });

    it("POST /api/linkedin/checkpoint/solve: Tenant A solving checkpoint on own account succeeds with 200 OK", async () => {
      let callCount = 0;
      vi.spyOn(db, "select").mockImplementation(() => {
        callCount++;
        return {
          from: () => ({
            where: () => ({
              limit: async () => {
                if (callCount === 1) {
                  return [{ id: tenantA.userId, role: "USER", email: tenantA.email, sessionVersion: 0, emailVerifiedAt: new Date() }];
                }
                return [{ id: "acc-db-tenant-a", userId: tenantA.userId, unipileAccountId: "unipile-acc-tenant-a" }];
              },
            }),
          }),
        } as any;
      });

      const solveSpy = vi.spyOn(linkedInAccountService, "solveCheckpoint").mockResolvedValue({
        success: true,
        status: "SOLVED",
      } as any);

      const res = await request(app)
        .post("/api/linkedin/checkpoint/solve")
        .set("Authorization", `Bearer ${tokenTenantA}`)
        .send({ accountId: "unipile-acc-tenant-a", code: "654321" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(solveSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // 5. NON-EXISTENT ROUTE CATCH-ALL
  // ==========================================================================
  describe("Group 5: Router Pipeline 404 Catch-All", () => {
    it("Non-existent route returns 404 with custom error message", async () => {
      const res = await request(app).get("/api/nonexistent-route-xyz");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Endpoint not found on this server.");
    });
  });
});
