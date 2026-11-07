import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * The "why now" story: the internet already has the audience, MarketSpase
 * supplies the system, and the contrast makes the new model obvious.
 */
@Component({
  selector: 'async-index-why-now',
  imports: [MatIconModule],
  template: `
    <section class="mkt-section" aria-labelledby="why-now-title">
      <div class="mkt-section-inner">
        <div class="mkt-section-head mkt-section-head--left">
          <p class="mkt-eyebrow">The problem · The opportunity</p>
          <h2 class="mkt-h2" id="why-now-title">You want to make money online. You just don&rsquo;t want the old hustle.</h2>
          <p class="mkt-sub">
            The problem was never your ambition. It was the model: find leads, cold-call, pitch
            friends, guess what to do and hope it works. MarketSpase replaces that with a real
            online business, guided by AI.
          </p>
        </div>

        <div class="mkt-grid mkt-grid--3">
          <article class="mkt-card">
            <span class="mkt-icon-tile"><mat-icon aria-hidden="true">storefront</mat-icon></span>
            <h3>You want an online business</h3>
            <p>Not another side hustle. A real, product-backed business opportunity with a system and a path to income.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--rose"><mat-icon aria-hidden="true">do_not_disturb_on</mat-icon></span>
            <h3>You don&rsquo;t want to chase</h3>
            <p>No cold calls, no warm lists, no pitching friends and family. MarketSpase brings the interest.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--teal"><mat-icon aria-hidden="true">auto_awesome</mat-icon></span>
            <h3>You need a system</h3>
            <p>Ora turns your goals into a daily plan and prepares the work you approve. No blank page, no guesswork.</p>
          </article>
        </div>

        <div class="mkt-compare" style="margin-top: 1rem;">
          <article class="mkt-compare-col mkt-compare-col--old">
            <div class="mkt-compare-head">
              <mat-icon aria-hidden="true">cancel</mat-icon>
              <h3>The old way to earn online</h3>
            </div>
            <ul>
              <li><mat-icon aria-hidden="true">close</mat-icon> Chase friends and family until it gets awkward</li>
              <li><mat-icon aria-hidden="true">close</mat-icon> Buy cold lead lists and hope for the best</li>
              <li><mat-icon aria-hidden="true">close</mat-icon> Cold-call, warm-call and hot-call your way through the day</li>
              <li><mat-icon aria-hidden="true">close</mat-icon> Wake up with no idea what to do next</li>
              <li><mat-icon aria-hidden="true">close</mat-icon> Wait days for your upline to reply</li>
              <li><mat-icon aria-hidden="true">close</mat-icon> Keep your business in your head and your notes app</li>
            </ul>
          </article>

          <article class="mkt-compare-col mkt-compare-col--new">
            <div class="mkt-compare-head">
              <mat-icon aria-hidden="true">verified</mat-icon>
              <h3>The MarketSpase way</h3>
            </div>
            <ul>
              <li><mat-icon aria-hidden="true">check_circle</mat-icon> MarketSpase runs the ads and routes the interest</li>
              <li><mat-icon aria-hidden="true">check_circle</mat-icon> Activated partners are matched through fair, explainable allocation</li>
              <li><mat-icon aria-hidden="true">check_circle</mat-icon> No cold, warm or hot call grind</li>
              <li><mat-icon aria-hidden="true">check_circle</mat-icon> Ora gives you a daily plan and prepares the follow-ups</li>
              <li><mat-icon aria-hidden="true">check_circle</mat-icon> You approve, edit or skip the next move</li>
              <li><mat-icon aria-hidden="true">check_circle</mat-icon> Real product, transparent wallet and one business dashboard</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class WhyNowComponent {}
