# UI QA â€” Pass 1

**Date:** 2026-11-04  
**Scope:** single shell, public site, hub pages, cleanup regressions.  
**Status (2026-11-09):** historical QA snapshot from 2026-11-04. Route names have since changed: partner "page leads"/`personal-list` → **Customer Leads**; Buy Prospect is retired; the personal lead page is `/lead/<username>`. Partner bulk SMS/email outreach, contact analytics, team reports, contact lists, cell meetings, coaching notes, partner surveys, the admin Page Leads desk, session bookings and presentation kits were retired on 2026-11-09. Current API suite: 726 tests. Treat counts and route lists below as of the QA date.
**Method:** production build, public browser probes, axe-core, static reference scans, orphan-component scan.

---

## Step 1 â€” Build baseline

- `npm run build` â†’ **passes, no warnings**.
- Bundle after cleanup: admin chunk **343 kB**, prospects **250 kB**, tools **92 kB**.

## Step 2 â€” Public landing browser probe (790px viewport)

| Check | Result |
|---|---|
| Page renders | âœ“ |
| `main` landmark | âœ— â†’ fixed |
| `header` landmark | âœ— â†’ fixed |
| `footer` landmark | âœ— â†’ fixed |
| Horizontal overflow | âœ— 14px â†’ fixed |
| Empty links | âœ“ 0 |
| Unlabeled buttons | âœ“ 0 |
| H1 count | âœ“ 1 |
| Focusable control count | âœ“ 20 |

**Fix 1:** `.video-card` used `width: 100%` with `content-box`; padding pushed it 14px past the viewport. Added `box-sizing: border-box`.

**Fix 2:** wrapped the public content in `<main>`, the nav in `<header>`, the footer in `<footer>`.

## Step 3 â€” Accessibility (axe-core, public landing)

Before fixes:
- `landmark-one-main` (moderate)
- `region` â€” 13 nodes outside landmarks (moderate)

After fixes:
- **0 violations**

## Step 4 â€” Post-fix verification

- Landing `scrollWidth === clientWidth` (790/790).
- `main`, `header`, `footer` present.
- 1 H1.
- No empty links or unlabeled buttons.

## Step 5 â€” Orphan/dead-code scan

- Unreferenced components: **0** (only `AppComponent`, bootstrapped by `main.ts`).
- Unreferenced services/pipes: **0** (only internal transport classes in `notification-stream.service.ts`).
- No references remain to `--dp-*`, `general-list`, `admin/leads`, legacy campaign routes, or deleted auth/send code.

## Step 6 â€” Authenticated UI browser QA

Added a same-origin dev proxy so browser API calls avoid CORS:
- `platform/proxy.conf.json` â€” forwards all API prefixes + `/socket.io` to `127.0.0.1:3000`
- `environment.ts` (dev only) â€” `apiUrl: ''` so the SPA uses same-origin paths
- `angular.json` serve options â€” `proxyConfig: proxy.conf.json`

### Partner route sweep â€” 52 routes

`/dashboard`, Pipeline, Campaigns, Team, Wallet, Learn, Community, More; pipeline list/reminders/board; Customer Leads (then called page leads); bookings; kits; SMS/email compose; Training, Courses, Paths, Library, Tutorials, Coach, Analytics; Goals; Progress; Insights (overview, My Business, downloads); Wallet history/deposit; eShop/orders; Messages; Notifications center/preferences; Settings profile/landing/appearance/billing; Support ticket/about; Ora; Compensation; Activate; Checkout; My Partners; Activation board/confirmations/contact lists/team members; Network tree/org; Cell meeting.

Result:
- **0 issues** â€” every route rendered the shell + `<main>`, no horizontal overflow, no console errors.

### Admin route sweep

Blocked by intermittent `502 Bad Gateway` from the embedded browser's connection to the dev server (resources `main.js`, `polyfills.js`, logo). The same URLs return 200 from the host shell, so this is an environment/proxy limitation, not an app crash. Admin pages were reviewed statically and the admin route tree resolves.

