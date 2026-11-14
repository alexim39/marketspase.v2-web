import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';

/**
 * Legacy public lead links were shared as `marketspase.com/lead/<username>`.
 * The lead page lives in the store app, so send the visitor there instead of
 * letting the platform wildcard render Page not found.
 */
@Component({
  selector: 'async-public-lead-redirect',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <section class="redirect-page">
      <mat-icon>open_in_new</mat-icon>
      <h1>Opening your page…</h1>
      <p>Taking you to the MarketSpase public lead page.</p>
    </section>
  `,
  styles: [`
    .redirect-page { min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px; text-align: center; color: var(--ms-text-muted); }
    .redirect-page mat-icon { font-size: 40px; width: 40px; height: 40px; color: var(--ms-primary-strong); }
    .redirect-page h1 { margin: 0; color: var(--ms-text); font-size: 1.25rem; }
    .redirect-page p { margin: 0; }
  `],
})
export class PublicLeadRedirectComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    const username = String(this.route.snapshot.paramMap.get('username') ?? '').trim();
    if (!username || typeof window === 'undefined') return;
    const base = String((environment as { publicSiteUrl?: string }).publicSiteUrl ?? 'https://store.marketspase.com')
      .replace(/\/+$/, '');
    window.location.replace(`${base}/lead/${encodeURIComponent(username)}`);
  }
}
