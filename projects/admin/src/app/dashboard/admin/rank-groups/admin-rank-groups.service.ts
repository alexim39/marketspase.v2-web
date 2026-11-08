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

export interface RankGroupMessage {
  id: string;
  senderId: string;
  senderName?: string | null;
  senderPhoto?: string | null;
  senderRole?: 'admin' | 'member' | null;
  body: string;
  attachments?: Array<{ url: string; mime: string; size: number }>;
  createdAt: string;
  editedAt?: string | null;
}

export interface RankGroupMember {
  id: string;
  name: string;
  username?: string | null;
  photo?: string | null;
  role: 'admin' | 'member';
  muted?: boolean;
  joinedAt?: string | null;
}

export interface RankGroupBan {
  partnerId: string;
  name?: string | null;
  username?: string | null;
  photo?: string | null;
  reason?: string;
  createdAt?: string | null;
}

export interface RankGroupReport {
  id: string;
  reason: string;
  status: string;
  createdAt: string | null;
  message: RankGroupMessage | null;
}

export interface RankGroupDetail {
  rank: RankGroupRank;
  groupId: string;
  name: string;
  description: string;
  joinPolicy: 'open' | 'approval';
  memberCount: number;
  adminCount: number;
  pinnedMessage: RankGroupMessage | null;
  messages: RankGroupMessage[];
  members: RankGroupMember[];
  bans: RankGroupBan[];
  reports: RankGroupReport[];
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

  get(rank: RankGroupRank): Observable<ApiEnvelope<RankGroupDetail>> {
    return this.api.get<ApiEnvelope<RankGroupDetail>>(`v1/admin/rank-groups/${encodeURIComponent(rank)}`);
  }

  send(rank: RankGroupRank, body: string): Observable<ApiEnvelope<RankGroupMessage>> {
    return this.api.post<ApiEnvelope<RankGroupMessage>>(
      `v1/admin/rank-groups/${encodeURIComponent(rank)}/messages`,
      { body },
    );
  }

  removeMessage(rank: RankGroupRank, messageId: string): Observable<ApiEnvelope<{ deleted: boolean }>> {
    return this.api.delete<ApiEnvelope<{ deleted: boolean }>>(
      `v1/admin/rank-groups/${encodeURIComponent(rank)}/messages/${encodeURIComponent(messageId)}`,
    );
  }

  setPinned(rank: RankGroupRank, body: string): Observable<ApiEnvelope<{ messageId: string }>> {
    return this.api.patch<ApiEnvelope<{ messageId: string }>>(
      `v1/admin/rank-groups/${encodeURIComponent(rank)}/pinned`,
      { body },
    );
  }

  ban(rank: RankGroupRank, memberId: string, reason = ''): Observable<ApiEnvelope<{ banned: boolean }>> {
    return this.api.post<ApiEnvelope<{ banned: boolean }>>(
      `v1/admin/rank-groups/${encodeURIComponent(rank)}/members/${encodeURIComponent(memberId)}/ban`,
      { reason },
    );
  }

  unban(rank: RankGroupRank, memberId: string): Observable<ApiEnvelope<{ unbanned: boolean }>> {
    return this.api.post<ApiEnvelope<{ unbanned: boolean }>>(
      `v1/admin/rank-groups/${encodeURIComponent(rank)}/members/${encodeURIComponent(memberId)}/unban`,
      {},
    );
  }

  decideReport(
    rank: RankGroupRank,
    reportId: string,
    decision: 'dismiss' | 'remove',
    banMember = false,
  ): Observable<ApiEnvelope<{ reportId: string; decision: string }>> {
    return this.api.post<ApiEnvelope<{ reportId: string; decision: string }>>(
      `v1/admin/rank-groups/${encodeURIComponent(rank)}/reports/${encodeURIComponent(reportId)}/decision`,
      { decision, banMember },
    );
  }
}
