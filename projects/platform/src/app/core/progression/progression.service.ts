import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { JourneyEnvelope, MilestonesEnvelope } from './progression.models';

/** MarketSpase journey ladder → backend `/v1/progression/*`. Fully typed. */
@Injectable({ providedIn: 'root' })
export class ProgressionService {
  private readonly api = inject(ApiClient);

  mine(): Observable<JourneyEnvelope> {
    return this.api.get<JourneyEnvelope>('v1/progression/mine');
  }

  /** Coaching read — own, upline or admin. Read-only server-side. */
  byMember(partnerId: string): Observable<JourneyEnvelope> {
    return this.api.get<JourneyEnvelope>(`v1/progression/by-member/${encodeURIComponent(partnerId)}`);
  }

  attest(patch: Record<string, unknown>): Observable<MilestonesEnvelope> {
    return this.api.put<MilestonesEnvelope>('v1/progression/mine/milestones', patch);
  }
}
