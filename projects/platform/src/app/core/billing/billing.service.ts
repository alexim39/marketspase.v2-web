import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { CommissionStatus, EarningsTrendEnvelope, LedgerEnvelope, PendingQueueEnvelope, PerformanceEnvelope } from './billing.models';

/**
 * Money data access → backend `/v1/billing/*`.
 * Earner endpoints use the session identity; release/void are admin-gated
 * server-side (requireRole) in addition to the admin UI guard.
 */
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly api = inject(ApiClient);

  myCommissions(params: { status?: CommissionStatus; limit?: number; skip?: number } = {}): Observable<LedgerEnvelope> {
    const query = new URLSearchParams({
      limit: String(params.limit ?? 50),
      skip: String(params.skip ?? 0),
      ...(params.status ? { status: params.status } : {}),
    });
    return this.api.get<LedgerEnvelope>(`v1/billing/mine?${query.toString()}`);
  }

  performance(): Observable<PerformanceEnvelope> {
    return this.api.get<PerformanceEnvelope>('v1/billing/performance');
  }

  trends(months = 6): Observable<EarningsTrendEnvelope> {
    return this.api.get<EarningsTrendEnvelope>(`v1/billing/trends?months=${months}`);
  }

  accrue(cartId: string): Observable<unknown> {
    return this.api.post(`v1/billing/accrue/${cartId}`, {});
  }

  pendingQueue(params: { limit?: number; skip?: number } = {}): Observable<PendingQueueEnvelope> {
    const query = new URLSearchParams({
      limit: String(params.limit ?? 25),
      skip: String(params.skip ?? 0),
    });
    return this.api.get<PendingQueueEnvelope>(`v1/billing/pending-carts?${query.toString()}`);
  }

  release(cartId: string): Observable<unknown> {
    return this.api.post(`v1/billing/release/${cartId}`, {});
  }

  void(cartId: string): Observable<unknown> {
    return this.api.post(`v1/billing/void/${cartId}`, {});
  }
}
