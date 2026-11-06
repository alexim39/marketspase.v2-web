import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';


@Component({
    selector: 'async-index-why-we-exist',
    imports: [RouterModule, MatIconModule, MatButtonModule],
    template: `
    <section class="mission" aria-label="Why we exist">
      <mat-icon class="mark">diamond</mat-icon>
      <h2>Built so no partner builds alone.</h2>
      <p>
        MarketSpase turns effort into duplication: learn the method, work it visibly,
        and coach others to do the same. This platform is the shared workspace where
        that compounding happens — pipeline, team, training and community in one login.
      </p>
      <a mat-button routerLink="partner/signin" (click)="scrollToTop()">Sign in to your workspace →</a>
    </section>
  `,
    changeDetection: ChangeDetectionStrategy.Eager,
    styles: [`
  .mission {
    padding: 3em 1.25em;
    text-align: center;
    background: var(--ms-ink, #14122b);
    color: var(--ms-ink-text, #f3f4f6);
  }
  .mark { color: var(--ms-ink-icon, #8192ee); font-size: 2.5rem; height: 2.5rem; width: 2.5rem; }
  .mission h2 { margin: 0.5em 0; font-size: clamp(1.4rem, 3.5vw, 2rem); color: var(--ms-ink-text, #f3f4f6); }
  .mission p { margin: 0 auto 1.25em; max-width: 44em; line-height: 1.7; opacity: 0.85; }
  .mission a { min-height: 44px; color: var(--ms-ink-icon, #8192ee); font-weight: 700; }
  `]
})
export class WhyWeExistComponent{

   // scroll to top when clicked
   scrollToTop() {
     window.scrollTo({ top: 0, behavior: 'smooth' });
   }

}
