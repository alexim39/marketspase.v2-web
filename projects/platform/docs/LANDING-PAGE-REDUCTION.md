# Landing Page Reduction

The public landing page was reduced from nine narrative sections to six. The
goal is conversion clarity: the visitor should understand the outcome, the
problem, the solution, what they do, how the money works and the cost before
being asked to sign up.

## Final structure

1. **Hero** — “Make money online without chasing anyone.” Primary CTA:
   **Start your online business**. One Ora plan preview.
2. **Problem + introduction video** — the old way versus the MarketSpase way,
   followed by the existing intro video.
3. **How it works** — three steps: start free, activate with the ₦38,000
   product, approve Ora’s plan and earn from product activity.
4. **Ora / why it is different** — three cards: Ora plans, Ora prepares, you
   approve.
5. **The money** — resale margin, store sales, activation/product commissions
   and the fixed ₦1,200 mentor bonus, plus the cost breakdown.
6. **Short FAQ + final CTA** — four questions and a closing
   **Start your online business** action.

## Removed from the landing page

- Duplicate “why now” section.
- Six-card “pillars” fear/fix section.
- Twelve-bullet old-way/new-way comparison.
- Separate “why we exist” mission section.
- Rank ladder (moved to the deeper how-it-works page).
- Second Ora mockup.
- Standalone final CTA section; the CTA now closes the FAQ section.

## Accuracy corrections

- Mentor bonus is **₦1,200**.
- Resale margin is the member buying at partner price and selling at retail.
- Sign-up alone, recruiting alone, training alone, campaign spend and
  deposits/withdrawals are explicitly listed as non-earning.

## Verification

- `npm run build:platform` passes.
- At 390px: one H1, six landing sections, intro video present, first CTA above
  the fold, no horizontal overflow.
- At 1440px: same section order, hero CTA present, no horizontal overflow.
- Copy still includes the ₦38,000 activation product, 2% store service fee and
  income qualification language.
- No testimonials were added.
