import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';

export interface MediaGalleryItem {
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  alt?: string;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
}

/**
 * Shared product media gallery for the platform and store apps.
 *
 * - Mixed image/video support with video posters.
 * - Thumbnail strip, active state, keyboard arrows and Escape.
 * - Click an image to expand; videos play inline with native controls.
 * - No autoplay-with-sound, no layout shift, lazy thumbnails.
 */
@Component({
  selector: 'async-media-gallery',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    <section class="ms-media-gallery" aria-label="Product media">
      @if (items().length > 0) {
        <div class="stage" [class.stage--video]="active()?.type === 'video'">
          @if (active(); as item) {
            @if (item.type === 'video') {
              <video
                [src]="item.url"
                [poster]="item.thumbnailUrl || ''"
                controls
                playsinline
                preload="metadata"
                [attr.aria-label]="label(item)"
              ></video>
            } @else {
              <button
                type="button"
                class="image-button"
                (click)="openLightbox()"
                [attr.aria-label]="'Expand image: ' + label(item)"
              >
                <img
                  [src]="item.url"
                  [alt]="label(item)"
                  loading="eager"
                  decoding="async"
                  (error)="hideBrokenImage($event)"
                >
              </button>
            }
          }
          @if (items().length > 1) {
            <span class="count" aria-hidden="true">{{ activeIndex() + 1 }} / {{ items().length }}</span>
          }
        </div>

        @if (items().length > 1) {
          <div class="thumbs" role="group" aria-label="Product media thumbnails">
            @for (item of items(); track item.url + '-' + $index; let i = $index) {
              <button
                type="button"
                class="thumb"
                [class.active]="activeIndex() === i"
                [attr.aria-label]="'Show ' + item.type + ' ' + (i + 1)"
                [attr.aria-pressed]="activeIndex() === i"
                (click)="select(i)"
              >
                @if (item.type === 'video' && !item.thumbnailUrl) {
                  <span class="thumb-video-fallback" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="22" height="22">
                      <path d="M8 5v14l11-7z" fill="currentColor"></path>
                    </svg>
                  </span>
                } @else {
                  <img
                    [src]="thumb(item)"
                    [alt]="label(item)"
                    loading="lazy"
                    decoding="async"
                    (error)="hideBrokenImage($event)"
                  >
                }
                @if (item.type === 'video') {
                  <span class="play" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18">
                      <path d="M8 5v14l11-7z" fill="currentColor"></path>
                    </svg>
                  </span>
                }
              </button>
            }
          </div>
        }
      } @else {
        <div class="empty" role="img" aria-label="No product media">
          <span>Product media coming soon</span>
        </div>
      }
    </section>

    @if (lightboxOpen() && active(); as item) {
      <div
        class="lightbox"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="label(item)"
        (click)="closeLightbox()"
      >
        <button type="button" class="lightbox-close" aria-label="Close media viewer" (click)="closeLightbox()">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
          </svg>
        </button>

        @if (items().length > 1) {
          <button type="button" class="lightbox-nav prev" aria-label="Previous media" (click)="previous($event)">
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
            </svg>
          </button>
          <button type="button" class="lightbox-nav next" aria-label="Next media" (click)="next($event)">
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
            </svg>
          </button>
        }

        <div class="lightbox-body" (click)="$event.stopPropagation()">
          @if (item.type === 'video') {
            <video
              [src]="item.url"
              [poster]="item.thumbnailUrl || ''"
              controls
              autoplay
              playsinline
              [attr.aria-label]="label(item)"
            ></video>
          } @else {
            <img [src]="item.url" [alt]="label(item)" (error)="hideBrokenImage($event)">
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .ms-media-gallery { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
    .stage {
      position: relative;
      display: grid;
      place-items: center;
      aspect-ratio: 1 / 1;
      max-height: 640px;
      overflow: hidden;
      border-radius: 18px;
      background: var(--ms-surface-3, #f1f2f4);
      border: 1px solid var(--ms-line, #e4e4e7);
    }
    .image-button { display: grid; place-items: center; width: 100%; height: 100%; border: 0; padding: 0; background: transparent; cursor: zoom-in; }
    .stage img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .stage video { width: 100%; height: 100%; object-fit: contain; background: #000; display: block; }
    .count {
      position: absolute; right: 12px; bottom: 12px;
      padding: 4px 9px; border-radius: 999px;
      background: rgba(0,0,0,0.62); color: #fff;
      font-size: 0.75rem; font-weight: 600; letter-spacing: 0.02em;
    }
    .thumbs { display: flex; gap: 9px; overflow-x: auto; padding: 2px 2px 6px; scrollbar-width: thin; }
    .thumb {
      position: relative; flex: 0 0 74px; width: 74px; height: 74px;
      padding: 0; overflow: hidden; cursor: pointer;
      border-radius: 12px; border: 2px solid transparent;
      background: var(--ms-surface-3, #f1f2f4);
      transition: border-color 120ms ease, transform 120ms ease;
    }
    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .thumb-video-fallback {
      display: grid; place-items: center; width: 100%; height: 100%;
      color: #fff; background: linear-gradient(135deg, #1f2937, #111827);
    }
    .thumb:hover { transform: translateY(-1px); }
    .thumb.active { border-color: var(--ms-primary, #1f7a4d); }
    .thumb:focus-visible { outline: 2px solid var(--ms-primary, #1f7a4d); outline-offset: 2px; }
    .play {
      position: absolute; inset: 0; display: grid; place-items: center;
      color: #fff; background: rgba(0,0,0,0.35);
    }
    .play svg { filter: drop-shadow(0 1px 4px rgba(0,0,0,.45)); }
    .empty {
      display: grid; place-items: center; aspect-ratio: 1 / 1;
      border-radius: 18px; border: 1px dashed var(--ms-line, #d4d4d8);
      background: var(--ms-surface-3, #f1f2f4);
      color: var(--ms-text-muted, #71717a); font-size: 0.9rem;
    }
    .lightbox {
      position: fixed; inset: 0; z-index: 1200;
      display: grid; place-items: center;
      padding: 28px;
      background: rgba(8, 10, 12, 0.92);
      backdrop-filter: blur(4px);
    }
    .lightbox-body { max-width: min(1100px, 92vw); max-height: 88vh; display: grid; place-items: center; }
    .lightbox-body img, .lightbox-body video {
      max-width: 100%; max-height: 88vh; width: auto; height: auto;
      object-fit: contain; border-radius: 10px; background: #000;
      box-shadow: 0 24px 80px rgba(0,0,0,0.45);
    }
    .lightbox-close {
      position: absolute; top: 18px; right: 18px;
      width: 44px; height: 44px; border: 0; border-radius: 999px;
      display: grid; place-items: center; cursor: pointer;
      color: #fff; background: rgba(255,255,255,0.14);
    }
    .lightbox-close:hover { background: rgba(255,255,255,0.24); }
    .lightbox-nav {
      position: absolute; top: 50%; transform: translateY(-50%);
      width: 48px; height: 48px; border: 0; border-radius: 999px;
      display: grid; place-items: center; cursor: pointer;
      color: #fff; background: rgba(255,255,255,0.14);
    }
    .lightbox-nav:hover { background: rgba(255,255,255,0.24); }
    .lightbox-nav.prev { left: 18px; }
    .lightbox-nav.next { right: 18px; }
    @media (max-width: 640px) {
      .stage { aspect-ratio: 1 / 1; border-radius: 14px; }
      .thumb { flex-basis: 62px; width: 62px; height: 62px; }
      .lightbox { padding: 12px; }
      .lightbox-nav.prev { left: 8px; }
      .lightbox-nav.next { right: 8px; }
      .lightbox-close { top: 10px; right: 10px; }
    }
  `],
})
export class MediaGalleryComponent {
  readonly media = input<MediaGalleryItem[]>([]);
  readonly fallback = input<string>('');
  readonly productName = input<string>('Product');

  protected readonly activeIndex = signal(0);
  protected readonly lightboxOpen = signal(false);

  protected readonly items = computed<MediaGalleryItem[]>(() => {
    const source = (this.media() ?? [])
      .filter((item) => item && item.url)
      .map((item) => ({
        type: item.type === 'video' ? 'video' as const : 'image' as const,
        url: String(item.url),
        thumbnailUrl: item.thumbnailUrl ? String(item.thumbnailUrl) : '',
        alt: item.alt ? String(item.alt) : '',
        width: item.width ?? null,
        height: item.height ?? null,
        duration: item.duration ?? null,
      }));
    if (source.length > 0) return source;
    const fallback = String(this.fallback() ?? '').trim();
    return fallback
      ? [{ type: 'image', url: fallback, thumbnailUrl: fallback, alt: '', width: null, height: null, duration: null }]
      : [];
  });

  protected readonly active = computed(() => {
    const items = this.items();
    if (items.length === 0) return null;
    return items[Math.min(Math.max(this.activeIndex(), 0), items.length - 1)] ?? null;
  });

  protected select(index: number): void {
    if (index < 0 || index >= this.items().length) return;
    this.activeIndex.set(index);
  }

  protected thumb(item: MediaGalleryItem): string {
    return item.thumbnailUrl || item.url;
  }

  protected label(item: MediaGalleryItem): string {
    if (item.alt) return item.alt;
    return `${this.productName()} ${item.type === 'video' ? 'video' : 'image'}`.trim();
  }

  protected openLightbox(): void {
    if (this.active()?.type === 'video') return;
    this.lightboxOpen.set(true);
  }

  protected closeLightbox(): void {
    this.lightboxOpen.set(false);
  }

  protected previous(event: Event): void {
    event.stopPropagation();
    const total = this.items().length;
    if (total < 2) return;
    this.activeIndex.set((this.activeIndex() - 1 + total) % total);
  }

  protected next(event: Event): void {
    event.stopPropagation();
    const total = this.items().length;
    if (total < 2) return;
    this.activeIndex.set((this.activeIndex() + 1) % total);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.lightboxOpen()) {
      this.closeLightbox();
      return;
    }
    if (!this.lightboxOpen()) return;
    if (event.key === 'ArrowLeft') this.previous(event);
    if (event.key === 'ArrowRight') this.next(event);
  }

  protected hideBrokenImage(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    if (image) image.style.visibility = 'hidden';
  }
}