### Accessibility fix found in the authenticated shell

- Angular Material warned: badge attached to an `aria-hidden` icon.
- Fixed: notification badge icon now uses `aria-hidden="false"` + `matBadgeDescription="unread notifications"`.

## Step 7 â€” Static accessibility scans

- Icon-only buttons: all have `aria-label`, `title` or `matTooltip` (a few flagged only because the binding used `[title]`/`[attr.aria-label]`).
- Form fields: 1 unlabeled field found in Messages group-chat edit â†’ added `aria-label="Edit message"`.
- Charts: all ECharts surfaces have `role="img"` + descriptive `aria-label`.
- Images: all `<img>` elements have `alt` bindings or text.
- Global focus ring, 44px touch targets and reduced-motion rules remain in place.

## Step 8 â€” Contrast audit

Computed WCAG contrast for the semantic token pairs:

| Pair | Light | Dark |
|---|---:|---:|
| text / surface | 18.23 | 16.57 |
| muted / surface | 5.22 | 7.22 |
| text / canvas | 16.89 | 17.83 |
| success / success-soft | 4.84 | 6.38 |
| warning / warning-soft | 6.37 | 10.39 |
| error / error-soft | 5.30 | 8.51 |
| info / info-soft | 5.49 | 8.15 |
| primary-strong / primary-soft | **3.95 â†’ 4.94 after fix** | 8.48 |

**Fix:** darkened light `--ms-primary-strong` from `#5a6fd8` to `#4c5bd4`, bringing chip/eyebrow/link text above AA normal.

## Step 9 â€” Device matrix

The embedded browser viewport is fixed at **800Ã—574**; `window.resizeTo` is ignored. The full matrix was later completed with real Chrome in Step 15.

## Step 10 â€” Legacy color audit

- 75 app files still contain hardcoded hex colors.
- Most are intentional data palettes (pipeline/notification status colors), certificate PDF colors, chart themes, or dark hero surfaces.
- The previously highest-risk remainder, the legacy eShop styling (`monthly-purchase`, `purchases`, `checkout`), was tokenized in Step 13.

## Step 11 â€” Offline & reduced motion

- Offline banner is mounted globally in `AppComponent`.
- Failed writes queue in the outbox and replay on reconnect (`offline-queue.interceptor`, `OutboxService`).
- Service worker registration is guarded and fails soft (`push-sw.js`).
- Global reduced-motion rule shortens all animations/transitions; the app shell and loading animation also opt out explicitly.

## Step 12 â€” Form errors

- Material form fields use labeled inputs (`mat-label` or `aria-label`).
- The only unlabeled field found (Messages edit input) was fixed.
- Legacy toast-only validation was closed for the high-traffic forms in Step 14; remaining snackbar messages are server outcomes or guarded by disabled buttons.

## Step 13 â€” eShop token pass + money edge cases

- Tokenized the remaining legacy eShop styles:
  - `monthly-purchase.component.scss`
  - `checkout/checkout.component.scss`
  - `purchases/purchases.component.ts`
- Fixed containers/cards/borders/CTAs to `--ms-canvas`, `--ms-surface`, `--ms-line`, `--ms-primary-strong`, `--ms-success`, `--ms-success-soft`, `--ms-warning` and `--ms-text-muted`.
- Wallet money formatting now puts the sign before the symbol:
  - debits read `âˆ’â‚¦1,000` instead of `â‚¦-1,000`
  - pending/released/campaign-held/money-in/out/personal-volume all use the same helper.
- Zero values render as `â‚¦0`; pending and released totals are always explicit.
- Team/pipeline/community lists truncate long names with ellipsis; money figures use tabular numerals.

## Step 14 â€” Form errors, dead actions and table edge cases

- Added inline, screen-reader-announced validation (`mat-error` / `role="alert"`) to:
  - Activation identity step: no document/address fields are shown while auto-completion is enabled.
  - Activation shipping form: all 6 required fields.
  - Billing withdrawal dialog: bank, account number, account name, amount; the submit button now stays enabled so submitting reveals the errors (instead of a silently disabled button).
  - Reservation-code dialogs (3): empty-code error is shown on the field instead of a toast.
