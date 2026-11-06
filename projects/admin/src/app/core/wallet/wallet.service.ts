import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { WalletHistoryEnvelope, WalletTransaction } from './wallet.models';
import { AuthService } from '../auth/auth.service';

export interface DepositInit {
  reference: string;
  orderNo: string | null;
  cashierUrl: string;
  amountNgn: number;
  expiresInMinutes: number;
}

export interface PaystackDepositInit {
  reference: string;
  checkoutUrl: string;
  amountNgn: number;
  expiresInMinutes: number;
}

export interface DepositState {
  reference: string;
  status: string;
  amountNgn: number;
  orderNo: string | null;
  creditedAt: string | null;
  liveStatus: string | null;
}

/** Deposit method registry entry — the deposit page renders these, so a
 * future gateway (Paystack…) needs only a backend entry + one card. */
export interface DepositMethod {
  id: string;
  kind: 'gateway' | 'manual';
  label: string;
  detail: string;
  enabled: boolean;
  accounts?: Array<{ bank: string; number: string; name: string }>;
}

export interface ManualClaimRow {
  reference: string;
  amountNgn: number;
  status: string;
  claim: Record<string, unknown> | null;
  decidedAt: string | null;
  decisionNote: string | null;
  creditedAt: string | null;
  createdAt: string;
  partner?: { name: string; email: string | null; phone: string | null; username: string | null } | null;
}

export interface LookupHit {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  balance: number;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

/**
 * Wallet data access — reads the partner's own money records.
 * Balance is the live `partner.balance` (carried forward as the wallet
 * balance); history reads legacy transaction rows (normalized — writers
 * vary). Session-owned: callers pass nothing identity-bearing.
 */
@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);

  /** Current session user id (null until `me()` hydrates). */
  ownerId(): string | null {
    return (this.auth.currentUser()?.id as string | undefined) ?? null;
  }

  history(): Observable<WalletTransaction[]> {
    const id = this.ownerId() ?? '';
    return this.api
      .get<WalletHistoryEnvelope>(`billing/transaction/${id}`)
      .pipe(map((res) => ((res.data ?? []) as unknown[]).map((r) => this.shape(r))));
  }

  /** Open an Opay cashier session — the response carries the redirect URL. */
  initDeposit(amountNgn: number): Observable<{ data: DepositInit }> {
    return this.api.post<{ data: DepositInit }>('v1/billing/deposit/init', { amountNgn });
  }

  /** Paystack hosted checkout — card, bank transfer or USSD. */
  initPaystackDeposit(amountNgn: number): Observable<{ data: PaystackDepositInit }> {
    return this.api.post<{ data: PaystackDepositInit }>('v1/billing/deposit/paystack/init', { amountNgn });
  }

  /** Owner-scoped intent state (+ live Opay cross-check while pending). */
  depositStatus(reference: string): Observable<{ data: DepositState }> {
    return this.api.get<{ data: DepositState }>(`v1/billing/deposit/status?reference=${encodeURIComponent(reference)}`);
  }

  /** Available deposit methods (Paystack, Opay, …). */
  depositMethods(): Observable<{ data: DepositMethod[] }> {
    return this.api.get<{ data: DepositMethod[] }>('v1/billing/deposit/methods');
  }

  /** Admin: manual-claim review queue (historical; new claims are disabled). */
  manualQueue(status = 'awaiting-review'): Observable<{ data: ManualClaimRow[] }> {
    return this.api.get<{ data: ManualClaimRow[] }>(`v1/billing/deposit/manual/queue?status=${encodeURIComponent(status)}`);
  }

  /** Admin: approve (credits once) or reject (reason required). */
  decideManualDeposit(reference: string, decision: 'approve' | 'reject', note = ''): Observable<{ message: string; data: unknown }> {
    return this.api.post(`v1/billing/deposit/manual/${encodeURIComponent(reference)}/decide`, { decision, note });
  }

  /** Admin: find a partner to credit (email/username). */
  lookupPartner(q: string): Observable<{ data: { exact: LookupHit | null; matches: LookupHit[] } }> {
    return this.api.get(`v1/billing/admin/wallet/lookup?q=${encodeURIComponent(q)}`);
  }

  /** Admin: direct wallet top-up (mandatory reason, audited). */
  adminCredit(partnerId: string, amountNgn: number, reason: string): Observable<{ message: string; data: unknown }> {
    return this.api.post('v1/billing/admin/wallet/credit', { partnerId, amountNgn, reason });
  }

  private shape(r: unknown): WalletTransaction {
    const o = (r ?? {}) as Record<string, unknown>;
    const at = o['createdAt'] ?? o['date'] ?? o['dateOfPayment'] ?? null;
    return {
      id: str(o['_id'] ?? o['id']),
      amount: num(o['amount']),
      reference: str(o['reference']),
      status: str(o['status'] ?? o['paymentStatus'] ?? 'unknown') || 'unknown',
      method: str(o['paymentMethod'] ?? o['method'] ?? '—') || '—',
      type: str(o['transactionType'] ?? o['type'] ?? '—') || '—',
      at: at ? new Date(at as string | number | Date).toISOString() : null,
    };
  }
}
