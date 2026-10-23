// Agreed canonical data structures between Raunak and Harsh (Specification Section 36)

export interface Person {
  name: string;
  linkedin_id: string;
  profile_url: string;
  company: string;
  designation: string;
  location: string;
  industry: string;
}

export interface ProfileDetails extends Person {
  headline?: string;
  about?: string;
  follower_count?: number;
  connection_count?: number;
  skills?: string[];
  experience?: Array<{
    title: string;
    company: string;
    duration?: string;
    description?: string;
  }>;
}

export interface Message {
  id?: string;
  conversation: string;
  sender: string;
  receiver: string;
  message: string;
  time: string; // ISO 8601
  isSender?: boolean;
  senderName?: string;
  senderId?: string;
  attachments?: any[];
}

export interface LinkedInAction {
  action: "CONNECT" | "MESSAGE" | "VIEW" | "REACT" | "COMMENT";
  person: string;
  time: string; // ISO 8601
  status: "QUEUED" | "EXECUTING" | "COMPLETED" | "FAILED" | "SKIPPED";
}

export interface PendingRequest {
  id: string;
  recipient_id: string;
  recipient_name: string;
  recipient_title?: string;
  recipient_picture_url?: string;
  recipient_public_id?: string;
  invitation_text?: string | null;
  created_at: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
}

export interface IncomingRequest {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_title?: string;
  sender_picture_url?: string;
  sender_public_id?: string;
  connection_urn?: string;
  created_at: string;
}

export interface Post {
  id: string;
  author_name: string;
  author_id: string;
  content: string;
  like_count: number;
  comment_count: number;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  author_name: string;
  author_id: string;
  text: string;
  created_at: string;
}

export interface SearchFilters {
  query?: string | undefined;
  keywords?: string | undefined;
  role?: string | undefined;
  location?: string | undefined;
  company?: string | undefined;
  industry?: string | undefined;
  limit?: number | undefined;
  url?: string | undefined;
  accountId?: string | undefined;
  cursor?: string | undefined;
  userId?: string | undefined;
  networkDepth?: "F" | "S" | "O" | undefined;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

export interface SearchPeopleResult {
  isLive: boolean;
  source: "LIVE_LINKEDIN" | "PRE_SAVED_PREVIEW";
  notice?: string;
  results: Person[];
}
