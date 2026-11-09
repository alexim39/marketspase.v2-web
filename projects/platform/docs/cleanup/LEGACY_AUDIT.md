# MarketSpase — Legacy & Redundancy Audit

**Date:** 2026-11-04 (post-audit update 2026-11-09)  
**Status:** Batch 1–4 executed — see `CHANGES-batch1.md` … `CHANGES-batch4.md`. The Buy Prospect pool and legacy campaign pool-lead allocation were subsequently removed end to end (2026-11-08). The legacy cart commission engine, partner bulk outreach, contact lists, coaching/cell meetings, reports, partner surveys and page-lead desk were removed on 2026-11-09. Remaining items are compatibility-only (legacy `/auth` clients).  
**Scope:** `platform/src`, `api/src`, mounts in `api/server.js`, public assets, dependencies.  
**Mode:** read-only audit at the time; batches 1–4 and the later Buy Prospect removal were executed afterwards.  
**Rollback snapshot:** `C:\Users\Hp\AppData\Local\Temp\opencode\marketspase-backup-20261104-064913.zip` (11.14 MB; source, docs, public assets, configs — excludes `node_modules`, `dist`, `.angular`, `.env`).

---

## 1. Method

- Enumerated every Angular route file and extracted `path`, `redirectTo`, `loadChildren`, `loadComponent`, `component`, `title`.
- Counted inbound references for every component/pipe/service by class name, selector and route-loader basename.
- Mapped every API call in the SPA to its backend mount.
- Grepped for legacy/retired/deprecated markers, unused dependencies and unreferenced assets.
- Compared the current model in `MARKETSPASE_PROGRESS.md` (central acquisition, campaign studio, compensation) against the screens and endpoints still shipped.

---

## 2. Executive summary

| Category | Count | Risk |
|---|---:|---|
| Components with zero inbound references | 8 + 1 transitive child | Safe |
| Unused pipes | 2 | Safe |
| Unused services | 3 | Safe |
| Dead/unmounted backend app | 1 (`apps/image`) | Safe |
| Mounted backend app with no SPA caller and no auth | 1 (`/settings`) | Safe + security win |
| Routes that only redirect | 9 | Low |
| Redundant route pages | 2 (`marketing`, `earnings`) | Low |
| Legacy feature clusters needing a product decision | 6 | Medium/High |
| Unused frontend dependencies | 2 (+1 CDN) | Safe after build |
| Assets to review | ~20 | Low |

**Headline (post-audit):** the ad-brief campaign UI, Buy Prospect pool, legacy Paystack deposit, DTC commissions, legacy cart commission engine, partner bulk outreach, contact lists, coaching/cell meetings, team reports, partner surveys and page-lead desk have been removed. The remaining legacy is compatibility-only: legacy `/auth` clients and the temporary `/emailSubscription/*` shim.

---

## 3. Safe removals — zero inbound references

### 3.1 Components

| Component | Path | Evidence |
|---|---|---|
| `ReservationCodeDialogComponent` | `auth/signup/reservation-code.component.ts` | selector `<async-reservation-code>` unused; open signup removed codes |
| `PushNotificationsComponent` | `dashboard/partner/index/push-notifications/` | class + selector unused |
| `NotificationsSettingsComponent` | `dashboard/partner/settings/notifications/` | selector unused; superseded by `v1/notifications/preferences` |
| `PushNotificationListContainerComponent` | `dashboard/partner/settings/push-notification-list/` | unused; depends on dead push service |
| `VideoDownloadComponent` | `dashboard/partner/resources/resource-download/video-download/` | selector unused |
| `MarketingChannelsComponent` | `dashboard/partner/tools/campaigns/create-campaign/marketing-channels.component.*` | unused parent |
| `GoogleComponent` | `dashboard/partner/tools/campaigns/create-campaign/google/` | only used by `MarketingChannelsComponent` |
| `ManageContactsAnalyticsContainerComponent` | `dashboard/partner/contacts/manage/analytics/manage-contacts-analytics-container.component.ts` | unused container; the inner analytics component is still used by the Insights route |
| `ManageContactsDetailContainerComponent` | `dashboard/partner/contacts/manage/details/` | duplicate selector of the live `MyPartnerContactsDetailContainerComponent`; unused |

