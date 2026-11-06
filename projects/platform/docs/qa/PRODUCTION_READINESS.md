# Production Readiness Audit â€” 2026-11-04

Scope: deployment configuration, production API connectivity, payment hooks, email
links, font/PWA dependencies and cross-browser behavior. Code-side fixes are listed
with the files touched; the one remaining **critical external action** is the live
API CORS deployment.

## Status

| Area | Status |
|---|---|
| Platform production build | **Passes, warning-free** |
| API test suite | **605 / 605 pass** |
| Cross-browser layout (Edge + WebKit) | **92 / 92 runs, 0 overflow** |
| Axe (authenticated, light/dark/mobile/desktop) | **68 scans, 0 violations** |
| Live API reachable | **Yes** â€” `https://c21fg-f054fmrs.b4a.run` returns 200 |
| Live API CORS for `marketspase.com` | **Blocked** â€” redeploy required (see below) |
| Production env checklist | Documented below; values live in the host dashboard |

## Critical â€” live API CORS

The deployed API does **not** send `Access-Control-Allow-Origin` for the platform
origins, even though the code on disk includes them.

Evidence (preflight to `/v1/auth/signin`):

```text
Origin: https://marketspase.com      -> 204, allow-origin: (missing)
Origin: https://www.marketspase.com  -> 204, allow-origin: (missing)
Origin: https://c21fg.online         -> 204, allow-origin: https://c21fg.online
```

The platform production build calls the API cross-origin at
`https://c21fg-f054fmrs.b4a.run`, so every authenticated call would fail in the
browser until this is fixed.

The deployed API also returns **401** for
`POST /v1/billing/deposit/paystack/webhook`, which confirms it is running the old router
order (the public webhook is currently caught by the authenticated billing router). A redeploy
is required before Paystack can deliver live events.

**Action (deployment, not code):**

1. Redeploy the current `api` code to the b4a.run service, **or**
2. Set `EXTRA_CORS_ORIGINS=https://marketspase.com,https://www.marketspase.com`
   in the API host environment and restart.

Verify after deploy:

```bash
curl -i -X OPTIONS https://c21fg-f054fmrs.b4a.run/v1/auth/signin \
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
| Google Fonts + Material Icons loaded from `fonts.googleapis.com` (privacy, availability and WebKit TLS failures) | Self-hosted `@fontsource-variable/inter` + `@fontsource/material-icons`; removed external font links; added the `.material-icons` class rule (without it icon ligatures render as words) | `platform/angular.json`, `src/index.html`, `src/styles.scss`, `src/styles/_variables.scss`, `package.json` |
| 404 page hotlinked a Dribbble GIF | Replaced with a self-contained premium 404 using design tokens | `platform/src/app/page-not-found.component.ts` |
| Landing loaded the YouTube iframe on first paint | Click-to-play facade; iframe loads only after the user presses play | `platform/src/app/index/banner/banner.component.ts` |
| CORS list had a duplicate origin and an insecure `http://survey...` entry | Removed duplicate + insecure entry | `api/server.js` |
| `.env.example` did not list the Paystack key or the production `NODE_ENV` requirement | Added `PAYSTACKTOKEN=`, `PAYSTACK_PUBLIC_KEY=` and `NODE_ENV=production` note | `api/.env.example` |
| Deposits were Opay-only and withdrawals trusted a client-typed account name | Added Paystack hosted checkout + signature-verified webhook + idempotent credit; withdrawals re-resolve the account server-side, start an automatic Paystack transfer, and refund automatically on failure. The legacy admin withdrawal queue and page were removed; exceptions reconcile in the Paystack dashboard | `api/src/modules/billing/**`, `api/src/jobs/payout-reconcile.js`, `platform/.../wallet/deposit/**`, `platform/.../partner/billing/**` |
| Training approvals were tied to the retired 10-level ladder | IPO/QSG/SMO now auto-record from the course certificate and count toward the four-rank model (Partner → Builder → Leader → Ambassador); the confirmation inbox is retired and redirects to Team | `api/src/modules/training/**`, `api/src/modules/progression/**`, `platform/.../progress/**`, `platform/.../training/detail/**`, `platform/.../mentorship/**`, `platform/.../shell/**` |
| Admin panel carried retired features and the prospect flow still asked for a reservation code | Removed Payout queue (merged into Compensation), Prolific Women, Reservation codes, the Withdrawals queue and Oversight from both UI and API; prospect conversion is now a no-code confirmation; learning paths/old rank cards removed; G8 removed from role UI and backend normalization (legacy g8 reads as Leader) | `platform/.../admin/**`, `platform/.../partner/mentorship/**`, `api/server.js`, `api/src/modules/{crm,identity-access,progression,reservations}/**` |

