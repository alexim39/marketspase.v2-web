# Phase 3 — money and products

This phase migrates the operational money and product pages behind device
wrappers, with shared facades so data and actions stay identical across views.

## Money

```text
dashboard/wallet/history/
dashboard/wallet/deposit/
dashboard/wallet/deposit/result/
dashboard/compensation/
```

- Wallet history: facade-backed filters, paging and load-more; mobile card list.
- Deposit: shared methods, amount validation and checkout handoff; mobile
  two-step flow with a sticky continue bar above the global bottom nav.
- Deposit result: shared polling state; mobile status page for checking,
  success, failure and missing-reference cases.
- Compensation: shared earnings, simulator, statement export and ledger;
  mobile summary, stream cards, rates, commission entries and mentor bonuses.

## Products

```text
dashboard/partner/products/catalog/
dashboard/partner/products/product-page/
dashboard/partner/products/resale/
dashboard/partner/products/my-store/
dashboard/partner/products/store-orders/
dashboard/partner/products/purchases/
dashboard/partner/products/checkout/
dashboard/partner/products/guides/
```

- Catalog: shared product filters, cart and load-more; mobile 2-column grid
  with category chips and cart CTA.
- Product page: shared gallery, stock, quantity and cart actions; mobile
  product detail with a sticky purchase flow in the body.
- Resale, My store, Store orders, My orders and Checkout use their existing
  responsive operational templates with a shared facade for logic and state.
- Product guides now has dedicated desktop/mobile components.

## Shared UI fix

`async-mobile-sticky-action` gained an `aboveBottomNav` mode. The catalog cart
bar and deposit continue bar now sit above the fixed dashboard bottom nav
instead of behind it.

## Verification

Checked at `390×844` and `1440×900`:

- all money pages render and load their data
- all product/store/checkout pages render without horizontal overflow
- catalog add-to-cart flows into a populated checkout
- checkout prefills the profile delivery address and shows the wallet shortfall
- no old component entry points remain in the routes
- full CI green
