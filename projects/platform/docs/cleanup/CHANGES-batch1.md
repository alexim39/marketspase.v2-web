# Cleanup — Batch 1 change log

> Historical change log: counts and route names are as of the execution date. The current app state is in `MARKETSPASE_PROGRESS.md` and the project READMEs.

**Executed:** 2026-11-04  
**Rollback:** `C:\Users\Hp\AppData\Local\Temp\opencode\marketspase-backup-20261104-064913.zip`

## Deleted — frontend dead code

| Path | Reason |
|---|---|
| `auth/signup/reservation-code.component.ts` | Open signup; selector unused |
| `dashboard/partner/index/push-notifications/` | Component + service unreferenced |
| `dashboard/partner/settings/notifications/` | Unreferenced legacy settings UI |
| `dashboard/partner/settings/push-notification-list/` | Unreferenced; depended on dead push service |
| `dashboard/partner/settings/settings.service.ts` | No importers |
| `dashboard/partner/resources/resource-download/video-download/` | Selector unused |
| `dashboard/partner/tools/campaigns/create-campaign/marketing-channels.component.{ts,html}` | Dead parent |
| `dashboard/partner/tools/campaigns/create-campaign/google/` | Used only by dead parent |
| `dashboard/partner/contacts/manage/analytics/manage-contacts-analytics-container.component.ts` | Dead container; the inner analytics component is still used by Insights |
| `dashboard/partner/contacts/manage/details/manage-contacts-detail-container.component.ts` | Dead duplicate container |
| `dashboard/partner/contacts/manage/details/manage-contacts-detail.component.ts` | Used only by dead container |
| `details/actions-panel/`, `basic-info-panel/`, `email-panel/`, `sms-panel/`, `status-info-panel/` | Only used by dead detail component |
| `dashboard/partner/contacts/manage/manage-contacts.mobile.scss` | Unreferenced |
| `dashboard/partner/billing/billing-filter.pipe.ts` | Pipe never used |
| `dashboard/partner/contacts/contacts-filter.pipe.ts` | Pipe never used |
| `dashboard/marketing/home/` | No inbound links; route now redirects to Campaigns |
| `dashboard/earnings/` | Superseded by Compensation; route now redirects |
| `platform/m3-theme.scss` | Not referenced by `angular.json` |

**Retained:** `contacts/manage/details/collect-code.component.ts` — used by prospect detail, pipeline board and lead pipeline.

## Deleted — backend dead code

| Path | Reason |
|---|---|
| `api/src/apps/image/` | Router never mounted |
| `api/src/apps/settings/` | Mounted `/settings` had no SPA callers and no auth guard |
| `/settings` mount + import in `api/server.js` | Dead/unsafe |
| Dead `// app.use('/image', ProfileImageRouter)` comment | Removed |

## Modified — routes

| File | Change |
|---|---|
| `app.routes.ts` | Removed commented-out legacy routes |
| `dashboard/partner/dashboard.routes.ts` | Removed `classic`, `search`, `contact-analytics` redirects and the `earnings` module; added `earnings → compensation` redirect |
| `dashboard/marketing/marketing.routes.ts` | `/dashboard/marketing` now redirects to `/dashboard/campaigns`; removed `MarketingHomeComponent` import |
| `dashboard/notifications/notifications.routes.ts` | `/dashboard/notifications` → `center` |
| `dashboard/network/network.routes.ts` | `/dashboard/network` → `tree` |
| `dashboard/partner/tools/tools.routes.ts` | Removed dead `campaigns/analytics`, `campaigns/link`, `contacts/list` redirects |
| `dashboard/partner/mentorship/mentorship.routes.ts` | Removed `new-request` redirect and stale commented redirect |
| `dashboard/partner/prospects/prospects.routes.ts` | Removed `email-list` redirect |
| `index.html` | Removed unused Font Awesome CDN |

## Dependencies / audit corrections

- **Kept `@angular/animations`** — required by `provideAnimationsAsync()`.
- **Kept `socket.io-client`** — imported by `core/messaging/chat-socket.service.ts` (the audit grep missed it).
- Removed Font Awesome CDN only.

## Verification

- `npm run build` (platform): **success**, only the pre-existing `sweetalert2` CommonJS warning.
- `node --test src` (API): **578/578 pass**.
- `npm run smoke:compensation`: **full money path passes** — signup attribution → KYC → activation → campaign → allocation → commission → mentor bonus → attribution report → cleanup.
- No references remain to deleted classes, selectors or route paths.
