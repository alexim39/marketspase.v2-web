# Paystack payments — setup and runbook

**Scope:** wallet deposits, automatic withdrawals, bank directory and account-name resolution.
**Status:** live-ready. Deposits credit automatically; withdrawals are paid automatically by
Paystack Transfer. The admin queue remains as an override/reconciliation surface, not a required
step.

---

## 1. What Paystack powers

| Flow | Paystack API | Our endpoint |
|---|---|---|
| Wallet top-up | Hosted checkout (`/transaction/initialize`) | `POST /v1/billing/deposit/paystack/init` |
| Deposit confirmation (push) | Webhook (`charge.success`) | `POST /v1/billing/paystack/webhook` |
| Deposit confirmation (pull) | Verify (`/transaction/verify/:reference`) | `GET /v1/billing/deposit/status?reference=…` |
| Bank list | List banks (`/bank?currency=NGN`) | `GET /v1/billing/banks` |
| Account name | Resolve account (`/bank/resolve`) | `GET /v1/billing/resolve-account` |
| Withdrawal | Resolve + recipient + transfer | `POST /v1/billing/withdrawals` |
| Payout confirmation | Webhook (`transfer.success` / `failed` / `reversed`) | `POST /v1/billing/paystack/webhook` |
| Payout reconciliation | Verify (`/transfer/verify/:reference`) | scheduled job every 10 minutes |

The browser never receives the secret key and never calls `api.paystack.co` directly.

## 2. Environment

```dotenv
# API only — never expose this to the SPA or commit it.
PAYSTACKTOKEN=sk_live_…

# Optional. The hosted-checkout flow does not use it.
PAYSTACK_PUBLIC_KEY=pk_live_…

# Automatic payouts are on by default. Set false to fall back to the manual
# admin-review queue (incident kill switch).
PAYSTACK_AUTO_PAYOUT=true

# Used to build the checkout return URL.
FRONTEND_URL=https://marketspase.com
```

Restart the API after changing values. `PAYSTACKTOKEN` empty disables Paystack deposits and
withdrawals; Opay remains; manual bank transfer is retired.

### Account prerequisites for automatic payouts

1. **Enable Transfers** on the Paystack business account.
2. **Disable transfer OTP** in the Paystack dashboard (Settings → Preferences/Transfers).
   If Paystack returns `status: "otp"`, the API cannot finalize the transfer without a human;
   it refunds the wallet and returns a clear error. This is the only step that still needs a
   one-time human action.
3. **Keep the Paystack balance funded.** A withdrawal is refused before the wallet is debited
   when the payout balance is short; if the balance changes mid-flight, Paystack rejects the
   transfer and the wallet is refunded automatically.
4. Confirm the business is allowed to transfer to the selected bank/account type.

## 3. Webhook

Configure **one** URL in Paystack → **Settings → API Keys & Webhooks**:

```text
https://<api-host>/v1/billing/paystack/webhook
```

The older alias `https://<api-host>/v1/billing/deposit/paystack/webhook` also works, but the
unified path is the recommended one. Subscribe to:

- `charge.success`
- `transfer.success`
- `transfer.failed`
- `transfer.reversed`

The handler:

1. Verifies `x-paystack-signature` as an HMAC-SHA512 of the **raw** request body.
2. Dispatches `charge.success` to the deposit credit flow.
3. Dispatches `transfer.success` → withdrawal **Paid**.
4. Dispatches `transfer.failed` / `transfer.reversed` → withdrawal **Rejected** + full refund.
5. Ignores unknown/manual transfers with `200` so unrelated Paystack activity never retries.
6. Claims every state transition atomically, so duplicate webhook deliveries are idempotent.

Bad signatures return `400`. Deposit amount/currency mismatches and unknown deposit references
return `400` so they are visible in the Paystack delivery log. Transfer events for unknown
references return `200` (they were not created by this app).

> The raw body is captured by `express.json({ verify })` in `api/server.js`. If you add another
> body parser before it, keep the raw bytes or webhook signatures will fail.

## 4. Deposit flow

1. Partner picks **Card or bank payment** on `/dashboard/wallet/deposit`.
2. `POST /v1/billing/deposit/paystack/init` creates a `paystack` deposit intent and a hosted
   checkout URL.
3. The browser redirects to `checkout.paystack.com`; card, bank transfer and USSD are handled
   by Paystack.
4. Paystack returns to `/dashboard/wallet/deposit/result?reference=…` (it also appends
   `trxref`, which the result page accepts).
5. The result page calls `GET /v1/billing/deposit/status`; the server verifies with Paystack,
   credits the wallet exactly once and returns the terminal state.

Abandoned checkouts stay `pending` until verified; they are never credited. Live smoke tests
should stop after the checkout URL is created (no real charge).

## 5. Withdrawal flow (automatic)

1. Partner opens **Settings → Billing → Withdraw**.
2. The dialog loads the live bank list (`GET /v1/billing/banks`) into a searchable autocomplete.
3. A 10-digit account number triggers a debounced `GET /v1/billing/resolve-account`; the
   returned account name is displayed on a verified-account card.
