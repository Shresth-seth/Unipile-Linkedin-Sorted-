import { FakeListChatModel } from "@langchain/core/utils/testing";

export class MockGeminiConfigService {
  private userConfigs: Map<
    string,
    { apiKey: string | null; model: string | null; isCustom: boolean }
  > = new Map([
    [
      "tenant-a-uuid",
      {
        apiKey: "AIzaSyTenantACustomKey1234567890",
        model: "gemini-1.5-pro",
        isCustom: true,
      },
    ],
    [
      "tenant-b-uuid",
      {
        apiKey: null,
        model: null,
        isCustom: false,
      },
    ],
  ]);

  public systemApiKey = "system-default-gemini-key";
  public systemModel = "gemini-1.5-flash";

  public async getUserConfig(userId?: string) {
    if (!userId || !this.userConfigs.has(userId)) {
      return {
        apiKey: this.systemApiKey,
        model: this.systemModel,
        isCustom: false,
        source: "SYSTEM_DEFAULT",
      };
    }
    const cfg = this.userConfigs.get(userId)!;
    if (cfg.isCustom && cfg.apiKey) {
      return {
        apiKey: cfg.apiKey,
        model: cfg.model || this.systemModel,
        isCustom: true,
        source: "USER_CUSTOM",
      };
    }
    return {
      apiKey: this.systemApiKey,
      model: this.systemModel,
      isCustom: false,
      source: "SYSTEM_DEFAULT",
    };
  }

  public createFakeModel(responses: string[] = ["Mocked AI Response"]) {
    return new FakeListChatModel({ responses });
  }
}

export const mockGeminiConfigService = new MockGeminiConfigService();
