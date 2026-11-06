import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { ApiEnvelope } from '../../../core/auth/auth.models';

export interface PartnerSurveyRow {
  id: string;
  name: string;
  gender: string;
  phoneNumber: string;
  reservationCode: string;
  difficulty: string;
  challenges: string[];
  strategies: string[];
  targetAudience: string[];
  recruitmentTool: string;
  misconception: string;
  businessMotivation: string;
  recruitmentAttempt: string;
  trainingSupport: string;
  comfortWithTech: string;
  businessTimeDedication: string;
  interestedInTraining: string;
  createdAt: string | null;
}

export interface Rank { label: string; count: number }

export interface PartnerSurveyList {
  items: PartnerSurveyRow[];
  total: number;
  summary: {
    total: number;
    new7d: number;
    topChallenges: Rank[];
    topStrategies: Rank[];
    topAudiences: Rank[];
    byDifficulty: Rank[];
    byTool: Rank[];
    trainingDemand: Rank[];
    wantsTraining: number;
  };
}

/** Admin partner-surveys desk → `/v1/admin/partner-surveys/*` (role-gated). */
@Injectable({ providedIn: 'root' })
export class AdminPartnerSurveysService {
  private readonly api = inject(ApiClient);

  list(params: { q?: string; limit?: number; skip?: number } = {}): Observable<ApiEnvelope<PartnerSurveyList>> {
    const query = new URLSearchParams({
      ...(params.q?.trim() ? { q: params.q.trim() } : {}),
      limit: String(params.limit ?? 25),
      skip: String(params.skip ?? 0),
    });
    return this.api.get<ApiEnvelope<PartnerSurveyList>>(`v1/admin/partner-surveys?${query.toString()}`);
  }

  remove(id: string): Observable<ApiEnvelope<{ id: string }>> {
    return this.api.delete(`v1/admin/partner-surveys/${encodeURIComponent(id)}`);
  }
}
