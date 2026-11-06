import {Component, ChangeDetectionStrategy} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import { RouterModule } from '@angular/router';


@Component({
selector: 'async-be-partner',
template: `
  <section class="final" aria-label="Get started">
    <div class="final-card">
      <p class="eyebrow">/ YOUR MOVE</p>
      <h2>Your business, one login away.</h2>
      <p>Sign in to work today’s pipeline, coach your team and track your numbers — or create your free account in minutes.</p>
      <div class="cta-row">
        <a mat-flat-button color="primary" routerLink="partner/signin" (click)="scrollToTop()">Sign in</a>
        <a mat-stroked-button routerLink="partner/signup" (click)="scrollToTop()">Create account</a>
      </div>
      <p class="fine">New to MarketSpase? <a href="https://marketspase.com/" target="_blank" rel="noopener">Explore the public MarketSpase site</a> first - or <a href="https://wa.me/2348080386208?text=Hello%20MarketSpase%20admin%2C%20I%20need%20help%20getting%20started." target="_blank" rel="noopener">chat with an admin on WhatsApp</a>.</p>
    </div>
  </section>
  `,
styles: [`
  .final { padding: 3em 1.25em 3.5em; }
  .final-card {
    max-width: 860px; margin: 0 auto; text-align: center;
    background: var(--ms-ink, #14122b); color: var(--ms-ink-text, #f3f4f6);
    border: 1px solid var(--ms-primary, #667eea); border-radius: 18px; padding: 2.5em 1.5em;
  }
  .eyebrow { color: var(--ms-ink-icon, #8192ee); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.15em; margin: 0; }
  .final-card h2 { margin: 0.4em 0 0.5em; font-size: clamp(1.6rem, 4vw, 2.4rem); color: var(--ms-ink-text, #f3f4f6); }
  .final-card p { opacity: 0.85; max-width: 36em; margin: 0 auto 1.25em; line-height: 1.6; }
  .cta-row { display: flex; gap: 0.75em; justify-content: center; flex-wrap: wrap; }
  .cta-row a { min-height: 48px; }
  a[mat-stroked-button] { border-color: var(--ms-ink-icon, #8192ee); color: var(--ms-ink-text, #f3f4f6); }
  .fine { font-size: 0.85em; opacity: 0.75; margin: 1.25em auto 0; }
  .fine a { color: var(--ms-ink-icon, #8192ee); }
  `],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatButtonModule, MatIconModule, RouterModule]
})
export class BePartnerComponent {
   // scroll to top when clicked
   scrollToTop() {
     window.scrollTo({ top: 0, behavior: 'smooth' });
   }
}
