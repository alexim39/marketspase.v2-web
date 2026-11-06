import { inject, Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { API_BASE_URL } from '../config/api-tokens';
import type { GroupAttachment, GroupMessage, Message } from './message.models';

export interface SocketAck<T = unknown> {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
  message?: T;
}

export interface TypingEvent {
  from: string;
  typing: boolean;
}

export interface GroupTypingEvent extends TypingEvent {
  groupId: string;
}

export interface GroupIncoming {
  message: GroupMessage;
  groupId: string;
}

export interface PresenceEvent {
  userId: string;
  online: boolean;
}

export interface ReadEvent {
  messageId: string;
  readerId: string;
}

/**
 * Live chat transport — socket.io with automatic REST fallback.
 *
 * Connects with the session Bearer token (same fallback the HTTP
 * interceptor uses when third-party cookies are blocked). When the
 * socket is down the UI stays fully usable over REST; `connected`
 * tells views which path sent each message. Never throws into callers
 * on transport failure — sends reject so views can fall back to REST.
 */
@Injectable({ providedIn: 'root' })
export class ChatSocketService {
  private readonly auth = inject(AuthService);
  private readonly baseUrl = inject(API_BASE_URL);

  private socket: Socket | null = null;
  private connecting = false;

  /** True while the live channel is up (else views use REST + polling). */
  readonly connected = signal(false);

  private readonly incoming = new Subject<Message>();
  private readonly groupIncoming = new Subject<GroupIncoming>();
  private readonly reads = new Subject<ReadEvent>();
  private readonly typingEvents = new Subject<TypingEvent>();
  private readonly groupTypingEvents = new Subject<GroupTypingEvent>();
  private readonly presenceEvents = new Subject<PresenceEvent>();
  private readonly reconnects = new Subject<void>();

  readonly message$: Observable<Message> = this.incoming.asObservable();
  /** Group messages arrive on their own stream (never leak into DM threads). */
  readonly groupMessage$: Observable<GroupIncoming> = this.groupIncoming.asObservable();
  readonly read$: Observable<ReadEvent> = this.reads.asObservable();
  readonly typing$: Observable<TypingEvent> = this.typingEvents.asObservable();
  /** Group typing carries the groupId so indicators stay per-room. */
  readonly groupTyping$: Observable<GroupTypingEvent> = this.groupTypingEvents.asObservable();
  readonly presence$: Observable<PresenceEvent> = this.presenceEvents.asObservable();
  readonly reconnected$: Observable<void> = this.reconnects.asObservable();

  /** Idempotent connect — no token means REST-only mode (still fully usable). */
  connect(): void {
    if (this.socket?.connected || this.connecting) return;
    const token = this.auth.token();
    if (!token) return;
    this.connecting = true;
    const socket = io(this.baseUrl, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 15000,
      timeout: 10000,
    });
    this.socket = socket;
    socket.on('connect', () => {
      this.connecting = false;
      this.connected.set(true);
      this.reconnects.next();
    });
    socket.on('disconnect', () => {
      this.connected.set(false);
    });
    socket.on('connect_error', () => {
      this.connecting = false;
      this.connected.set(false);
    });
    socket.on('message:new', (payload: { message?: Message; groupId?: string }) => {
      if (!payload?.message || typeof payload.message !== 'object') return;
      const gid = payload.groupId ?? (payload.message as Partial<GroupMessage>).groupId;
      if (gid) {
        this.groupIncoming.next({ message: payload.message as unknown as GroupMessage, groupId: String(gid) });
        return;
      }
      this.incoming.next(payload.message as Message);
    });
    socket.on('message:read', (payload: ReadEvent) => {
      if (payload?.messageId) this.reads.next(payload);
    });
    socket.on('typing', (payload: TypingEvent & { groupId?: string }) => {
      if (!payload?.from) return;
      if (payload.groupId) {
        this.groupTypingEvents.next({ from: String(payload.from), typing: !!payload.typing, groupId: String(payload.groupId) });
        return;
      }
      this.typingEvents.next(payload);
    });
    socket.on('presence', (payload: PresenceEvent) => {
      if (payload?.userId) this.presenceEvents.next(payload);
    });
  }

  disconnect(): void {
    try {
      this.socket?.disconnect();
    } catch { /* already gone */ }
    this.socket = null;
    this.connected.set(false);
  }

  send(to: string, body: string, clientId: string): Promise<{ message: Message; clientId: string }> {
    const socket = this.socket;
    if (!socket?.connected) return Promise.reject(new Error('offline'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('send timed out')), 12000);
      socket.emit('message:send', { to, body, clientId }, (ack: SocketAck<Message>) => {
        clearTimeout(timer);
        if (ack?.ok && ack.message) {
          resolve({ message: ack.message, clientId: String(ack['clientId'] ?? clientId) });
        } else {
          reject(new Error(ack?.error ?? 'send failed'));
        }
      });
    });
  }

  markRead(messageId: string): void {
    try {
      this.socket?.connected && this.socket.emit('message:read', { messageId });
    } catch { /* REST path already marks reads */ }
  }

  /** Group send over the live channel (membership-checked server-side). */
  sendGroup(groupId: string, body: string, clientId: string, attachments: GroupAttachment[] = []): Promise<{ message: GroupMessage; clientId: string }> {
    const socket = this.socket;
    if (!socket?.connected) return Promise.reject(new Error('offline'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('send timed out')), 12000);
      socket.emit('message:send', { groupId, body, attachments, clientId }, (ack: SocketAck<GroupMessage>) => {
        clearTimeout(timer);
        if (ack?.ok && ack.message) {
          resolve({ message: ack.message, clientId: String(ack['clientId'] ?? clientId) });
        } else {
          reject(new Error(ack?.error ?? 'send failed'));
        }
      });
    });
  }

  /** Join/leave the socket room for a group (server re-checks membership). */
  joinGroupRoom(groupId: string): void {
    try {
      this.socket?.connected && this.socket.emit('group:join', { groupId });
    } catch { /* REST polling still covers the thread */ }
  }

  leaveGroupRoom(groupId: string): void {
    try {
      this.socket?.connected && this.socket.emit('group:leave', { groupId });
    } catch { /* ephemeral — never fail */ }
  }

  groupTyping(groupId: string, on: boolean): void {
    try {
      this.socket?.connected && this.socket.emit(on ? 'typing:start' : 'typing:stop', { groupId });
    } catch { /* ephemeral — never fail */ }
  }

  typing(to: string, on: boolean): void {
    try {
      this.socket?.connected && this.socket.emit(on ? 'typing:start' : 'typing:stop', { to });
    } catch { /* ephemeral — never fail */ }
  }
}
