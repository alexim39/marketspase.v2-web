import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
selector: 'async-index-pathway',
imports: [MatButtonModule, MatIconModule, RouterModule],
template: `
<section class="pathway" aria-label="How it works">
  <p class="eyebrow">/ HOW IT WORKS</p>
  <h2>Three steps. Then compound.</h2>
  <ol class="steps">
    <li class="dp-card">
      <span class="num">1</span>
      <h3>Create your account</h3>
      <p>Sign up free with your name, phone and email, verify your email, and your workspace is ready.</p>
    </li>
    <li class="dp-card">
      <span class="num">2</span>
      <h3>Learn &amp; get confirmed</h3>
      <p>Complete IPO, QSG and SMO, pass the quizzes. Training is recorded automatically — no upline confirmation.</p>
    </li>
    <li class="dp-card">
      <span class="num">3</span>
      <h3>Duplicate daily</h3>
      <p>Work your pipeline, coach your downline, track your numbers. The platform tells you the next move.</p>
    </li>
  </ol>
  <div class="ladder" aria-label="Rank path">
    <span>Partner</span><mat-icon>arrow_forward</mat-icon>
    <span>Builder</span><mat-icon>arrow_forward</mat-icon>
    <span>Leader</span><mat-icon>arrow_forward</mat-icon>
    <span><strong>Ambassador</strong></span>
  </div>
  <a mat-flat-button color="primary" routerLink="partner/signup" (click)="scrollToTop()">Start step one</a>
</section>
`,
changeDetection: ChangeDetectionStrategy.Eager,
styles: [`
.pathway { background: var(--ms-canvas); border-top: 1px solid var(--ms-line); border-bottom: 1px solid var(--ms-line); padding: 3em 1.25em; text-align: center; }
.eyebrow { color: var(--ms-primary-strong); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.15em; margin: 0; }
.pathway h2 { margin: 0.3em 0 1em; font-size: clamp(1.5rem, 3.5vw, 2.1rem); }
.steps { list-style: none; margin: 0 auto 1.5em; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 1em; max-width: 960px; text-align: left; }
.steps li { padding: 1.25em; }
.num { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; background: var(--ms-ink); color: var(--ms-primary); font-weight: 800; margin-bottom: 0.5em; }
.steps h3 { margin: 0 0 0.3em; }
.steps p { margin: 0; color: var(--ms-text-muted); font-size: 0.92rem; line-height: 1.6; }
.ladder { display: flex; align-items: center; justify-content: center; gap: 0.4em; flex-wrap: wrap; margin-bottom: 1.5em; font-size: 0.9em; color: var(--ms-text-muted); }
.ladder mat-icon { font-size: 18px; height: 18px; width: 18px; color: var(--ms-primary-strong); }
.ladder strong { color: var(--ms-primary-strong); }
a[mat-flat-button] { min-height: 48px; }
`],
})
export class PathwayComponent {
  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
