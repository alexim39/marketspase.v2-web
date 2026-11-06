import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { ActionsEnvelope, ActivationEnvelope, BenchAnalytics, CohortRetentionEnvelope, FunnelEnvelope, OverviewEnvelope, TeamEnvelope } from './analytics.models';
import { ApiEnvelope } from '../auth/auth.models';

/** Read-only analytics → backend `/v1/analytics/*`. Fully typed. */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly api = inject(ApiClient);

  funnel(days = 30): Observable<FunnelEnvelope> {
    return this.api.get<FunnelEnvelope>(`v1/analytics/funnel?days=${days}`);
  }

  team(days = 30, subjectId?: string): Observable<TeamEnvelope> {
    const params = new URLSearchParams({ days: String(days) });
    if (subjectId?.trim()) params.set('subjectId', subjectId.trim());
    return this.api.get<TeamEnvelope>(`v1/analytics/team?${params.toString()}`);
  }

  actions(limit = 15): Observable<ActionsEnvelope> {
    return this.api.get<ActionsEnvelope>(`v1/analytics/actions?limit=${limit}`);
  }

  /** Single aggregation powering the Insights page (replaces 3 calls). */
  overview(days = 30, forId?: string): Observable<OverviewEnvelope> {
    const params = new URLSearchParams({ days: String(days) });
    if (forId?.trim()) params.set('for', forId.trim());
    return this.api.get<OverviewEnvelope>(`v1/dashboard/overview?${params.toString()}`);
  }

  /** 7-day onboarding activation over the trailing signup cohort. */
  activation(days = 90): Observable<ActivationEnvelope> {
    return this.api.get<ActivationEnvelope>(`v1/analytics/activation?days=${days}`);
  }

  /** Leadership bench — distribution plus confirmation/nomination pressure. */
  bench(): Observable<ApiEnvelope<BenchAnalytics>> {
    return this.api.get<ApiEnvelope<BenchAnalytics>>(`v1/analytics/bench`);
  }

  /** Org-wide funnel (admin) — all prospects in-window by stage. */
  orgFunnel(days = 30): Observable<FunnelEnvelope> {
    return this.api.get<FunnelEnvelope>(`v1/analytics/admin/funnel?days=${days}`);
  }

  /** Signup-cohort rank retention (admin). */
  cohortRetention(months = 6): Observable<CohortRetentionEnvelope> {
    return this.api.get<CohortRetentionEnvelope>(`v1/analytics/admin/retention?months=${months}`);
  }
}
