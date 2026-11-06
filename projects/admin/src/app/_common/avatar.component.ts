import { Component, ChangeDetectionStrategy, computed, effect, inject, input, signal } from '@angular/core';
import { API_BASE_URL } from '../core/config/api-tokens';
import type { PresenceStatus } from '../core/presence/presence.service';

/**
 * Shared member avatar — photo when present, initial letter otherwise.
 * Resolves both storage generations: absolute URLs (Cloudinary) pass
 * through, legacy bare filenames resolve against `/uploads/`.
 * Optional `presence` paints the online/recent dot (same language as the
 * admin directory pills and the messages/community dots).
 */
@Component({
  selector: 'async-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="avatar-wrap" [class.avatar-wrap--online]="presence() === 'online'" [class.avatar-wrap--recent]="presence() === 'recent'"
      [attr.title]="presenceTitle()" [attr.aria-label]="presenceTitle()">
      @if (url() && !failed()) {
        <img [src]="url()" [alt]="alt()" class="avatar avatar--{{ size() }}" loading="lazy" (error)="failed.set(true)" />
      } @else {
        <span class="avatar avatar--{{ size() }} avatar--fallback" aria-hidden="true">{{ initial() }}</span>
      }
    </span>
  `,
  styles: [`
    .avatar-wrap { position: relative; display: inline-flex; flex: none; border-radius: 50%; }
    .avatar { border-radius: 50%; object-fit: cover; flex: none; background: var(--ms-ink); }
    .avatar--xs { width: 1.6em; height: 1.6em; font-size: 0.85em; }
    .avatar--sm { width: 2.2em; height: 2.2em; font-size: 1em; }
    .avatar--md { width: 3em; height: 3em; font-size: 1.2em; }
    .avatar--lg { width: 3em; height: 3em; font-size: 1.25em; }
    img.avatar { border: 1.5px solid rgba(245,243,255,0.32); }
    .avatar--fallback { display: inline-flex; align-items: center; justify-content: center; font-weight: 800; color: var(--ms-ink-text); border: 1.5px solid rgba(245,243,255,0.32); }
    .avatar-wrap--online::after, .avatar-wrap--recent::after {
      content: ''; position: absolute; right: 0; bottom: 0;
      width: 0.65em; height: 0.65em; border-radius: 50%;
      border: 2px solid var(--ms-surface, #fff);
    }
    .avatar-wrap--online::after { background: #2e7d32; animation: presence-ping 1.8s ease-out infinite; }
    .avatar-wrap--recent::after { background: #d9a406; }
    @keyframes presence-ping {
      0% { box-shadow: 0 0 0 0 rgba(46, 125, 50, 0.55); }
      70% { box-shadow: 0 0 0 7px rgba(46, 125, 50, 0); }
      100% { box-shadow: 0 0 0 0 rgba(46, 125, 50, 0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .avatar-wrap--online::after { animation: none; }
    }
  `],
})
export class AvatarComponent {
  /** Raw stored value: absolute URL (Cloudinary) or legacy bare filename. */
  readonly photo = input<string | null | undefined>(null);
  /** Display name — feeds the initial and the alt text. */
  readonly name = input<string>('');
  readonly size = input<'xs' | 'sm' | 'md' | 'lg'>('sm');
  /** Presence dot — 'online' (green) or 'recent' (amber); null hides it. */
  readonly presence = input<PresenceStatus>(null);

  private readonly baseUrl = inject(API_BASE_URL);
  /** Set when the image 404s (deleted legacy file, dead URL) — fall back to the initial. */
  protected readonly failed = signal(false);

  constructor() {
    // New photo → retry the image instead of sticking on the fallback.
    effect(() => {
      this.photo();
      this.failed.set(false);
    }, { allowSignalWrites: true });
  }

  protected readonly url = computed(() => {
    const raw = String(this.photo() ?? '').trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${this.baseUrl}/uploads/${raw.replace(/^\/+/, '')}`;
  });

  protected readonly initial = computed(() => {
    const name = this.name().trim();
    return name ? name.charAt(0).toUpperCase() : '?';
  });

  protected readonly alt = computed(() => {
    const name = this.name().trim();
    return name ? `${name}'s profile photo` : 'Profile photo';
  });

  protected readonly presenceTitle = computed(() => {
    const p = this.presence();
    if (p === 'online') return 'Online now';
    if (p === 'recent') return 'Active recently';
    return null;
  });
}
