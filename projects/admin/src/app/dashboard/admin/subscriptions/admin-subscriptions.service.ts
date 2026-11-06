import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { ApiEnvelope } from '../../../core/auth/auth.models';

export interface SubscriptionRow {
  id: string;
  email: string;
  status: string;
  userDevice: string;
  username: string;
  createdAt: string | null;
}

export interface SubscriptionSummary {
  total: number;
  subscribed: number;
  unsubscribed: number;
  new7d: number;
}

export interface SubscriptionList {
  items: SubscriptionRow[];
  total: number;
  summary: SubscriptionSummary;
}

export type SubscriptionListEnvelope = ApiEnvelope<SubscriptionList>;

export interface SubscriptionExport {
  items: SubscriptionRow[];
  total: number;
  capped: boolean;
}

/** Admin email-list desk → `/v1/admin/subscriptions/*` (role-gated server-side). */
@Injectable({ providedIn: 'root' })
export class AdminSubscriptionsService {
  private readonly api = inject(ApiClient);

  list(params: { q?: string; status?: string; limit?: number; skip?: number } = {}): Observable<SubscriptionListEnvelope> {
    const query = new URLSearchParams({
      ...(params.q?.trim() ? { q: params.q.trim() } : {}),
      ...(params.status ? { status: params.status } : {}),
      limit: String(params.limit ?? 25),
      skip: String(params.skip ?? 0),
    });
    return this.api.get<SubscriptionListEnvelope>(`v1/admin/subscriptions?${query.toString()}`);
  }

  setStatus(id: string, status: 'Subscribed' | 'Unsubscribed'): Observable<ApiEnvelope<SubscriptionRow>> {
    return this.api.patch(`v1/admin/subscriptions/${encodeURIComponent(id)}`, { status });
  }

  remove(id: string): Observable<ApiEnvelope<{ id: string }>> {
    return this.api.delete(`v1/admin/subscriptions/${encodeURIComponent(id)}`);
  }

  exportCsv(params: { q?: string; status?: string } = {}): Observable<SubscriptionExport> {
    const query = new URLSearchParams({
      ...(params.q?.trim() ? { q: params.q.trim() } : {}),
      ...(params.status ? { status: params.status } : {}),
    });
    return this.api
      .get<ApiEnvelope<SubscriptionExport>>(`v1/admin/subscriptions/export?${query.toString()}`)
      .pipe(map((res) => res.data as SubscriptionExport));
  }
}
