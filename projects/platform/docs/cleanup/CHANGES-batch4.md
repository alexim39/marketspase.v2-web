# Cleanup — Batch 4 change log

**Executed:** 2026-11-04  
**Rollback:** `C:\Users\Hp\AppData\Local\Temp\opencode\marketspase-backup-20261104-064913.zip`

## Buy Prospect / lead pool retired (UI)

**Data check before removal:** `Survey` pool rows = **0**; claimed pool prospects = **0**.

| Removed | Detail |
|---|---|
| Partner page | `prospects/general-list/**` (shelf, claim dialogs, masked dossier) |
| Route | `/dashboard/prospects/general-list` removed; `/dashboard/prospects` now redirects to `pipeline` |
| Nav | "Buy prospect" removed from the Pipeline group |
| Pipeline hub | "Buy prospect" shortcut removed |
| Pipeline list | Buy Prospect toggle removed; copy updated |
| My Page Leads | Buy Prospect toggle and help text removed |
| Lead pipeline service | `pool()`, `releaseProspect()`, `importLeads()` removed; pool models removed |
| Return-to-pool | Button, confirmation state and methods removed |
| Admin desk | `/dashboard/admin/leads` removed; redirects to Partner Pipeline; nav entry removed; `admin/leads/**` deleted |

Backend pool endpoints and data models are retained for compatibility/history; no pool data existed in the current database.

## Design token unification

- Removed the entire legacy `--dp-*` token layer.
- All references now use `--ms-*` tokens.
- Token values were written explicitly in `styles.scss` (no aliases).
- Fixed two latent `var(--dp-primary)` references (undefined token) in Prolific Women pages.

## Assets

Removed obsolete Diamond-era assets:
- `img/appLogo.png`, `cash-payment.svg`, `default_pp.png`, `diamond-project-logo2.png`, `img1.jpg`, `logo.PNG`, `plogo*.png|jpg`
- `logo/email_logo.jpg`, `email-logo.png`, `index_logo.png`, `logo.jpg`, `logo-placeholder.png`, `marketspase-logo.png`, `marketspase-mark.png`, `platform_desktop_logo.jpg`, `platform_mobile_logo.jpg`

Fixed `public/resource-templates/img/source.json` — now references only the 8 images that actually exist (was pointing at missing 9–20).

**Kept:** current MarketSpase brand/social assets (`meta_logo`, `x_logo`, `social-profile-1024`, PWA icons, OG image) and eShop product images.

## Verification

- Platform build: **passes** (only the pre-existing `sweetalert2` warning)
- Bundle impact: admin chunk **360 kB → 343 kB**; prospects chunk **286 kB → 250 kB**; CSS **147.5 kB → 146.6 kB**
- No references remain to `--dp-*`, `general-list`, or `admin/leads`
- API tests were not re-run (no backend change in this batch), but remained 578/578 after Batch 3.
