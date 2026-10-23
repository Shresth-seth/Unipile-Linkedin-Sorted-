import { db } from "../../db/index.js";
import { systemSettings, users } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { decryptStoredSecret, encryptSecret } from "../../utils/crypto.util.js";

export interface UserGeminiConfig {
  apiKey: string;
  model: string;
  isCustom: boolean;
  maskedKey?: string;
  source: "USER_CUSTOM" | "SYSTEM_DEFAULT";
}

export class GeminiConfigService {
  private cachedApiKey: string | null = null;
  private cachedModel: string | null = null;
  private userConfigCache = new Map<string, { config: UserGeminiConfig; cachedAt: number }>();
  private readonly CACHE_TTL_MS = 60 * 1000; // 1 minute TTL

  public async loadFromDb(): Promise<void> {
    try {
      const rows = await db.select().from(systemSettings);

      for (const row of rows) {
        if (row.key === "gemini_api_key") {
          this.cachedApiKey = decryptStoredSecret(row.value) || null;
          if (row.value && !row.value.startsWith("v2:") && this.cachedApiKey) {
            await db.update(systemSettings).set({ value: encryptSecret(this.cachedApiKey), updatedAt: new Date() })
              .where(eq(systemSettings.key, "gemini_api_key"));
          }
        } else if (row.key === "gemini_model") {
          this.cachedModel = row.value?.trim() || null;
        }
      }
    } catch {
      // In case DB or table is not ready yet
    }
  }

  public getApiKey(): string {
    if (this.cachedApiKey) {
      return this.cachedApiKey;
    }
    return (
      (process.env.GEMINI_API_KEY || "").trim() ||
      (process.env.GOOGLE_API_KEY || "").trim() ||
      ""
    );
  }

  public getModelName(): string {
    if (this.cachedModel) {
      return this.cachedModel;
    }
    return (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
  }

  public getSource(): "DATABASE" | "ENV_VARIABLE" {
    return this.cachedApiKey ? "DATABASE" : "ENV_VARIABLE";
  }

  public setInCache(apiKey?: string, modelName?: string): void {
    if (apiKey !== undefined) {
      this.cachedApiKey = apiKey.trim() || null;
    }
    if (modelName !== undefined) {
      this.cachedModel = modelName.trim() || null;
    }
  }

  public maskKey(key: string): string {
    if (!key || typeof key !== "string") return "";
    const clean = key.trim();
    if (clean.length <= 8) return "••••••••";
    return `${clean.slice(0, 6)}••••${clean.slice(-4)}`;
  }

  /**
   * Retrieves the effective Gemini config for a specific user.
   * If the user has configured their own personal key, it is returned.
   * Otherwise, it gracefully falls back to the system-wide default key.
   */
  public async getUserConfig(userId?: string): Promise<UserGeminiConfig> {
    const systemKey = this.getApiKey();
    const systemModel = this.getModelName();

    if (!userId || userId === "default") {
      return {
        apiKey: systemKey,
        model: systemModel,
        isCustom: false,
        source: "SYSTEM_DEFAULT",
      };
    }

    // Check cache
    const cached = this.userConfigCache.get(userId);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.config;
    }

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      if (isUuid) {
        const [user] = await db
          .select({
            geminiApiKey: users.geminiApiKey,
            geminiModel: users.geminiModel,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (user?.geminiApiKey && user.geminiApiKey.trim()) {
          const customKey = decryptStoredSecret(user.geminiApiKey);
          if (!user.geminiApiKey.startsWith("v2:") && customKey) {
            await db.update(users).set({ geminiApiKey: encryptSecret(customKey), updatedAt: new Date() })
              .where(eq(users.id, userId));
          }
          const customModel = (user.geminiModel || systemModel).trim();
          const config: UserGeminiConfig = {
            apiKey: customKey,
            model: customModel,
            isCustom: true,
            maskedKey: this.maskKey(customKey),
            source: "USER_CUSTOM",
          };
          this.userConfigCache.set(userId, { config, cachedAt: Date.now() });
          return config;
        }
      }
    } catch (err) {
      console.warn(`[gemini-config] Failed to load custom key for user ${userId}:`, err);
    }

    // Fallback to system key
    const fallbackConfig: UserGeminiConfig = {
      apiKey: systemKey,
      model: systemModel,
      isCustom: false,
      source: "SYSTEM_DEFAULT",
    };
    this.userConfigCache.set(userId, { config: fallbackConfig, cachedAt: Date.now() });
    return fallbackConfig;
  }

  /**
   * Synchronously checks in-memory cache for user's key, falling back to system key immediately.
   */
  public getCachedUserApiKey(userId?: string): { apiKey: string; model: string } {
    if (userId && userId !== "default") {
      const cached = this.userConfigCache.get(userId);
      if (cached) {
        return { apiKey: cached.config.apiKey, model: cached.config.model };
      }
    }
    return { apiKey: this.getApiKey(), model: this.getModelName() };
  }

  /**
   * Updates or removes a user's personal Gemini API key and model preference.
   */
  public async setUserConfig(
    userId: string,
    apiKey: string | null,
    modelName?: string | null,
  ): Promise<UserGeminiConfig> {
    const cleanKey = apiKey ? apiKey.trim() : null;
    const cleanModel = modelName ? modelName.trim() : null;

    await db
      .update(users)
      .set({
        geminiApiKey: cleanKey ? encryptSecret(cleanKey) : null,
        geminiModel: cleanModel,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Invalidate / update cache
    this.userConfigCache.delete(userId);
    return this.getUserConfig(userId);
  }

  public async testConnection(apiKeyToTest?: string, modelToTest?: string): Promise<{
    success: boolean;
    message: string;
    model: string;
  }> {
    const key = apiKeyToTest?.trim() || this.getApiKey();
    const model = modelToTest?.trim() || this.getModelName();

    if (!key) {
      throw new Error("No Gemini API key provided or configured in environment/database.");
    }

    const testModel = new ChatGoogleGenerativeAI({
      apiKey: key,
      model: model,
      temperature: 0.1,
    });

    const res = await testModel.invoke([
      new HumanMessage("Say 'ready' in one word to verify connection."),
    ]);

    const content = typeof res.content === "string" ? res.content : JSON.stringify(res.content);

    return {
      success: true,
      message: `Gemini API connection verified successfully (${model}). Response: ${content.trim()}`,
      model,
    };
  }
}

export const geminiConfigService = new GeminiConfigService();
// Eagerly populate cache on boot
geminiConfigService.loadFromDb().catch(() => {});
