import { describe, it, expect } from "vitest";
import http from "node:http";
import https from "node:https";

describe("Phase 3: Fail-Closed Network Boundary Guard", () => {
  it("blocks outbound fetch calls to Unipile API", async () => {
    await expect(
      globalThis.fetch("https://api1.unipile.com:13200/api/v1/users")
    ).rejects.toThrow(/\[NETWORK HAZARD BLOCKED\]/);
  });

  it("blocks outbound fetch calls to Google Gemini API", async () => {
    await expect(
      globalThis.fetch("https://generativelanguage.googleapis.com/v1beta/models")
    ).rejects.toThrow(/\[NETWORK HAZARD BLOCKED\]/);
  });

  it("blocks outbound fetch calls to Razorpay API", async () => {
    await expect(
      globalThis.fetch("https://api.razorpay.com/v1/subscriptions")
    ).rejects.toThrow(/\[NETWORK HAZARD BLOCKED\]/);
  });

  it("blocks outbound fetch calls to Resend API", async () => {
    await expect(
      globalThis.fetch("https://api.resend.com/emails")
    ).rejects.toThrow(/\[NETWORK HAZARD BLOCKED\]/);
  });

  it("blocks outbound node:http.request to external IP/host", () => {
    expect(() => {
      http.request({ hostname: "external-hazard.example.com", port: 80 });
    }).toThrow(/\[NETWORK HAZARD BLOCKED\]/);
  });

  it("blocks outbound node:https.request to external IP/host", () => {
    expect(() => {
      https.request({ hostname: "api.unipile.com", port: 443 });
    }).toThrow(/\[NETWORK HAZARD BLOCKED\]/);
  });
});
