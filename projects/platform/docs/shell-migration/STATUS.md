# Shell Migration — Status

**Last updated:** 2026-11-09

## Completed

| Area | What shipped | Files |
| --- | --- | --- |
| Route inventory | Full current route map with keep/consolidate/relocate guidance | `route-inventory.md` |
| IA mapping | Old nav → new 8-destination IA + redirect strategy | `nav-mapping.md` |
| Design tokens | `--ms-*` semantic tokens (light + dark) with `--dp-*` aliases; refreshed palette, type, elevation and Material overrides | `src/styles.scss`, `src/index.html` |
| Single shell | One modern shell for the whole app: collapsible rail, sticky topbar, global create menu, command palette, notifications, theme, view-as, mobile bottom nav | `src/app/dashboard/shell/app-shell.component.*` |
| Legacy UI removed | Old `DashboardComponent`, `ShellVersionService`, shell switcher and 3-level nav deleted | routes + shell cleanup |
| Design system | Bricolage Grotesque + Manrope + JetBrains Mono, rounded Material components, soft cards, uppercase table headers, custom scrollbars, reduced-motion support | `projects/shared/styles/_tokens.scss`, `src/styles.scss` |
| Admin mode | Dedicated admin rail (Money/Growth/Members/Catalog & Learning/System) + `/dashboard/admin` default | `src/app/dashboard/admin/admin-shell.component.ts`, `admin-nav.config.ts`, `admin.routes.ts` |
| Home Command Center | Gradient hero with status chips + next-best-action, growth engine card, quick actions, 6 momentum widgets, two-column plan/community layout | `src/app/dashboard/home/home.component.ts` |
| Campaigns hub | Allocation explainability (score reasons), portfolio summary (funded/spent/remaining/active/placed), tabs for Campaign Studio / My campaigns / Placement, Studio side panel with "what happens next", wallet shortfall guard | `src/app/dashboard/campaigns/campaigns.component.ts`, `shell/nav.config.ts` |
| Pipeline hub | Overdue/today/upcoming metrics, follow-up queue, stage-mix bars, quick links to board/leads/sessions/kits | `src/app/dashboard/partner/pipeline/pipeline-hub.component.ts`, `dashboard.routes.ts`, `shell/nav.config.ts` |
| Team hub | Downline/active/activation-rate metrics, activation board priority queue with tone pills, team health + recommendations, coaching shortcuts | `src/app/dashboard/partner/team/team-hub.component.ts`, `dashboard.routes.ts`, `shell/nav.config.ts` |
| Wallet hub | Balance hero with pending/released commissions + campaign budget held, cashflow metrics, recent transactions, deposit/withdraw/shop/commission actions | `src/app/dashboard/wallet/dashboard/wallet-dashboard.component.ts` |
| Learn hub | Level + next level, readiness score, courses in progress, continue-learning list, active goals, readiness requirements, learning shortcuts | `src/app/dashboard/partner/learn/learn-hub.component.ts`, `dashboard.routes.ts`, `shell/nav.config.ts` |
| More hub | Account card with role/state/KYC and completeness meter, grouped account/insights/support links, admin console entry | `src/app/dashboard/partner/more/more-hub.component.ts`, `dashboard.routes.ts`, `shell/nav.config.ts` |
| Community hub | Feed preview, upcoming events, unread messages and shortcuts; feed moved to `/community/feed` | `src/app/dashboard/community/hub/community-hub.component.ts`, `community.routes.ts`, `shell/nav.config.ts` |
| Legacy nav retired | The shell renders the single `NEW_NAV_PRIMARY` IA; the old 3-level `NAV_GROUPS` and mobile tabs are gone | `shell/nav.config.ts`, `shell/app-shell.component.*` |
| Token sweep | Semantic `--dp-*` references replaced with `--ms-*` across 153 app files; only sidenav/nav-icon tokens remain on `--dp-*` | `platform/src/app/**` |
| Acquisition attribution | Public `/join?campaign=gc_...` landing persists the code; signup forwards `campaign`; API validates and stores `campaignCode` on the partner | `index/join/join-landing.component.ts`, `partner-signup.component.ts`, `Auth.validator.js`, `Partner.entity.js`, `Signup.usecase.js`, `partner.model.js` |
| Attribution reporting | Admin Growth now shows signups/activations/KYC by campaign link via `GET /v1/admin/campaigns/attribution` | `Campaign.routes.js`, `Campaign.usecases.js`, `Campaign.mongo.repository.js`, `campaigns.models.ts`, `campaigns.service.ts`, `admin-growth.component.ts` |
| Home activity timeline | Recent placements, commissions, certificates and promotions, newest first | `dashboard/home/home.component.ts` |
| Attribution verifier | Read-only CLI: per-code signup/activation table + optional `--email` check of a stored `campaignCode` | `api/scripts/verify-attribution.js`, `api/package.json` |
| Compensation smoke test | End-to-end CLI: signup attribution → KYC → activation → campaign → allocation → commission release → mentor bonus, with optional cleanup | `api/scripts/smoke-compensation-flow.js`, `api/package.json` |
| Component budget | Warning raised to 8 kB (error stays 10 kB) after the Home redesign | `angular.json` |
| Batch 1 cleanup | Removed dead components/pipes/services/routes, unmounted `apps/image`, unguarded legacy `apps/settings`, Font Awesome CDN, `m3-theme.scss`; added canonical redirects | `platform/docs/cleanup/CHANGES-batch1.md` |
| Batch 2 cleanup | Removed DTC external commissions, duplicate Paystack deposit, billing commissions page, legacy ad-brief campaign UI (partner + admin), campaign analytics, legacy ROI and campaign-linked SMS selector; updated notification/Ora links | `platform/docs/cleanup/CHANGES-batch2.md` |
| Batch 3 cleanup | Consolidated auth into `AuthService` (v1 sign-out/reset), removed duplicate `PartnerAuthService`, legacy email/SMS send + bulk-charge + Paystack confirmation endpoints, and the npm `path` dependency | `platform/docs/cleanup/CHANGES-batch3.md` |
| Batch 4 cleanup | Retired Buy Prospect/lead-pool UI + admin desk; removed `--dp-*` token layer; deleted obsolete Diamond assets; fixed resource-template manifest | `platform/docs/cleanup/CHANGES-batch4.md` |
| UI QA pass 1 | Fixed landing overflow + landmarks; public axe 0; 52-route authenticated sweep; dev proxy; badge/form-label a11y; contrast token fix; eShop token pass; wallet negative-money formatting; inline form errors; dead legacy status card removed; long-table wrapping; 126 progress-bar labels; real-browser 88-run device matrix + 68-scan axe 0; mobile root/topbar overflow fixes | `platform/docs/qa/UI_QA.md`, `proxy.conf.json`, `angular.json`, `environment.ts`, `core/format/money.ts` |
| Cross-browser + production pass | Edge + WebKit 92-run matrix (0 overflow); self-hosted fonts + Material Icons (fixed ligature bug; later moved to Bricolage/Manrope); click-to-play landing video; self-contained 404; Paystack bank-list proxy + resolve envelope fix; legacy reset/SMTP/token fix; `.env.example` + CORS cleanup | `platform/docs/qa/UI_QA.md`, `platform/docs/qa/PRODUCTION_READINESS.md`, `package.json`, `src/index.html`, `src/styles.scss`, `index/banner`, `page-not-found`, `api` billing/auth |
| Feedback cleanup | Removed `sweetalert2` (dependency, CSS, 57 calls/18 files); added shared Material `UiDialogComponent` + `UiFeedbackService`; verified confirms, alerts, snackbars, withdrawal banks, light/dark; build now warning-free | `core/ui/*`, `platform/package.json`, `angular.json`, all affected auth/billing/CRM/messaging pages |
| IA pass 1 | Group headers now link to hubs; submenu links 58→32; Workspace/Connect/Account sections; primary descriptors; single-open accordion; mobile bottom nav Home/Pipeline/Team/Wallet/More; hub shortcut links fixed to absolute routes | `shell/nav.config.ts`, `shell/app-shell.component.*`, `pipeline-hub`, `team-hub`, `learn-hub`, `more-hub`, `docs/shell-migration/nav-mapping.md` |
| Lead surfaces (2026-11-08) | Retired partner page leads and Buy Prospect; added Customer Leads for store checkout buyers; personal-page leads and referral signups in the pipeline; personal lead page `/lead/:username` in the store | `platform/.../prospects/**`, `store/.../lead-page/**`, `api/src/modules/{crm,stores,partner-pages}/**` |
| Single upline (2026-11-08) | `partnerOf` is the only upline; `placementParentId` removed; referral `/join?ref=` attribution, system-owned fallback and campaign allocation history | `api/src/modules/{identity-access,campaigns,compensation}/**`, migration scripts |
| Compensation and ranks (2026-11-08) | Immediate mentor bonus; product commissions on every growth-plan order; journey rank auto-promotes while commission rank stays manual | `api/src/modules/{compensation,progression}/**`, platform progress/compensation pages |
| Theme and appearance | Theme control moved to **More → Settings → Appearance** (Light/Dark/System) | `dashboard/settings/appearance/**`, `more-hub` |
| Feature retirement (2026-11-09) | Removed partner bulk SMS/email outreach, contact analytics, team reports, contact lists/warm-list import, cell meetings, coaching notes, partner surveys, admin Page Leads desk, legacy shop commission plan and legacy ad-brief campaign system. Activation board is training-only; manual prospect add is `/dashboard/prospects/new`. | `platform/...`, `admin/...`, `api/src/modules/{outreach,reports,coaching,mentorship,partner-surveys,crm,billing}/**` |

