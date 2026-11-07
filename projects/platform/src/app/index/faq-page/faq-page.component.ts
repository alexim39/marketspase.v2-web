import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

/**
 * Full public FAQ. Answers stay deliberately plain and avoid income claims;
 * the goal is informed signups, not pressure.
 */
@Component({
  selector: 'async-faq-page',
  imports: [MatButtonModule, MatIconModule, RouterModule],
  template: `
    <div class="mkt-page-hero">
      <div class="mkt-page-hero-inner">
        <nav class="mkt-breadcrumb" aria-label="Breadcrumb">
          <a routerLink="/">Home</a>
          <mat-icon aria-hidden="true" style="font-size: 14px; width: 14px; height: 14px;">chevron_right</mat-icon>
          <span>FAQ</span>
        </nav>
        <p class="mkt-eyebrow">Your online business questions</p>
        <h1>Make money online. Ask the real questions first.</h1>
        <p class="mkt-lede">
          What MarketSpase is, how you earn, what Ora does and why you never have to chase
          anyone. If your question is not here, a real human is one message away.
        </p>
        <div class="mkt-actions">
          <a mat-flat-button color="primary" routerLink="/partner/signup">Start your online business</a>
          <a
            mat-stroked-button
            href="https://wa.me/2348080386208?text=Hello%20MarketSpase%2C%20I%20have%20a%20question."
            target="_blank"
            rel="noopener"
          >Ask on WhatsApp</a>
        </div>
      </div>
    </div>

    <section class="mkt-section" aria-labelledby="faq-getting-started">
      <div class="mkt-section-inner">
        <div class="mkt-section-head">
          <p class="mkt-eyebrow">Getting started</p>
          <h2 class="mkt-h2" id="faq-getting-started">The first things people ask.</h2>
        </div>
        <div class="mkt-faq">
          <details open>
            <summary>What kind of online business is this?</summary>
            <p>
              MarketSpase is a product-backed online business. You activate with a real product,
              earn from product sales and qualification, and use Ora to plan the day and prepare
              the work.
            </p>
          </details>
          <details>
            <summary>Who can join MarketSpase?</summary>
            <p>
              Anyone ready to build a product business can create an account. The experience is
              designed with 18–35s in mind, but the platform is open to anyone willing to do the
              work and follow the rules.
            </p>
          </details>
          <details>
            <summary>Do I need experience or a following?</summary>
            <p>
              No. Ora gives you a daily plan, the academy teaches the basics and the community has
              your back. You need consistency and a willingness to learn — that&rsquo;s it.
            </p>
          </details>
          <details>
            <summary>Do I need an invitation or referral link?</summary>
            <p>
              No. Sign-up is open. Create an account with your name, phone and email, then verify
              your email. Campaign and referral links are tracked when present, but they are not
              required to join.
            </p>
          </details>
          <details>
            <summary>What happens after I sign up?</summary>
            <p>
              You get a free business account and dashboard. Verify your email, meet Ora, get your
              first plan and explore the academy. Activation is the next step when you are ready.
            </p>
          </details>
          <details>
            <summary>Can I explore before paying anything?</summary>
            <p>
              Yes. You can look around, learn and talk to Ora before activation. Activation is what
              unlocks the allocation queue and commission eligibility.
            </p>
          </details>
        </div>
      </div>
    </section>

    <section class="mkt-section mkt-section--band" aria-labelledby="faq-money">
      <div class="mkt-section-inner">
        <div class="mkt-section-head">
          <p class="mkt-eyebrow">The business and the money</p>
          <h2 class="mkt-h2" id="faq-money">How you make money, explained plainly.</h2>
        </div>
        <div class="mkt-faq">
          <details>
            <summary>What am I buying when I activate?</summary>
            <p>
              A real MarketSpase starter product, shipped to the address you provide. The product
              and exact price are shown before you pay. It is not a recruitment fee.
            </p>
          </details>
          <details>
            <summary>How do I make money?</summary>
            <p>
              Through product sales, team and placement commissions, the Activation Mentor Bonus
              and store or retail orders. Every earning path is visible in your wallet, with
              pending, released and withdrawn amounts.
            </p>
          </details>
          <details>
            <summary>Do I have to chase or call people?</summary>
            <p>
              No. MarketSpase runs central ads and routes the interest through fair allocation.
              Ora prepares the follow-ups and you approve what sends. No cold, warm or hot call
              scripts.
            </p>
          </details>
          <details>
            <summary>How does placement work?</summary>
            <p>
              Activated partners join a fair allocation queue. Placement uses eligible funded
              campaigns, capacity and fairness, with wait time and fit weighted in. You can keep
              learning, retail products and build your team while you are queued.
            </p>
          </details>
          <details>
            <summary>Do I have to fund campaigns?</summary>
            <p>
              No. Funding a campaign is optional. It is a restricted advertising budget used to run
              central advertising, and it can influence allocation priority within a capped weight.
            </p>
          </details>
          <details>
            <summary>Are there ranks?</summary>
            <p>
              Yes: Partner, Builder, Leader and Ambassador. Ranks are earned through product
              activity, retail customers, team development, retention and training — not through
              registration count.
            </p>
          </details>
          <details>
            <summary>What should I know before funding a campaign?</summary>
            <p>
              You choose the budget and can follow its status in your dashboard. The campaign terms
              explain how pause, cancellation and any unspent budget are handled, so you always know
              where your money is.
            </p>
          </details>
        </div>
      </div>
    </section>

    <section class="mkt-section" aria-labelledby="faq-ora">
      <div class="mkt-section-inner">
        <div class="mkt-section-head">
          <p class="mkt-eyebrow">Ora and the platform</p>
          <h2 class="mkt-h2" id="faq-ora">The AI partner, in plain language.</h2>
        </div>
        <div class="mkt-faq">
          <details>
            <summary>What is Ora?</summary>
            <p>
              Ora is your AI business partner. It knows your rank, progress, pipeline, campaigns and
              team. Ask what to do, get a personal plan and approve the actions you want it to
              prepare.
            </p>
          </details>
          <details>
            <summary>Can Ora act without me?</summary>
            <p>
              No. Ora can prepare actions — campaigns, follow-ups, team messages — but you confirm
              before anything runs. You stay in control.
            </p>
          </details>
          <details>
            <summary>Does Ora replace my upline or team?</summary>
            <p>
              Ora is always-on support that works alongside your campaign owner, mentor, team and
              community. The human relationships still matter.
            </p>
          </details>
          <details>
            <summary>Is my data safe?</summary>
            <p>
              We handle account data under our Privacy Policy. Ora uses your business state to
              personalise guidance, and you control every action it prepares.
            </p>
          </details>
          <details>
            <summary>What if I need a human?</summary>
            <p>
              Message the team on WhatsApp or use support in the app. A real person is ready
              whenever you need one.
            </p>
          </details>
        </div>
      </div>
    </section>

    <section class="mkt-section" aria-labelledby="faq-cta-title">
      <div class="mkt-section-inner">
        <div class="mkt-cta">
          <p class="mkt-eyebrow">Still curious?</p>
          <h2 id="faq-cta-title">The best way to understand it is to look inside.</h2>
          <p>Create a free account and explore at your own pace. No pressure, no invitation, no card required to sign up.</p>
          <div class="mkt-actions">
            <a mat-flat-button color="primary" routerLink="/partner/signup">Start your online business</a>
            <a mat-stroked-button routerLink="/how-it-works">How it works</a>
          </div>
          <p class="mkt-fine">Free to join. Activation is a real product purchase.</p>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class FaqPageComponent {}
