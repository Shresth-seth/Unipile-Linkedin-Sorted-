import "../config/dotenv.config.js";
import { db, client } from "../db/index.js";
import { users } from "../db/schema.js";
import { linkedInAccountService } from "../services/linkedin/account.service.js";
import { linkedInPeopleService } from "../services/linkedin/people.service.js";
import { linkedInConnectionService } from "../services/linkedin/connection.service.js";
import { linkedInMessageService } from "../services/linkedin/message.service.js";
import { linkedInPostService } from "../services/linkedin/post.service.js";

interface TestReport {
  testNumber: number;
  name: string;
  passed: boolean;
  output?: any;
}

const reports: TestReport[] = [];

const record = (testNumber: number, name: string, passed: boolean, output?: any) => {
  reports.push({ testNumber, name, passed, output });
  const badge = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[${badge}] Test ${testNumber}: ${name}`);
  if (output) {
    console.log("   Details:", typeof output === "string" ? output : JSON.stringify(output, null, 2));
  }
};

const runPhase1TestSuite = async () => {
  console.log("\n==================================================================");
  console.log("🚀 WORKPILOT PHASE 1 VALIDATION GATE: RAUNAK'S 13 LINKEDIN TESTS");
  console.log("==================================================================\n");

  // Fetch or resolve a valid UUID user from database
  let testUserId = "c8655adf-76b8-471c-b21b-0642cff5a830";
  try {
    const [existingUser] = await db.select().from(users).limit(1);
    if (existingUser) {
      testUserId = existingUser.id;
    }
  } catch {
    // fallback to valid RFC4122 UUID
  }
  let samplePerson: any = null;
  let samplePost: any = null;

  try {
    // -----------------------------------------------------------------
    // TEST 1: Connect LinkedIn (Generate Hosted Link)
    // -----------------------------------------------------------------
    const authLink = await linkedInAccountService.generateAuthLink(testUserId);
    record(1, "Connect LinkedIn (Generate Hosted Auth Link)", Boolean(authLink.url), authLink.url);

    // -----------------------------------------------------------------
    // TEST 2: Search someone on LinkedIn
    // -----------------------------------------------------------------
    const searchResults = await linkedInPeopleService.searchPeople({
      role: "Founder",
      location: "Dubai",
      industry: "Real Estate",
      limit: 3,
    });
    samplePerson = searchResults[0];
    record(
      2,
      "Search someone on LinkedIn (Targeting Dubai Real Estate)",
      searchResults.length > 0,
      `Discovered ${searchResults.length} candidates (Lead: ${samplePerson?.name || "None"})`
    );

    // -----------------------------------------------------------------
    // TEST 3: Get their profile details
    // -----------------------------------------------------------------
    const profileDetails = await linkedInPeopleService.getProfileDetails(
      samplePerson ? samplePerson.linkedin_id : "urn:li:fsd_profile:rahul-sharma-123"
    );
    record(
      3,
      "Get profile details",
      Boolean(profileDetails && profileDetails.name),
      `Profile fetched for: ${profileDetails.name} (${profileDetails.designation} at ${profileDetails.company})`
    );

    // -----------------------------------------------------------------
    // TEST 4: Send connection request
    // -----------------------------------------------------------------
    const connectRes = await linkedInConnectionService.sendConnectionRequest(
      samplePerson,
      "Hi Rahul, saw you lead sales at XYZ Realty. Thought it would be great to connect!"
    );
    record(4, "Send connection request with personalized note", connectRes.success, connectRes.message);

    // -----------------------------------------------------------------
    // TEST 5: See incoming connection requests
    // -----------------------------------------------------------------
    const incomingRequests = await linkedInConnectionService.getReceivedRequests();
    record(
      5,
      "See incoming connection requests",
      Array.isArray(incomingRequests),
      `Found ${incomingRequests.length} pending incoming requests`
    );

    // -----------------------------------------------------------------
    // TEST 6: Accept connection request
    // -----------------------------------------------------------------
    const acceptRes = await linkedInConnectionService.acceptConnectionRequest("req_inc_001");
    record(6, "Accept connection request", acceptRes.success, acceptRes.message);

    // -----------------------------------------------------------------
    // TEST 7: Send message to connection
    // -----------------------------------------------------------------
    const sendMsgRes = await linkedInMessageService.sendMessage(
      samplePerson?.linkedin_id || "target_user_123",
      "Hi Rahul, thanks for connecting! Wanted to share our AI qualification workflow for real estate."
    );
    record(7, "Send direct message", sendMsgRes.success, sendMsgRes.message);

    // -----------------------------------------------------------------
    // TEST 8: Receive message
    // -----------------------------------------------------------------
    const receivedMessages = await linkedInMessageService.receiveNewMessage();
    record(
      8,
      "Receive message (Inbound DM sync)",
      receivedMessages.length > 0,
      `Received reply from ${receivedMessages[0]?.sender}: "${receivedMessages[0]?.message}"`
    );

    // -----------------------------------------------------------------
    // TEST 9: Detect accepted connection
    // -----------------------------------------------------------------
    const connectionStatus = await linkedInConnectionService.checkConnectionStatus(
      samplePerson?.linkedin_id || "target_user_123"
    );
    record(
      9,
      "Detect accepted connection status",
      connectionStatus === "CONNECTED",
      `Status verified: ${connectionStatus}`
    );

    // -----------------------------------------------------------------
    // TEST 10: Get a post
    // -----------------------------------------------------------------
    const posts = await linkedInPostService.readPosts(samplePerson?.linkedin_id || "target_user_123");
    samplePost = posts[0];
    record(
      10,
      "Get a post from target feed",
      posts.length > 0,
      `Post id ${samplePost?.id}: "${samplePost?.content.slice(0, 60)}..."`
    );

    // -----------------------------------------------------------------
    // TEST 11: React to post
    // -----------------------------------------------------------------
    const reactRes = await linkedInPostService.reactToPost(samplePost?.id || "post_1001", "INSIGHTFUL");
    record(11, "React to post (INSIGHTFUL)", reactRes.success, reactRes.message);

    // -----------------------------------------------------------------
    // TEST 12: Comment on post
    // -----------------------------------------------------------------
    const commentRes = await linkedInPostService.commentOnPost(
      samplePost?.id || "post_1001",
      "Automating the first qualification layer can make a huge difference without replacing the sales team."
    );
    record(12, "Comment on post with contextual thought", commentRes.success, commentRes.message);

    // -----------------------------------------------------------------
    // TEST 13: Disconnect and reconnect LinkedIn
    // -----------------------------------------------------------------
    const disconnectRes = await linkedInAccountService.disconnect(testUserId);
    const reconnectLink = await linkedInAccountService.generateAuthLink(testUserId);
    record(
      13,
      "Disconnect and reconnect LinkedIn account lifecycle",
      disconnectRes && Boolean(reconnectLink.url),
      "Successfully severed session and generated a clean reconnection URL."
    );

    // -----------------------------------------------------------------
    // SUMMARY
    // -----------------------------------------------------------------
    console.log("\n==================================================================");
    const passedCount = reports.filter((r) => r.passed).length;
    console.log(`🏁 PHASE 1 VALIDATION RESULT: ${passedCount} / 13 TESTS PASSED`);
    if (passedCount === 13) {
      console.log("🎉 SUCCESS! Raunak's Phase 1 Exit Gate is 100% ACHIEVED!");
      console.log("👉 WorkPilot can reliably control LinkedIn across all required action types.");
    } else {
      console.log("⚠️ Some tests failed. Please review details above.");
    }
    console.log("==================================================================\n");
  } catch (err: any) {
    console.error("❌ Fatal runner error:", err);
  } finally {
    await client.end();
  }
};

runPhase1TestSuite();
