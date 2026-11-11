import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@marketspase/shared/core/http/api-client.service';
import { ApiEnvelope } from '../auth/auth.models';
import {
  CurrentWeeklyVideo,
  WeeklyVideoComments,
  WeeklyVideoList,
  WeeklyVideoProgress,
  WeeklyVideoReflection,
  WeeklyVideoWatchStart,
} from './weekly-video.models';

/** Weekly video, verified watch progress, reflections and engagement. */
@Injectable({ providedIn: 'root' })
export class WeeklyVideoService {
  private readonly api = inject(ApiClient);

  current(): Observable<ApiEnvelope<CurrentWeeklyVideo>> {
    return this.api.get<ApiEnvelope<CurrentWeeklyVideo>>('v1/weekly-videos/current');
  }

  list(): Observable<ApiEnvelope<WeeklyVideoList>> {
    return this.api.get<ApiEnvelope<WeeklyVideoList>>('v1/weekly-videos?limit=50');
  }

  detail(id: string): Observable<ApiEnvelope<CurrentWeeklyVideo>> {
    return this.api.get<ApiEnvelope<CurrentWeeklyVideo>>(`v1/weekly-videos/${encodeURIComponent(id)}`);
  }

  startWatch(id: string): Observable<ApiEnvelope<WeeklyVideoWatchStart>> {
    return this.api.post<ApiEnvelope<WeeklyVideoWatchStart>>(
      `v1/weekly-videos/${encodeURIComponent(id)}/watch/start`,
      {},
    );
  }

  heartbeat(
    id: string,
    body: {
      sessionId: string;
      positionSeconds: number;
      playing: boolean;
      visible: boolean;
    },
  ): Observable<ApiEnvelope<WeeklyVideoProgress>> {
    return this.api.post<ApiEnvelope<WeeklyVideoProgress>>(
      `v1/weekly-videos/${encodeURIComponent(id)}/watch/heartbeat`,
      body,
    );
  }

  comments(id: string, params: { limit?: number; skip?: number } = {}): Observable<ApiEnvelope<WeeklyVideoComments>> {
    const query = new URLSearchParams({
      limit: String(params.limit ?? 50),
      skip: String(params.skip ?? 0),
    });
    return this.api.get<ApiEnvelope<WeeklyVideoComments>>(
      `v1/weekly-videos/${encodeURIComponent(id)}/comments?${query.toString()}`,
    );
  }

  reflect(id: string, body: string): Observable<ApiEnvelope<{
    comment: WeeklyVideoReflection;
    engagement: CurrentWeeklyVideo['engagement'];
  }>> {
    return this.api.post<ApiEnvelope<{
      comment: WeeklyVideoReflection;
      engagement: CurrentWeeklyVideo['engagement'];
    }>>(`v1/weekly-videos/${encodeURIComponent(id)}/comments`, { body });
  }
}
