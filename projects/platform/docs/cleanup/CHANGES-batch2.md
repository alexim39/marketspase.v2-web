# Cleanup — Batch 2 change log

> Historical change log. Buy Prospect was retired in batch 4, not left open.

**Executed:** 2026-11-04  
**Rollback:** `C:\Users\Hp\AppData\Local\Temp\opencode\marketspase-backup-20261104-064913.zip`

## Part A — duplicate money surfaces

| Item | Evidence | Change |
|---|---|---|
| DTC external commissions | `DTC_URL` was only used by the wallet "DTC link" action; in-app compensation is canonical | Removed constant, link and copy |
| Paystack deposit | Duplicate of the canonical Opay/manual wallet deposit | Removed `billing-deposit.component.ts`, `addFund()` + button in Billing, `payWithPaystack()` / `confirmPayment()`, and the Paystack inline script |
| Hardcoded Paystack live public key | `pk_live_...` embedded in `paystack.service.ts` | Deleted with `payWithPaystack()` |
| Legacy billing commissions page | `settings/billing/commissions` duplicated `/dashboard/compensation` | Route now redirects to compensation; page deleted |

## Part B — legacy ad-brief campaign UI

**Database check before removal:** legacy `Campaign` collection has **0 rows**; legacy pending commissions **0**. The ad-brief flow is fully superseded by Campaign Studio / growth campaigns.

### Removed frontend
- `dashboard/partner/tools/campaigns/**` (wizard, manage, detail, share, services)
- `dashboard/partner/prospects/campaign-analytics/**` and `link-analytics/**`
- `dashboard/marketing/**` (legacy ROI/home)
- `core/marketing/**`
- `dashboard/admin/campaigns/**` and `reported-leads/**`
- Nav entries: Start ad campaign, My ad campaigns, ROI, Share invite link, admin Ad campaigns, admin Reported leads
- Campaigns hub "View ROI" link
- SMS composer campaign selector + `CampaignService` dependency
- Pipeline campaign badge link (now a plain label)

### Route changes
- `/dashboard/marketing` → redirects to `/dashboard/campaigns`
- `/dashboard/tools` → redirects to `/dashboard/campaigns`
- `/dashboard/tools/campaigns/*` removed
- Admin `/campaigns` and `/reported-leads` → redirect to `/growth`
- `/dashboard/settings/billing/commissions` → redirect to `/dashboard/compensation`

### Backend link updates
- Campaign expiry job + campaign controller notifications → `/dashboard/campaigns`
- Legacy transaction notification → `/dashboard/compensation`
- Commission feed item → `/dashboard/compensation`
- Ora action allowlist/persona updated to the new IA (pipeline, campaigns, team, wallet, learn, compensation)

**Backend legacy `/campaign` endpoints are retained** for historical data and pipeline `campaign/names` references; no UI calls the ad-brief endpoints now.

## Kept intentionally

| Item | Why |
|---|---|
| Withdrawals + bank resolution | `resolveAccount()` still used by the withdrawal dialog; backend proxy keeps the secret server-side |
| Legacy eShop checkout | Still sells products and accrues legacy cart commissions |
| Admin Payouts | Still operational for pending legacy cart commissions from eShop orders |
| Admin Commission Plan | Still controls legacy cart accrual rates |
| Buy Prospect | Retired in batch 4 (`prospects/general-list`, pool UI and later the backend pool) |
| Legacy `/auth`, `/emails`, `/sms` send endpoints | Possible external clients; deferred until confirmed |

## Verification

- Platform build: **passes** (only the pre-existing `sweetalert2` warning)
- API tests: **578/578 pass**
- Full compensation smoke test: **passes** (activation → allocation → commission → mentor bonus → attribution → cleanup)
- No remaining references to DTC, Paystack checkout, legacy campaign routes or deleted components
- Bundle impact: tools route chunk 158.7 kB → 91.7 kB; admin chunk 380 kB → 360 kB
