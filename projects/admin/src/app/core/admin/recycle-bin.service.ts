import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { ApiEnvelope } from '../auth/auth.models';

export type RecycleEntity =
  | 'prospects'
  | 'bookings'
  | 'goals'
  | 'kits'
  | 'tutorials'
  | 'events'
  | 'community-posts'
  | 'teams'
  | 'subscriptions';

export interface RecycleItem {
  id: string;
  entity: RecycleEntity;
  label: string;
  summary: string;
  deletedAt: string | null;
  deletedBy: string | null;
  createdAt: string | null;
}

export interface RecycleEnvelope extends ApiEnvelope<RecycleItem[]> {
  data: RecycleItem[];
  meta?: {
    entity: RecycleEntity;
    total: number;
    limit: number;
    skip: number;
    hasMore: boolean;
    next_action: string | null;
  };
}

@Injectable({ providedIn: 'root' })
export class AdminRecycleBinService {
  private readonly api = inject(ApiClient);

  list(
    entity: RecycleEntity,
    params: { q?: string; limit?: number; skip?: number } = {},
  ): Observable<RecycleEnvelope> {
    const query = new URLSearchParams({
      ...(params.q?.trim() ? { q: params.q.trim() } : {}),
      limit: String(params.limit ?? 25),
      skip: String(params.skip ?? 0),
    });
    return this.api.get<RecycleEnvelope>(`v1/admin/recycle-bin/${entity}?${query.toString()}`);
  }

  restore(entity: RecycleEntity, id: string): Observable<ApiEnvelope<{ restored: boolean }>> {
    return this.api.post<ApiEnvelope<{ restored: boolean }>>(
      `v1/admin/recycle-bin/${entity}/${id}/restore`,
      {},
    );
  }
}