4. **Review withdrawal** shows bank, resolved name, number and amount.
5. `POST /v1/billing/withdrawals`:
   - re-resolves the account **server-side** (the client-displayed name is never trusted);
   - derives the bank display name from `bankCode`;
   - checks the Paystack payout balance;
   - creates a Paystack transfer recipient;
   - atomically debits the wallet and writes a `Pending` withdrawal with
     `payoutMode: 'automatic'`, `transferRecipientCode`, `transferStatus: 'processing'`;
   - starts the transfer using our unique withdrawal reference.
6. If Paystack answers `success`, the row is marked **Paid** immediately. If it answers
   `pending`, the row stays **Pending** and the webhook (or the 10-minute reconcile job) marks
   it **Paid**.
7. If Paystack answers `failed` / `reversed`, or the transfer cannot start, the wallet is
   refunded in full, the row is **Rejected**, and the partner is notified.
8. If Paystack answers `otp`, automatic payout is not enabled: the wallet is refunded and the
   partner is told to contact support. Disable transfer OTP in Paystack to remove this case.

The displayed name can never be forged: the server ignores any client-supplied name and uses
the Paystack resolve response. The legacy `/billing/withdraw-request` endpoint fails closed with
**410**. Minimum ₦100, maximum ₦1,000,000 per request.

### Statuses

| Stored `status` | Meaning |
|---|---|
| `Pending` | Wallet debited; transfer in flight or awaiting the webhook/reconcile |
| `Paid` | Paystack confirmed the transfer |
| `Rejected` | Transfer failed/reversed/OTP; wallet refunded in full |

`transferStatus` records the provider detail (`processing`, `pending`, `success`, `failed`,
`reversed`, `otp`), and `transferCode` is the Paystack `TRF_…` reference.

### No admin queue

There is no separate admin withdrawal queue. Automatic payouts settle from the Paystack
webhook; failures refund the wallet and mark the withdrawal **Rejected** automatically.
Admins reconcile exceptions from the Paystack dashboard and the member's transaction
history (Compensation/withdrawals ledger). The legacy `/billing/withdrawals` review
endpoints and the admin Withdrawals page were removed; `/dashboard/admin/withdrawals`
now redirects to `/dashboard/admin/compensation`.

## 6. Verification commands

Read-only checks (safe against live keys):

```bash
# Method registry (authenticated)
curl -s https://<api-host>/v1/billing/deposit/methods \
  -H "Authorization: Bearer <partner-access-token>"

# Bank directory (authenticated)
curl -s https://<api-host>/v1/billing/banks \
  -H "Authorization: Bearer <partner-access-token>"

# Account resolve (authenticated; use a real account you control)
curl -s "https://<api-host>/v1/billing/resolve-account?accountNumber=<10-digits>&bankCode=058" \
  -H "Authorization: Bearer <partner-access-token>"

# Bad webhook signature must be rejected
curl -i -X POST https://<api-host>/v1/billing/paystack/webhook \
  -H "content-type: application/json" -H "x-paystack-signature: bad" \
  -d '{"event":"transfer.success","data":{"reference":"NOPE"}}'
# expect: HTTP 400
```

Do **not** run a live `transaction/initialize` against production unless you intend to create a
real checkout. Initializing alone does not charge anyone, but it creates a pending intent that
must be cleaned up or left to expire.

Do **not** submit a live withdrawal with a test account. Real payouts move money. Use the
signed-webhook test harness in local QA or a real account the business controls.

## 7. Operations

- **Rotate the secret key** after any exposure: create a new key in Paystack, update
  `PAYSTACKTOKEN` in the API host, restart, confirm the webhook still verifies, then revoke the
  old key.
- **Payout balance:** keep the Paystack balance above expected withdrawal volume. The API
  refuses a withdrawal before debiting when the available balance is short.
- **OTP:** if automatic payouts start failing with “Automatic payouts are not enabled yet”,
  disable transfer OTP in Paystack. Existing refunded rows are safe; the partner can retry.
- **Reconciliation:** the `payout-reconcile` job runs every 10 minutes, verifies in-flight
  automatic transfers, applies Paid/Rejected, and refunds a debit whose transfer was never
  created after a 10-minute grace period.
- **Webhook failures:** check the Paystack dashboard delivery log first; then replay. The
  handler is idempotent, so replays are safe. The reconcile job also covers missed deliveries.
- **Deposit reconciliation:** deposit intents store `accessCode`, `authorizationUrl`, `orderNo`,
  `status`, `creditedAt` and the last callback payload. A `success` row must always have a
  matching wallet credit transaction with the same reference.
- **Withdrawal audit:** `decidedBy`, `decidedAt`, `decisionNote`, `payoutMode`, `transferCode`,
  `transferStatus` and `payoutFailureReason` are stored on the transaction.
- **Amount mismatch:** do not credit manually until Paystack support confirms the charge; the
  deposit intent is flagged with the last callback payload.

## 8. Tests

Unit coverage lives beside the code:

- `api/src/modules/billing/infrastructure/PaystackClient.test.js` — checkout, verify, resolve,
  banks, transfer recipient, initiate/verify transfer, balance, timing-safe signature.
- `api/src/modules/billing/application/PaystackDeposit.usecases.test.js` — deposit intent,
  webhook dispatch, automatic withdrawal initiation, insufficient payout balance, refund on
  failure, transfer.success/failed dedupe.
- `api/src/jobs/payout-reconcile.test.js` — successful reconcile, refund when the transfer was
  never created, disabled-key no-op.

Run the full suite with `cd api && node --test src`.
