# Production Readiness Audit — 2026-11-04 (updated 2026-11-09)

Scope: deployment configuration, production API connectivity, payment hooks, email
links, font/PWA dependencies and cross-browser behavior. Code-side fixes are listed
with the files touched. The remaining **critical external actions** are the live API
redeploy, the single-upline migration and the production PII keyring.

## Status (2026-11-09)

| Area | Status |
|---|---|
| Platform production build | **Passes, warning-free** |
| API test suite | **721 / 721 pass** (last verified 2026-11-09) |
| Web CI | **Green** on the latest web commit |
| Cross-browser layout (Edge + WebKit) | **92 / 92 runs, 0 overflow** (2026-11-04 audit) |
| Axe (authenticated, light/dark/mobile/desktop) | **68 scans, 0 violations** (2026-11-04 audit) |
| Live API reachable | **Verify after deploy** — `https://marketspasev2api-p3jkxlvy.back4.app/health` should return **200** |
| Live API CORS for `marketspase.com` | **Verify after deploy** (see below) |
| Single-upline migration | **Not yet run in production** |
| Production PII keyring | **Not yet configured/verified** |
| Production env checklist | Documented below; values live in the host dashboard |

## Critical — production API host

The production API host is `https://marketspasev2api-p3jkxlvy.back4.app`.
The previous host is retired and must not be used.

**Action order (deployment, not code):**

1. `npm run migrate:upline` (dry run) against production.
2. `APPLY=1 npm run migrate:upline`, then `npm run audit:upline`.
3. Redeploy the current `api` code to the Back4App service.
4. Set `EXTRA_CORS_ORIGINS=https://marketspase.com,https://www.marketspase.com`
   in the API host environment and restart.
5. Verify `/health` returns `200` and the CORS preflight returns the origin.

Verify after deploy:

```bash
curl -i -X OPTIONS https://marketspasev2api-p3jkxlvy.back4.app/v1/auth/signin \
  -H "Origin: https://marketspase.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
# expect: access-control-allow-origin: https://marketspase.com
```

## Fixed in code

| Finding | Fix | Files |
|---|---|---|
| `angular.json` had a trailing comma (invalid JSON for tooling/CI) | Removed; validated with `JSON.parse` | `platform/angular.json` |
| Legacy `/auth` password reset linked to `c21fg.online`, used a hardcoded `async.ng` SMTP account and referenced an undefined `SECRET_KEY` | Uses `appBaseUrl()` + shared `sendEmail`; reset verifier reads `JWTTOKENSECRET`; cookie flags match v1 | `api/src/apps/auth/controllers/auth.controller.js` |
| Browser called Paystack's bank directory directly | Added authenticated `GET /v1/billing/banks` proxy with a server-side use case and tests; withdrawal dialog uses it | `api/src/modules/billing/application/Commission.queries.js`, `Billing.routes.js`, `Billing.controller.js`, `platform/.../paystack.service.ts`, `billing-withdraw.component.ts` |
| Withdrawal account-name resolve expected a flat response but the API returns an envelope | `resolveAccount` now maps `res.data` | `platform/.../paystack.service.ts` |
| Google Fonts + Material Icons loaded from `fonts.googleapis.com` (privacy, availability and WebKit TLS failures) | Self-hosted fonts + Material Icons; removed external font links; added the `.material-icons` class rule. The product now uses Bricolage Grotesque + Manrope. | `platform/angular.json`, `src/index.html`, `src/styles.scss`, `src/styles/_variables.scss`, `package.json` |
| 404 page hotlinked a Dribbble GIF | Replaced with a self-contained premium 404 using design tokens | `platform/src/app/page-not-found.component.ts` |
| Landing loaded the YouTube iframe on first paint | Click-to-play facade; iframe loads only after the user presses play | `platform/src/app/index/banner/banner.component.ts` |
| CORS list had a duplicate origin and an insecure `http://survey...` entry | Removed duplicate + insecure entry | `api/server.js` |
| `.env.example` did not list the Paystack key or the production `NODE_ENV` requirement | Added `PAYSTACKTOKEN=`, `PAYSTACK_PUBLIC_KEY=` and `NODE_ENV=production` note | `api/.env.example` |
| Deposits were Opay-only and withdrawals trusted a client-typed account name | Added Paystack hosted checkout + signature-verified webhook + idempotent credit; withdrawals re-resolve the account server-side, start an automatic Paystack transfer, and refund automatically on failure. The legacy admin withdrawal queue and page were removed; exceptions reconcile in the Paystack dashboard | `api/src/modules/billing/**`, `api/src/jobs/payout-reconcile.js`, `platform/.../wallet/deposit/**`, `platform/.../partner/billing/**` |
| Training approvals were tied to the retired 10-level ladder | IPO/QSG/SMO/Leadership now auto-record from the course certificate and count toward the four-rank model (Partner → Builder → Leader → Ambassador); the confirmation inbox is retired and redirects to Team | `api/src/modules/training/**`, `api/src/modules/progression/**`, `platform/.../progress/**`, `platform/.../training/detail/**`, `platform/.../mentorship/**`, `platform/.../shell/**` |
| Admin panel carried retired features and the prospect flow still asked for a reservation code | Removed Payout queue (merged into Compensation), Prolific Women, Reservation codes, the Withdrawals queue and Oversight from both UI and API; prospect conversion is now a no-code confirmation; learning paths/old rank cards removed; G8 removed from role UI and backend normalization (legacy g8 reads as Leader) | `platform/.../admin/**`, `platform/.../partner/mentorship/**`, `api/server.js`, `api/src/modules/{crm,identity-access,progression,reservations}/**` |

