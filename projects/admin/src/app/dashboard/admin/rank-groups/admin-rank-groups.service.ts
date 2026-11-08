import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { ApiEnvelope } from '../../../core/auth/auth.models';

export type RankGroupRank = 'Partner' | 'Builder' | 'Leader' | 'Ambassador';

export interface RankGroupRow {
  rank: RankGroupRank;
  groupId: string | null;
  name: string;
  description: string;
  joinPolicy: 'open' | 'approval';
  pinned: boolean;
  memberCount: number;
  adminCount: number;
  ready: boolean;
}

export interface RankGroupSyncResult {
  seed: { ready: boolean; created?: number; total?: number; reason?: string; cached?: boolean };
  sync: { synced: number; skipped: number; reason?: string };
}

/** Official journey-level groups — read state and run repair. */
@Injectable({ providedIn: 'root' })
export class AdminRankGroupsService {
  private readonly api = inject(ApiClient);

  list(): Observable<ApiEnvelope<RankGroupRow[]>> {
    return this.api.get<ApiEnvelope<RankGroupRow[]>>('v1/admin/rank-groups');
  }

  sync(): Observable<ApiEnvelope<RankGroupSyncResult>> {
    return this.api.post<ApiEnvelope<RankGroupSyncResult>>('v1/admin/rank-groups/sync', {});
  }
}
