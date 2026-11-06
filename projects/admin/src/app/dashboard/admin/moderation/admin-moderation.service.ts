import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { ApiEnvelope } from '../../../core/auth/auth.models';

export interface ReportedPost {
  postId: string;
  reports: number;
  latestAt: string | null;
  reasons: string[];
  excerpt: string;
  kind: string | null;
  authorId: string | null;
  authorUsername: string | null;
  postedAt: string | null;
}

export interface ReportedQueueEnvelope extends ApiEnvelope<{ items: ReportedPost[]; total: number; limit: number; skip: number }> {
  data: { items: ReportedPost[]; total: number; limit: number; skip: number };
}

/** Community moderation → `/v1/community/moderation/*` (role-gated server-side). */
@Injectable({ providedIn: 'root' })
export class AdminModerationService {
  private readonly api = inject(ApiClient);

  queue(params: { limit?: number; skip?: number } = {}): Observable<ReportedQueueEnvelope> {
    const query = new URLSearchParams({
      limit: String(params.limit ?? 25),
      skip: String(params.skip ?? 0),
    });
    return this.api.get<ReportedQueueEnvelope>(`v1/community/moderation/queue?${query.toString()}`);
  }

  decide(postId: string, decision: 'remove' | 'dismiss'): Observable<ApiEnvelope<{ decision: string; postId: string }>> {
    return this.api.post<ApiEnvelope<{ decision: string; postId: string }>>(`v1/community/moderation/${postId}`, { decision });
  }
}
