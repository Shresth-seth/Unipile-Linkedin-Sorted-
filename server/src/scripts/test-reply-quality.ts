import "./../config/dotenv.config.js";
import { getGeminiChatModelForUser } from "../agent/WORKPILOT-connect-agent.js";
import { linkedInProfileService } from "../services/linkedin/profile.service.js";
import { HumanMessage } from "@langchain/core/messages";

async function test() {
  const userId = "81b7747a-f8c5-4d95-8a26-8a4b4b87f705";
  const userProfileTruth = await linkedInProfileService.getUserProfileGroundTruth(userId);
  console.log("Profile Truth:\n", userProfileTruth);

  const model = await getGeminiChatModelForUser(userId, { temperature: 0.2 });

  const history = [
    { sender: "Vedic", text: "Hi Sejal, I noticed we're connected on LinkedIn — great seeing your work in 1st Runner-Up @Hackatron🏆 | Product Engineer @isoftwarelab | Web developer @KisanOne| CA E-Cell IIT Bombay |NEC FINALIST 25 | FastAPI | Java. I'd love to connect more deeply. Are you open to a quick chat about a quick demo call?" },
    { sender: "Sejal Choudhary", text: "Hi vedic" },
    { sender: "Sejal Choudhary", text: "Yeah sure " }
  ];

  const prompt = `You are the WorkPilot Real-Time LinkedIn Reply Agent.
You are directly speaking and replying ON BEHALF OF THE USER in a live 1-on-1 direct message.

USER'S VERIFIED GROUND TRUTH PROFILE:
${userProfileTruth}

CONTACT INFORMATION:
- Name: Sejal Choudhary
- Headline: 1st Runner-Up @Hackatron🏆 | Product Engineer @isoftwarelab | Web developer @KisanOne| CA E-Cell IIT Bombay |NEC FINALIST 25 | FastAPI | Java

CONVERSATION HISTORY:
${history.map(m => `${m.sender}: "${m.text}"`).join("\n")}

LATEST INCOMING MESSAGE FROM Sejal Choudhary:
"""
Yeah sure 
"""

YOUR TOP OBJECTIVES:
1. LISTEN & UNDERSTAND: Look at the full conversation history. Understand what Sejal is replying "Yeah sure " to! She is agreeing to a quick chat/demo call.
2. TALK LIKE A REAL HUMAN: Sound like Vedic texting on LinkedIn. Warm, direct, casual, peer-to-peer.
3. COMPACT & CRISP: Strictly 1 to 2 sentences. No corporate fluff, no AI buzzwords, no boilerplate.
4. If she agreed to a quick chat/call, suggest a couple of times casually or offer a brief 10-min window.

Respond in JSON:
{
  "understoodWhatTheySaid": "...",
  "suggestedReply": "..."
}`;

  const res = await model.invoke([new HumanMessage(prompt)]);
  console.log("\nRESULT:\n", res.content);
}

test().catch(console.error);
