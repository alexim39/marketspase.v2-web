import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from './notification.service';

export type PushStatus = 'unknown' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed';

const urlBase64ToUint8Array = (base64: string): Uint8Array<ArrayBuffer> => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
};

/**
 * Browser push subscription manager.
 * Registers the app's push service worker, subscribes with the server's
 * VAPID key, and stores the endpoint via the notifications API. Ready
 * for production the moment VAPID keys land in backend env — until then
 * `enable()` reports "not enabled on the server yet" instead of failing.
 */
@Injectable({ providedIn: 'root' })
export class PushSubscriptionService {
  private readonly notifications = inject(NotificationService);

  readonly status = signal<PushStatus>('unknown');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  get supported(): boolean {
    return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  async refresh(): Promise<void> {
    if (!this.supported) {
      this.status.set('unsupported');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) this.status.set('subscribed');
      else this.status.set(Notification.permission === 'denied' ? 'denied' : 'unsubscribed');
    } catch {
      this.status.set('unknown');
    }
  }

  async enable(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      if (!this.supported) {
        this.status.set('unsupported');
        return;
      }
      const config = await firstValueFrom(this.notifications.pushConfig());
      if (!config.data?.enabled || !config.data.publicKey) {
        this.error.set('Push is not enabled on the server yet — check back soon.');
        return;
      }
      const reg = await navigator.serviceWorker.register('/push-sw.js');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.status.set('denied');
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.data.publicKey),
      });
      const json = sub.toJSON();
      await firstValueFrom(this.notifications.subscribePush({
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.['p256dh'] ?? '', auth: json.keys?.['auth'] ?? '' },
        userAgent: navigator.userAgent,
      }));
      this.status.set('subscribed');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not enable push notifications.');
    } finally {
      this.busy.set(false);
    }
  }

  async disable(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      const endpoint = sub?.endpoint ?? null;
      await sub?.unsubscribe();
      if (endpoint) {
        await firstValueFrom(this.notifications.unsubscribePush(endpoint));
      }
      this.status.set('unsubscribed');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not disable push notifications.');
    } finally {
      this.busy.set(false);
    }
  }
}