- Removed the dead â€œMove & convertâ€ card from legacy contact analytics: its status/remark saves were disabled upstream and silently did nothing. The card now points to Pipeline, where stage moves update the timeline.
- Wallet history shows signed ledger amounts (`+â‚¦â€¦` / `âˆ’â‚¦â€¦`) and an em dash for missing dates.
- Shared money helper (`core/format/money.ts`) now backs the wallet dashboard, wallet history and compensation ledger, so zero/negative values format consistently.
- Global table rules wrap long names, emails and references inside cells; `num` / `num-cell` / `money` cells stay on one line with tabular figures.
- Remaining snackbar-only validation is limited to micro-actions whose buttons are already disabled until valid, or to server-side outcomes that cannot be mapped to a single field.

## Step 15 â€” Real-browser device matrix, admin sweep and axe

The embedded browser cannot reach the dev server reliably (502s), so this pass used **Playwright Core driving the installed Chrome** from a temporary folder â€” no project dependency or build change.

### Device matrix

- Widths: **360, 390, 430, 767, 768, 1024, 1440**.
- Themes: light everywhere; dark at 360, 768 and 1440.
- Partner: 34 runs across 12 key routes.
- Admin: 54 runs across all 27 admin routes at 360 and 1440.
- Result: **0 horizontal overflow, 0 console errors**.
- Breakpoints verified: 360â€“767 use the bottom nav; 768+ use the side rail.
- `/dashboard/activate` was checked separately (the old `/dashboard/activation` path is not a route and correctly 404s).

### Axe

- 68 scans: 12 partner routes + 5 admin routes Ã— 360/1440 Ã— light/dark.
- Result: **0 WCAG 2.0/2.1/2.2 A/AA violations**.

### Fixes from this pass

| Finding | Fix |
|---|---|
| 360px page overflow on every route | App root grid now uses `grid-template-columns: minmax(0, 1fr)` so content can shrink instead of widening the shell |
| Admin topbar clipped at 360px | Tighter topbar padding/gaps below 420px |
| 3-second global fade left text low-contrast during load | Removed the fade; retained the 220ms page lift with reduced-motion support |
| Notification badge icon exposed as unnamed `role="img"` | Button label now includes the unread count; the icon carries a matching `aria-label` (no hidden-badge warning) |
| Learn course/goal/readiness progress bars unnamed | Added descriptive `aria-label`s |
| 126 progress bars across the app had no accessible name | Added `aria-label="Loading"` or `"Progress"` to every bar |
| White text on `#667eea` filled buttons was 3.66:1 | Light-theme primary buttons use `--ms-primary-strong` (`#4c5bd4`, 5.59:1) |
| Compensation rank tiles used `opacity: 0.55` | Replaced with dashed borders/soft fills, keeping text at full contrast |

## Step 16 â€” Cross-browser and production dependency pass

- **Edge + WebKit**: 92 runs across partner/admin routes, 360/390/768/1440, light/dark.
  **0 horizontal overflow.** The only WebKit console noise came from rapid route
  navigation cancelling in-flight requests; focused WebKit sessions were clean.
- **WebKit caught a real font bug**: after moving off Google Fonts, the
  `.material-icons` class rule was missing, so icon ligatures rendered as words
  ("menu", "add"). Added the class rule; icons now load from the self-hosted
  `@fontsource/material-icons` asset at first paint.
- **Removed external first-paint dependencies**: Material Icons + the then-brand font are
  self-hosted; the landing YouTube iframe is click-to-play; the 404 page no longer
  hotlinks Dribbble.
- **Production audit**: see `PRODUCTION_READINESS.md`. Key blocker: the deployed
  The hosted API did not yet allow `https://marketspase.com` /
  `https://www.marketspase.com`; redeploy or set `EXTRA_CORS_ORIGINS`.

## Step 17 - First-party feedback surfaces (SweetAlert2 removed)

