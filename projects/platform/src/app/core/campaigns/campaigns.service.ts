import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import {
  AdminGrowthCampaignEnvelope,
  AdminGrowthCampaignsEnvelope,
  AllocatePartnersEnvelope,
  CampaignAttributionEnvelope,
  CampaignQueueEnvelope,
  CreateGrowthCampaignInput,
  GrowthCampaignEnvelope,
  GrowthCampaignsEnvelope,
  MyAllocationEnvelope,
  PlacedPartnersEnvelope,
} from './campaigns.models';

@Injectable({ providedIn: 'root' })
export class CampaignsService {
  private readonly api = inject(ApiClient);

  mine(): Observable<GrowthCampaignsEnvelope> {
    return this.api.get<GrowthCampaignsEnvelope>('v1/campaigns');
  }

  get(campaignId: string): Observable<GrowthCampaignEnvelope> {
    return this.api.get<GrowthCampaignEnvelope>(`v1/campaigns/${campaignId}`);
  }

  create(input: CreateGrowthCampaignInput): Observable<GrowthCampaignEnvelope> {
    return this.api.post<GrowthCampaignEnvelope>('v1/campaigns', input);
  }

  cancel(campaignId: string, reason?: string): Observable<GrowthCampaignEnvelope> {
    return this.api.post<GrowthCampaignEnvelope>(`v1/campaigns/${campaignId}/cancel`, { reason });
  }

  pause(campaignId: string): Observable<GrowthCampaignEnvelope> {
    return this.api.post<GrowthCampaignEnvelope>(`v1/campaigns/${campaignId}/pause`, {});
  }

  resume(campaignId: string): Observable<GrowthCampaignEnvelope> {
    return this.api.post<GrowthCampaignEnvelope>(`v1/campaigns/${campaignId}/resume`, {});
  }

  myAllocation(): Observable<MyAllocationEnvelope> {
    return this.api.get<MyAllocationEnvelope>('v1/campaigns/me/allocation');
  }

  myPlacedPartners(): Observable<PlacedPartnersEnvelope> {
    return this.api.get<PlacedPartnersEnvelope>('v1/campaigns/me/placed-partners');
  }

  adminList(params: { status?: string; page?: number; limit?: number } = {}): Observable<AdminGrowthCampaignsEnvelope> {
    const query = new URLSearchParams({
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 25),
      ...(params.status ? { status: params.status } : {}),
    });
    return this.api.get<AdminGrowthCampaignsEnvelope>(`v1/admin/campaigns?${query.toString()}`);
  }

  adminQueue(limit = 200): Observable<CampaignQueueEnvelope> {
    return this.api.get<CampaignQueueEnvelope>(`v1/admin/campaigns/queue?limit=${limit}`);
  }

  /** Acquisition attribution — signups/activations grouped by campaign code. */
  adminAttribution(limit = 100): Observable<CampaignAttributionEnvelope> {
    return this.api.get<CampaignAttributionEnvelope>(`v1/admin/campaigns/attribution?limit=${limit}`);
  }

  adminActivate(campaignId: string): Observable<AdminGrowthCampaignEnvelope> {
    return this.api.post<AdminGrowthCampaignEnvelope>(`v1/admin/campaigns/${campaignId}/activate`, {});
  }

  adminReject(campaignId: string, reason: string): Observable<AdminGrowthCampaignEnvelope> {
    return this.api.post<AdminGrowthCampaignEnvelope>(`v1/admin/campaigns/${campaignId}/reject`, { reason });
  }

  adminPause(campaignId: string): Observable<AdminGrowthCampaignEnvelope> {
    return this.api.post<AdminGrowthCampaignEnvelope>(`v1/admin/campaigns/${campaignId}/pause`, {});
  }

  adminResume(campaignId: string): Observable<AdminGrowthCampaignEnvelope> {
    return this.api.post<AdminGrowthCampaignEnvelope>(`v1/admin/campaigns/${campaignId}/resume`, {});
  }

  adminEnd(campaignId: string, spentAmount: number, note?: string): Observable<AdminGrowthCampaignEnvelope> {
    return this.api.post<AdminGrowthCampaignEnvelope>(`v1/admin/campaigns/${campaignId}/end`, { spentAmount, note });
  }

  adminAllocate(campaignId?: string, limit = 20): Observable<AllocatePartnersEnvelope> {
    const path = campaignId
      ? `v1/admin/campaigns/${campaignId}/allocate`
      : 'v1/admin/campaigns/allocate';
    return this.api.post<AllocatePartnersEnvelope>(path, { limit });
  }
}
