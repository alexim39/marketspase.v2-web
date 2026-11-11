import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { ApiEnvelope } from '../../../core/auth/auth.models';

export type WeeklyVideoStatus = 'draft' | 'scheduled' | 'published' | 'archived';

export interface AdminWeeklyVideo {
  id: string;
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  title: string;
  description: string;
  youtubeId: string;
  youtubeUrl?: string;
  thumbnailUrl: string;
  durationSeconds: number;
  status: WeeklyVideoStatus;
  publishAt?: string | null;
  publishedAt?: string | null;
  notifiedAt?: string | null;
  notificationCount?: number;
  notificationFailed?: number;
  notificationCapped?: boolean;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string | null;
}

export interface WeeklyVideoAuthor {
  id: string;
  username: string;
  name: string;
  profileImage: string | null;
  commissionRank?: string;
}

export interface WeeklyParticipant {
  id: string;
  videoId: string;
  partnerId: string;
  watchedSeconds: number;
  lastPositionSeconds: number;
  durationSeconds: number;
  percent: number;
  completed: boolean;
  completedAt: string | null;
  reflectionAt: string | null;
  startedAt: string | null;
  lastHeartbeatAt: string | null;
  heartbeatCount: number;
  author: WeeklyVideoAuthor | null;
}

export interface WeeklyComment {
  id: string;
  videoId: string;
  partnerId: string;
  body: string;
  status: 'visible' | 'hidden';
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: WeeklyVideoAuthor | null;
}

export interface WeeklyVideoStats {
  video: AdminWeeklyVideo;
  stats: {
    started: number;
    completed: number;
    comments: number;
    visibleComments: number;
    completionRate: number;
  };
  participants: WeeklyParticipant[];
  comments: { items: WeeklyComment[]; total: number };
}

export interface WeeklyVideoList {
  items: AdminWeeklyVideo[];
  total: number;
}

export interface CreateWeeklyVideoInput {
  youtubeUrl: string;
  title: string;
  description: string;
  weekStart: string;
  durationSeconds: number;
}

export type UpdateWeeklyVideoInput = Partial<CreateWeeklyVideoInput>;

@Injectable({ providedIn: 'root' })
export class AdminWeeklyVideosService {
  private readonly api = inject(ApiClient);

  list(): Observable<ApiEnvelope<WeeklyVideoList>> {
    return this.api.get<ApiEnvelope<WeeklyVideoList>>('v1/admin/weekly-videos?limit=100');
  }

  create(payload: CreateWeeklyVideoInput): Observable<ApiEnvelope<AdminWeeklyVideo>> {
    return this.api.post<ApiEnvelope<AdminWeeklyVideo>>('v1/admin/weekly-videos', payload);
  }

  update(id: string, payload: UpdateWeeklyVideoInput): Observable<ApiEnvelope<AdminWeeklyVideo>> {
    return this.api.patch<ApiEnvelope<AdminWeeklyVideo>>(`v1/admin/weekly-videos/${id}`, payload);
  }

  publish(id: string, publishAt?: string | null): Observable<ApiEnvelope<{
    video: AdminWeeklyVideo;
    scheduled: boolean;
    repeated: boolean;
    notification?: { delivered?: number; failed?: number; capped?: boolean; total?: number } | null;
  }>> {
    return this.api.post(`v1/admin/weekly-videos/${id}/publish`, publishAt ? { publishAt } : {});
  }

  archive(id: string): Observable<ApiEnvelope<AdminWeeklyVideo>> {
    return this.api.post<ApiEnvelope<AdminWeeklyVideo>>(`v1/admin/weekly-videos/${id}/archive`, {});
  }

  notify(id: string): Observable<ApiEnvelope<{ video: AdminWeeklyVideo; notification: { delivered: number; failed: number; capped: boolean; total: number } }>> {
    return this.api.post(`v1/admin/weekly-videos/${id}/notify`, {});
  }

  stats(id: string): Observable<ApiEnvelope<WeeklyVideoStats>> {
    return this.api.get<ApiEnvelope<WeeklyVideoStats>>(`v1/admin/weekly-videos/${id}/stats`);
  }

  comments(id: string, params: { limit?: number; skip?: number } = {}): Observable<ApiEnvelope<{ items: WeeklyComment[]; total: number }>> {
    const query = new URLSearchParams({
      limit: String(params.limit ?? 100),
      skip: String(params.skip ?? 0),
    });
    return this.api.get<ApiEnvelope<{ items: WeeklyComment[]; total: number }>>(
      `v1/admin/weekly-videos/${id}/comments?${query.toString()}`,
    );
  }

  moderateComment(commentId: string, status: 'visible' | 'hidden'): Observable<ApiEnvelope<WeeklyComment>> {
    return this.api.patch<ApiEnvelope<WeeklyComment>>(
      `v1/admin/weekly-videos/comments/${commentId}`,
      { status },
    );
  }
}