- Removed `sweetalert2` entirely: package, global CSS, and **57 calls across 18 files**.
- Added:
  - `core/ui/ui-dialog.component.ts` â€” one themed confirmation/outcome dialog with semantic icon tones.
  - `core/ui/ui-feedback.service.ts` â€” `success` / `error` / `warning` / `info` snackbars plus `confirm` / `alert` dialogs.
- Decisions and blocking outcomes use dialogs; transient success/failure notices use snackbars.
- Destructive confirmations use a red action button, with Cancel as the first tabbable control.
- Verified end to end:
  - Delete prospect â†’ confirm dialog â†’ Cancel leaves the record untouched.
  - Confirm delete â†’ success dialog â†’ OK returns to the Pipeline.
  - Support ticket â†’ success snackbar with the server message.
  - Withdrawal dialog â†’ **295 banks** loaded through the new API proxy.
  - Icons: 25 visible, Material Icons loaded; 0 console errors.
  - Light and dark dialog screenshots reviewed.
- Build is now **warning-free**; global CSS dropped from **147.1 KB to 126.9 KB** (about 20 KB smaller).

## Step 18 — IA pass 1: focused navigation

- Rebuilt the partner rail around daily jobs rather than feature inventory.
- Primary groups now **link to their hub**; the chevron expands a smaller submenu.
- Removed repeated “Overview” entries and transient actions/steps from the rail.
- Submenu links reduced from **58 to 32**.
- Added section labels: **Workspace**, **Connect**, **Account**.
- Added one-line descriptors under every primary label in the expanded rail.
- Only one section can be open at a time; the active route auto-opens its section.
- Mobile bottom nav corrected to **Home, Pipeline, Team, Wallet, More**.
- Moved secondary destinations onto hub cards:
  - Pipeline hub: presentations, add prospect.
  - Team hub: contact lists, team updates, my teams, start a team, cell meeting, coach.
  - Learn hub: content library, prospecting guides, presentations, coach, analytics.
  - More hub: notification settings, My Business, reports, survey.
- Fixed hub shortcut links to absolute `/dashboard/*` routes.
- Topbar titles now fall back to the deepest route title for destinations moved off the rail (e.g. Team Reports, Content Library, Downline Contact Lists).
- Verified:
  - desktop expanded + collapsed rails, 390px mobile chrome
  - group header navigation + single-open accordion
  - 12 hub shortcut destinations reachable without a 404
  - **0 horizontal overflow, 0 console errors**
  - **4 axe scans (light/dark × 360/1440) with 0 violations**
  - build **warning-free** (shell component style budget raised to 9 kB)

## Step 19 — Paystack deposits (hosted checkout)

- Deposit method registry now lists **Card or bank payment (Paystack)** first, then Opay.
  Manual bank transfer was retired in Step 23. Paystack is the default selection.
- Live API checks on `:3000`:
  - `GET /v1/billing/deposit/methods` → Paystack `enabled: true`.
  - `POST /v1/billing/deposit/paystack/init` → **200**, returns a
    `checkout.paystack.com` URL, 30-minute window, server-owned reference.
  - `GET /v1/billing/deposit/status?reference=…` → pending intent cross-checked with Paystack;
    abandoned checkouts report `ABANDONED` without crediting.
  - Bad webhook signature → **400** `BAD_SIGNATURE` (raw-body HMAC verified before any work).
- Browser (Chrome, 1440px):
  - deposit page rendered both gateway methods with the Paystack card selected;
  - CTA read “Pay 2,500 with Card or bank payment”;
  - clicking opened the live Paystack checkout handoff (navigation aborted in the test, no
    charge);
  - result page: success state rendered “₦2,500 added to your wallet”; abandoned state
    rendered “Payment did not go through”. Status responses were mocked for these two UI states
    so the suite never performs a real charge.
- Provider-facing copy is now neutral (“payment provider”) instead of Opay-specific, and the
  deposit route title no longer says “Top up with Opay”.
- Setup and webhook instructions: `platform/docs/payments/PAYSTACK.md`.

