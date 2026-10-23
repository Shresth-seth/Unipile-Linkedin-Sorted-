import { linkedInPostService } from "../linkedin/post.service.js";
import { actionQueueService } from "../queue/queue.service.js";
import { Post } from "../../types/linkedin.types.js";

export interface WarmupSequenceResult {
  contactId: string;
  reactJobId: string;
  commentJobId: string;
  connectJobId: string;
  postEngaged: Post;
  commentDraft: string;
}

export class EngagementService {
  private genericClichés = [
    "great post",
    "awesome post",
    "thanks for sharing",
    "insightful post",
    "agree 100%",
    "love this",
    "spot on",
    "well said",
  ];

  public async getTargetPostForWarmup(
    targetLinkedinId: string,
  ): Promise<Post | null> {
    const posts = await linkedInPostService.readPosts(targetLinkedinId);
    if (!posts || posts.length === 0) return null;
    return posts[0]!;
  }

  public generateInsightfulComment(post: Post): string {
    const content = post.content.toLowerCase();

    if (
      content.includes("response time") ||
      content.includes("lead") ||
      content.includes("sales")
    ) {
      return "One critical aspect here is that businesses often focus heavily on lead acquisition volume, but response latency is where the real conversion leak happens. Automating initial triage makes a massive difference.";
    }

    if (
      content.includes("real estate") ||
      content.includes("property") ||
      content.includes("broker")
    ) {
      return "Speed-to-lead is everything in modern real estate. Qualifying high-intent buyers in the first 5 minutes while routing tire-kickers away gives brokers a tremendous competitive edge.";
    }

    if (
      content.includes("ai") ||
      content.includes("automation") ||
      content.includes("workflow")
    ) {
      return "The most effective automation workflows don't try to replace human salespeople; they eliminate repetitive manual qualification so closers spend 100% of their time talking to qualified buyers.";
    }

    return `Really interesting perspective on this. Consistency and streamlined follow-ups are usually what separates top-performing outreach from average campaigns.`;
  }

  public validateCommentQuality(commentText: string): {
    isValid: boolean;
    reason?: string;
  } {
    const lower = commentText.toLowerCase().trim();

    for (const cliché of this.genericClichés) {
      if (
        lower === cliché ||
        lower === `${cliché}!` ||
        lower === `${cliché}.`
      ) {
        return {
          isValid: false,
          reason: `Rejected generic robotic comment: "${commentText}". Comments must be contextual and value-driven.`,
        };
      }
    }

    if (commentText.split(" ").length < 8) {
      return {
        isValid: false,
        reason:
          "Comment is too short. Contextual engagement requires at least 8 thoughtful words.",
      };
    }

    return { isValid: true };
  }

  public async orchestrateWarmupSequence(
    userId: string,
    contact: {
      id: string;
      name: string;
      linkedinId: string;
      company?: string | null | undefined;
      designation?: string | null | undefined;
    },
    options: {
      postDelayMinutes?: number;
      commentDelayMinutes?: number;
      connectDelayMinutes?: number;
    } = {},
  ): Promise<WarmupSequenceResult> {
    const post = await this.getTargetPostForWarmup(contact.linkedinId);
    if (!post) {
      throw new Error(
        `No recent posts found for prospect ${contact.name} to engage with.`,
      );
    }

    const commentText = this.generateInsightfulComment(post);
    const qualityCheck = this.validateCommentQuality(commentText);
    if (!qualityCheck.isValid) {
      throw new Error(qualityCheck.reason);
    }

    const reactDelay = options.postDelayMinutes ?? 0;
    const commentDelay = options.commentDelayMinutes ?? 30;
    const connectDelay = options.connectDelayMinutes ?? 60;

    const reactJob = await actionQueueService.enqueue(
      userId,
      "REACT",
      {
        postId: post.id,
        reactionType: "INSIGHTFUL",
      },
      {
        contactId: contact.id,
        delayMinutes: reactDelay,
      },
    );

    const commentJob = await actionQueueService.enqueue(
      userId,
      "COMMENT",
      {
        postId: post.id,
        comment: commentText,
      },
      {
        contactId: contact.id,
        delayMinutes: commentDelay,
      },
    );

    const connectionNote = `Hi ${contact.name.split(" ")[0]}, noticed your recent post on lead response times. Really resonated with our work in real estate automation. Thought it would be great to connect!`;
    const connectJob = await actionQueueService.enqueue(
      userId,
      "CONNECT",
      {
        person: {
          name: contact.name,
          linkedin_id: contact.linkedinId,
          company: contact.company || "",
          designation: contact.designation || "",
        },
        note: connectionNote,
      },
      {
        contactId: contact.id,
        delayMinutes: connectDelay,
      },
    );

    return {
      contactId: contact.id,
      reactJobId: reactJob.id,
      commentJobId: commentJob.id,
      connectJobId: connectJob.id,
      postEngaged: post,
      commentDraft: commentText,
    };
  }
}

export const engagementService = new EngagementService();