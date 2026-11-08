import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';

interface ReadinessCheck {
  key: string;
  label: string;
  done: boolean;
}

interface PromotionCard {
  icon: string;
  title: string;
  body: string;
  cta: string;
  link: string;
}

/**
 * @title Promote — the public-page growth hub.
 *
 * Promotion starts with the partner's public page: complete it, share the
 * link, use the content library and guides, then work the page leads.
 * SMS/email remain under Outreach; partner acquisition is separate.
 */
@Component({
  selector: 'async-promote-hub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, MatSnackBarModule, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>Promote</span>
      </div>
    </section>

    <section class="promote-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Promote · Your public page</p>
          <h1>Your page is the asset. Put it to work.</h1>
          <p class="subtitle">Complete your page, share it with your network, and turn page visits into page leads.</p>
        </div>
        <a mat-flat-button color="primary" routerLink="/dashboard/settings/landing-page">
          <mat-icon>edit</mat-icon> Edit my page
        </a>
      </header>

      <section class="hero dp-card">
        <div class="hero-main">
          <span class="eyebrow">Your share link</span>
          @if (publicUrl(); as url) {
            <div class="share-row">
              <code>{{ url }}</code>
              <button mat-stroked-button type="button" (click)="copyLink()"><mat-icon>content_copy</mat-icon>Copy link</button>
              <a mat-stroked-button [href]="url" target="_blank" rel="noopener"><mat-icon>open_in_new</mat-icon>Preview</a>
            </div>
          } @else {
            <p class="muted">Your public page link will appear here once your username is set.</p>
          }
          <p class="muted share-note">
            This is the page to share on WhatsApp, Facebook, Instagram, TikTok, LinkedIn and X. Every visit can become a page lead.
          </p>

          @if (referralUrl(); as referral) {
            <span class="eyebrow">Your team referral link</span>
            <div class="share-row">
              <code>{{ referral }}</code>
              <button mat-stroked-button type="button" (click)="copyReferralLink()">
                <mat-icon>content_copy</mat-icon> Copy referral link
              </button>
              <a mat-stroked-button [href]="referral" target="_blank" rel="noopener">
                <mat-icon>open_in_new</mat-icon> Preview
              </a>
            </div>
            <p class="muted share-note">
              Anyone who signs up through this link joins your team automatically. Keep sharing your public page for lead capture.
            </p>
          }

          <div class="mini-stats">
            <span><strong>{{ completedCount() }}/{{ checks().length }}</strong> page essentials</span>
            <span><strong>{{ socialCount() }}</strong> social profiles linked</span>
          </div>
        </div>

        <div class="readiness">
          <div class="readiness-head">
            <span>Page readiness</span>
            <strong>{{ readiness() }}%</strong>
          </div>
          <mat-progress-bar mode="determinate" [value]="readiness()" aria-label="Public page readiness" />
          <ul class="check-list">
            @for (check of checks(); track check.key) {
              <li [class.done]="check.done">
                <mat-icon>{{ check.done ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                {{ check.label }}
              </li>
            }
          </ul>
          <a mat-button routerLink="/dashboard/settings/landing-page">Finish my page →</a>
        </div>
      </section>

      <section class="action-grid" aria-label="Promotion tools">
        @for (card of cards; track card.link + card.title) {
          <a class="dp-card action-card" [routerLink]="card.link">
            <span class="card-icon"><mat-icon>{{ card.icon }}</mat-icon></span>
            <strong>{{ card.title }}</strong>
            <p class="muted">{{ card.body }}</p>
            <span class="card-cta">{{ card.cta }} →</span>
          </a>
        }
      </section>

      <section class="dp-card flow-card">
        <div>
          <p class="eyebrow">The promotion loop</p>
          <h2>Complete → share → capture → follow up</h2>
        </div>
        <ol class="flow-list">
          <li><span>1</span><div><strong>Complete your page</strong><p class="muted">Story, offer, proof, WhatsApp and social links.</p></div></li>
          <li><span>2</span><div><strong>Share your link</strong><p class="muted">Post it on social, in WhatsApp groups and in your status.</p></div></li>
          <li><span>3</span><div><strong>Capture leads</strong><p class="muted">Visitors who submit Get Started land in your pipeline.</p></div></li>
          <li><span>4</span><div><strong>Follow up</strong><p class="muted">Work the lead in your pipeline or reach out by SMS/email.</p></div></li>
        </ol>
      </section>

      <p class="cross-link muted">
        Need activated partners rather than page leads? That is a separate growth engine —
        <a routerLink="/dashboard/campaigns">Partner acquisition</a> under Team.
      </p>
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .promote-page { display: flex; flex-direction: column; gap: 1.1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1em; flex-wrap: wrap; }
    .page-head h1 { margin: 0.15em 0 0.25em; font-size: clamp(1.5rem, 3vw, 2rem); }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .subtitle { margin: 0; color: var(--ms-text-muted); max-width: 46em; line-height: 1.5; }
    .hero { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr); gap: 1.25em; padding: 1.2em 1.3em; }
    .hero-main { display: flex; flex-direction: column; gap: 0.5em; min-width: 0; }
    .share-row { display: flex; align-items: center; gap: 0.45em; flex-wrap: wrap; }
    .share-row code { background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: 8px; padding: 0.5em 0.7em; font-size: 0.88em; word-break: break-all; }
    .share-note { margin: 0; line-height: 1.5; }
    .mini-stats { display: flex; gap: 1.2em; flex-wrap: wrap; margin-top: 0.25em; color: var(--ms-text-muted); font-size: 0.86em; }
    .mini-stats strong { color: var(--ms-text); }
    .readiness { background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); padding: 0.9em 1em; display: flex; flex-direction: column; gap: 0.5em; }
    .readiness-head { display: flex; justify-content: space-between; gap: 1em; font-weight: 700; }
    .readiness-head strong { color: var(--ms-primary-strong); }
    .check-list { list-style: none; margin: 0.2em 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.3em; }
    .check-list li { display: flex; align-items: center; gap: 0.35em; color: var(--ms-text-muted); font-size: 0.86em; }
    .check-list li.done { color: var(--ms-text); }
    .check-list mat-icon { font-size: 17px; height: 17px; width: 17px; color: var(--ms-text-soft); }
    .check-list li.done mat-icon { color: var(--ms-success); }
    .readiness a { align-self: flex-start; min-height: 40px; }
    .action-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 0.75em; }
    .action-card { display: flex; flex-direction: column; gap: 0.35em; padding: 1em; text-decoration: none; color: inherit; border: 1px solid var(--ms-line); transition: border-color 140ms ease, transform 140ms ease; }
    .action-card:hover { border-color: var(--ms-primary); transform: translateY(-1px); }
    .card-icon { width: 36px; height: 36px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .action-card strong { font-size: 1em; }
    .action-card p { margin: 0; line-height: 1.45; flex: 1; }
    .card-cta { color: var(--ms-primary-strong); font-weight: 700; font-size: 0.84em; }
    .flow-card { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 1em; padding: 1.1em 1.2em; align-items: start; }
    .flow-card h2 { margin: 0.2em 0 0; font-size: 1.15em; }
    .flow-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr)); gap: 0.6em; }
    .flow-list li { display: flex; gap: 0.6em; align-items: flex-start; }
    .flow-list li > span { flex: none; width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 800; font-size: 0.78em; }
    .flow-list strong { font-size: 0.88em; }
    .flow-list p { margin: 0.1em 0 0; line-height: 1.4; }
    .cross-link { margin: 0; font-size: 0.86em; }
    .cross-link a { font-weight: 700; }
    .muted { color: var(--ms-text-muted); }
    @media (max-width: 900px) {
      .hero, .flow-card { grid-template-columns: 1fr; }
    }
  `],
})
export class PromoteHubComponent {
  private readonly auth = inject(AuthService);
  private readonly snack = inject(MatSnackBar);

  protected readonly partner = computed(() => this.auth.currentUser() as Record<string, unknown> | null);

  protected readonly publicUrl = computed(() => {
    const username = String(this.partner()?.['username'] ?? '').trim();
    if (!username) return null;
    const base = (environment as { publicSiteUrl?: string }).publicSiteUrl ?? 'https://marketspase.com';
    return `${String(base).replace(/\/+$/, '')}/${username}`;
  });

  protected readonly referralUrl = computed(() => {
    const username = String(this.partner()?.['username'] ?? '').trim();
    if (!username || typeof window === 'undefined') return null;
    return `${window.location.origin}/join?ref=${encodeURIComponent(username)}`;
  });

  protected readonly checks = computed<ReadinessCheck[]>(() => {
    const p = this.partner() ?? {};
    const filled = (value: unknown) => String(value ?? '').trim().length > 0;
    const opportunity = p['opportunityPoints'];
    const hasOffer = (Array.isArray(opportunity) && opportunity.some((v) => filled(v)))
      || filled(p['inviteNote']);
    const socialKeys = ['facebookPage', 'instagramPage', 'tiktokPage', 'linkedinPage', 'twitterPage', 'youtubePage'];
    return [
      { key: 'headline', label: 'Headline and subheadline', done: filled(p['headline']) && filled(p['subHeadline']) },
      { key: 'story', label: 'Your story', done: filled(p['aboutStory']) || filled(p['bio']) },
      { key: 'offer', label: 'Opportunity / offer', done: hasOffer },
      { key: 'proof', label: 'Testimonial or proof', done: filled(p['testimonial']) || filled(p['videoTestimonialUrl']) },
      {
        key: 'contact',
        label: 'WhatsApp or contact details',
        done: filled(p['whatsappGroupLink']) || filled(p['whatsappChatLink']) || filled(p['displayPhone']) || filled(p['displayEmail']),
      },
      { key: 'social', label: 'At least one social profile', done: socialKeys.some((key) => filled(p[key])) },
    ];
  });

  protected readonly completedCount = computed(() => this.checks().filter((check) => check.done).length);
  protected readonly readiness = computed(() => Math.round((this.completedCount() / this.checks().length) * 100));
  protected readonly socialCount = computed(() => {
    const p = this.partner() ?? {};
    return ['facebookPage', 'instagramPage', 'tiktokPage', 'linkedinPage', 'twitterPage', 'youtubePage']
      .filter((key) => String(p[key] ?? '').trim().length > 0).length;
  });

  protected readonly cards: PromotionCard[] = [
    {
      icon: 'edit_note',
      title: 'My page',
      body: 'Edit the story, offer, proof, WhatsApp CTA and social links prospects see.',
      cta: 'Edit page',
      link: '/dashboard/settings/landing-page',
    },
    {
      icon: 'perm_media',
      title: 'Content library',
      body: 'Ready-made texts and images you can post or send to prospects.',
      cta: 'Open library',
      link: '/dashboard/resources/ads-contents',
    },
    {
      icon: 'menu_book',
      title: 'Prospecting guides',
      body: 'Conversation frameworks and scripts for sharing your page with confidence.',
      cta: 'Open guides',
      link: '/dashboard/resources/prospecting-contents',
    },
    {
      icon: 'forum',
      title: 'Outreach',
      body: 'Send SMS or email and review your message history.',
      cta: 'Open outreach',
      link: '/dashboard/promote/outreach',
    },
  ];

  protected copyLink(): void {
    const url = this.publicUrl();
    if (!url) return;
    const done = () => this.snack.open('Public page link copied — share it anywhere', 'OK', { duration: 3000 });
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, done);
    else done();
  }

  protected copyReferralLink(): void {
    const url = this.referralUrl();
    if (!url) return;
    const done = () => this.snack.open('Referral link copied — new signups join your team', 'OK', { duration: 3000 });
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, done);
    else done();
  }
}