## Step 20 — Withdrawals: verified account, atomic debit, refund

- Withdrawal dialog rebuilt:
  - searchable bank autocomplete from the live Paystack directory (**289 unique banks**;
    Paystack returns 294 rows, of which 5 reuse a code — duplicates are collapsed by code);
  - 10-digit account number field with a 350 ms debounced account-name lookup;
  - verified-account card (name + bank + number);
  - review step before any debit; Max button; minimum ₦100 / maximum ₦1,000,000.
- Invalid account (`0000000000`):
  - Paystack returned a friendly error, no verified card appeared, and Review was blocked —
    the user saw exactly one clear message, not a stack of duplicate errors.
- Verified-account UI/review (lookup mocked client-side only to avoid a real third-party
  account): card showed **ADA OBI**, review showed bank, name, number and amount, with the
  “debited now, refunded if declined” note.
- Server-side truth: `POST /v1/billing/withdrawals` re-resolves the account with Paystack,
  atomically debits the wallet and writes a **Pending** transaction with `bank`, `bankCode`,
  `accountNumber`, `accountName` and a server-owned reference. A client-supplied name is never
  trusted.
- Admin queue refund verified end to end:
  - seeded one Pending ₦1,000 withdrawal for the QA partner (balance 50,000 → 49,000);
  - admin UI listed the row with destination and owner, accepted a reason and rejected it;
  - result: balance restored to **50,000**, withdrawal status **Rejected**, `decidedBy` /
    `decidedAt` / `decisionNote` written, and a **Withdrawal Refund** credit transaction
    created for ₦1,000;
  - a second reject attempt returned **409** and did not refund twice (the decision is claimed
    atomically and the refund runs in the same transaction);
  - partner notification fired, row left the Pending queue.
- The legacy `/billing/withdraw-request` endpoint now returns **410** `WITHDRAWAL_FLOW_UPDATED`
  instead of accepting a client-typed account name — old clients cannot bypass verification.
- At the time of this pass the payout was manual; Step 22 replaces that with automatic Paystack
  transfers. Failure refunds are automatic; the admin queue was later removed entirely.

## Step 21 — Admin rail pass 2

- Regrouped the admin rail from a flat feature list into six operational groups:
  **Finance, Commerce, Growth, Communications, People, System**.
- Finance leads with the money surfaces (activation desk, compensation, commission plan);
  the retired Payout queue, Withdrawals queue and manual deposits desks are not in the rail.
- Growth, communications, people and system each keep their full toolset.
## Step 22 — Automatic Paystack payouts and unified webhook

- Withdrawals now pay automatically:
  - server-side account resolve → bank name from `bankCode` → Paystack transfer recipient;
  - atomic wallet debit + `Pending` withdrawal (`payoutMode: automatic`, `transferStatus:
    processing`);
  - Paystack Transfer initiated with our unique withdrawal reference;
  - immediate `success` marks **Paid**; `pending` waits for the webhook;
  - `failed` / `reversed` / OTP / initiation failure refunds in full and marks **Rejected**.
- One webhook handles both directions:
  `POST /v1/billing/paystack/webhook` (alias `/v1/billing/deposit/paystack/webhook`).
  Events: `charge.success`, `transfer.success`, `transfer.failed`, `transfer.reversed`.
- Safety:
  - all money transitions are atomic and idempotent; duplicate transfer events are deduped;
  - the admin queue shows `Auto · …`, hides **Mark paid** while a transfer is in flight, and
    keeps **Reject** only for rows that need reconciliation;
  - a 10-minute reconcile job verifies in-flight transfers and refunds a debit whose transfer
    was never created after a grace period;
  - Paystack payout balance is checked before the wallet is debited.
- Verified with signed webhook simulations against the local DB (no real transfer):
  - `transfer.success` → **Paid**, duplicate delivery → deduped;
  - `transfer.failed` → **Rejected**, full wallet refund + `Withdrawal Refund` credit;
  - bad signature → **400**;
  - admin queue with a seeded in-flight auto row showed **Auto · in flight**, hid
    **Mark paid** and **Reject**, and displayed “Automatic payout in progress”;
  - API suite **603 / 603**, platform build warning-free.
