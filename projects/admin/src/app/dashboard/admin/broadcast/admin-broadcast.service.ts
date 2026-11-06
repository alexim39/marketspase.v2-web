import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { ApiEnvelope } from '../../../core/auth/auth.models';

export interface BroadcastRow {
  id: string;
  title: string;
  body: string;
  link: string | null;
  priority: 'high' | 'medium';
  createdBy: string | null;
  recipientCount: number;
  capped: boolean;
  createdAt: string | null;
  channels?: { inApp: boolean; email: boolean; sms: boolean } | null;
  kind?: 'system' | 'marketing' | null;
  status?: string | null;
  stats?: {
    total: number;
    capped: boolean;
    inApp: { sent: number; failed: number };
    email: { sent: number; failed: number };
    sms: { sent: number; failed: number };
    estimatedSmsSpend: number;
  } | null;
  sendAt?: string | null;
  estimatedSmsSpend?: number | null;
}

export interface CampaignAudience {
  mode: 'all' | 'segment' | 'picked';
  segment?: { role?: string; active?: boolean; excludeSuspended?: boolean; joinedAfter?: string; joinedBefore?: string };
  ids?: string[];
}

export interface CampaignPayload {
  title: string;
  body: string;
  link?: string;
  priority?: 'high' | 'medium';
  subject?: string;
  smsBody?: string;
  channels?: { inApp?: boolean; email?: boolean; sms?: boolean };
  kind?: 'system' | 'marketing';
  audience?: CampaignAudience;
  sendAt?: string;
  confirmSpend?: boolean;
}

export interface AudienceEstimate {
  total: number;
  capped: boolean;
  inApp: number;
  email: number;
  sms: number;
  smsPages: number;
  estimatedSmsSpend: number;
}

export interface BroadcastListEnvelope extends ApiEnvelope<{ items: BroadcastRow[]; total: number; limit: number; skip: number }> {
  data: { items: BroadcastRow[]; total: number; limit: number; skip: number };
}

export interface BroadcastResult {
  id: string;
  delivered: number;
  failed: number;
  capped: boolean;
  total: number;
}

/** Platform broadcast → `/v1/admin/broadcast/*` (role-gated server-side). */
@Injectable({ providedIn: 'root' })
export class AdminBroadcastService {
  private readonly api = inject(ApiClient);

  history(params: { limit?: number; skip?: number; status?: string; kind?: string; q?: string } = {}): Observable<BroadcastListEnvelope> {
    const query = new URLSearchParams({
      limit: String(params.limit ?? 25),
      skip: String(params.skip ?? 0),
    });
    if (params.status) query.set('status', params.status);
    if (params.kind) query.set('kind', params.kind);
    if (params.q?.trim()) query.set('q', params.q.trim());
    return this.api.get<BroadcastListEnvelope>(`v1/admin/broadcast?${query.toString()}`);
  }

  send(payload: { title: string; body: string; link?: string; priority?: 'high' | 'medium' }): Observable<ApiEnvelope<BroadcastResult>> {
    return this.api.post<ApiEnvelope<BroadcastResult>>('v1/admin/broadcast', payload);
  }

  /** Audience + spend preview — zero sends. */
  estimate(payload: CampaignPayload): Observable<ApiEnvelope<AudienceEstimate>> {
    return this.api.post<ApiEnvelope<AudienceEstimate>>('v1/admin/broadcast/campaigns/estimate', payload);
  }

  /** Queue now or schedule — the minute worker fires when due. */
  queueCampaign(payload: CampaignPayload): Observable<ApiEnvelope<{ id: string; status: string; sendAt: string }>> {
    return this.api.post('v1/admin/broadcast/campaigns', payload);
  }

  /** Member lookup for hand-picked audiences (email/username). */
  lookupMember(q: string): Observable<ApiEnvelope<{ exact: unknown | null; matches: unknown[] }>> {
    return this.api.get(`v1/billing/admin/wallet/lookup?q=${encodeURIComponent(q)}`);
  }

  /** Full campaign detail for the history drill-down. */
  campaignDetail(id: string): Observable<ApiEnvelope<Record<string, unknown>>> {
    return this.api.get(`v1/admin/broadcast/campaigns/${encodeURIComponent(id)}`);
  }

  /** Cancel a scheduled campaign before it fires. */
  cancelCampaign(id: string): Observable<ApiEnvelope<unknown>> {
    return this.api.post(`v1/admin/broadcast/campaigns/${encodeURIComponent(id)}/cancel`, {});
  }

  /** Requeue a failed campaign (same row, fresh stats on success). */
  retryCampaign(id: string): Observable<ApiEnvelope<unknown>> {
    return this.api.post(`v1/admin/broadcast/campaigns/${encodeURIComponent(id)}/retry`, {});
  }

  /** Hard delete a record + its fanned-out inbox copies (never unsends mail/SMS). */
  deleteBroadcast(id: string): Observable<ApiEnvelope<unknown>> {
    return this.api.delete(`v1/admin/broadcast/campaigns/${encodeURIComponent(id)}`);
  }
}
