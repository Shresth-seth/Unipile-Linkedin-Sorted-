"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart3,
  Eye,
  ThumbsUp,
  MessageSquare,
  Share2,
  ExternalLink,
  RefreshCw,
  Loader2,
  Sparkles,
  Send,
  CheckCircle2,
} from "lucide-react";
import { linkedinApi } from "@/lib/api";
import { LinkedInIcon } from "@/components/icons/linkedin-icon";

interface PostItem {
  id: string;
  socialId: string;
  text: string;
  shareUrl?: string | null;
  impressions: number;
  reactions: number;
  comments: number;
  reposts: number;
  date?: string | null;
  createdAt: string;
}

interface LinkedInPostsAnalyticsProps {
  connected: boolean;
}

export const LinkedInPostsAnalytics: React.FC<LinkedInPostsAnalyticsProps> = ({
  connected,
}) => {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newPostText, setNewPostText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [postFeedback, setPostFeedback] = useState<string | null>(null);

  const fetchPosts = async () => {
    if (!connected) return;
    setIsLoading(true);
    try {
      const res = await linkedinApi.getPosts(10);
      if (res.success && Array.isArray(res.data)) {
        setPosts(res.data);
      }
    } catch (err) {
      console.warn("Could not fetch published posts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [connected]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim() || isPosting) return;

    setIsPosting(true);
    setPostFeedback(null);
    try {
      const res = await linkedinApi.createPost({ content: newPostText.trim() });
      if (res.success) {
        setPostFeedback("Post published successfully to LinkedIn feed!");
        setNewPostText("");
        setTimeout(() => fetchPosts(), 1500);
      } else {
        setPostFeedback(res.message || "Failed to publish post.");
      }
    } catch (err: any) {
      setPostFeedback(err?.response?.data?.message || err?.message || "Failed to publish post.");
    } finally {
      setIsPosting(false);
      setTimeout(() => setPostFeedback(null), 5000);
    }
  };

  if (!connected) {
    return null;
  }

  const totalImpressions = posts.reduce((acc, p) => acc + (p.impressions || 0), 0);
  const totalReactions = posts.reduce((acc, p) => acc + (p.reactions || 0), 0);
  const totalComments = posts.reduce((acc, p) => acc + (p.comments || 0), 0);
  const totalReposts = posts.reduce((acc, p) => acc + (p.reposts || 0), 0);

  return (
    <div className="rounded-xl bg-white dark:bg-[#0c0d12]/80 border border-slate-200 dark:border-white/8 p-5 space-y-5 shadow-sm dark:shadow-none backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0A66C2]/15 border border-[#0A66C2]/30 flex items-center justify-center text-[#0A66C2]">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white/95">LinkedIn Post Performance & Real Analytics</h2>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                Live Unipile Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/45">
              Live impressions, reactions, and engagement metrics directly from your LinkedIn profile.
            </p>
          </div>
        </div>

        <button
          onClick={fetchPosts}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white/80 border border-slate-200 dark:border-white/8 transition-all disabled:opacity-50 w-fit cursor-pointer shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-500" : "text-slate-500 dark:text-blue-400"}`} />
          <span>Sync Analytics</span>
        </button>
      </div>

      {/* Analytics Summary Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/2 border border-slate-200/80 dark:border-white/5 space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-white/40">
            <span className="text-[11px] font-medium">Total Impressions</span>
            <Eye className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white/95 tracking-tight font-heading">
            {totalImpressions.toLocaleString()}
          </p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400/80 font-medium flex items-center gap-1">
            Real LinkedIn Views
          </p>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/2 border border-slate-200/80 dark:border-white/5 space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-white/40">
            <span className="text-[11px] font-medium">Reactions / Likes</span>
            <ThumbsUp className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white/95 tracking-tight font-heading">
            {totalReactions.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-white/40">Engagements</p>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/2 border border-slate-200/80 dark:border-white/5 space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-white/40">
            <span className="text-[11px] font-medium">Comments</span>
            <MessageSquare className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white/95 tracking-tight font-heading">
            {totalComments.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-white/40">Responses</p>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/2 border border-slate-200/80 dark:border-white/5 space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-white/40">
            <span className="text-[11px] font-medium">Published Posts</span>
            <LinkedInIcon className="w-3.5 h-3.5 text-[#0A66C2]" />
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white/95 tracking-tight font-heading">
            {posts.length}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-white/40">On Profile</p>
        </div>
      </div>

      {/* Posts List & Quick Composer */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-700 dark:text-white/70 uppercase tracking-wider">
          Recent Posts & Analytics Breakdown
        </h3>

        {isLoading && posts.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-white/40">
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            <span className="text-xs">Fetching live LinkedIn posts & metrics...</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-6 px-4 rounded-lg bg-slate-50 dark:bg-white/2 border border-dashed border-slate-200 dark:border-white/10 text-center space-y-2">
            <p className="text-xs font-medium text-slate-700 dark:text-white/60">No published posts detected yet on your profile.</p>
            <p className="text-[11px] text-slate-500 dark:text-white/40">
              Publish your first post using the quick box below or let the AI Agent draft one for you!
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {posts.map((post) => (
              <div
                key={post.id}
                className="p-3.5 rounded-lg bg-slate-50 hover:bg-slate-100/80 dark:bg-white/2 dark:hover:bg-white/4 border border-slate-200 dark:border-white/6 transition-all space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-slate-800 dark:text-white/85 line-clamp-2 leading-relaxed font-normal">
                    {post.text || "(Media post without text)"}
                  </p>
                  {post.shareUrl && (
                    <a
                      href={post.shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 p-1.5 rounded-md bg-slate-200/70 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 hover:text-slate-900 dark:text-white/60 dark:hover:text-white transition-colors"
                      title="View post on LinkedIn"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-white/5 text-[11px]">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                      <Eye className="w-3 h-3" />
                      <span>{post.impressions} impressions</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-white/60">
                      <ThumbsUp className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                      <span>{post.reactions}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-white/60">
                      <MessageSquare className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                      <span>{post.comments}</span>
                    </span>
                    {post.reposts > 0 && (
                      <span className="flex items-center gap-1.5 text-slate-600 dark:text-white/60">
                        <Share2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>{post.reposts}</span>
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-500 dark:text-white/35">
                    {post.createdAt
                      ? new Date(post.createdAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Recent"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Post Publisher */}
        <form onSubmit={handleCreatePost} className="pt-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newPostText}
              onChange={(e) => setNewPostText(e.target.value)}
              placeholder="Draft and publish a live post to your LinkedIn feed..."
              className="flex-1 bg-white dark:bg-white/3 border border-slate-300 dark:border-white/8 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-blue-500 shadow-xs"
              disabled={isPosting}
            />
            <button
              type="submit"
              disabled={isPosting || !newPostText.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0A66C2] hover:bg-[#095196] text-white text-white-force transition-all disabled:opacity-50 shrink-0 cursor-pointer shadow-sm"
            >
              {isPosting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Publish</span>
            </button>
          </div>
          {postFeedback && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span>{postFeedback}</span>
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default LinkedInPostsAnalytics;
