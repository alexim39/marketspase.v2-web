import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

/**
 * The brand story page. It explains the "why" behind MarketSpase without
 * inventing traction claims or promising income.
 */
@Component({
  selector: 'async-about-page',
  imports: [MatButtonModule, MatIconModule, RouterModule],
  template: `
    <div class="mkt-page-hero">
      <div class="mkt-page-hero-inner">
        <nav class="mkt-breadcrumb" aria-label="Breadcrumb">
          <a routerLink="/">Home</a>
          <mat-icon aria-hidden="true" style="font-size: 14px; width: 14px; height: 14px;">chevron_right</mat-icon>
          <span>About</span>
        </nav>
        <p class="mkt-eyebrow">About the opportunity</p>
        <h1>We built the online business opportunity we wished existed.</h1>
        <p class="mkt-lede">
          MarketSpase is a product-backed online business for people who want to earn online
          without chasing, cold-calling or pitching friends. We combine a real product, fair
          allocation and an AI business partner that prepares the work.
        </p>
        <div class="mkt-actions">
          <a mat-flat-button color="primary" routerLink="/partner/signup">Start your online business</a>
          <a mat-stroked-button routerLink="/how-it-works">See how it works</a>
        </div>
      </div>
    </div>

    <section class="mkt-section" aria-labelledby="story-title">
      <div class="mkt-section-inner mkt-split">
        <div>
          <p class="mkt-eyebrow">Our story</p>
          <h2 class="mkt-h2" id="story-title">The problem was never ambition. It was the model.</h2>
          <p class="mkt-lede">
            Young people want to earn online. But most opportunities ask them to chase leads,
            cold-call strangers, pitch friends and figure everything out alone.
          </p>
          <p class="mkt-lede">
            We wanted a different experience: a real product, a platform that brings the interest
            and an AI business partner that prepares the work. Social, community and AI working together
            instead of pulling in different directions.
          </p>
          <p class="mkt-lede">
            MarketSpase is that online business opportunity. It is still growing, and we are
            building it with the people who use it.
          </p>
        </div>
        <div>
          <blockquote class="mkt-quote">
            <p>&ldquo;A system, a real product and a coach who knows your next move — then your consistency does the rest.&rdquo;</p>
            <span>The MarketSpase team</span>
          </blockquote>
          <div class="mkt-grid mkt-grid--2" style="margin-top: 1rem;">
            <div class="mkt-stat">
              <strong>Online business</strong>
              <span>Built for people who want to earn without chasing.</span>
            </div>
            <div class="mkt-stat">
              <strong>AI-guided</strong>
              <span>Ora turns your business data into a daily plan.</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="mkt-section mkt-section--band" aria-labelledby="values-title">
      <div class="mkt-section-inner">
        <div class="mkt-section-head">
          <p class="mkt-eyebrow">What we stand for</p>
          <h2 class="mkt-h2" id="values-title">Four things we refuse to compromise.</h2>
        </div>
        <div class="mkt-grid mkt-grid--4">
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--teal" aria-hidden="true"><mat-icon>inventory_2</mat-icon></span>
            <h3>Product over promises</h3>
            <p>The product is real, the margin is real and the commissions trace back to it.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--violet" aria-hidden="true"><mat-icon>do_not_disturb_on</mat-icon></span>
            <h3>No chasing by design</h3>
            <p>Central ads and fair allocation mean you&rsquo;re not hunting strangers or pitching friends.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--amber" aria-hidden="true"><mat-icon>balance</mat-icon></span>
            <h3>Fairness you can see</h3>
            <p>Allocation records its reasons, campaign money stays separate and every earning has a trail.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile" aria-hidden="true"><mat-icon>auto_awesome</mat-icon></span>
            <h3>Coaching that shows up</h3>
            <p>Ora is available when you are, so support fits your schedule.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="mkt-section" aria-labelledby="audience-title">
      <div class="mkt-section-inner">
        <div class="mkt-section-head mkt-section-head--left">
          <p class="mkt-eyebrow">Who it is for</p>
          <h2 class="mkt-h2" id="audience-title">Built with 18–35 in mind. Open to anyone ready to build.</h2>
          <p class="mkt-sub">
            You do not need a business background or a big audience. You need a little
            consistency and the willingness to learn a real skill.
          </p>
        </div>
        <div class="mkt-grid mkt-grid--3">
          <article class="mkt-card">
            <span class="mkt-icon-tile" aria-hidden="true"><mat-icon>school</mat-icon></span>
            <h3>Students and fresh graduates</h3>
            <p>You have time, curiosity and data. Build a real online business while you figure out your next step.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--violet" aria-hidden="true"><mat-icon>movie</mat-icon></span>
            <h3>Creators and side-hustlers</h3>
            <p>You already understand attention. Add a product-backed online business and a coach who keeps you consistent.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--teal" aria-hidden="true"><mat-icon>work</mat-icon></span>
            <h3>Young professionals and parents</h3>
            <p>Busy schedules need focus. Ora gives you the short list that fits your day.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="mkt-section mkt-section--soft" aria-labelledby="about-ora-title">
      <div class="mkt-section-inner mkt-split">
        <div>
          <p class="mkt-eyebrow">Ora, your AI business partner</p>
          <h2 class="mkt-h2" id="about-ora-title">The operator behind your online business.</h2>
          <p class="mkt-lede">
            Most opportunities leave you with a script and a group chat. Ora knows your rank,
            pipeline, campaigns and team — and prepares the work for your approval. Every member
            and partner gets a coach that understands their next move.
          </p>
          <ul class="mkt-value-list">
            <li><mat-icon aria-hidden="true">check_circle</mat-icon><span>Personal answers built from your real business state.</span></li>
            <li><mat-icon aria-hidden="true">check_circle</mat-icon><span>Daily actions, campaign drafts and team follow-ups.</span></li>
            <li><mat-icon aria-hidden="true">check_circle</mat-icon><span>You confirm every action before it runs.</span></li>
          </ul>
          <a class="mkt-inline-link" routerLink="/ora">Meet Ora properly <mat-icon aria-hidden="true">arrow_forward</mat-icon></a>
        </div>
        <div class="mkt-ora-window">
          <div class="mkt-ora-head">
            <span class="mkt-ora-avatar" aria-hidden="true">O</span>
            <div class="mkt-ora-head-text">
              <strong>Ora</strong>
              <span class="mkt-ora-status">Always in your corner</span>
            </div>
          </div>
          <div class="mkt-ora-body">
            <div class="mkt-msg mkt-msg--user">
              <p>What should I focus on this week?</p>
            </div>
            <div class="mkt-msg mkt-msg--ora">
              <p>Your campaign is healthy. The bigger opportunity is retention: 2 new partners need their first-week check-in and 1 Builder needs support with their frontline.</p>
              <p>Want me to build a 20-minute plan for each?</p>
              <div class="mkt-msg-actions">
                <span>Approve plan</span>
                <span>Edit plan</span>
              </div>
            </div>
          </div>
          <div class="mkt-ora-input">
            <span>Ask Ora anything…</span>
            <span class="mkt-ora-send" aria-hidden="true"><mat-icon>arrow_upward</mat-icon></span>
          </div>
        </div>
      </div>
    </section>

    <section class="mkt-section" aria-labelledby="about-cta-title">
      <div class="mkt-section-inner">
        <div class="mkt-cta">
          <p class="mkt-eyebrow">Build with us</p>
          <h2 id="about-cta-title">Your online business starts here.</h2>
          <p>Create a free account, look around and meet the coach who will know your business as well as you do.</p>
          <div class="mkt-actions">
            <a mat-flat-button color="primary" routerLink="/partner/signup">Start your online business</a>
            <a mat-stroked-button routerLink="/partner/signin">Sign in</a>
          </div>
          <p class="mkt-fine">Free to join. Activation is a real product purchase.</p>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class AboutPageComponent {}
