import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api-tokens';

export interface QueuedWrite {
  id: string;
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  body: unknown;
  at: string;
}

const STORAGE_KEY = 'dp-outbox-v1';
const MAX_QUEUED = 50;
/** Header bypassing the outbox interceptor during replay (no re-queue loops). */
export const OUTBOX_BYPASS = 'X-Skip-Outbox';

/** Mutating endpoints safe to queue offline (append/create semantics). */
const QUEUEABLE = [
  { method: 'POST', pattern: /\/v1\/prospects\/[^/]+\/communications$/ },
  { method: 'POST', pattern: /\/v1\/prospects\/?$/ },
  { method: 'POST', pattern: /\/v1\/prospects\/create$/ },
];

export const isQueueableWrite = (method: string, url: string): method is QueuedWrite['method'] =>
  (method === 'POST' || method === 'PUT' || method === 'DELETE')
  && QUEUEABLE.some((q) => q.method === method && q.pattern.test(url.split('?')[0]));

/**
 * Offline outbox — failed mutating calls wait in localStorage and replay
 * in order when connectivity returns. Reads never queue. Replays bypass
 * the interceptor so a failed replay surfaces instead of looping.
 * Trade-off (documented): a touch whose response was lost may replay as a
 * duplicate timeline line — rare, cosmetic, and attributable (timestamped).
 */
@Injectable({ providedIn: 'root' })
export class OutboxService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  readonly online = signal(typeof navigator !== 'undefined' ? navigator.onLine : true);
  readonly queued = signal<QueuedWrite[]>(this.load());
  readonly syncing = signal(false);
  readonly notice = signal<string | null>(null);

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.online.set(true);
        void this.replay();
      });
      window.addEventListener('offline', () => this.online.set(false));
    }
  }

  private load(): QueuedWrite[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const rows = raw ? JSON.parse(raw) : [];
      return Array.isArray(rows) ? rows.filter((r) => r && r.url && r.method) : [];
    } catch {
      return [];
    }
  }

  private persist(rows: QueuedWrite[]): void {
    this.queued.set(rows);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch { /* storage full/blocked — memory copy still drives the banner */ }
  }

  enqueue(entry: Omit<QueuedWrite, 'id' | 'at'>): void {
    const rows = [...this.queued(), {
      ...entry,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
    }].slice(-MAX_QUEUED);
    this.persist(rows);
    this.flash('Saved offline — will sync when you reconnect.');
  }

  /** Replay oldest-first; a failed row stays queued for the next pass. */
  async replay(): Promise<{ sent: number; kept: number }> {
    if (!this.online() || this.syncing() || this.queued().length === 0) {
      return { sent: 0, kept: this.queued().length };
    }
    this.syncing.set(true);
    let sent = 0;
    let rows = [...this.queued()];
    for (const row of [...rows]) {
      try {
        await firstValueFrom(
          this.http.request(row.method, row.url.startsWith('http') ? row.url : `${this.baseUrl}${row.url}`, {
            body: row.body ?? null,
            headers: { [OUTBOX_BYPASS]: '1' },
          }),
        );
        rows = rows.filter((r) => r.id !== row.id);
        this.persist(rows);
        sent += 1;
      } catch {
        break; // still offline or server error — keep the rest for later
      }
    }
    this.syncing.set(false);
    if (sent > 0) this.flash(`Back online — synced ${sent} change${sent === 1 ? '' : 's'}.`);
    return { sent, kept: rows.length };
  }

  /** Transient banner text — auto-clears so it never squats at the top. */
  private flash(message: string): void {
    this.notice.set(message);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        if (this.notice() === message) this.notice.set(null);
      }, 8000);
    }
  }
}