Later cleanup (2026-11-08/09): the Buy Prospect pool and legacy campaign pool-lead
allocation were removed end to end; Customer Leads and personal-page leads were
added; referral signups now appear in the pipeline; the mentor bonus is immediate;
single-upline `partnerOf` replaced `placementParentId`; partner bulk SMS/email
outreach, contact analytics, team reports, contact lists, cell meetings, coaching
notes, partner surveys, the admin Page Leads desk, session bookings,
presentation kits and the legacy cart commission engine were retired.

## Required production environment

Set these in the API host dashboard before switching traffic:

- `NODE_ENV=production`
- `MONGODB_USERNAME`, `MONGODB_PASSWORD`, `MONGODB_DATABASE`
- `JWTTOKENSECRET`, `KYC_HASH_SECRET`
- `PII_ENCRYPTION_KEYS`, `PII_ACTIVE_KEY_ID` (or a verifiable `PII_ENCRYPTION_KEY`)
- `FRONTEND_URL=https://marketspase.com`
- `APP_BASE_URL=https://marketspase.com`
- `PUBLIC_SITE_URL=https://marketspase.com`
- `EXTRA_CORS_ORIGINS=https://marketspase.com,https://www.marketspase.com`
- `EMAIL_HOST=marketspase.com`, `EMAIL_PORT=465`, `EMAIL_SECURE=true`,
  `EMAIL_USER=noreply@marketspase.com`, `EMAIL_PASS=…`, `EMAIL_FROM_EMAIL=…`
- `PAYSTACKTOKEN=…` (hosted deposits, verification, bank directory + account-name resolution)
- `PAYSTACK_PUBLIC_KEY=…` (optional; hosted checkout does not expose it)
- `PAYSTACK_AUTO_PAYOUT=true` (automatic transfers; set `false` for the manual queue kill switch)
- Paystack webhook URL: `https://<api-host>/v1/billing/paystack/webhook`,
  subscribed to `charge.success`, `transfer.success`, `transfer.failed` and
  `transfer.reversed` — see `platform/docs/payments/PAYSTACK.md`
- Paystack account: **Transfers enabled**, **transfer OTP disabled**, **balance funded**
- `OPAY_MODE=live`, `OPAY_LIVE_PUBLIC_KEY`, `OPAY_LIVE_PRIVATE_KEY`,
  `OPAY_MERCHANT_ID`, `OPAY_CALLBACK_URL`, `OPAY_RETURN_URL`
- `CLOUDINARY_*`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `DEEPSEEK_API_KEY` if Ora is enabled; `ORA_DAILY_LIMIT=25`
- `SMS_PROVIDER=http`, `BULKSMS_API_TOKEN=…`, `BULKSMS_SENDER_ID=marketspase`

## Deploy sequence

1. Set the production environment above.
2. Run `npm run migrate:upline` (dry) → `APPLY=1 npm run migrate:upline` →
   `npm run audit:upline`.
3. Redeploy the API (this publishes the current router order, Paystack webhook,
   `/health`, single-upline reads, Customer Leads, personal-page leads and the
   compensation/product paths).
4. Configure the Paystack webhook:
   `https://<api-host>/v1/billing/paystack/webhook` → `charge.success`,
   `transfer.success`, `transfer.failed`, `transfer.reversed`.
5. In Paystack: enable Transfers, disable transfer OTP, and fund the payout balance.
6. Verify CORS with the preflight command above.
7. Run `npm run migrate:pii` (dry) → `APPLY=1 npm run migrate:pii` if PII sealing
   or key rotation is part of the release.
8. Build and deploy the platform, store and admin apps. Confirm SPA fallback
   (`/dashboard/*`, `/lead/*`, `/stores/*` reloads).
9. Verify the money path without charging:
   - deposit methods show Paystack enabled;
   - `GET /v1/billing/banks` returns the live bank list;
   - an invalid account returns the friendly “could not verify” message;
   - a bad webhook signature returns **400**;
   - the deposit page hands off to `checkout.paystack.com` (abandon the checkout).
10. Run one withdrawal with a real Nigerian bank account the business controls and
    confirm it reaches **Paid** automatically (or refunds automatically if rejected).
11. Verify: sign-in, admin rail, activation identity step, wallet history, PWA
    install, offline banner, Customer Leads, `/lead/<username>` and `/join?ref=`.
12. Run the staging money-path smoke with `--keep`, then the attribution check.

## Notes

- The API runs on Back4App at `https://marketspasev2api-p3jkxlvy.back4.app`.
- `push-sw.js` caches the app shell; its cache name is versioned (`ms-shell-v1`) and
  navigation is network-first, so a deploy refreshes the shell.
- After changing `styles`/`assets` in `angular.json`, restart `ng serve` — HMR does
  not reload builder configuration. A stale dev server will serve the old CSS while
  the updated `index.html` no longer has the Google Fonts link, which makes icons
  disappear until the server is restarted.
- SweetAlert2 is no longer a dependency. Feedback now uses the shared
  `UiFeedbackService` (Material snackbars and dialogs); keep new messages on that
  surface so tone, focus and dark-mode behavior stay consistent.
- The legacy `/emailSubscription/*` redirect window ends on **2026-11-14**; remove
  only after `audit:legacy` shows no traffic.