**Keep:** `contacts/manage/details/collect-code.component.ts` — still imported by prospect detail, pipeline board and lead pipeline.

### 3.2 Dead duplicate contact-detail tree

Delete only:
- `contacts/manage/details/manage-contacts-detail-container.component.ts`
- `contacts/manage/details/manage-contacts-detail.component.ts`
- `details/actions-panel/`
- `details/basic-info-panel/`
- `details/email-panel/`
- `details/sms-panel/`
- `details/status-info-panel/`
- `contacts/manage/manage-contacts.mobile.scss`

Keep `details/collect-code.component.ts` (live).

### 3.3 Pipes / services

| Item | Path | Evidence |
|---|---|---|
| `BillingFilterPipe` | `dashboard/partner/billing/billing-filter.pipe.ts` | `billingFilter` never used |
| `ConctactFilterPipe` | `dashboard/partner/contacts/contacts-filter.pipe.ts` | `contactFilter` never used as a pipe (matches are input names) |
| `SettingsService` | `dashboard/partner/settings/settings.service.ts` | no importers |
| `PushNotificationService` | `dashboard/partner/index/push-notifications/push-notifications.service.ts` | only dead components |
| `VideoDownload` | (same as component) | no importers |

### 3.4 Unused dependency/config files

| Item | Evidence |
|---|---|
| `platform/m3-theme.scss` | not referenced by `angular.json` or any import |
| `@angular/animations` | **kept** — required by `provideAnimationsAsync()` despite no direct import |
| `socket.io-client` | **kept** — used by `core/messaging/chat-socket.service.ts` |
| Font Awesome CDN | no `fa-*` icon usage found |
| Paystack inline script | only used by legacy billing deposit dialog (see 4.4) |
| Commented-out route lines in `app.routes.ts` | dead comments |

### 3.5 Redundant routes with no inbound links

| Route | Current behaviour | Recommended |
|---|---|---|
| `/dashboard/marketing` | renders `MarketingHomeComponent`; no nav/link points here | redirect → `/dashboard/campaigns`; delete page |
| `/dashboard/earnings` | renders `EarningsComponent`; no nav/link points here | redirect → `/dashboard/compensation`; delete page |
| `/dashboard/classic` | redirect → my-partners | remove |
| `/dashboard/search` | redirect → my-partners | remove |
| `/dashboard/contact-analytics` | redirect → insights/contact-analytics | remove or keep one release |
| `/dashboard/prospects/email-list` | redirect → pipeline | remove |
| `/dashboard/tools/campaigns/analytics` | redirect → marketing/roi | remove with ad-campaign flow |
| `/dashboard/tools/campaigns/link` | redirect → marketing/roi | remove with ad-campaign flow |
| `/dashboard/tools/contacts/list` | redirect → pipeline | remove |
| `/dashboard/mentorship/new-request` | redirect → team/members | remove |
| `/dashboard/support/about` | redirect → about/app | keep (harmless canonical alias) |
| `/dashboard/training/:courseId` | redirect → courses/:courseId | keep (deep-link safety) |

**Missing redirects to add (not cleanup):**
- `/dashboard/notifications` → `/dashboard/notifications/center`
- `/dashboard/network` → `/dashboard/network/tree`
- `/dashboard/marketing` and `/dashboard/earnings` as above.

---

## 4. Legacy feature clusters — decisions required

### 4.1 Legacy ad-brief campaigns
**Paths:** partner `tools/campaigns/**`, `marketing/roi`, admin `campaigns`, `reported-leads`, `plan`; services `create-campaign.service`, `manage-campaign.service`, `admin-campaign.service`; backend `apps/campaign/**`, mounts `/campaign`, legacy admin campaign endpoints.

**Evidence:** `MARKETSPASE_PROGRESS.md` explicitly says “do not carry forward” the ad-brief flow. The new Campaign Studio, growth campaigns and fair allocation supersede it.

