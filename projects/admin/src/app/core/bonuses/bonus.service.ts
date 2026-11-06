import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { ApiEnvelope } from '../auth/auth.models';

export interface BonusCampaign {
  id: string;
  title: string;
  message: string;
  amountNgn: number;
  status: 'active' | 'disabled' | string;
  eligibleAfter?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface BonusCampaignPayload {
  title: string;
  message?: string;
  amountNgn: number;
  status?: 'active' | 'disabled';
  eligibleAfter?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface EligibleBonus {
  campaign: BonusCampaign | null;
  claimed: boolean;
}

export interface EligibleEnvelope extends ApiEnvelope<EligibleBonus> {
  data: EligibleBonus;
}

export interface ClaimResult {
  amountNgn: number;
  balance: number | null;
  reference: string;
  transactionId: string;
}

/** Configurable wallet bonuses → backend `/v1/bonuses/*`. Fully typed. */
@Injectable({ providedIn: 'root' })
export class BonusService {
  private readonly api = inject(ApiClient);

  eligible(): Observable<EligibleEnvelope> {
    return this.api.get<EligibleEnvelope>('v1/bonuses/eligible');
  }

  claim(campaignId: string): Observable<{ message: string; data: ClaimResult }> {
    return this.api.post<{ message: string; data: ClaimResult }>('v1/bonuses/claim', { campaignId });
  }

  /** Admin: campaign desk. */
  campaigns(): Observable<{ data: { items: Array<BonusCampaign & { claims: number }> } }> {
    return this.api.get('v1/admin/bonuses');
  }

  createCampaign(payload: BonusCampaignPayload): Observable<unknown> {
    return this.api.post('v1/admin/bonuses', payload);
  }

  updateCampaign(id: string, patch: Partial<BonusCampaignPayload>): Observable<unknown> {
    return this.api.patch(`v1/admin/bonuses/${id}`, patch);
  }

  deleteCampaign(id: string): Observable<unknown> {
    return this.api.delete(`v1/admin/bonuses/${id}`);
  }
}
