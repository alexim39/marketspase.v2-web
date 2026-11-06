import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { ApiEnvelope } from '../../../core/auth/auth.models';

export interface CommissionPlan {
  id: string;
  name: string;
  rates: number[];
  updatedAt: string | null;
}

/** Legacy shop commission plan → `/v1/billing/plan` (read: partners, write: admins). */
@Injectable({ providedIn: 'root' })
export class AdminPlanService {
  private readonly api = inject(ApiClient);

  get(): Observable<ApiEnvelope<CommissionPlan>> {
    return this.api.get<ApiEnvelope<CommissionPlan>>('v1/billing/plan');
  }

  save(rates: number[], name?: string): Observable<ApiEnvelope<CommissionPlan>> {
    return this.api.put<ApiEnvelope<CommissionPlan>>('v1/billing/plan', {
      rates,
      ...(name?.trim() ? { name: name.trim() } : {}),
    });
  }
}
