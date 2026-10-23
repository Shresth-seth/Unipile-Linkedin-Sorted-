export interface IntentAnalysisResult {
  isHotLead: boolean;
  intentType?:
    | "PRICING"
    | "DEMO"
    | "PROPOSAL"
    | "CALL"
    | "TIMELINE"
    | "GENERAL_INTEREST";
  confidence: number;
  reason?: string;
  matchedKeywords: string[];
}

export class IntentDetectionService {
  private buyingSignals = [
    {
      type: "PRICING" as const,
      patterns: [
        "price",
        "pricing",
        "cost",
        "how much",
        "quote",
        "rate",
        "fee",
        "packages",
      ],
    },
    {
      type: "DEMO" as const,
      patterns: [
        "book a demo",
        "see a demo",
        "demo call",
        "product demo",
        "show me how",
        "walkthrough",
      ],
    },
    {
      type: "CALL" as const,
      patterns: [
        "talk tomorrow",
        "quick call",
        "schedule a call",
        "zoom",
        "google meet",
        "calendar",
        "call next week",
      ],
    },
    {
      type: "PROPOSAL" as const,
      patterns: [
        "send a proposal",
        "send proposal",
        "share proposal",
        "pitch deck",
        "scope of work",
      ],
    },
    {
      type: "TIMELINE" as const,
      patterns: [
        "how quickly",
        "implementation time",
        "when can we start",
        "need this for our team",
        "onboard",
      ],
    },
  ];

  public analyzeIntent(messageText: string): IntentAnalysisResult {
    const matched: { type: any; keyword: string }[] = [];

    for (const group of this.buyingSignals) {
      for (const pattern of group.patterns) {
        const regex = new RegExp(`\\b${pattern}\\b`, "i");
        if (regex.test(messageText)) {
          matched.push({ type: group.type, keyword: pattern });
        }
      }
    }

    if (matched.length > 0) {
      const primary = matched[0]!;
      return {
        isHotLead: true,
        intentType: primary.type,
        confidence: 0.95,
        reason: `Detected buying intent (${primary.type}) matching: "${matched.map((m) => m.keyword).join(", ")}"`,
        matchedKeywords: matched.map((m) => m.keyword),
      };
    }

    return {
      isHotLead: false,
      confidence: 0.2,
      matchedKeywords: [],
    };
  }
}

export const intentDetectionService = new IntentDetectionService();