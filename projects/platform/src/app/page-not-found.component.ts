import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';

/** Premium, self-contained 404 — no external illustration or font dependency. */
@Component({
  selector: 'async-page-not-found',
  imports: [MatButtonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; padding: 3em 1em; }

    .page_404 {
      max-width: 720px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5em;
      text-align: center;
    }

    .four_zero_four_bg {
      width: 100%;
      min-height: clamp(220px, 40vh, 360px);
      display: grid;
      place-items: center;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-xl);
      background:
        radial-gradient(420px 220px at 50% 0%, color-mix(in srgb, var(--ms-primary) 18%, transparent), transparent 70%),
        var(--ms-canvas);
      overflow: hidden;
    }

    .four_zero_four_bg h1 {
      margin: 0;
      font-size: clamp(4rem, 18vw, 9rem);
      font-weight: 800;
      letter-spacing: -0.06em;
      line-height: 1;
      color: var(--ms-primary-strong);
    }

    .contant_box_404 h3 { margin: 0 0 0.5em; font-size: clamp(1.1rem, 3vw, 1.5rem); }
    .contant_box_404 p { margin: 0 0 1.4em; color: var(--ms-text-muted); }

    @media only screen and (max-width: 600px) {
      :host { padding: 2em 0.75em; }
    }
  `],
  template: `
    <section class="page_404">
      <div class="four_zero_four_bg" aria-hidden="true">
        <h1>404</h1>
      </div>

      <div class="contant_box_404">
        <h3>It looks like you followed a wrong link</h3>
        <p>The page you are looking for is not available.</p>
        <a mat-flat-button color="primary" routerLink="/dashboard">Return to Dashboard</a>
      </div>
    </section>
  `,
})
export class PageNotFoundComponent {}