## Required production environment

Set these in the API host dashboard before switching traffic:

- `NODE_ENV=production`
- `MONGODB_USERNAME`, `MONGODB_PASSWORD`, `MONGODB_DATABASE`
- `JWTTOKENSECRET`, `KYC_HASH_SECRET`
- `FRONTEND_URL=https://marketspase.com`
- `APP_BASE_URL=https://marketspase.com`
- `PUBLIC_SITE_URL=https://marketspase.com`
- `EXTRA_CORS_ORIGINS=https://marketspase.com,https://www.marketspase.com`
- `EMAIL_HOST=marketspase.com`, `EMAIL_PORT=465`, `EMAIL_SECURE=true`,
  `EMAIL_USER=noreply@marketspase.com`, `EMAIL_PASS=â€¦`, `EMAIL_FROM_EMAIL=â€¦`
- `PAYSTACKTOKEN=â€¦` (hosted deposits, verification, bank directory + account-name resolution)
- `PAYSTACK_PUBLIC_KEY=â€¦` (optional; hosted checkout does not expose it)
- `PAYSTACK_AUTO_PAYOUT=true` (automatic transfers; set `false` for the manual queue kill switch)
- Paystack webhook URL: `https://<api-host>/v1/billing/paystack/webhook`,
  subscribed to `charge.success`, `transfer.success`, `transfer.failed` and
  `transfer.reversed` â€” see `platform/docs/payments/PAYSTACK.md`
- Paystack account: **Transfers enabled**, **transfer OTP disabled**, **balance funded**
- `OPAY_MODE=live`, `OPAY_LIVE_PUBLIC_KEY`, `OPAY_LIVE_PRIVATE_KEY`,
  `OPAY_MERCHANT_ID`, `OPAY_CALLBACK_URL`, `OPAY_RETURN_URL`
- `CLOUDINARY_*`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `DEEPSEEK_API_KEY` if Ora is enabled
- `SMS_PROVIDER` + provider keys if SMS is enabled

## Deploy sequence

1. Set the production environment above.
2. Redeploy the API (this publishes Paystack deposits, automatic transfers,
   `/v1/billing/withdrawals`, the bank directory dedupe and the legacy reset fix).
3. Configure the Paystack webhook:
   `https://<api-host>/v1/billing/paystack/webhook` â†’ `charge.success`,
   `transfer.success`, `transfer.failed`, `transfer.reversed`.
4. In Paystack: enable Transfers, disable transfer OTP, and fund the payout balance.
5. Verify CORS with the preflight command above.
6. Build the platform: `cd platform && npm run build` â†’ deploy
   `platform/dist/partners/browser` to `marketspase.com`.
7. Confirm SPA fallback (`/dashboard/*` reloads) via `.htaccess` / `_redirects`.
8. Verify the money path without charging:
   - deposit methods show Paystack enabled;
   - `GET /v1/billing/banks` returns **289 unique codes**;
   - an invalid account returns the friendly â€œcould not verifyâ€ message;
   - a bad webhook signature returns **400**;
   - the deposit page hands off to `checkout.paystack.com` (abandon the checkout).
9. Run one withdrawal with a real Nigerian bank account the business controls and confirm it
   reaches **Paid** automatically (or refunds automatically if the account rejects it).
10. Verify: sign-in, admin rail, activation identity step, wallet history, PWA install, offline banner.
11. Run the staging money-path smoke with `--keep`, then the attribution check.

## Notes

- The API remains on `b4a.run` until the API domain migration; the platform build is
  already pointed at it.
- `push-sw.js` caches the app shell; its cache name is versioned (`ms-shell-v1`) and
  navigation is network-first, so a deploy refreshes the shell.
- After changing `styles`/`assets` in `angular.json`, restart `ng serve` â€” HMR does
  not reload builder configuration. A stale dev server will serve the old CSS while
  the updated `index.html` no longer has the Google Fonts link, which makes icons
  disappear until the server is restarted.
- SweetAlert2 is no longer a dependency. Feedback now uses the shared
  `UiFeedbackService` (Material snackbars and dialogs); keep new messages on that
  surface so tone, focus and dark-mode behavior stay consistent.