**Blockers before deletion:**
- Pipeline calls `campaign/names` and `campaign/allocations/by-survey/.../report`.
- SMS composer accepts a legacy `campaignId`.
- Admin `reported-leads` is tied to the legacy allocation ledger.
- ROI page is still linked from the new Campaigns hub and legacy pages.

**Recommendation:** Batch 2. Retire the partner ad-brief wizard and admin ad-campaign desk; keep `campaign/names` until pipeline attribution is migrated; move ROI metrics into the new Campaigns hub.

### 4.2 Buy Prospect / lead pool — retired
**Paths:** partner `prospects/general-list`, admin `admin/leads`, nav entries, backend lead-pool endpoints.

**Status:** retired in batch 4 and removed end to end on 2026-11-08. The partner flow is now Customer Leads (store checkout buyers) plus personal-page/referral leads in the pipeline. No pool screen, claim workflow, pricing or allocation job remains.

### 4.3 Earnings / payouts (legacy commission slice)
**Paths:** partner `/earnings`, admin `/admin/payouts`, legacy `billing` commission endpoints.

**Evidence:** superseded by `compensation` (unilevel, ranks, mentor bonus). Both pages are still routed; `earnings` has no inbound links; `payouts` remains in the admin rail.

**Recommendation:** redirect `earnings` → `compensation`; remove admin payouts after confirming no pending legacy carts need release; keep the v1 compensation ledger.

### 4.4 Paystack deposit + DTC commissions
- `billing-deposit.component.ts` opens Paystack checkout; `payWithPaystack` embeds a hardcoded **live public key** in `paystack.service.ts`; `index.html` loads the Paystack inline script.
- The canonical wallet deposit is Opay/manual (`v1/billing/deposit/*`).
- `DTC_URL` in the wallet points to an external legacy commission platform and conflicts with the in-app compensation ledger.

**Recommendation:** remove Paystack deposit UI + script + `payWithPaystack`; keep bank resolution for withdrawals. Remove DTC link and copy.

### 4.5 Legacy auth/email/SMS send surfaces
- `PartnerAuthService` duplicates `AuthService`; only `signOut`, `resetPassword`, `confirmResetPassword` are used. The shell still calls legacy `auth/signout`; legacy `auth/signin` is unused by the SPA.
- `POST /emails/send-emails`, `POST /emails/send-email`, `POST /sms/save-sms`, `POST /billing/bulk-sms-charge` are unused by the SPA; comments already call them legacy.
- Inbox delete/read endpoints are still used.

**Recommendation:** migrate sign-out and reset flows to `AuthService` (`v1/auth`), then remove `PartnerAuthService` and the legacy `/auth` router after confirming no external client uses it. Remove dead send endpoints in Batch 3.

### 4.6 Legacy `/settings` notification backend
**Path:** `api/src/apps/settings/**` mounted at `/settings`.

**Evidence:** no SPA caller (the only `SettingsService` is dead). Routes have **no auth middleware** and write notification preferences. Superseded by `v1/notifications/preferences`.

**Recommendation:** delete the entire `apps/settings` app and `/settings` mount now — high-confidence dead and closes an unguarded write surface.

### 4.7 Other legacy-but-active (do not delete yet)
- Booking (`/booking`) — still used by sessions.
- Contact / email subscription / survey — public sites may use them.
- Partner profile updates (`/partners/*`) — profile page still uses them.
- Products/eshop (`/products/*`) — checkout and order history still use the legacy cart API; the catalog UI was replaced in the product Phase 1 work.
- Teams (`/team/*`) — create/manage team pages still use them.
- Tickets (`/ticket` + `/v1/tickets`) — migrate legacy submit then retire.
- Transaction/billing (`/billing/*`) — wallet history still uses it; withdrawal creation moved to `/v1/billing/withdrawals`; legacy `POST /billing/withdraw-request` returns 410.
- Legacy `apps/image` — already unmounted; delete folder safely.
- Reservations — retired server-side (`/v1/reservations` removed); historical collection kept for audit only.

---

## 5. Backend mount map (current)

