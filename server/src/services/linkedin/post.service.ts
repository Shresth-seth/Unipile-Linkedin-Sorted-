import { unipileClient } from "../unipile/unipile.client.js";
import { Post, Comment, ActionResult } from "../../types/linkedin.types.js";

export class LinkedInPostService {
  /**
   * Reads posts from a target user or company feed.
   */
  public async readPosts(targetUserOrCompany: string): Promise<Post[]> {
    if (!unipileClient.isConfigured()) {
      return [];
    }

    try {
      const res = await unipileClient.request<any>(
        `/api/v1/posts?author_id=${targetUserOrCompany}`,
      );
      const items = res.items || [];
      return items.map((item: any) => ({
        id: item.id,
        author_name: item.author_name || "Author",
        author_id: item.author_id,
        content: item.text || item.content || "",
        like_count: item.likes_count || 0,
        comment_count: item.comments_count || 0,
        created_at: item.created_at || new Date().toISOString(),
      }));
    } catch (err: any) {
      return [];
    }
  }

  /**
   * Reads comments from a specific post.
   */
  public async readComments(postId: string): Promise<Comment[]> {
    if (!unipileClient.isConfigured()) {
      return [];
    }

    try {
      const res = await unipileClient.request<any>(
        `/api/v1/posts/${postId}/comments`,
      );
      const items = res.items || [];
      return items.map((item: any) => ({
        id: item.id,
        post_id: postId,
        author_name: item.author_name || "Commenter",
        author_id: item.author_id,
        text: item.text || "",
        created_at: item.created_at || new Date().toISOString(),
      }));
    } catch (err: any) {
      return [];
    }
  }

  /**
   * Submits a reaction (Like, Celebrate, Support, Insightful) to a post.
   */
  public async reactToPost(
    postId: string,
    reactionType: "LIKE" | "CELEBRATE" | "SUPPORT" | "INSIGHTFUL" = "LIKE",
    accountId?: string,
  ): Promise<ActionResult> {
    if (!unipileClient.isConfigured()) {
      return {
        success: false,
        message: "Unipile is not configured in server/.env",
      };
    }

    try {
      const res = await unipileClient.request(
        `/api/v1/posts/${postId}/reactions`,
        {
          method: "POST",
          body: JSON.stringify({
            reaction: reactionType,
            account_id: accountId,
          }),
        },
      );

      return {
        success: true,
        message: `Reaction ${reactionType} added to post ${postId}`,
        data: res,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to react to post: ${err.message}`,
      };
    }
  }

  /**
   * Posts an insightful comment on a post.
   */
  public async commentOnPost(
    postId: string,
    commentText: string,
    accountId?: string,
  ): Promise<ActionResult> {
    if (!unipileClient.isConfigured()) {
      return {
        success: false,
        message: "Unipile is not configured in server/.env",
      };
    }

    try {
      const res = await unipileClient.request(
        `/api/v1/posts/${postId}/comments`,
        {
          method: "POST",
          body: JSON.stringify({
            text: commentText,
            account_id: accountId,
          }),
        },
      );

      return {
        success: true,
        message: `Comment successfully posted on post ${postId}`,
        data: res,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to post comment: ${err.message}`,
      };
    }
  }

  /**
   * Creates a post on user's feed.
   */
  public async createPost(
    content: string,
    options?: {
      accountId?: string | undefined;
      attachments?: any[] | undefined;
    },
  ): Promise<ActionResult> {
    if (!unipileClient.isConfigured()) {
      return {
        success: false,
        message: "Unipile is not configured in server/.env",
      };
    }

    const activeAccountId = options?.accountId?.trim();
    if (!activeAccountId) {
      return {
        success: false,
        message:
          "No active LinkedIn account connected. Please connect your LinkedIn account to publish posts.",
      };
    }

    try {
      const res = await unipileClient.createPost(
        activeAccountId,
        content,
        options?.attachments,
      );

      return {
        success: true,
        message: "Post published successfully on LinkedIn feed",
        data: res,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to publish post: ${err.message}`,
      };
    }
  }

  /**
   * Deletes a post from user's feed.
   */
  public async deletePost(postId: string): Promise<ActionResult> {
    if (!unipileClient.isConfigured()) {
      return {
        success: false,
        message: "Unipile is not configured in server/.env",
      };
    }

    try {
      const res = await unipileClient.deletePost(postId);
      return {
        success: true,
        message: `Post ${postId} deleted successfully`,
        data: res,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to delete post: ${err.message}`,
      };
    }
  }

  /**
   * Retrieves published posts with live analytics (impressions, reactions, comments, reposts)
   * for the connected LinkedIn user.
   */
  public async getPublishedPosts(
    accountId: string,
    limit = 20,
  ): Promise<any[]> {
    if (!unipileClient.isConfigured() || !accountId) {
      return [];
    }

    try {
      const resolvedAccountId = accountId.trim();
      const acc = await unipileClient.getAccount(resolvedAccountId);
      const providerId = acc?.connection_params?.im?.id;
      if (!providerId) {
        return [];
      }

      const res = await unipileClient.request<any>(
        `/api/v1/users/${encodeURIComponent(providerId)}/posts?account_id=${encodeURIComponent(resolvedAccountId)}&limit=${limit}`
      );

      const items = res?.items || (Array.isArray(res) ? res : []);
      return items.map((item: any) => ({
        id: item.id || item.social_id,
        socialId: item.social_id || item.id,
        text: item.text || "",
        shareUrl: item.share_url || null,
        impressions: item.impressions_counter || 0,
        reactions: item.reaction_counter || 0,
        comments: item.comment_counter || 0,
        reposts: item.repost_counter || 0,
        date: item.date || null,
        createdAt: item.parsed_datetime || item.created_at || new Date().toISOString(),
        attachments: item.attachments || [],
        author: item.author || null,
      }));
    } catch (err: any) {
      console.warn("Failed to get published posts:", err?.message);
      return [];
    }
  }
}

export const linkedInPostService = new LinkedInPostService();
