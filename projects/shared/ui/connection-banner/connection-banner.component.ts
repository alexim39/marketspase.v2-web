import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NetworkStatusService } from '@marketspase/shared/core/ui/network-status.service';

/**
 * Shared connectivity surface for platform, store and admin.
 *
 * Offline keeps cached content visible and names what still works. Slow
 * shows real request completion counts, not a fake spinner, and offers a
 * lighter path. Lite mode can be switched on or off at any time.
 */
@Component({
  selector: 'async-connection-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  host: {
    '[class.net-banner-host--bottom]': "placement() === 'bottom'",
  },
  template: `
    @if (!network.online()) {
      <aside class="net-banner net-banner--offline" role="status" aria-live="polite">
        <mat-icon aria-hidden="true">cloud_off</mat-icon>
        <div class="net-copy">
          <strong>You're offline.</strong>
          <span>Cached pages stay on screen. Reading, browsing and opening saved records still work.</span>
          <small>Paused until you reconnect: sending, payments, wallet changes and live updates.</small>
        </div>
        <div class="net-actions">
          <button type="button" class="net-btn primary" (click)="network.retry()">Retry now</button>
          <button type="button" class="net-btn" (click)="network.enableLiteMode()">Use lite mode</button>
        </div>
      </aside>
    } @else if (network.slow()) {
      <aside class="net-banner net-banner--slow" role="status" aria-live="polite">
        <mat-icon aria-hidden="true">network_check</mat-icon>
        <div class="net-copy">
          <strong>Your connection is slow.</strong>
          <span>
            {{ network.completedRequests() }} of {{ network.totalRequests() }} request{{ network.totalRequests() === 1 ? '' : 's' }} finished.
            We are still working — no need to refresh.
          </span>
          <progress [value]="network.progressPercent()" max="100" aria-label="Requests completed"></progress>
        </div>
        <div class="net-actions">
          <button type="button" class="net-btn primary" (click)="network.enableLiteMode()">Lighter path</button>
          <button type="button" class="net-btn" (click)="network.dismissSlow()">Keep waiting</button>
        </div>
      </aside>
    } @else if (network.cacheUsed()) {
      <aside class="net-banner net-banner--cache" role="status" aria-live="polite">
        <mat-icon aria-hidden="true">history</mat-icon>
        <div class="net-copy">
          <strong>Showing saved content.</strong>
          <span>This page is from the last successful load. New changes may not be reflected yet.</span>
        </div>
        <div class="net-actions">
          <button type="button" class="net-btn primary" (click)="network.retry()">Refresh</button>
          <button type="button" class="net-btn" (click)="network.dismissCacheNotice()">Dismiss</button>
        </div>
      </aside>
    } @else if (network.liteMode()) {
      <aside class="net-banner net-banner--lite" role="status" aria-live="polite">
        <mat-icon aria-hidden="true">bolt</mat-icon>
        <div class="net-copy">
          <strong>Lite mode is on.</strong>
          <span>Animations, heavy decoration and embedded media are reduced.</span>
        </div>
        <div class="net-actions">
          <button type="button" class="net-btn" (click)="network.disableLiteMode()">Turn off</button>
        </div>
      </aside>
    }
  `,
  styles: [`
    .net-banner {
      position: fixed;
      top: 76px;
      left: 50%;
      z-index: 1300;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      width: min(720px, calc(100vw - 2em));
      padding: 12px 14px;
      box-sizing: border-box;
      transform: translateX(-50%);
      border: 1px solid var(--ms-line);
      border-radius: 14px;
      background: var(--ms-surface);
      color: var(--ms-text);
      box-shadow: var(--ms-shadow-md);
      backdrop-filter: blur(14px);
    }
    /* Bottom toast: 12px above the viewport edge on public screens. The
       dashboard sets --ms-connection-banner-bottom so the toast clears the
       mobile bottom navigation instead of covering it. */
    :host(.net-banner-host--bottom) .net-banner {
      top: auto;
      bottom: var(--ms-connection-banner-bottom, calc(env(safe-area-inset-bottom, 0px) + 12px));
    }
    .net-banner > mat-icon { flex: none; margin-top: 2px; font-size: 21px; width: 21px; height: 21px; }
    .net-banner--offline { border-color: color-mix(in srgb, var(--ms-warning) 38%, var(--ms-line)); }
    .net-banner--offline > mat-icon { color: var(--ms-warning); }
    .net-banner--slow { border-color: color-mix(in srgb, var(--ms-info) 38%, var(--ms-line)); }
    .net-banner--slow > mat-icon { color: var(--ms-info); }
    .net-banner--cache > mat-icon { color: var(--ms-primary-strong); }
    .net-banner--lite > mat-icon { color: var(--ms-accent); }
    .net-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: 0.82rem; line-height: 1.45; }
    .net-copy strong { font-size: 0.88rem; }
    .net-copy span { color: var(--ms-text-muted); }
    .net-copy small { color: var(--ms-warning); font-size: 0.74rem; }
    .net-copy progress { width: 100%; height: 6px; margin-top: 5px; accent-color: var(--ms-primary); }
    .net-actions { display: flex; gap: 6px; flex-wrap: wrap; flex: none; }
    .net-btn {
      min-height: 44px;
      padding: 0 12px;
      border: 1px solid var(--ms-line);
      border-radius: 10px;
      background: var(--ms-surface);
      color: var(--ms-text-muted);
      font: inherit;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }
    .net-btn:hover { color: var(--ms-primary-strong); border-color: var(--ms-primary); }
    .net-btn.primary { background: var(--ms-primary-soft); color: var(--ms-primary-strong); border-color: transparent; }
    @media (max-width: 700px) {
      .net-banner { flex-wrap: wrap; }
      .net-actions { width: 100%; }
      .net-btn { flex: 1; }
    }
  `],
})
export class ConnectionBannerComponent {
  /** Host-level placement: defaults to the original top anchor. */
  readonly placement = input<'top' | 'bottom'>('top');

  protected readonly network = inject(NetworkStatusService);
}
