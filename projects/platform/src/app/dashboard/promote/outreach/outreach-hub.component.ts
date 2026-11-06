import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

interface OutreachCard {
  icon: string;
  title: string;
  body: string;
  cta: string;
  link: string;
}

/**
 * @title Outreach — SMS and email tools.
 *
 * These are direct outreach channels, separate from public-page promotion.
 * Send and history remain on their existing working pages.
 */
@Component({
  selector: 'async-outreach-hub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/promote">Promote</a> &gt;
        <span>Outreach</span>
      </div>
    </section>

    <section class="outreach-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Promote · Outreach</p>
          <h1>Reach people directly</h1>
          <p class="subtitle">Use SMS or email for direct follow-up. Your public-page link and content still do the promotion work.</p>
        </div>
        <a mat-stroked-button routerLink="/dashboard/promote"><mat-icon>arrow_back</mat-icon> Promote</a>
      </header>

      <section class="group">
        <div class="group-head">
          <h2>Send</h2>
          <p class="muted">Compose a message to selected contacts.</p>
        </div>
        <div class="grid">
          @for (card of sendCards; track card.link) {
            <a class="dp-card action-card" [routerLink]="card.link">
              <span class="card-icon"><mat-icon>{{ card.icon }}</mat-icon></span>
              <strong>{{ card.title }}</strong>
              <p class="muted">{{ card.body }}</p>
              <span class="card-cta">{{ card.cta }} →</span>
            </a>
          }
        </div>
      </section>

      <section class="group">
        <div class="group-head">
          <h2>History</h2>
          <p class="muted">Review what was sent and to whom.</p>
        </div>
        <div class="grid">
          @for (card of historyCards; track card.link) {
            <a class="dp-card action-card" [routerLink]="card.link">
              <span class="card-icon"><mat-icon>{{ card.icon }}</mat-icon></span>
              <strong>{{ card.title }}</strong>
              <p class="muted">{{ card.body }}</p>
              <span class="card-cta">{{ card.cta }} →</span>
            </a>
          }
        </div>
      </section>

      <p class="note muted">
        SMS and email are for direct outreach. To promote your page to many people at once, share your public-page link
        and use the content library.
      </p>
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .outreach-page { display: flex; flex-direction: column; gap: 1.2em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1em; flex-wrap: wrap; }
    .page-head h1 { margin: 0.15em 0 0.25em; font-size: clamp(1.5rem, 3vw, 2rem); }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .subtitle { margin: 0; color: var(--ms-text-muted); max-width: 46em; line-height: 1.5; }
    .group { display: flex; flex-direction: column; gap: 0.6em; }
    .group-head h2 { margin: 0; font-size: 1.1em; }
    .group-head p { margin: 0.1em 0 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 0.75em; }
    .action-card { display: flex; flex-direction: column; gap: 0.35em; padding: 1em; text-decoration: none; color: inherit; border: 1px solid var(--ms-line); transition: border-color 140ms ease, transform 140ms ease; }
    .action-card:hover { border-color: var(--ms-primary); transform: translateY(-1px); }
    .card-icon { width: 36px; height: 36px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .action-card strong { font-size: 1em; }
    .action-card p { margin: 0; line-height: 1.45; flex: 1; }
    .card-cta { color: var(--ms-primary-strong); font-weight: 700; font-size: 0.84em; }
    .note { margin: 0; line-height: 1.5; font-size: 0.86em; max-width: 60em; }
    .muted { color: var(--ms-text-muted); }
  `],
})
export class OutreachHubComponent {
  protected readonly sendCards: OutreachCard[] = [
    {
      icon: 'sms',
      title: 'Send SMS',
      body: 'Send a text message to one or more contacts.',
      cta: 'Compose SMS',
      link: '/dashboard/tools/sms/new',
    },
    {
      icon: 'mail',
      title: 'Send email',
      body: 'Send an email to selected prospects or contacts.',
      cta: 'Compose email',
      link: '/dashboard/tools/email/new',
    },
  ];

  protected readonly historyCards: OutreachCard[] = [
    {
      icon: 'history',
      title: 'SMS history',
      body: 'See sent messages, recipients and delivery outcomes.',
      cta: 'View SMS history',
      link: '/dashboard/tools/sms/messages',
    },
    {
      icon: 'mark_email_read',
      title: 'Email history',
      body: 'Review sent emails and their delivery records.',
      cta: 'View email history',
      link: '/dashboard/tools/email/logs',
    },
  ];
}