- Live prerequisite: Paystack Transfers enabled, transfer OTP disabled, payout balance funded.
  A real Nigerian bank-account transfer is still the final live check.

## Step 23 — Manual bank-transfer deposits retired

- Removed the **Bank transfer** method from `GET /v1/billing/deposit/methods`; the deposit page
  now shows only Paystack and Opay.
- Deleted the manual deposit form component and the client methods that submitted claims.
- `POST /v1/billing/deposit/manual` now returns **410** `MANUAL_DEPOSIT_RETIRED`.
- Removed the three hardcoded Opay receiving accounts (`DEFAULT_MANUAL_ACCOUNTS` is empty).
- Historical manual claims remain readable/decidable in the admin queue; the page is labelled
  as historical and new claims are disabled.
- Verified API tests and the platform build after the removal.



## Step 24 — Menu group toggle fix

- The partner rail group name is now a true accordion toggle:
  - closed → opens the submenu and goes to the group hub;
  - same open group → closes the submenu and stays on the current page;
  - another group → closes the previous one and opens/navigates to the new one.
- The chevron still expands/collapses independently without navigating.
- The group name is a real button, so keyboard activation works and the active
  hub styling is preserved.
- Verified with Playwright at 1440px: open+navigate, close on second click,
  one-group-at-a-time, chevron toggle with no navigation, **0 console errors**.

## Step 25 — Four-rank progression + automatic training recording

- The progress page now uses the app's four ranks: **Partner → Builder → Leader →
  Ambassador**. The old 10-level ladder (Prospect, Emerging Active, Qualified Active,
  Kingsman, ECL, Cell Leader, G Leader, G8) is no longer shown.
- Each rank card shows its role, commission depth and the criteria for the next rank.
- IPO, QSG and SMO training are recorded automatically when the course certificate is earned.
  The generic milestone endpoint also auto-confirms those three keys. No upline or admin
  approval is required.
- The training-approval inbox was removed:
  - `Training approvals` removed from the Team menu;
  - Team hub confirmation metric and shortcut removed;
  - app-shell pending-confirmation badge removed;
  - My Partners support/KPI approval links removed;
  - `/dashboard/mentorship/team/confirmations` redirects to `/dashboard/team`;
  - `POST /v1/progression/confirmations/decision` returns **410
    `TRAINING_APPROVALS_RETIRED`**;
  - the training request/decision notification fan-out is no longer subscribed.
- Verified with Playwright:
  - current rank Builder, position 2 of 4;
  - cards Partner, Builder, Leader, Ambassador;
  - IPO/QSG recorded; SMO auto-recorded after a milestone update;
  - no `Training approvals` nav item;
  - confirmations URL redirects to the Team hub;
  - decision endpoint returns 410;
  - **0 unexpected console errors** (the 410 came from the deliberate retired-endpoint call).
- API suite **605 / 605**; platform build warning-free.



## Step 26 — Admin audit + remaining old-level surfaces

**Admin pages removed or retired**

| Page | Decision | Redirect / reason |
|---|---|---|
| Payout queue | Removed | `/dashboard/admin/payouts` → `/dashboard/admin/compensation`; Compensation already releases/voids the same commission entries |
| Prolific Women leads | Removed | → `/dashboard/admin/growth`; feature not in use, partner page and permission toggle removed |
| Reservation codes | Removed | → `/dashboard/admin/growth`; reservation-code UI retired |
| Oversight | Removed | → `/dashboard/admin/activation`; was gated to the retired G8 level |
| Manual deposits | Removed from nav | Historical route retained; new claims were already disabled |

Kept admin surfaces: Activation desk, Compensation, Commission plan,
Product orders, Products, Bonuses, Growth campaigns, Automation, historical Page leads,
Partner pipeline, Public pages, Broadcast, Email list, Manage roles, Support tickets,
Moderation, Audit log, Partner surveys, Training quizzes, Tutorials, Presentations.

