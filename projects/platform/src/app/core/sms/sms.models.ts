import { ApiEnvelope } from '../auth/auth.models';

export interface SmsRecipientItem {
  id: string;
  type: 'prospect' | 'partner';
  name: string;
  username?: string;
  phoneMasked: string;
  eligible: boolean;
  reason: string | null;
  context?: Record<string, unknown>;
}

export interface SmsRecipientsData {
  type: 'prospects' | 'partners';
  items: SmsRecipientItem[];
  walletBalance: number;
  actor: { name: string; storeLink: string; leadPage: string };
}

export interface SmsSuggestion {
  intent: string;
  label: string;
  body: string;
}

export interface SmsSuggestData {
  recipient: { id: string; type: 'prospect' | 'partner'; name: string };
  suggestions: SmsSuggestion[];
}

export interface SmsQuote {
  pages: number;
  recipients: number;
  ineligible: Array<{ type: string; id: string; name: string; reason: string }>;
  cost: number;
  pricePerPage: number;
  walletBalance: number;
  canSend: boolean;
  shortfall: number;
  normalisedBody: string;
  previews: Array<{ name: string; phoneMasked: string; pages?: number; cost?: number; body: string }>;
}

export interface SmsCampaign {
  id: string;
  body: string;
  pages: number;
  pricePerPage: number;
  totalCost: number;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  refundedAmount: number;
  status: 'scheduled' | 'sending' | 'sent' | 'partial' | 'failed' | 'cancelled';
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  error: string | null;
  ineligible?: Array<{ type: string; id: string; name: string; reason: string }>;
}

export interface SmsCampaignDetail extends SmsCampaign {
  recipients: Array<{
    id: string;
    type: 'prospect' | 'partner';
    recipientId: string;
    name: string;
    phoneMasked: string;
    status: string;
    cost: number;
    refundedAmount: number;
    error: string | null;
    sentAt: string | null;
  }>;
}

export interface SmsTemplate {
  id: string;
  name: string;
  body: string;
  system?: boolean;
}

export interface SmsSuppression {
  id: string;
  phone: string;
  maskedPhone: string;
  reason: string;
  createdAt: string;
}

export type SmsRecipientsEnvelope = ApiEnvelope<SmsRecipientsData>;
export type SmsSuggestEnvelope = ApiEnvelope<SmsSuggestData>;
export type SmsQuoteEnvelope = ApiEnvelope<SmsQuote>;
export type SmsCampaignEnvelope = ApiEnvelope<SmsCampaign>;
export type SmsCampaignDetailEnvelope = ApiEnvelope<SmsCampaignDetail>;
export type SmsHistoryEnvelope = ApiEnvelope<{ items: SmsCampaign[]; total: number; limit: number; skip: number }>;
export type SmsTemplatesEnvelope = ApiEnvelope<SmsTemplate[]>;
export type SmsSuppressionsEnvelope = ApiEnvelope<SmsSuppression[]>;
