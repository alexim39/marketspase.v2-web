# Product-sale commission rule

Last verified: 2026-11-09.

Status: **implemented for new product orders**. `PRODUCT_COMMISSION_PLAN`
defaults to `growth`; set it to `legacy` only to roll back new orders. Existing
legacy carts keep the old accrual path until they are released or voided. The
same rule now covers every growth-plan product order, including repeat orders;
activation orders accrue activation commissions separately.

Phase 1 ships the product catalog and product page. This rule is wired into
product checkout and order fulfilment; it does not touch Paystack transfers.

## Decision in one line

Pay the existing **4-rank, 5-level growth plan on product gross margin**, and
treat a reseller's retail spread as **direct trade margin**, not a commission.

## Why not the legacy shop plan

The legacy cart plan pays:

| Level | 1 | 2 | 3 | 4 | 5 | Total |
|---|---|---|---|---|---|---|
| Rate on purchase total | 10% | 5% | 3% | 2% | 1% | **21%** |

It is calculated on revenue, not margin. That is safe only when gross margin is
above 21%. On a thin-margin physical product it can pay out more than the
platform earns.

Worked example — a product sold at ₦20,000 with ₦8,000 cost of goods, ₦2,000
shipping and a 1.5% payment fee (₦300):

- Gross margin = ₦20,000 − ₦8,000 − ₦2,000 − ₦300 = **₦9,700**
- Legacy plan payout = 21% × ₦20,000 = **₦4,200**
- Growth plan payout = 18.5% × ₦9,700 = **₦1,794.50**
- Platform keeps: legacy ₦5,500 vs growth **₦7,905.50** before overheads

The growth plan still rewards the field, but the payout shrinks automatically
when a product's margin shrinks. The platform cannot promise money it did not
make.

## Recommended rule

### 1. Commission base

```
gross margin = sale price
             − cost of goods sold (COGS)
             − shipping cost borne by the platform
             − payment fee
             − tax / gateway fee
```

Floor the result at zero. Do not include shipping charged to the buyer, taxes
collected, or the reseller's own retail markup.

This is the same formula already used by activation orders in
`Onboarding.mongo.repository.js`.

### 2. Rates and depth

Use the canonical plan in `Compensation.plan.js`, unchanged:

| Level | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Rate on gross margin | 9% | 4.5% | 2.5% | 1.5% | 1% |

Rank depth remains:

| Rank | Partner | Builder | Leader | Ambassador |
|---|---|---|---|---|
| Levels paid | 1 | 2 | 3 | 5 |

Maximum field payout is therefore **18.5% of gross margin**. The platform keeps
at least 81.5% of margin before overheads.

### 3. Who earns

- Active partners only: `accountState = partner`, not suspended, KYC verified.
- The buyer is excluded.
- Walk the single upline chain (`partnerOf`). Every member — referred or
  campaign-allocated — has one upline. Product sales, activation commissions,
  mentor bonuses and the network tree all use this one chain, so a referred
  reseller's purchases pay their actual sponsor.
- Campaign history stays on `placementCampaignId`/`placedAt` for reporting and
  the “Campaign placement” badge; it is not a second parent edge.
- Members can buy products but do not earn unilevel commission until they
  activate.
- Rank is read at accrual time and stored on the entry, as the growth ledger
  already does. Commission depth reads `commissionRank`, which now auto-syncs
  from the journey/training rank through progression events and an hourly
  reconcile sweep. Admin override is an audited exception with a reason and
  optional expiry; expired overrides return to automatic sync. The journey
  rank shown on Progress and the earning rank therefore stay aligned by default.
  Run `npm run migrate:rank-sync` once before enabling auto-sync; matching
  legacy rows are tagged `auto`, while mismatches are preserved as `admin`
  overrides for review. Every change is recorded in `partner_rank_history`.

### 4. When it accrues and releases

1. Order is paid from the wallet → the cart stores a price/cost snapshot and
   Pending entries are created on the commissionable gross margin.
2. Admin fulfils the order → Pending entries are released and wallets credited.
3. Order is cancelled or refunded → Pending entries are voided; any already
   released entries are reversed with the existing clawback path.
4. If checkout accrual failed, fulfilment retries it before releasing, so a
   paid order is never lost to a transient error.