The old **Withdrawals** queue page and its `/billing/withdrawals` endpoints are removed;
`/dashboard/admin/withdrawals` redirects to Compensation.

**Reservation-code UX retired**

- Prospect conversion is now one confirmation: the prospect is marked Converted and can
  complete open registration; no code is entered or shown.
- “Activate new partner”, “My codes”, and reservation-code collection dialogs were removed.
- `POST /v1/prospects/:id/convert` accepts an empty body and no longer accepts or stores a code.
- The `/v1/reservations/*` API, the legacy reservation-code app, permission toggles and the
  reservation-code signup field/validation were removed server-side. Historical collections
  remain in the database for audit only.

**Other old-level surfaces migrated**

- Learn hub: four ranks + core-training count; old readiness panel removed.
- Academy dashboard: four-rank card + training record; old journey/readiness cards removed.
- My Coach: old journey line and old action items removed.
- Training analytics: old “leadership pipeline” rank distribution removed.
- Training paths: “10 rank journeys” page removed; `/dashboard/training/paths` redirects to
  `/dashboard/training/courses`.
- Admin roles: “Journey ranks” distribution removed; member 360 journey line removed.
- **Admin roles G8 removed**: role filter, role options, stats card and transitions no longer
  mention G8. Legacy `g8` accounts display as **Leader**; the backend normalizes legacy `g8`
  to `leader`, and the G8 route guard was deleted.
- Public pathway: Partner → Builder → Leader → Ambassador.
- Team/activation/My Partners labels no longer show old journey levels.

**Verified**

- Admin nav contains none of the retired pages; all four old URLs redirect correctly.
- Partner nav no longer shows Prolific Women.
- `/dashboard/training/paths` redirects to `/dashboard/training/courses`.
- No-code prospect conversion returns **200**, `code: null`, status **Converted**.
- API suite **605 / 605**; platform build warning-free; **0 console errors** in the admin cleanup run.



## Open QA backlog

1. Run one live automatic payout with a real Nigerian bank account the business controls.
   The signed-webhook simulation proves the state machine; only the provider transfer itself is
   unverified.
2. Deploy the API with the CORS fix, set the unified Paystack webhook URL and `PAYSTACKTOKEN`,
   enable Transfers, disable transfer OTP, fund the payout balance, then run the production
   money-path smoke.
3. Rotate the Paystack live secret key that was shared during setup; confirm the webhook still
   verifies after the rotation.
4. Manual offline/reduced-motion pass on a real PWA install.
5. Screen-reader spot-check on the activation identity step and withdrawal dialog with a real device.

## Verdict

Public site passes WCAG-oriented automated checks with **0 axe violations**. The authenticated product now also passes **68 axe scans with 0 violations**, **92 cross-browser (Edge + WebKit) layout runs with 0 overflow**, and **88 Chromium device-matrix runs with 0 overflow**, covering partner and admin routes at 360–1440px in light and dark. Static audits closed the label, contrast-token, chart-label, image-alt, offline and reduced-motion checks. Form-level validation and long-table edge cases are closed for the high-traffic and legacy money surfaces. The Paystack deposit handoff, signature-verified webhook, verified account-name withdrawal flow, automatic transfer state machine, automatic refund path, four-rank progression page and automatic IPO/QSG/SMO recording are covered; the API suite is **555 / 555**. Remaining launch blockers are the live API CORS deployment, the production webhook/key/OTP/balance configuration, and one live bank-account payout.

## Dev QA setup

```bash
cd platform
npm start
# API must be running on :3000; dev server proxies API paths same-origin.
```

**Icon font note:** after changing the `styles`/`assets` arrays in `angular.json`,
restart `npm start` â€” the dev server reads builder config only at startup. A stale
server can remove the Google Fonts `<link>` from `index.html` (hot reload) while
still serving the old CSS without the self-hosted `@font-face`, so icons render as
words or blank boxes. Hard-refresh once after restarting.

