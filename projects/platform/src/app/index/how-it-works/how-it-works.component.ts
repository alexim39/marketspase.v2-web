import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

/**
 * Public explainer page. Keeps the model honest: real product activation,
 * central acquisition, fair allocation, product-margin rewards and a rank
 * path built on activity — never on registration fees.
 */
@Component({
  selector: 'async-how-it-works',
  imports: [MatButtonModule, MatIconModule, RouterModule],
  template: `
    <div class="mkt-page-hero">
      <div class="mkt-page-hero-inner">
        <nav class="mkt-breadcrumb" aria-label="Breadcrumb">
          <a routerLink="/">Home</a>
          <mat-icon aria-hidden="true" style="font-size: 14px; width: 14px; height: 14px;">chevron_right</mat-icon>
          <span>How it works</span>
        </nav>
        <p class="mkt-eyebrow">How your online business works</p>
        <h1>Your online business, without the chase.</h1>
        <p class="mkt-lede">
          You want to make money online. You don&rsquo;t want to cold-call, chase strangers or
          pitch your friends. MarketSpase is built around that exact problem.
        </p>
        <div class="mkt-actions">
          <a mat-flat-button color="primary" routerLink="/partner/signup">Start your online business</a>
          <a mat-stroked-button routerLink="/ora">Meet Ora</a>
        </div>
        <p class="mkt-fine">
          No invitation needed. Activation is a real product purchase, and every next step is shown in your dashboard.
        </p>
      </div>
    </div>

    <section class="mkt-section" aria-labelledby="roles-title">
      <div class="mkt-section-inner">
        <div class="mkt-section-head">
          <p class="mkt-eyebrow">The problem · The fix</p>
          <h2 class="mkt-h2" id="roles-title">You bring the yes. MarketSpase brings the system.</h2>
          <p class="mkt-sub">
            No chasing. No cold calls. No guesswork. The platform and Ora handle the parts people
            hate; you stay in control of the next move.
          </p>
        </div>

        <div class="mkt-grid mkt-grid--2">
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--teal" aria-hidden="true"><mat-icon>person</mat-icon></span>
            <h3>Your part</h3>
            <ul class="mkt-value-list">
              <li><mat-icon aria-hidden="true">check_circle</mat-icon><span>Approve the next action from Ora.</span></li>
              <li><mat-icon aria-hidden="true">check_circle</mat-icon><span>Have real conversations with interested people.</span></li>
              <li><mat-icon aria-hidden="true">check_circle</mat-icon><span>Use the products and support your team.</span></li>
              <li><mat-icon aria-hidden="true">check_circle</mat-icon><span>Keep learning and keep your business qualified.</span></li>
            </ul>
          </article>
          <article class="mkt-card mkt-card--brand">
            <span class="mkt-icon-tile" aria-hidden="true"><mat-icon>settings_suggest</mat-icon></span>
            <h3>MarketSpase&rsquo;s part</h3>
            <ul class="mkt-value-list">
              <li><mat-icon aria-hidden="true">check_circle</mat-icon><span>Run central ads and route the interest.</span></li>
              <li><mat-icon aria-hidden="true">check_circle</mat-icon><span>Allocate activated partners fairly and explainably.</span></li>
              <li><mat-icon aria-hidden="true">check_circle</mat-icon><span>Provide the product, payments, wallet and ledger.</span></li>
              <li><mat-icon aria-hidden="true">check_circle</mat-icon><span>Give you Ora, training, community and team tools.</span></li>
            </ul>
          </article>
        </div>
      </div>
    </section>

    <section class="mkt-section mkt-section--band" aria-labelledby="journey-title">
      <div class="mkt-section-inner">
        <div class="mkt-section-head">
          <p class="mkt-eyebrow">Your journey</p>
          <h2 class="mkt-h2" id="journey-title">From wanting to earn online to a business that knows its next move.</h2>
        </div>
        <ol class="mkt-steps">
          <li class="mkt-step">
            <span class="mkt-step-num">1</span>
            <h3>Start free. Meet Ora.</h3>
            <p>
              Verify your email and get your first plan. Explore the academy and community
              before spending anything — and see how the business works.
            </p>
          </li>
          <li class="mkt-step mkt-step--accent">
            <span class="mkt-step-num">2</span>
            <h3>Activate your online business</h3>
            <p>
              Buy the MarketSpase starter product at the price shown before you pay. It ships
              to your address. Complete KYC and join the allocation queue.
            </p>
          </li>
          <li class="mkt-step">
            <span class="mkt-step-num">3</span>
            <h3>Let the platform bring the interest</h3>
            <p>
              MarketSpase runs central ads and allocates activated partners fairly to funded
              campaigns. No chasing, no cold lists, no call scripts.
            </p>
          </li>
          <li class="mkt-step">
            <span class="mkt-step-num">4</span>
            <h3>Approve the next move</h3>
            <p>
              Ora prepares follow-ups, campaigns and team check-ins. You approve, track your
              wallet and build week by week.
            </p>
          </li>
        </ol>

        <blockquote class="mkt-quote" style="margin-top: 1.4rem;">
          <p>&ldquo;A good online business system tells you the truth, then shows you the next step.&rdquo;</p>
          <span>The MarketSpase product principle</span>
        </blockquote>
      </div>
    </section>

    <section class="mkt-section" aria-labelledby="money-title">
      <div class="mkt-section-inner">
        <div class="mkt-section-head mkt-section-head--left">
          <p class="mkt-eyebrow">How you make money</p>
          <h2 class="mkt-h2" id="money-title">More than one way to earn online.</h2>
          <p class="mkt-sub">
            Your online business earns from real product activity and team growth.
            Every earning path is visible in your wallet.
          </p>
        </div>
        <div class="mkt-grid mkt-grid--4">
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--teal" aria-hidden="true"><mat-icon>inventory_2</mat-icon></span>
            <h3>Product sales</h3>
            <p>Earn from real MarketSpase products and everyday customer orders.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile" aria-hidden="true"><mat-icon>groups</mat-icon></span>
            <h3>Team &amp; placement commissions</h3>
            <p>Earn as the partners placed with you grow, sell and qualify.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--violet" aria-hidden="true"><mat-icon>card_giftcard</mat-icon></span>
            <h3>Activation Mentor Bonus</h3>
            <p>Earn for supporting a new partner through their first days in the business.</p>
          </article>
          <article class="mkt-card">
            <span class="mkt-icon-tile mkt-icon-tile--amber" aria-hidden="true"><mat-icon>storefront</mat-icon></span>
            <h3>Store &amp; retail orders</h3>
            <p>Earn from store orders and the products your customers already want.</p>
          </article>
        </div>
        <div class="mkt-grid mkt-grid--3" style="margin-top: 1rem;">
          <div class="mkt-stat">
            <strong>Product margin</strong>
            <span>Commissions come from real product sales, not registration fees.</span>
          </div>
          <div class="mkt-stat">
            <strong>Campaign money</strong>
            <span>Advertising budget stays separate from commissions and rank volume.</span>
          </div>
          <div class="mkt-stat">
            <strong>Your wallet</strong>
            <span>Pending, released and withdrawn earnings are visible in one ledger.</span>
          </div>
        </div>
        <p class="mkt-fine">
          Commissions are tied to product activity and qualification. Your rank unlocks deeper team
          rewards as you build.
        </p>
      </div>
    </section>

    <section class="mkt-section mkt-section--soft" aria-labelledby="rank-title">
      <div class="mkt-section-inner">
        <div class="mkt-section-head">
          <p class="mkt-eyebrow">The rank path</p>
          <h2 class="mkt-h2" id="rank-title">Grow from Partner to Ambassador.</h2>
          <p class="mkt-sub">Ranks are earned through product activity, retail customers, team development and training.</p>
        </div>
        <ul class="mkt-ladder" aria-label="Partner rank path" style="margin-bottom: 1.6rem;">
          <li>Partner</li>
          <li class="mkt-ladder-arrow" aria-hidden="true"><mat-icon>arrow_forward</mat-icon></li>
          <li>Builder</li>
          <li class="mkt-ladder-arrow" aria-hidden="true"><mat-icon>arrow_forward</mat-icon></li>
          <li>Leader</li>
          <li class="mkt-ladder-arrow" aria-hidden="true"><mat-icon>arrow_forward</mat-icon></li>
          <li class="is-current">Ambassador</li>
        </ul>
        <div class="mkt-grid mkt-grid--4">
          <article class="mkt-card">
            <h3>Partner</h3>
            <p>The foundation. Complete onboarding and training, get verified and start making your first customer moves.</p>
          </article>
          <article class="mkt-card">
            <h3>Builder</h3>
            <p>Build a retail base and develop your frontline. Team depth and consistent product activity start to matter.</p>
          </article>
          <article class="mkt-card">
            <h3>Leader</h3>
            <p>Develop Builders, lead frontline teams and keep customer satisfaction strong while your organisation grows.</p>
          </article>
          <article class="mkt-card">
            <h3>Ambassador</h3>
            <p>Organisation depth, leadership development and a track record of service. The highest recognition in the plan.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="mkt-section" aria-labelledby="questions-title">
      <div class="mkt-section-inner">
        <div class="mkt-section-head">
          <p class="mkt-eyebrow">Before you start</p>
          <h2 class="mkt-h2" id="questions-title">The short answers.</h2>
        </div>
        <div class="mkt-faq">
          <details open>
            <summary>Can I start before I activate?</summary>
            <p>Yes. Create a free account, verify your email and explore the platform. Activation unlocks the allocation queue and commission eligibility.</p>
          </details>
          <details>
            <summary>Do I have to chase or call people?</summary>
            <p>No. MarketSpase runs central ads and routes the interest through fair allocation. Ora prepares the follow-ups and you approve what sends. No cold, warm or hot call scripts.</p>
          </details>
          <details>
            <summary>How does a campaign budget work?</summary>
            <p>A campaign is a restricted advertising budget used to run central advertising. It can support your allocation priority within a capped weight, and every placement follows the fairness rules and available capacity.</p>
          </details>
        </div>
        <div class="mkt-actions" style="justify-content: center; margin-top: 1.5rem;">
          <a mat-button routerLink="/faq">Read all frequently asked questions →</a>
        </div>
      </div>
    </section>

    <section class="mkt-section" aria-labelledby="how-cta-title">
      <div class="mkt-section-inner">
        <div class="mkt-cta">
          <p class="mkt-eyebrow">Ready when you are</p>
          <h2 id="how-cta-title">Start free. Meet Ora. See your first plan.</h2>
          <p>You do not need to have it all figured out. You need a free account and a few focused minutes.</p>
          <div class="mkt-actions">
            <a mat-flat-button color="primary" routerLink="/partner/signup">Start your online business</a>
            <a mat-stroked-button routerLink="/ora">Meet Ora first</a>
          </div>
          <p class="mkt-fine">Free to join. Activation is a real product purchase.</p>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class HowItWorksComponent {}
