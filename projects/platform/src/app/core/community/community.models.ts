import { ApiEnvelope } from '../../core/auth/auth.models';

export type PostKind = 'standard' | 'announcement' | 'recognition' | 'training' | 'event';
export type AudienceScope = 'global' | 'team' | 'leadership';

export const POST_KIND_LABELS: Record<PostKind, string> = {
  standard: 'Post',
  announcement: 'Announcement',
  recognition: 'Recognition',
  training: 'Training',
  event: 'Event',
};

export interface DirectoryLabel {
  username: string;
  name: string;
  profileImage?: string | null;
}

export interface PostAttachment {
  url: string;
  mime: string;
  size: number;
}

export interface AttachmentEnvelope extends ApiEnvelope<PostAttachment> {
  data: PostAttachment;
}

export interface FeedPost {
  id: string;
  authorId: string;
  kind: PostKind;
  title: string;
  body: string;
  link: string;
  scope: AudienceScope;
  pinned: boolean;
  pinnedUntil?: string | null;
  auto: boolean;
  createdAt: string;
  mentions?: string[];
  attachments?: PostAttachment[];
  author: DirectoryLabel | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  saveCount: number;
}

export interface FeedComment {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  parentId: string | null;
  createdAt: string;
  mentions?: string[];
  author: DirectoryLabel | null;
  likeCount: number;
  likedByMe: boolean;
}

export interface DirectoryEntry {
  username: string;
  name: string;
}

export interface DirectoryEnvelope extends ApiEnvelope<DirectoryEntry[]> {
  data: DirectoryEntry[];
}

export interface ToggleEnvelope extends ApiEnvelope<{ liked: boolean; saved?: boolean }> {
  data: { liked: boolean; saved?: boolean };
}

export interface FeedEnvelope extends ApiEnvelope<{ items: FeedPost[]; nextCursor: string | null; viewerLevel: string | null }> {
  data: { items: FeedPost[]; nextCursor: string | null; viewerLevel: string | null };
}

export interface PostEnvelope extends ApiEnvelope<FeedPost> {
  data: FeedPost;
}

export interface CommentsEnvelope extends ApiEnvelope<FeedComment[]> {
  data: FeedComment[];
}

export interface CommentEnvelope extends ApiEnvelope<FeedComment> {
  data: FeedComment;
}

export interface CreatePostPayload {
  kind: PostKind;
  title?: string;
  body: string;
  link?: string;
  scope: AudienceScope;
  attachments?: PostAttachment[];
}

export interface UpdatePostPayload {
  title?: string;
  body?: string;
  link?: string;
}
