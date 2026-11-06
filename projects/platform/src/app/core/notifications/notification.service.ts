import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpHeaders } from '@angular/common/http';
import { ApiClient } from '../http/api-client.service';
import {
  CenterListEnvelope,
  FeedEnvelope,
  NotificationPreferences,
  PreferencesEnvelope,
  PushConfigEnvelope,
  StatsEnvelope,
  StoredNotificationItem,
} from './notification.models';

/** Unified notification feed → backend `/v1/notifications/*`. Fully typed. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(ApiClient);

  feed(limit = 100): Observable<FeedEnvelope> {
    return this.api.get<FeedEnvelope>(`v1/notifications/mine?limit=${limit}`);
  }

  markRead(ids: string[]): Observable<unknown> {
    return this.api.post('v1/notifications/read', { ids });
  }

  /** N1: unified stored + derived list. */
  list(
    params: { unread?: boolean; q?: string; limit?: number } = {},
    headers?: HttpHeaders,
  ): Observable<CenterListEnvelope> {
    const qs = new URLSearchParams();
    if (params.unread) qs.set('unread', 'true');
    if (params.q?.trim()) qs.set('q', params.q.trim());
    if (params.limit) qs.set('limit', String(params.limit));
    const suffix = qs.size ? `?${qs.toString()}` : '';
    return this.api.get<CenterListEnvelope>(`v1/notifications/list${suffix}`, undefined, headers);
  }

  markStoredRead(id: string): Observable<unknown> {
    return this.api.post(`v1/notifications/${id}/read`, {});
  }

  markStoredUnread(id: string): Observable<unknown> {
    return this.api.post(`v1/notifications/${id}/unread`, {});
  }

  /** Click beacon — records engagement, implies read. */
  recordOpen(id: string): Observable<{ data: StoredNotificationItem }> {
    return this.api.post<{ data: StoredNotificationItem }>(`v1/notifications/${id}/open`, {});
  }

  archiveStored(id: string): Observable<unknown> {
    return this.api.post(`v1/notifications/${id}/archive`, {});
  }

  deleteStored(id: string): Observable<unknown> {
    return this.api.delete(`v1/notifications/${id}`);
  }

  bulk(action: 'read-all' | 'archive-all' | 'delete-all'): Observable<unknown> {
    return this.api.post('v1/notifications/bulk', { action });
  }

  stats(days = 30): Observable<StatsEnvelope> {
    return this.api.get<StatsEnvelope>(`v1/notifications/stats?days=${days}`);
  }

  pushConfig(): Observable<PushConfigEnvelope> {
    return this.api.get<PushConfigEnvelope>('v1/notifications/push/vapid-key');
  }

  subscribePush(subscription: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string }): Observable<unknown> {
    return this.api.post('v1/notifications/push/subscriptions', subscription);
  }

  unsubscribePush(endpoint: string): Observable<unknown> {
    return this.api.post('v1/notifications/push/subscriptions/unsubscribe', { endpoint });
  }

  getPreferences(): Observable<PreferencesEnvelope> {
    return this.api.get<PreferencesEnvelope>('v1/notifications/preferences');
  }

  updatePreferences(prefs: NotificationPreferences): Observable<PreferencesEnvelope> {
    return this.api.put<PreferencesEnvelope>('v1/notifications/preferences', prefs);
  }
}
