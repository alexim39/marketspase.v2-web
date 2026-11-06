import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import {
  CommissionEntriesEnvelope,
  CommissionRank,
  CompensationPlanEnvelope,
  MentorBonusRunEnvelope,
  MentorBonusesEnvelope,
  MyCompensationEnvelope,
  ProductCommissionReconcileEnvelope,
  ProductCommissionReportEnvelope,
  ReleaseCommissionEnvelope,
  SetRankEnvelope,
} from './compensation.models';

@Injectable({ providedIn: 'root' })
export class CompensationService {
  private readonly api = inject(ApiClient);

  me(): Observable<MyCompensationEnvelope> {
    return this.api.get<MyCompensationEnvelope>('v1/compensation/me');
  }

  plan(): Observable<CompensationPlanEnvelope> {
    return this.api.get<CompensationPlanEnvelope>('v1/compensation/plan');
  }

  adminEntries(params: { status?: string; page?: number; limit?: number } = {}): Observable<CommissionEntriesEnvelope> {
    const query = new URLSearchParams({
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 25),
      ...(params.status ? { status: params.status } : {}),
    });
    return this.api.get<CommissionEntriesEnvelope>(`v1/admin/compensation/entries?${query.toString()}`);
  }

  release(entryId: string): Observable<ReleaseCommissionEnvelope> {
    return this.api.post<ReleaseCommissionEnvelope>(`v1/admin/compensation/entries/${entryId}/release`, {});
  }

  void(entryId: string, reason: string): Observable<ReleaseCommissionEnvelope> {
    return this.api.post<ReleaseCommissionEnvelope>(`v1/admin/compensation/entries/${entryId}/void`, { reason });
  }

  adminBonuses(params: { status?: string; page?: number; limit?: number } = {}): Observable<MentorBonusesEnvelope> {
    const query = new URLSearchParams({
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 25),
      ...(params.status ? { status: params.status } : {}),
    });
    return this.api.get<MentorBonusesEnvelope>(`v1/admin/compensation/mentor-bonuses?${query.toString()}`);
  }

  runBonuses(): Observable<MentorBonusRunEnvelope> {
    return this.api.post<MentorBonusRunEnvelope>('v1/admin/compensation/mentor-bonuses/run', {});
  }

  setRank(identifier: string, rank: CommissionRank): Observable<SetRankEnvelope> {
    return this.api.patch<SetRankEnvelope>('v1/admin/compensation/partners/rank', { identifier, rank });
  }

  productReport(params: { from?: string; to?: string } = {}): Observable<ProductCommissionReportEnvelope> {
    const query = new URLSearchParams({
      ...(params.from ? { from: params.from } : {}),
      ...(params.to ? { to: params.to } : {}),
    });
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.api.get<ProductCommissionReportEnvelope>(`v1/admin/compensation/product-report${suffix}`);
  }

  reconcileProductCommissions(params: {
    from?: string;
    to?: string;
    limit?: number;
    apply?: boolean;
  } = {}): Observable<ProductCommissionReconcileEnvelope> {
    return this.api.post<ProductCommissionReconcileEnvelope>(
      'v1/admin/compensation/product-reconcile',
      {
        ...(params.from ? { from: params.from } : {}),
        ...(params.to ? { to: params.to } : {}),
        limit: params.limit ?? 100,
        apply: params.apply === true,
      },
    );
  }
}
