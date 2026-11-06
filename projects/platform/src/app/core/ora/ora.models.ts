import { ApiEnvelope } from '../../core/auth/auth.models';

export interface OraContext {
  displayName: string;
  level: string;
  levelLabel: string;
  next: string | null;
  nextLabel: string | null;
  percent: number;
  greeting: string;
  starters: string[];
}

export type OraContextEnvelope = ApiEnvelope<OraContext>;

export interface OraAction {
  label: string;
  link: string;
}

export interface OraChatReply {
  conversationId: string;
  reply: string;
  actions: OraAction[];
}

export type OraChatEnvelope = ApiEnvelope<OraChatReply>;

export interface OraConversationSummary {
  id: string;
  title: string;
  pinned: boolean;
  updatedAt: string | null;
}

export type OraConversationsEnvelope = ApiEnvelope<{ items: OraConversationSummary[] }>;

export interface OraMessage {
  role: 'user' | 'assistant';
  content: string;
  at: string | null;
}

export interface OraConversation {
  id: string;
  title: string;
  messages: OraMessage[];
}

export type OraConversationEnvelope = ApiEnvelope<OraConversation>;

export interface OraTopicCount {
  topic: string;
  label: string;
  count: number;
}

export interface OraAnalytics {
  days: number;
  questions: number;
  conversations: number;
  activeDays: number;
  perTopic: OraTopicCount[];
}

export type OraAnalyticsEnvelope = ApiEnvelope<OraAnalytics>;
