import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
selector: 'async-banner',
imports: [MatButtonModule, MatIconModule, RouterModule],
template: `

<div class="hero">
  <div class="hero-inner">
    <p class="eyebrow">MarketSpase · Partner Platform</p>
    <h1>Build and run your network business from one place</h1>
    <p class="sub">
      Prospects, team, training, community and insights — the digital network
      marketing platform for independent partners.
    </p>
    <div class="cta-row">
      <a mat-flat-button color="primary" routerLink="partner/signin" (click)="scrollToTop()">Sign in</a>
      <a mat-stroked-button routerLink="partner/signup" (click)="scrollToTop()">Create account</a>
    </div>
    <p class="hint">New here? Sign up free and verify your email to get started.</p>
    <p class="contact">
      Need help getting started?
      <a
        href="https://wa.me/2348080386208?text=Hello%20MarketSpase%20admin%2C%20I%20need%20help%20getting%20started."
        target="_blank"
        rel="noopener"
        aria-label="Chat with an admin on WhatsApp at 0808 038 6208"
      ><mat-icon aria-hidden="true">chat</mat-icon> Chat with an admin on WhatsApp</a>
    </p>
    <div class="video-card ms-lite-hide">
      <div class="video-frame">
        @if (showVideo()) {
          <iframe
            src="https://www.youtube-nocookie.com/embed/aJQSp1T1cGo?rel=0&autoplay=1"
            title="MarketSpase introduction video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
          ></iframe>
        } @else {
          <button type="button" class="video-facade" (click)="showVideo.set(true)">
            <span class="play"><mat-icon aria-hidden="true">play_arrow</mat-icon></span>
            <strong>Watch the introduction</strong>
            <small>Short overview of the opportunity</small>
          </button>
        }
      </div>
      <p class="video-caption">Watch this short introduction to the MarketSpase opportunity.</p>
    </div>
    <div class="trust">
      <span><mat-icon>person_search</mat-icon> Prospect pipeline</span>
      <span><mat-icon>groups</mat-icon> Team coaching</span>
      <span><mat-icon>school</mat-icon> IPO · QSG · SMO</span>
      <span><mat-icon>forum</mat-icon> Community</span>
    </div>
  </div>
</div>

`,
changeDetection: ChangeDetectionStrategy.Eager,
styles: `

.hero {
  background:
    radial-gradient(700px 420px at 50% 0%, rgba(102,126,234,0.22), rgba(15,13,28,0) 70%),
    var(--ms-ink, #14122b);
  color: var(--ms-ink-text, #f3f4f6);
  padding: 4em 1.25em 3em;
  text-align: center;
}
.hero-inner {
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1em;
}
.eyebrow {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ms-ink-icon, #8192ee);
}
.hero h1 {
  margin: 0;
  font-size: clamp(2rem, 5.5vw, 3.25rem);
  line-height: 1.12;
  letter-spacing: -0.01em;
  color: var(--ms-ink-text, #f3f4f6);
}
.sub {
  margin: 0;
  max-width: 38em;
  color: var(--ms-ink-text, #f3f4f6);
  opacity: 0.82;
  font-size: 1.05rem;
  line-height: 1.6;
}
.cta-row {
  display: flex;
  gap: 0.75em;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 0.5em;
}
.cta-row a { min-height: 48px; }
a[mat-stroked-button] { border-color: var(--ms-ink-icon, #8192ee); color: var(--ms-ink-text, #f3f4f6); }
.hint { margin: 0; font-size: 0.85em; opacity: 0.7; }
.contact { margin: 0; font-size: 0.9em; opacity: 0.9; }
.contact a { display: inline-flex; align-items: center; gap: 0.35em; color: var(--ms-ink-icon, #8192ee); font-weight: 700; }
.contact mat-icon { font-size: 18px; height: 18px; width: 18px; }
.video-card {
  width: min(860px, 100%);
  box-sizing: border-box;
  margin: 1.5em auto 0;
  padding: 1em;
  border: 1px solid rgba(129, 146, 238, 0.35);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
}
.video-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 12px;
  background: #000;
}
.video-frame iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
.video-facade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.55em;
  border: 0;
  cursor: pointer;
  color: #fff;
  font: inherit;
  background:
    radial-gradient(320px 180px at 50% 30%, rgba(102, 126, 234, 0.35), transparent 70%),
    #14122b;
}
.video-facade .play {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--ms-primary-strong, #4c5bd4);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
  transition: transform 160ms ease;
}
.video-facade:hover .play { transform: scale(1.06); }
.video-facade mat-icon { font-size: 38px; width: 38px; height: 38px; color: #fff; }
.video-facade strong { font-size: 1.02rem; }
.video-facade small { opacity: 0.78; }
.video-caption { margin: 0.8em auto 0; font-size: 0.88em; opacity: 0.75; max-width: 36em; }
@media only screen and (max-width: 600px) {
  .hero { padding: 3em 1em 2.5em; }
  .video-card { padding: 0.65em; border-radius: 14px; }
  .video-frame { border-radius: 10px; }
}
.trust {
  display: flex;
  gap: 1.25em;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 1em;
  font-size: 0.88em;
  opacity: 0.9;
}
.trust span { display: inline-flex; align-items: center; gap: 0.35em; }
.trust mat-icon { font-size: 18px; height: 18px; width: 18px; color: var(--ms-ink-icon, #8192ee); }

`
})
export class BannerComponent {
  readonly showVideo = signal(false);

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
