# Phase 1 — Wallet and Home pilot

This phase proves the shared-facade wrapper pattern on two real pages before it
is rolled across the rest of the platform.

## Wallet dashboard

```text
dashboard/wallet/dashboard/
  index.component.ts                 # device wrapper + facade provider
  state/wallet-dashboard.facade.ts   # single data/action source
  desktop/wallet-dashboard.component.ts
  mobile/wallet-dashboard.component.{ts,html,scss}
```

- The facade is provided on the wrapper.
- Both views call `ensureLoaded()`, which is idempotent.
- The initial loading guard starts a request exactly once.
- The mobile view turns the wide balance panel into a gradient balance card,
  a vertical metrics list, a 2×2 action grid and tappable transaction cards.
- The desktop template and layout are unchanged.

## Home

```text
dashboard/home/
  index.component.ts                 # device wrapper + facade provider
  state/home.facade.ts               # all 13 Home reads and page actions
  desktop/home.component.ts          # original desktop template/styles
  mobile/home.component.{ts,html,scss}
```

- The compact launch-path card now sits **above** the device conditional in
  the wrapper. It stays mounted across a resize, so its five aggregate reads
  are not repeated.
- The mobile view prioritises: activation/profile/bonus, greeting, next best
  action, growth state, weekly briefing, quick actions, at-a-glance cards,
  starter checklist, today’s plan, community and activity.
- Glance and post cards use descendant selectors because their content is
  projected through `async-mobile-card`.

## Duplicate-request protection

Two layers keep network reads stable:

1. Page facades are provided on the wrapper and survive view swaps.
2. `httpCacheInterceptor` shares identical concurrent GETs. Two components
   asking for the same read at the same time receive one network response.
   The in-flight entry is removed on completion or error.

Verified on the authenticated dashboard:

- `390×844` and `1440×900`
- no horizontal overflow
- desktop Home remained mounted while the view switched
- **zero duplicate request URLs**
- **zero additional requests on resize**

## Shared fixes

- The compact launch-path card now uses a two-column grid below 640px; its
  action wraps under the copy instead of squeezing the title.
- The mobile wallet cashflow rows show full amounts; tablet switches to a
  three-column layout.
