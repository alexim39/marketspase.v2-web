import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { CreateGoalPayload, GoalEnvelope, GoalsEnvelope, TrendsEnvelope } from './goal.models';

/** Goal definitions + live progress → backend `/v1/goals/*`. Fully typed. */
@Injectable({ providedIn: 'root' })
export class GoalService {
  private readonly api = inject(ApiClient);

  mine(): Observable<GoalsEnvelope> {
    return this.api.get<GoalsEnvelope>('v1/goals/mine');
  }

  /** Per-member coaching read — own, upline or admin (outsiders get 403). */
  byPartner(partnerId: string): Observable<GoalsEnvelope> {
    return this.api.get<GoalsEnvelope>(`v1/goals/by-partner/${encodeURIComponent(partnerId)}`);
  }

  trends(months = 6): Observable<TrendsEnvelope> {
    return this.api.get<TrendsEnvelope>(`v1/goals/trends?months=${months}`);
  }

  create(payload: CreateGoalPayload): Observable<GoalEnvelope> {
    return this.api.post<GoalEnvelope>('v1/goals', payload);
  }

  update(id: string, patch: Partial<CreateGoalPayload>): Observable<GoalEnvelope> {
    return this.api.put<GoalEnvelope>(`v1/goals/${id}`, patch);
  }

  remove(id: string): Observable<unknown> {
    return this.api.delete(`v1/goals/${id}`);
  }

  celebrate(id: string): Observable<unknown> {
    return this.api.post(`v1/goals/${encodeURIComponent(id)}/celebrate`, {});
  }
}
