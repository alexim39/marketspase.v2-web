import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';


/**
 * @title About the app — what MarketSpase is and where to go next.
 */
@Component({
selector: 'async-about-app',
template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Me &amp; Settings</a> &gt;
        <span>About</span>
      </div>
    </section>

    <section class="about-page">
      <div class="dp-card hero">
        <p class="eyebrow">About {{ appName }}</p>
        <h1>Your online business, without the chase</h1>
        <p class="lede">
          MarketSpase is a product-backed online business opportunity built for independent partners and online users.
          It gives you the tools to grow your team, manage prospects and customers, track performance and promote your business from anywhere —
          with <strong>Ora</strong> preparing the work and you approving the next move.
        </p>
      </div>

      <div class="dp-card card">
        <h2>Community-driven success</h2>
        <p>
          Beyond individual growth tools, the Platform cultivates a thriving real-time business community where partners collaborate, share insights, celebrate achievements, and support each other's entrepreneurial journeys.
          This connected ecosystem ensures that no partner operates in isolation, fostering collective success through shared knowledge and mutual support.
        </p>
        <p class="dp-muted">
          MarketSpase replaces the old chase with central acquisition, fair allocation and an AI business partner that prepares the work — so you can build a real online business without cold calls or pitching friends.
        </p>
      </div>

      <div class="highlights">
        <div class="dp-card highlight-card">
          <mat-icon>group</mat-icon>
          <h2>Manage your team operations</h2>
          <p>
            As networks expand, the platform provides robust management systems that streamline communication, track performance metrics, monitor team development, and facilitate seamless coordination across multi-level organizational structures.
          </p>
        </div>
        <div class="dp-card highlight-card">
          <mat-icon>trending_up</mat-icon>
          <h2>Grow your network</h2>
          <p>
            MarketSpase runs central advertising and routes the interest through fair allocation, so partners can grow without chasing strangers or cold-calling.
          </p>
        </div>
        <div class="dp-card highlight-card">
          <mat-icon>access_time</mat-icon>
          <h2>Promote your business</h2>
          <p>
            Partners gain access to diverse online marketing channels, social media integration, content creation tools, and digital advertising capabilities to effectively promote their business and maximize market penetration.
          </p>
        </div>
      </div>

      <div class="dp-card cta">
        <div>
          <h2>Ready to move?</h2>
          <p class="dp-muted">Start prospecting or talk to support — both are one tap away.</p>
        </div>
        <span class="spacer"></span>
        <div class="cta-actions">
          <button mat-flat-button color="primary" routerLink="/dashboard/campaigns">
            Fund a growth campaign
          </button>
          <button mat-stroked-button routerLink="/dashboard/support/ticket">
            Contact support
          </button>
        </div>
      </div>

      <footer>
        <p>&copy; {{ currentYear }} {{ appName }}. All rights reserved.</p>
      </footer>
    </section>


`,
styles: [`
    .about-page { display: flex; flex-direction: column; gap: 0.9em; padding-bottom: 2em; }
    .hero { padding: 1.6em 1.4em; }
    .eyebrow {
      margin: 0 0 0.4em; font-size: 0.78rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em; color: var(--ms-primary-strong);
    }
    .hero h1 { margin: 0 0 0.5em; font-size: 1.7rem; line-height: 1.25; }
    .lede { margin: 0; line-height: 1.65; font-size: 1.02rem; }
    .card { padding: 1.2em 1.2em; }
    .card h2 { margin: 0 0 0.5em; font-size: 1.15rem; }
    .card p { margin: 0 0 0.7em; line-height: 1.65; }
    .card p:last-child { margin-bottom: 0; }
    .highlights { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 0.9em; }
    .highlight-card { padding: 1.2em 1.1em; display: flex; flex-direction: column; gap: 0.45em; }
    .highlight-card mat-icon { color: var(--ms-primary-strong); font-size: 1.9rem; width: auto; height: auto; }
    .highlight-card h2 { margin: 0; font-size: 1.05rem; }
    .highlight-card p { margin: 0; color: var(--ms-text-muted); line-height: 1.6; font-size: 0.95rem; }
    .cta { padding: 1.2em; display: flex; align-items: center; gap: 1em; flex-wrap: wrap; }
    .cta h2 { margin: 0 0 0.2em; font-size: 1.15rem; }
    .cta p { margin: 0; }
    .cta .spacer { flex: 1; }
    .cta-actions { display: flex; gap: 0.6em; flex-wrap: wrap; }
    .cta-actions button { min-height: 44px; }
    footer { text-align: center; padding-top: 0.6em; border-top: 1px solid var(--ms-line); }
    footer p { margin: 0; font-size: 0.85rem; color: var(--ms-text-muted); }
    @media (max-width: 600px) {
      .hero h1 { font-size: 1.4rem; }
      .cta-actions { width: 100%; }
      .cta-actions button { flex: 1; }
    }
`],
providers: [],
changeDetection: ChangeDetectionStrategy.OnPush,
imports: [
    MatIconModule,
    RouterModule,
    MatButtonModule
]
})
export class AboutAppComponent {
    appName = 'MarketSpase Partner Platform';
    currentYear = new Date().getFullYear();
}
