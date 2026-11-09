# Resale hub

Last verified: 2026-11-09.

Status: **live for verified partners**. Resale pricing is managed from
**Admin → Products**.

## Model

- **Partner price** — what a partner pays from their wallet.
- **Suggested retail price** — what the partner may charge their customer.
- **Partner margin** — suggested retail − partner price. This is the partner's
  trade income, not a platform commission.
- **Platform margin** — partner price − COGS − shipping − payment fee. Unilevel
  commission, when enabled, is calculated from this lower base.

The platform never collects the partner's retail leg. The customer pays the
partner directly; the partner keeps the spread.

## Enable resale for a product

1. Open **Admin → Products**.
2. Enter **COGS** and **shipping cost** so the platform margin is real.
3. Enter **Partner price** — the amount the partner pays.
4. Enter **Suggested retail** — the amount the partner can charge.
5. Save. The product appears in **Products → Resell** for verified partners.

If **Partner price** is zero, the product is hidden from the resale catalog.
If **Suggested retail** is missing, the normal product price is used as the
suggestion.

## API surface

- `GET /products/resale/catalog` — signed-in, verified partners only. Returns
  `partnerPrice`, `retailPrice`, stock and public catalog fields. COGS is never
  returned.
- `POST /products/cart` — accepts `saleMode: "resale"` per line. The server
  re-checks partner status and uses `partnerPrice`; client prices are ignored.
- The cart and order store the partner price, suggested retail and sale mode as
  a snapshot.

## Checkout and orders

- A resale line shows **Resale**, the partner price and the suggested retail.
- The checkout total is the partner-price total. The suggested resale margin is
  shown separately and is **not** added to the amount due.
- My orders marks resale orders and shows the suggested resale margin.
- The downloadable receipt records the partner price paid and the suggested
  resale margin.

## Share caption

The Resell hub copies a caption with the product name, suggested retail price,
short description and the partner's public page link. Partner price is never
included in the share text.

## What is intentionally not included

- No multi-level payout on the partner's retail spread.
- No platform handling of the partner's customer payment.
- No resale volume contribution to rank progression yet.