## How to use
1. Sign in to the platform.
2. Use the rail to move between Home, Pipeline, Campaigns, Team, Wallet, Learn, Community and More.
3. On tablet/desktop the rail collapses with the chevron at the bottom; below 768px the drawer + bottom nav take over.

## Verified runs

- **2026-11-04** — `npm run smoke:compensation -- --api=http://localhost:3000` passed end-to-end against Atlas `marketspaseV2`:
  signup attribution → email verification → KYC → ₦38,000 activation → campaign funding/activation → allocation (score 29) → commission release (₦1,658.70) → ₦1,000 mentor bonus → attribution report (1 signup / 1 activated) → cleanup.
- `npm run verify:attribution` confirmed the CLI reads the DB correctly (no leftover attributed signups after cleanup).

## Next up
1. Run the single-upline migration against production, then redeploy the API and verify `/health` + CORS.
2. Run the money-path smoke test on staging with `--keep` to retain evidence, then repeat the attribution check.
3. Deploy platform, store and admin builds and verify SPA fallback, auth cookies, fonts and PWA install.
4. Complete legal/compliance review and production COGS/CAC lock.
5. Add the consolidated in-app compensation/income disclosure before public launch.

## Notes / guardrails
- There is exactly one shell; no preview flag or old UI remains.
- All existing routes and deep links keep working.
- Admin routes retain `adminGuard`; the retired G8 oversight route and guard were removed.
- The rail collapses below `768px` into a drawer + bottom nav; 768px+ keeps the side rail.
- Pages should use `--ms-*` tokens and the shared Material overrides for consistency.
