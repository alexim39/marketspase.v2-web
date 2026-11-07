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

export interface OraUsage {
  dateKey: string;
  limit: number;
  used: number;
  remaining: number;
  resetsAt: string;
}

export type OraUsageEnvelope = ApiEnvelope<OraUsage>;

export interface OraPlanItem {
  title: string;
  detail?: string;
  link?: string;
}

export interface OraPlan {
  dateKey: string;
  items: OraPlanItem[];
  source?: string | null;
  savedAt?: string | null;
}

export type OraPlanEnvelope = ApiEnvelope<OraPlan>;

export interface OraAction {
  id?: string | null;
  type?: 'open_page' | 'send_sms' | 'send_email' | 'schedule_followup' | 'advance_stage' | 'save_daily_plan';
  label: string;
  link?: string;
  title?: string;
  summary?: string;
  status?: 'proposed' | 'ready' | 'executing' | 'executed' | 'skipped' | 'failed';
  requiresApproval?: boolean;
  payload?: {
    prospectId?: string;
    body?: string;
    subject?: string;
    followUpDate?: string;
    stage?: string;
    dateKey?: string;
    items?: OraPlanItem[];
    [key: string]: unknown;
  };
  result?: unknown;
  error?: string | null;
}

/** Plan items are optional and always re-validated by the API. */
export const actionPlanItems = (action: OraAction): OraPlanItem[] => {
  const items = action.payload?.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is OraPlanItem => Boolean(item && typeof item === 'object' && item.title))
    .map((item) => ({
      title: String(item.title),
      ...(item.detail ? { detail: String(item.detail) } : {}),
      ...(item.link ? { link: String(item.link) } : {}),
    }));
};

export type OraActionsEnvelope = ApiEnvelope<OraAction[]>;
export type OraActionEnvelope = ApiEnvelope<OraAction>;

export interface OraChatReply {
  conversationId: string;
  reply: string;
  actions: OraAction[];
  usage?: OraUsage;
  degraded?: boolean;
  warning?: string;
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
