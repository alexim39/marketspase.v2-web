import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

interface Pillar {
  icon: string;
  tone: string;
  title: string;
  body: string;
}

@Component({
  selector: 'async-index-pillars',
  imports: [MatButtonModule, MatIconModule, RouterModule],
  template: `
    <section class="mkt-section" aria-labelledby="pillars-title">
      <div class="mkt-section-inner">
        <div class="mkt-section-head">
          <p class="mkt-eyebrow">The problems · The fixes</p>
          <h2 class="mkt-h2" id="pillars-title">Less chasing. More building.</h2>
          <p class="mkt-sub">
            Every fear people bring to network marketing gets a direct answer inside MarketSpase.
            This is how your online business removes the parts you hate.
          </p>
        </div>

        <div class="mkt-grid mkt-grid--3">
          @for (p of pillars; track p.title) {
            <article class="mkt-card">
              <span [class]="'mkt-icon-tile ' + p.tone">
                <mat-icon aria-hidden="true">{{ p.icon }}</mat-icon>
              </span>
              <h3>{{ p.title }}</h3>
              <p>{{ p.body }}</p>
            </article>
          }
        </div>

        <div class="mkt-actions" style="justify-content: center; margin-top: 2rem;">
          <a mat-flat-button color="primary" routerLink="/partner/signup" (click)="scrollToTop()">Start your online business</a>
          <a mat-stroked-button routerLink="/ora" (click)="scrollToTop()">Meet Ora first</a>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class PillarsComponent {
  protected readonly pillars: Pillar[] = [
    {
      icon: 'do_not_disturb_on',
      tone: '',
      title: 'I don’t want to chase people',
      body: 'MarketSpase runs central ads and routes the interest. You serve people who already raised their hand.',
    },
    {
      icon: 'phone_disabled',
      tone: 'mkt-icon-tile--rose',
      title: 'I don’t want to make calls',
      body: 'No cold, warm or hot call scripts. Conversations are opt-in, and Ora prepares the follow-ups for your approval.',
    },
    {
      icon: 'today',
      tone: 'mkt-icon-tile--teal',
      title: 'I don’t know what to do daily',
      body: 'Ora builds a short daily plan from your rank, pipeline and campaigns. You always know the next move.',
    },
    {
      icon: 'edit_note',
      tone: 'mkt-icon-tile--violet',
      title: 'I don’t know what to say',
      body: 'Need a campaign or follow-up? Ora prepares the draft. You edit, approve or skip.',
    },
    {
      icon: 'people_outline',
      tone: 'mkt-icon-tile--amber',
      title: 'I don’t want to pitch friends',
      body: 'Sharing is optional. Your relationships stay relationships; growth comes from the platform.',
    },
    {
      icon: 'groups',
      tone: 'mkt-icon-tile--teal',
      title: 'I don’t want to build alone',
      body: 'Ora, your team and the community are built in. Support is part of your online business.',
    },
  ];

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
