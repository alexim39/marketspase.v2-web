# Product commission reporting and reconciliation

Last verified: 2026-11-09.

Admin location: **Admin desk → Compensation → Product economics**.

## What the report covers

Only product orders on the growth plan (`commissionPlan = growth`). Legacy
10/5/3/2/1 carts are intentionally excluded; they have their own ledger.

Date range: defaults to the last 90 days. `to` is inclusive through the end of
the selected day. The report caps at the latest 5,000 orders in the range and
marks `meta.truncated` when that cap is reached.

## Metrics

- **Revenue** — what buyers paid, including partner-price resale orders.
- **Gross margin** — product revenue minus COGS, shipping cost and the 1.5%
  payment-fee assumption stored at checkout.
- **Commissionable margin** — the subset where the product was marked
  commissionable and COGS was above zero.
- **Released / Pending commission** — growth ledger amounts.
- **Platform retained** — gross margin minus released commission. This is a
  working figure, not a full P&L.
- **Released rate / pending rate** — commission as a percentage of
  commissionable margin.

## Breakdowns

- **By sale mode** — personal, resale and mixed carts.
- **By product** — units, revenue, gross margin, commissionable margin and
  allocated released/pending commission.

Product-level commission is allocated by each product's share of the cart's
commissionable margin. It is an attribution view, not a second ledger.

## Exceptions

- **Missing accrual** — a Pending/Fulfilled growth order has no product
  commission sale.
- **Fulfilled, not released** — the order is fulfilled but the sale is not in
  `released` state.
- **Cancelled, not voided** — the order is cancelled but its commission sale
  is not `voided`.

The exception table shows up to 100 samples and counts all matches.

## Reconciliation

`POST /v1/admin/compensation/product-reconcile`

- Default is a **dry run**: `{ "apply": false }`.
- `{ "apply": true }` re-runs `accrueProductSale` for orders with no sale.
- It **never releases or voids** entries. Those remain explicit admin actions.
- It scans Pending and Fulfilled growth orders only. Cancelled orders with a
  missing sale do not need accrual.
- Results: scanned, missing (this batch), missingTotal, repaired, failed, and
  failure samples.
- Runs are audited as `commission.product_reconcile`.

## API

- `GET /v1/admin/compensation/product-report?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /v1/admin/compensation/product-reconcile`
- Admin-only, cookie or bearer session.

## CSV

The Product economics tab exports the product breakdown and summary totals as
a CSV. Product names containing commas, quotes or newlines are escaped.

## Limitations

- No historical snapshot of the report; it is generated from current ledger
  and cart snapshots.
- No refund line-item allocation; the whole order is refunded today.
- No PDF report yet.
