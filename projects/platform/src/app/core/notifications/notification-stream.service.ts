import { DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, filter, map, switchMap, takeUntil, timer } from 'rxjs';
import { SILENT_LOADING_HEADER } from '../loading/progress.interceptor';
import { NotificationService } from './notification.service';
import { StoredNotificationItem } from './notification.models';

/** Background polls never flash the top progress bar. */
const SILENT = new HttpHeaders({ [SILENT_LOADING_HEADER]: '1' });

export interface StreamSnapshot {
  unread: number;
  latest: StoredNotificationItem[];
}

/**
 * Pluggable real-time transport. Polling ships today; point
 * NOTIFICATION_WS_URL at a socket gateway later and the bell, badge
 * and Center pick it up with zero component changes (same snapshot
 * contract — SignalR-style hub messages map to it 1:1).
 */
export interface NotificationTransport {
  readonly snapshot$: Observable<StreamSnapshot>;
  start(): void;
  stop(): void;
}

/** Polling transport — cheap unread-count + top-items pull. */
export class PollingTransport implements NotificationTransport {
  private readonly stop$ = new Subject<void>();
  private readonly started = signal(false);
  readonly snapshot$: Observable<StreamSnapshot>;

  constructor(svc: NotificationService, private readonly intervalMs = 30000) {
    this.snapshot$ = timer(0, this.intervalMs).pipe(
      takeUntil(this.stop$),
      switchMap(() => svc.list({ limit: 10 }, SILENT)),
      map((res) => {
        const stored = res.data?.stored ?? [];
        const derived = res.data?.derived ?? [];
        const unreadStored = stored.filter((s) => !s.read);
        return {
          unread: unreadStored.length + derived.length,
          latest: [...unreadStored, ...derived]
            .sort((a, b) => +new Date(b.at) - +new Date(a.at))
            .slice(0, 5),
        } satisfies StreamSnapshot;
      }),
    );
  }

  start(): void {
    if (this.started()) return;
    this.started.set(true);
  }

  stop(): void {
    this.stop$.next();
  }
}

/** WebSocket transport — activates only when a gateway URL is provided. */
export class WebSocketTransport implements NotificationTransport {
  private readonly stop$ = new Subject<void>();
  private readonly incoming$ = new Subject<StreamSnapshot>();
  private socket: WebSocket | null = null;
  readonly snapshot$: Observable<StreamSnapshot> = this.incoming$.pipe(
    takeUntil(this.stop$),
    filter((s) => typeof s?.unread === 'number'),
  );

  constructor(private readonly url: string) {}

  start(): void {
    if (!this.url || this.socket) return;
    try {
      this.socket = new WebSocket(this.url);
    } catch {
      this.socket = null;
      return;
    }
    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(String(event.data));
        this.incoming$.next({ unread: Number(data.unread ?? 0), latest: data.latest ?? [] });
      } catch { /* malformed frames are ignored */ }
    };
    this.socket.onclose = () => {
      this.socket = null;
      window.setTimeout(() => this.start(), 15000);
    };
  }

  stop(): void {
    this.stop$.next();
    this.socket?.close();
    this.socket = null;
  }
}

/** Provide a gateway URL to switch the stream from polling to sockets. */
export const NOTIFICATION_WS_URL = new InjectionToken<string>('NOTIFICATION_WS_URL', {
  providedIn: 'root',
  factory: () => '',
});

/**
 * Live notification stream — badge count + dropdown latest.
 * Starts on first injection, polls every 30s, degrades silently.
 */
@Injectable({ providedIn: 'root' })
export class NotificationStreamService {
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transport: NotificationTransport;

  readonly unreadCount = signal(0);
  readonly latest = signal<StoredNotificationItem[]>([]);

  constructor() {
    const wsUrl = inject(NOTIFICATION_WS_URL);
    this.transport = wsUrl
      ? new WebSocketTransport(wsUrl)
      : new PollingTransport(this.notifications);
    this.transport.snapshot$
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (snap) => {
          this.unreadCount.set(snap.unread);
          this.latest.set(snap.latest);
        },
        error: () => { /* stream never breaks the shell */ },
      });
    this.transport.start();
  }

  /** Manual refresh (e.g. after bulk actions in the Center). */
  refresh(): void {
    // NOTE: bare takeUntilDestroyed() is illegal here — this runs from click
    // handlers with no injection context (NG0203). The explicit ref is safe.
    this.notifications
      .list({ limit: 10 }, SILENT)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const stored = res.data?.stored ?? [];
          const derived = res.data?.derived ?? [];
          this.unreadCount.set(stored.filter((s) => !s.read).length + derived.length);
          this.latest.set([...stored.filter((s) => !s.read), ...derived]
            .sort((a, b) => +new Date(b.at) - +new Date(a.at))
            .slice(0, 5));
        },
        error: () => { /* ignore */ },
      });
  }
}
