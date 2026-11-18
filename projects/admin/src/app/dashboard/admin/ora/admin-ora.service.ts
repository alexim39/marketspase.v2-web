import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { ApiEnvelope } from '../../../core/auth/auth.models';
import { environment } from '../../../../environments/environment';

export interface AdminOraPartner {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  accountState: 'member' | 'partner';
  activatedAt: string | null;
  profileImage: string | null;
  commissionRank: string;
}

export interface AdminOraMessage {
  role: 'user' | 'assistant';
  content: string;
  at: string | null;
}

export interface AdminOraAction {
  id: string;
  partnerId: string;
  conversationId: string | null;
  type: string;
  title: string;
  label: string;
  summary: string;
  status: string;
  area: string;
  error: string | null;
  createdAt: string | null;
  executedAt: string | null;
  partner: AdminOraPartner | null;
}

export interface AdminOraEvent {
  id: string;
  topic: string;
  messageChars: number;
  replyChars: number;
  latencyMs: number;
  at: string | null;
}

export interface AdminOraPlan {
  id: string;
  dateKey: string;
  items: Array<{ title: string; detail: string; link: string }>;
  source: string;
  updatedAt: string | null;
}

export interface AdminOraModeration {
  flagged: boolean;
  flagReason: string;
  flaggedAt: string | null;
  hidden: boolean;
  hiddenReason: string;
  hiddenAt: string | null;
  notesCount: number;
  notes?: Array<{ note: string; by: string | null; at: string | null }>;
}

export interface AdminOraConversationSummary {
  id: string;
  partnerId: string;
  title: string;
  pinned: boolean;
  messageCount: number;
  lastMessage: { role: 'user' | 'assistant'; content: string; at: string | null } | null;
  createdAt: string | null;
  updatedAt: string | null;
  partner: AdminOraPartner | null;
  moderation: AdminOraModeration;
}

export interface AdminOraConversationDetail extends AdminOraConversationSummary {
  messages: AdminOraMessage[];
}

export interface AdminOraList {
  items: AdminOraConversationSummary[];
  total: number;
  limit: number;
  skip: number;
}

export interface AdminOraDetail {
  conversation: AdminOraConversationDetail;
  actions: AdminOraAction[];
  events: AdminOraEvent[];
  plan: AdminOraPlan | null;
}

export interface AdminOraOverview {
  windowDays: number;
  conversations: number;
  messages: number;
  activeUsers: number;
  flagged: number;
  hidden: number;
  exchanges: number;
  avgLatencyMs: number;
  actions: { proposed: number; executed: number; failed: number; skipped: number };
  topics: Array<{ topic: string; count: number }>;
  daily: Array<{ date: string; count: number }>;
}

export interface AdminOraActions {
  items: AdminOraAction[];
  total: number;
  limit: number;
  skip: number;
}

export type AdminOraListEnvelope = ApiEnvelope<AdminOraList>;
export type AdminOraOverviewEnvelope = ApiEnvelope<AdminOraOverview>;
export type AdminOraDetailEnvelope = ApiEnvelope<AdminOraDetail>;
export type AdminOraActionsEnvelope = ApiEnvelope<AdminOraActions>;
export type AdminOraConversationEnvelope = ApiEnvelope<AdminOraConversationSummary>;

/** Admin-only Ora monitor API (`/v1/admin/ora/*`). */
@Injectable({ providedIn: 'root' })
export class AdminOraService {
  private readonly api = inject(ApiClient);
  private readonly http = inject(HttpClient);

  overview(days = 30): Observable<AdminOraOverviewEnvelope> {
    return this.api.get<AdminOraOverviewEnvelope>(`v1/admin/ora/overview?days=${days}`);
  }

  conversations(params: {
    q?: string;
    partnerId?: string;
    accountState?: 'member' | 'partner';
    flagged?: 'all' | 'yes' | 'no';
    hidden?: 'all' | 'yes' | 'no';
    from?: string;
    to?: string;
    limit?: number;
    skip?: number;
  } = {}): Observable<AdminOraListEnvelope> {
    let http = new HttpParams();
    if (params.q?.trim()) http = http.set('q', params.q.trim());
    if (params.partnerId) http = http.set('partnerId', params.partnerId);
    if (params.accountState) http = http.set('accountState', params.accountState);
    if (params.flagged) http = http.set('flagged', params.flagged);
    if (params.hidden) http = http.set('hidden', params.hidden);
    if (params.from) http = http.set('from', params.from);
    if (params.to) http = http.set('to', params.to);
    http = http.set('limit', String(params.limit ?? 25));
    http = http.set('skip', String(params.skip ?? 0));
    return this.api.get<AdminOraListEnvelope>('v1/admin/ora/conversations', http);
  }

  conversation(id: string): Observable<AdminOraDetailEnvelope> {
    return this.api.get<AdminOraDetailEnvelope>(`v1/admin/ora/conversations/${id}`);
  }

  flag(id: string, flagged: boolean, reason = ''): Observable<AdminOraConversationEnvelope> {
    return this.api.post<AdminOraConversationEnvelope>(`v1/admin/ora/conversations/${id}/flag`, { flagged, reason });
  }

  note(id: string, note: string): Observable<AdminOraConversationEnvelope> {
    return this.api.post<AdminOraConversationEnvelope>(`v1/admin/ora/conversations/${id}/notes`, { note });
  }

  hide(id: string, hidden: boolean, reason = ''): Observable<AdminOraConversationEnvelope> {
    return this.api.post<AdminOraConversationEnvelope>(`v1/admin/ora/conversations/${id}/hide`, { hidden, reason });
  }

  actions(params: { status?: string; partnerId?: string; limit?: number; skip?: number } = {}): Observable<AdminOraActionsEnvelope> {
    let http = new HttpParams();
    if (params.status) http = http.set('status', params.status);
    if (params.partnerId) http = http.set('partnerId', params.partnerId);
    http = http.set('limit', String(params.limit ?? 25));
    http = http.set('skip', String(params.skip ?? 0));
    return this.api.get<AdminOraActionsEnvelope>('v1/admin/ora/actions', http);
  }

  exportCsv(params: {
    q?: string;
    accountState?: 'member' | 'partner';
    flagged?: 'all' | 'yes' | 'no';
    hidden?: 'all' | 'yes' | 'no';
  } = {}): Observable<Blob> {
    let http = new HttpParams();
    if (params.q?.trim()) http = http.set('q', params.q.trim());
    if (params.accountState) http = http.set('accountState', params.accountState);
    if (params.flagged) http = http.set('flagged', params.flagged);
    if (params.hidden) http = http.set('hidden', params.hidden);
    return this.http.get(`${environment.apiUrl}/v1/admin/ora/export`, {
      params: http,
      withCredentials: true,
      responseType: 'blob',
    });
  }
}
