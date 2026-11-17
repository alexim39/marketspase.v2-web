import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

/**
 * Short introduction video + the three promises that make the model legible
 * before a visitor creates an account.
 */
@Component({
  selector: 'async-index-intro-video',
  imports: [MatButtonModule, MatIconModule, RouterModule],
  template: `
    <section class="mkt-section mkt-section--band" aria-labelledby="intro-video-title">
      <div class="mkt-section-inner mkt-media-band">
        <div>
          <p class="mkt-eyebrow">The problem</p>
          <h2 class="mkt-h2" id="intro-video-title">You want extra income online. You don&rsquo;t want to chase people.</h2>
          <p class="mkt-lede">
            The old way is calls, lead lists and pitching friends. MarketSpase flips it: the
            platform brings the interest, a real product backs the business and Ora prepares the
            work for your approval.
          </p>
          <div class="mkt-stat-strip">
            <div class="mkt-stat">
              <strong>No chasing</strong>
              <span>Interested customers come through the platform.</span>
            </div>
            <div class="mkt-stat">
              <strong>No cold calls</strong>
              <span>Conversations are opt-in.</span>
            </div>
            <div class="mkt-stat">
              <strong>No guesswork</strong>
              <span>Ora prepares the next move.</span>
            </div>
          </div>
          <a class="mkt-inline-link" routerLink="/how-it-works" (click)="scrollToTop()">
            See the full journey <mat-icon aria-hidden="true">arrow_forward</mat-icon>
          </a>
        </div>

        <div class="mkt-video-frame ms-lite-hide">
          @if (showVideo()) {
            <iframe
              src="https://www.youtube-nocookie.com/embed/aJQSp1T1cGo?rel=0&autoplay=1"
              title="MarketSpase introduction video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            ></iframe>
          } @else {
            <button type="button" class="mkt-video-facade" (click)="showVideo.set(true)">
              <span class="mkt-video-play" aria-hidden="true"><mat-icon>play_arrow</mat-icon></span>
              <strong>Watch the introduction</strong>
              <small>A short overview of your online business</small>
            </button>
          }
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class IntroVideoComponent {
  readonly showVideo = signal(false);

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
