import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { FeatureAdoptionEnvelope, RecurringRevenueEnvelope } from './feature-analytics.models';

@Injectable({ providedIn: 'root' })
export class FeatureAnalyticsService {
  private readonly api = inject(ApiClient);

  adoption(days = 30): Observable<FeatureAdoptionEnvelope> {
    return this.api.get<FeatureAdoptionEnvelope>(`v1/analytics/admin/feature-adoption?days=${days}`);
  }

  recurringRevenue(days = 90): Observable<RecurringRevenueEnvelope> {
    return this.api.get<RecurringRevenueEnvelope>(`v1/analytics/admin/recurring-revenue?days=${days}`);
  }
}
