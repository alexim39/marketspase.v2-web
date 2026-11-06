import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiClient } from '../http/api-client.service';

export type PresenceStatus = 'online' | 'recent' | null;

/** Online ≤5 min, recent ≤60 min — mirrors the admin directory pills. */
export const ONLINE_WINDOW_MIN = 5;
export const RECENT_WINDOW_MIN = 60;

export function statusOf(lastSeenAt: string | null | undefined): PresenceStatus {
  const at = lastSeenAt ? new Date(lastSeenAt).getTime() : NaN;
  if (!Number.isFinite(at)) return null;
  const mins = (Date.now() - at) / 60000;
  if (mins <= ONLINE_WINDOW_MIN) return 'online';
  if (mins <= RECENT_WINDOW_MIN) return 'recent';
  return null;
}

/**
 * Bulk presence — one `POST v1/network/presence` per page, cached 60s.
 * Server scopes ids to self/downline/upline (admins: all); out-of-scope
 * ids resolve null, so the UI simply shows no dot for strangers.
 */
@Injectable({ providedIn: 'root' })
export class PresenceService {
  private readonly api = inject(ApiClient);
  private readonly cache = new Map<string, { at: number; value: string | null }>();
  private static readonly TTL_MS = 60000;

  lookup(ids: Array<string | null | undefined>): Observable<Record<string, string | null>> {
    const clean = [...new Set(
      (ids ?? []).map((v) => String(v ?? '').trim()).filter((v) => /^[a-fA-F0-9]{24}$/.test(v)),
    )];
    if (clean.length === 0) return of({});
    const now = Date.now();
    const fresh: Record<string, string | null> = {};
    const stale = clean.filter((id) => {
      const hit = this.cache.get(id);
      if (hit && now - hit.at < PresenceService.TTL_MS) {
        fresh[id] = hit.value;
        return false;
      }
      return true;
    });
    if (stale.length === 0) return of(fresh);
    return this.api.post<{ data: { presence: Record<string, string | null> } }>('v1/network/presence', { ids: stale }).pipe(
      map((res) => {
        const fetched = res.data?.presence ?? {};
        for (const id of stale) {
          const value = fetched[id] ?? null;
          this.cache.set(id, { at: now, value });
          fresh[id] = value;
        }
        return fresh;
      }),
      catchError(() => of(fresh)),
    );
  }

  statusOf(lastSeenAt: string | null | undefined): PresenceStatus {
    return statusOf(lastSeenAt);
  }

  clear(): void {
    this.cache.clear();
  }
}
