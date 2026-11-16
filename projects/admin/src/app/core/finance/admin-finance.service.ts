import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { AdminFinanceTransactionEnvelope } from './admin-finance.models';

export type FinanceTransactionType = 'all' | 'deposits' | 'withdrawals' | 'refunds';

export interface FinanceTransactionQuery {
  type?: FinanceTransactionType;
  status?: string;
  q?: string;
  from?: Date | null;
  to?: Date | null;
  limit?: number;
  skip?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminFinanceService {
  private readonly api = inject(ApiClient);

  transactions(query: FinanceTransactionQuery = {}): Observable<AdminFinanceTransactionEnvelope> {
    const params = new URLSearchParams();
    params.set('type', query.type ?? 'all');
    if (query.status) params.set('status', query.status);
    if (query.q) params.set('q', query.q);
    if (query.from) params.set('from', query.from.toISOString());
    if (query.to) params.set('to', query.to.toISOString());
    params.set('limit', String(query.limit ?? 25));
    params.set('skip', String(query.skip ?? 0));
    return this.api.get<AdminFinanceTransactionEnvelope>(
      `v1/admin/finance/transactions?${params.toString()}`,
    );
  }
}
