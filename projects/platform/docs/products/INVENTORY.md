# Inventory and stock

Last verified: 2026-11-09.

Status: **enforced at checkout**.

## Rules

- `stock` is a number: checkout reserves that many units atomically.
- `stock: null` means unlimited/untracked; no reservation or restoration.
- Zero stock blocks checkout with `INSUFFICIENT_STOCK`.
- A cart with the same product in personal and resale lines reserves the
  **combined** quantity once.
- Checkout runs stock reservation, wallet debit, ledger row and order creation
  in one Mongo transaction. If any step fails, everything rolls back.
- Cancelling a Pending order refunds the wallet and restores tracked stock in
  the same transaction.
- `stockRestored` on the order makes restoration idempotent.
- Fulfilled orders do not restore stock.

## Admin

Set stock in **Admin → Products → Stock**. Leave it blank for unlimited.
The product table shows **Unlimited**, the count, or a warning colour at 5 or
fewer units.

## Current limits

- No partial cancellation or line-level refunds yet; cancellation reverses the
  whole order.
- No stock reservation timeout because payment is instant from the wallet.
- No supplier/purchase-order tracking or low-stock alerts yet.
