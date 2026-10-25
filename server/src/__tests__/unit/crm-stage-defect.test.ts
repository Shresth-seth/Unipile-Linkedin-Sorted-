import { describe, it, expect, vi } from "vitest";
import { dashboardController } from "../../controllers/dashboard.controller.js";
import { crmService } from "../../services/crm/crm.service.js";
import { NotFoundError } from "../../utils/error.util.js";

describe("CRM Stage Endpoint Authorization & Error Handling Defect Remediation (PATCH /api/dashboard/contacts/:id/stage)", () => {
  it("returns 401 Unauthorized when no user is authenticated", async () => {
    const req: any = {
      params: { id: "contact-123" },
      body: { stage: "REPLIED" },
      user: null,
    };
    let statusCode: number | undefined;
    let jsonBody: any;
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (body: any) => {
        jsonBody = body;
        return res;
      },
    };

    await dashboardController.updateContactStage(req, res);
    expect(statusCode).toBe(401);
    expect(jsonBody.success).toBe(false);
    expect(jsonBody.error).toBe("Authentication required.");
  });

  it("returns 400 Bad Request when contactId or stage is missing", async () => {
    const req: any = {
      params: { id: "" },
      body: {},
      user: { userId: "tenant-b" },
    };
    let statusCode: number | undefined;
    let jsonBody: any;
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (body: any) => {
        jsonBody = body;
        return res;
      },
    };

    await dashboardController.updateContactStage(req, res);
    expect(statusCode).toBe(400);
    expect(jsonBody.success).toBe(false);
    expect(jsonBody.error).toBe("Missing required contactId or stage.");
  });

  it("remediation verified: cross-tenant access returns 404 Not Found (not 500) and halts mutation", async () => {
    const spy = vi
      .spyOn(crmService, "updateContactStage")
      .mockRejectedValueOnce(new Error("Contact contact-tenant-a not found."));

    const req: any = {
      params: { id: "contact-tenant-a" },
      body: { stage: "CONNECTED" },
      user: { userId: "tenant-b-attacker" },
    };
    let statusCode: number | undefined;
    let jsonBody: any;
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (body: any) => {
        jsonBody = body;
        return res;
      },
    };

    await dashboardController.updateContactStage(req, res);

    expect(spy).toHaveBeenCalledWith("tenant-b-attacker", "contact-tenant-a", "CONNECTED");
    // Explicit assertion: Must be HTTP 404, never HTTP 500
    expect(statusCode).toBe(404);
    expect(jsonBody.success).toBe(false);
    expect(jsonBody.error).toBe("Contact contact-tenant-a not found.");

    spy.mockRestore();
  });

  it("positive control: same-tenant update succeeds with 200 OK", async () => {
    const mockUpdatedContact: any = {
      id: "contact-tenant-a",
      userId: "tenant-a-owner",
      status: "CONNECTED",
      updatedAt: new Date(),
    };

    const spy = vi
      .spyOn(crmService, "updateContactStage")
      .mockResolvedValueOnce(mockUpdatedContact);

    const req: any = {
      params: { id: "contact-tenant-a" },
      body: { stage: "CONNECTED" },
      user: { userId: "tenant-a-owner" },
    };
    let statusCode: number | undefined;
    let jsonBody: any;
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (body: any) => {
        jsonBody = body;
        return res;
      },
    };

    await dashboardController.updateContactStage(req, res);

    expect(spy).toHaveBeenCalledWith("tenant-a-owner", "contact-tenant-a", "CONNECTED");
    expect(statusCode).toBe(200);
    expect(jsonBody.success).toBe(true);
    expect(jsonBody.data.status).toBe("CONNECTED");

    spy.mockRestore();
  });

  it("typed NotFoundError from crmService returns HTTP 404 Not Found", async () => {
    const spy = vi
      .spyOn(crmService, "updateContactStage")
      .mockRejectedValueOnce(new NotFoundError("Contact contact-tenant-a not found."));

    const req: any = {
      params: { id: "contact-tenant-a" },
      body: { stage: "CONNECTED" },
      user: { userId: "tenant-b-attacker" },
    };
    let statusCode: number | undefined;
    let jsonBody: any;
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (body: any) => {
        jsonBody = body;
        return res;
      },
    };

    await dashboardController.updateContactStage(req, res);

    expect(statusCode).toBe(404);
    expect(jsonBody.success).toBe(false);
    expect(jsonBody.error).toBe("Contact contact-tenant-a not found.");

    spy.mockRestore();
  });

  it("internal database error containing 'not found' substring returns HTTP 500 (does not mask as 404) and sanitizes error", async () => {
    // Unrelated database error containing "not found" substring, e.g. relation not found or column not found
    const dbError = new Error("PostgresError: relation contacts not found in schema");
    (dbError as any).code = "42P01"; // Postgres code for undefined_table

    const spy = vi
      .spyOn(crmService, "updateContactStage")
      .mockRejectedValueOnce(dbError);

    const req: any = {
      params: { id: "contact-tenant-a" },
      body: { stage: "CONNECTED" },
      user: { userId: "tenant-a-owner" },
    };
    let statusCode: number | undefined;
    let jsonBody: any;
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (body: any) => {
        jsonBody = body;
        return res;
      },
    };

    await dashboardController.updateContactStage(req, res);

    // Must be 500, NOT 404!
    expect(statusCode).toBe(500);
    expect(jsonBody.success).toBe(false);
    // Leaked DB schema name must be sanitized
    expect(jsonBody.error).toBe("A database error occurred. Please try again later.");
    expect(jsonBody.error).not.toContain("contacts not found in schema");

    spy.mockRestore();
  });
});

