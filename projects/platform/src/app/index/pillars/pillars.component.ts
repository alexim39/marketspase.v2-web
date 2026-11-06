import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

interface Pillar {
  icon: string;
  title: string;
  body: string;
  link: string;
  cta: string;
}

@Component({
  selector: 'async-index-pillars',
  imports: [MatButtonModule, MatIconModule, RouterModule],
template: `
<section class="pillars" aria-label="What the platform does">
  <p class="eyebrow">/ WHY PARTNERS LOG IN DAILY</p>
  <h2>Five jobs. One platform.</h2>
  <div class="grid">
    @for (p of pillars; track p.title) {
      <article class="dp-card card">
        <mat-icon>{{ p.icon }}</mat-icon>
        <h3>{{ p.title }}</h3>
        <p>{{ p.body }}</p>
        <a mat-button routerLink="{{ p.link }}">{{ p.cta }}</a>
      </article>
    }
  </div>
</section>
`,
changeDetection: ChangeDetectionStrategy.Eager,
styles: [`
.pillars { padding: 3em 1.25em; max-width: 1080px; margin: 0 auto; }
.eyebrow { color: var(--ms-primary-strong); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.15em; margin: 0; }
.pillars h2 { margin: 0.3em 0 1em; font-size: clamp(1.5rem, 3.5vw, 2.1rem); }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 1em; }
.card { padding: 1.25em; display: flex; flex-direction: column; gap: 0.5em; }
.card mat-icon { color: var(--ms-primary-strong); font-size: 2rem; height: 2rem; width: 2rem; }
.card h3 { margin: 0; font-size: 1.05rem; }
.card p { margin: 0; color: var(--ms-text-muted); font-size: 0.92rem; line-height: 1.6; flex: 1; }
.card a { align-self: flex-start; text-decoration: none; color: var(--ms-primary-strong); font-weight: 700; min-height: 44px; display: inline-flex; align-items: center; }
`],
})
export class PillarsComponent {
  protected readonly pillars: Pillar[] = [
    { icon: 'person_search', title: 'Manage prospects', body: 'Pipeline, follow-ups, bookings and conversions — never lose a prospect again.', link: 'partner/signin', cta: 'Open pipeline →' },
    { icon: 'groups', title: 'Grow your team', body: 'Downline tree, activation board, contact lists and coaching — see who needs you next.', link: 'partner/signin', cta: 'See my team →' },
    { icon: 'campaign', title: 'Promote outward', body: 'Campaigns, invite links and your public page turn effort into inbound interest.', link: 'partner/signin', cta: 'Promote →' },
    { icon: 'school', title: 'Learn & certify', body: 'IPO, QSG and SMO with quizzes and upline-confirmed certificates that open rank gates.', link: 'partner/signin', cta: 'Start learning →' },
    { icon: 'insights', title: 'Know your numbers', body: 'Team health, funnel, goals and forecasts — act before problems compound.', link: 'partner/signin', cta: 'View insights →' },
  ];
}
