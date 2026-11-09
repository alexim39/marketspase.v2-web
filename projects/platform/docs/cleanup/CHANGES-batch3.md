# Cleanup — Batch 3 change log

> Historical change log. Buy Prospect was retired in batch 4 and removed from the API on 2026-11-08.

**Executed:** 2026-11-04  
**Rollback:** `C:\Users\Hp\AppData\Local\Temp\opencode\marketspase-backup-20261104-064913.zip`

## Auth consolidation

| Change | Detail |
|---|---|
| Core `AuthService` | Added `requestPasswordReset()` and `confirmResetPassword()` (v1 endpoints) |
| Forgot password | Uses `AuthService` instead of the duplicate `PartnerAuthService` |
| Reset password | Uses `AuthService` |
| Shell sign-out | Uses `AuthService.signOut()` → `POST /v1/auth/signout` |
| Deleted | `platform/src/app/auth/auth.service.ts` (`PartnerAuthService`) — duplicate of the v1 session service |

Legacy backend `/auth` router is retained for possible external clients; the SPA no longer calls `auth/signin` or `auth/signout`.

## Legacy send endpoints removed

| Endpoint | Why |
|---|---|
| `POST /emails/send-emails` | SPA sends via `v1/outreach/email`; controller removed |
| `POST /emails/send-email` | Same; controller removed |
| `POST /sms/save-sms` | No SPA writer; controller removed |
| `POST /billing/bulk-sms-charge` | No SPA caller; controller removed |
| `POST /billing/confirm-payment` | Paystack deposit retired; no SPA caller; controller removed |

Read/delete endpoints for historical email/SMS inbox rows were kept.

Frontend dead methods removed:
- `SMSService.bulkSMSCharge`, `SMSService.saveSMSRecord`, `smsInterface`
- `ContactsService.saveSMSRecord`

## Dependency cleanup

- Removed the unnecessary npm `path` package from `api/package.json`.
- `api/server.js` now imports `node:path`.

## Kept intentionally

| Item | Why |
|---|---|
| Buy Prospect / lead pool | Retired in batch 4; the remaining backend pool, routes and job were removed on 2026-11-08 |
| Legacy eShop + cart commissions | Still sells products and accrues legacy commissions |
| Admin Payouts + Commission Plan | Required while eShop cart commissions exist |
| Legacy `/auth` backend router | Possible external clients |
| Reservations admin desk | Retired; the server-side reservations module is gone and the historical collection is kept for audit only |

## Verification

- Platform build: **passes** (only the pre-existing `sweetalert2` warning)
- API tests: **578/578 pass**
- Full compensation smoke test: **passes** end-to-end
- No references remain to `PartnerAuthService`, legacy send routes, Paystack confirmation, or the `path` npm package