| Mount | Status | Evidence |
|---|---|---|
| `/auth` | only `signout` used by SPA | retire after `AuthService` migration |
| `/partners` | active | profile updates |
| `/booking` | active | sessions |
| `/campaign` | active legacy | ad-brief + pipeline reports |
| `/contact` | external/public | keep |
| `/billing` (legacy) | active | wallet history, deprecated withdraw-request (410), unused bulk-SMS charge |
| `/prospect` (legacy) | active | contacts/team screens |
| `/products` (legacy) | active | eShop/admin catalog |
| `/survey` | external site | keep |
| `/emailSubscription` | external site | keep |
| `/emails` | read/delete active, send dead | trim send routes |
| `/sms` | delete/read active, save dead | trim save route |
| `/ticket` | active legacy submit | migrate to v1 |
| `/team` | active legacy teams | keep until teams migration |
| `/settings` | **dead, unguarded** | remove |
| `/image` | **unmounted** | delete folder |
| `/v1/*` | current | keep |

---

## 6. Assets review

**In use:** `marketspase-logo-white.png`, `marketspase-mark-white.png`, PWA icons (`pwa-192/512/maskable`), OG image, favicons, manifest, `logo/marketspase-logo-white.png` (email), product images under `img/products/*` (legacy eShop).

**Likely unused / marketing leftovers (owner review):**
- `img/appLogo.png`, `img/diamond-project-logo2.png`, `img/img1.jpg`, `img/logo.PNG`, `img/plogo*.png|jpg`, `img/cash-payment.svg`, `img/default_pp.png`
- `logo/email_logo.jpg`, `logo/email-logo.png`, `logo/index_logo.png`, `logo/logo.jpg`, `logo/logo-placeholder.png`, `logo/marketspase-logo.png`, `logo/marketspase-mark.png`, `logo/meta_logo.png`, `logo/platform_desktop_logo.jpg`, `logo/platform_mobile_logo.jpg`, `logo/social-profile-1024.png`, `logo/x_logo.png`

**Broken content:** `public/resource-templates/img/source.json` references 20 images (`1.jpg`–`20.jpg`) but only 8 exist. Either trim the JSON or restore the assets.

---

## 7. Proposed execution batches

### Batch 1 — safe cleanup (no product decisions)
- Delete the dead components/pipes/services listed in §3.1–3.3.
- Delete `m3-theme.scss`, commented-out routes, unused `@angular/animations` + `socket.io-client`, Font Awesome CDN.
- Remove `api/src/apps/image/**` and `api/src/apps/settings/**` + `/settings` mount.
- Redirect `/dashboard/marketing` → campaigns, `/dashboard/earnings` → compensation; remove dead redirect routes.
- Add missing canonical redirects (`notifications`, `network`).
- **Verify:** platform build, API tests, smoke test, route crawl, no unused imports.

### Batch 2 — product-approved feature retirement
- Legacy ad-brief campaigns + admin ad campaigns/reported leads/plan.
- Buy Prospect pool (retired — executed in batch 4 and removed from the API).
- Legacy earnings/payouts.
- Paystack deposit + DTC commissions.
- Legacy auth/email/SMS send endpoints.

### Batch 3 — API/screen consolidation
- Migrate remaining legacy screens (profile, teams, products, booking, tickets) to v1.
- Remove legacy routers/repositories/models no longer referenced.
- Remove `--dp-*` aliases once no references remain.
- Purge reviewed assets and trim resource-template JSON.

---

## 8. Revert plan

1. Snapshot: `marketspase-backup-20261104-064913.zip`.
2. One batch at a time; record every touched file in `platform/docs/cleanup/CHANGES-<batch>.md`.
3. If a batch fails: restore only that batch’s files from the snapshot, or re-run the previous build/tests.
4. No database collections, migrations or user records are deleted in any batch.

---

## 9. Decisions at audit time (resolved)

1. Batch 1 deletions approved and executed.
2. Legacy `/auth`, `/emails`, `/sms`, `/settings`: no first-party client remains; compatibility decisions are documented in the runbook.
3. Buy Prospect: **retired** (batch 4 + API removal on 2026-11-08).
4. Legacy ad-brief campaigns: **retired**.
5. Paystack deposit: **removed**; the current deposit flow is the v1 Paystack hosted checkout (plus Opay where configured).
6. DTC external commissions: **removed**.
