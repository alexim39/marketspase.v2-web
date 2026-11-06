import { ApiEnvelope } from '../../core/auth/auth.models';

export type FeedKind = 'followup' | 'inactive' | 'conversion' | 'release' | 'mention';

export interface FeedItem {
  id: string;
  kind: FeedKind;
  urgency: boolean;
  title: string;
  body: string;
  icon: string;
  tag: string;
  link: string | null;
  at: string;
}

export interface FeedEnvelope extends ApiEnvelope<{ items: FeedItem[]; total: number; unreadCount: number }> {
  data: { items: FeedItem[]; total: number; unreadCount: number };
}

/** Stored (producer-written) notification — N1 center. */
export interface StoredNotificationItem {
  id: string;
  origin: 'stored' | 'derived';
  kind: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  urgency: boolean;
  title: string;
  body: string;
  icon: string;
  tag: string;
  link: string | null;
  at: string;
  read: boolean;
  key?: string | null;
}

export interface NotificationStats {
  days: number;
  totals: {
    sent: number;
    read: number;
    clicked: number;
    email: number;
    sms: number;
    push: number;
    readRate: number;
    clickRate: number;
    engagementRate: number;
  };
  perCategory: Array<{
    category: string;
    sent: number;
    read: number;
    clicked: number;
    channels: { email: number; sms: number; push: number };
    readRate: number;
    clickRate: number;
    engagementRate: number;
  }>;
}

export type StatsEnvelope = ApiEnvelope<NotificationStats>;

export interface PushConfig {
  publicKey: string | null;
  enabled: boolean;
}

export type PushConfigEnvelope = ApiEnvelope<PushConfig>;

export interface CenterListResponse {
  stored: StoredNotificationItem[];
  derived: StoredNotificationItem[];
  hasMore: boolean;
}

export type CenterListEnvelope = ApiEnvelope<CenterListResponse>;

export interface ChannelPreference {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
}

export interface NotificationPreferences {
  channels: Record<string, ChannelPreference>;
  emailDigest: 'immediate' | 'daily' | 'weekly' | 'off';
}

export type PreferencesEnvelope = ApiEnvelope<NotificationPreferences>;

export const CATEGORY_LABELS: Record<string, string> = {
  prospect: 'Prospects',
  goals: 'Goals',
  team: 'Team',
  commission: 'Commissions',
  training: 'Training',
  recognition: 'Recognition',
  system: 'System',
  community: 'Community',
  promotion: 'Promotions',
  progression: 'Progression',
  daily: 'Daily',
  marketing: 'Marketing',
};