The facade points are `accrueProductSale`, `releaseProductSale` and
`voidProductSale` on the compensation repository. `PRODUCT_COMMISSION_PLAN`
selects the plan for new carts; the legacy 10/5/3/2/1 ledger is untouched.

### 5. Resale margin is separate

A partner buying for resale should see two different numbers:

- **Partner price** — what they pay the platform.
- **Suggested retail price** — what they charge their customer.
- **Your margin** — retail minus partner price. This is theirs. It is not a
  platform commission, not unilevel, and not clawed back by the platform.

The platform earns its normal margin on the partner-price sale. Upline
commissions accrue on that platform margin. The reseller's retail leg happens
outside the platform and must not be represented as platform revenue.

Example:

| Item | Amount |
|---|---|
| Suggested retail price | ₦20,000 |
| Partner price | ₦16,000 |
| Partner's direct margin | ₦4,000 |
| Platform margin on ₦16,000 (after COGS/shipping/fee) | ₦5,760 |
| Maximum unilevel payout (18.5%) | ₦1,065.60 |

The partner earns ₦4,000 from the trade and may also qualify for unilevel
commission as an upline on other partners' sales. The two earnings are shown
separately so nobody confuses a trade margin with a bonus.

### 6. Product-level controls

Add to each product:

- `cogs`, `shippingCost`, `partnerPrice`, `retailPrice`
- `commissionable` (**default false**)
- `status` (`active`, `inactive`, `archived`)
- `stock`

A product must be explicitly marked `commissionable: true` **and have a COGS
greater than zero** before it can create unilevel entries. This is deliberate:
production catalog rows currently have no cost data, and paying 18.5% on a
price with no recorded COGS would overpay the field. Admins should enter
COGS/shipping and enable commissionable per product. The shop keeps selling
either way; only the commission changes.

If `commissionable` is false, the sale still earns the reseller's direct margin
but creates no unilevel entries. Use it for low-margin, regulated or
marketplace-fulfilled items.

### 7. Guardrails

- Payout is capped at 18.5% of gross margin by construction; no separate cap
  needed, but keep a sanity assertion in tests.
- Zero or negative margin → zero commission, no error.
- Partial refund → reduce the margin base proportionally; do not leave a
  released commission on money that was returned.
- Discounts reduce the margin base, never the rate.
- Bundles use the sum of component COGS, not the bundle list price.
- Digital products have zero shipping; delivery fees must not be counted as
  margin.
- Store `grossMargin`, `rate`, `rankAtAccrual` and `saleType = product` on the
  entry for audit and exports.

## What this means for each audience

**Members (buying for use):** simple shop, wallet payment, order tracking. They
see no commission math. Their purchase still funds upline commissions, which
keeps the field rewarded for bringing buyers in.

**Partners (buying for resale):** clear partner price, suggested retail and
direct margin. Resale is a trade, not a promise of bonus income.

**Platform:** every commission is funded from realised margin. Thin-margin
products cannot drain the platform, and the 18.5% ceiling is unchanged from the
existing growth plan.

## Migration notes

- Leave historical `commission_entries` untouched.
- Mark the legacy 10/5/3/2/1 plan as legacy in admin reporting.
- Existing catalog rows default to `commissionable: false`. In **Admin →
  Products**, enter COGS and shipping, then enable **Commission** before
  expecting unilevel payouts.
- Accrue new product orders through the compensation ledger, not
  `billingService.accrue(cartId)`.
- Keep `billing/accrue` available for old carts until they are fully released;
  it now skips carts marked with the growth plan.
- Set `PRODUCT_COMMISSION_PLAN=legacy` only to roll back new orders. The
  legacy 10/5/3/2/1 ledger remains for historical carts.

## Resolved decisions

1. A partner's own product purchase (personal use) is commissionable to their
   upline, because the platform still earns margin.
2. Resale orders do not count toward rank progression until resale volume and
   returns are measurable; rank follows activation, personal recruits and
   verified team performance.
3. Shipping charged to the buyer is passed through at cost and never treated
   as margin.

## Success metrics

- Product gross margin per order.
- Commission cost as a percentage of product revenue (target: below 9% at
  current 50% margin, below 18.5% of margin always).
- Repeat purchase rate for members.
- Resale activation rate (partners who buy at partner price and reorder).
- Refund and reversal rate by product.
