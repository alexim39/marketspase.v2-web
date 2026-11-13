import { ApiEnvelope } from '../auth/auth.models';

export type GrowthCampaignStatus = 'Pending' | 'Active' | 'Paused' | 'Ended' | 'Cancelled';

export interface GrowthCampaign {
  id: string;
  name: string;
  category: string;
  brief: string;
  status: GrowthCampaignStatus;
  budget: {
    total: number;
    spent: number;
    refunded: number;
    remaining: number;
  };
  flight: {
    startAt: string | null;
    endAt: string | null;
  };
  capacity: {
    total: number;
    allocated: number;
    remaining: number;
    maxPerWeek: number;
  };
  targetAudience: {
    states: string[];
    ageRange: string;
    gender: string;
  };
  supportQuality: number;
  trackingCode: string;
  trackingUrl: string;
  adminNote: string | null;
  refundReason: string | null;
  refundedAt: string | null;
  createdAt: string;
  activatedAt: string | null;
  pausedAt: string | null;
  endedAt: string | null;
  lastAllocatedAt: string | null;
}

export interface AdminGrowthCampaign extends GrowthCampaign {
  owner: {
    id: string;
    name: string;
    username: string;
    email: string;
    phone: string;
  } | null;
}

export interface MyAllocation {
  queue: {
    status: 'queued' | 'allocated' | 'cancelled';
    enteredAt: string;
    allocatedAt: string | null;
    position: number | null;
  } | null;
  allocation: {
    id: string;
    status: 'active' | 'ended' | 'reversed';
    allocatedAt: string;
    score: {
      fairness: number;
      contribution: number;
      fit: number;
      capacitySupport: number;
      total: number;
    };
    components: {
      waitDays: number;
      budgetTotal: number;
      supportQuality: number;
      capacityRemaining: number;
      partnerState: string;
    };
    explanation: string[];
    campaign: {
      id: string;
      name: string;
      status: GrowthCampaignStatus;
    } | null;
    owner: {
      id: string;
      name: string;
      username: string;
    } | null;
  } | null;
}

export interface PlacedPartner {
  id: string;
  allocatedAt: string;
  score: {
    fairness: number;
    contribution: number;
    fit: number;
    capacitySupport: number;
    total: number;
  };
  partner: {
    id: string;
    name: string;
    username: string;
    email: string;
    phone: string;
    state: string;
  } | null;
  campaign: {
    id: string;
    name: string;
    status: GrowthCampaignStatus;
  } | null;
}

export interface PlacedPartnersEnvelope extends ApiEnvelope<PlacedPartner[]> {
  data: PlacedPartner[];
}

export interface CampaignQueueRow {
  queueEntryId: string;
  partner: {
    id: string;
    name: string;
    username: string;
    email: string;
    phone: string;
    state: string;
    kycStatus: string;
  } | null;
  position: number;
  status: string;
  enteredAt: string;
  waitDays: number;
  eligible: boolean;
  reasons: string[];
}

export interface AllocatePartnersResult {
  allocated: Array<{
    allocation: { id: string };
    campaign: { id: string; name: string };
    partner: { id: string; name: string; email: string };
  }>;
  skipped: { races: number; failures: number };
  context: {
    campaigns: number;
    candidates: number;
    remainingCandidates: number;
  };
}

export interface CreateGrowthCampaignInput {
  name: string;
  category: string;
  brief: string;
  budgetAmount: number;
  capacityTotal: number;
  maxPerWeek: number;
  targetStates: string[];
  ageRange: string;
  gender: string;
  startAt?: string;
  endAt?: string | null;
}

export interface GrowthCampaignsEnvelope extends ApiEnvelope<GrowthCampaign[]> {
  data: GrowthCampaign[];
}

export interface AdminGrowthCampaignsEnvelope extends ApiEnvelope<AdminGrowthCampaign[]> {
  data: AdminGrowthCampaign[];
  meta: { page: number; limit: number; total: number; pages: number };
}

export interface MyAllocationEnvelope extends ApiEnvelope<MyAllocation> {
  data: MyAllocation;
}

export interface GrowthCampaignEnvelope extends ApiEnvelope<GrowthCampaign> {
  data: GrowthCampaign;
}

export interface AdminGrowthCampaignEnvelope extends ApiEnvelope<AdminGrowthCampaign> {
  data: AdminGrowthCampaign;
}

export interface CampaignQueueEnvelope extends ApiEnvelope<CampaignQueueRow[]> {
  data: CampaignQueueRow[];
  meta: { total: number; limit: number; capped: boolean };
}

export interface AllocatePartnersEnvelope extends ApiEnvelope<AllocatePartnersResult> {
  data: AllocatePartnersResult;
}

/** Acquisition attribution for `/join?campaign=...` signups. */
export interface CampaignAttributionRow {
  campaignCode: string;
  campaign: { id: string; name: string; status: GrowthCampaignStatus } | null;
  signups: number;
  activated: number;
  kycVerified: number;
  eligible7: number;
  retained7: number;
  activationRate: number;
  retentionRate: number | null;
  lastSignupAt: string | null;
  lastActivityAt: string | null;
}

export interface CampaignAttributionEnvelope extends ApiEnvelope<CampaignAttributionRow[]> {
  data: CampaignAttributionRow[];
}

export interface CampaignAnalyticsPoint {
  date: string;
  signups: number;
  activated: number;
}

export interface CampaignAnalyticsSummary {
  signups: number;
  activated: number;
  kycVerified: number;
  eligible7: number;
  retained7: number;
  activationRate: number;
  retentionRate: number | null;
  lastSignupAt: string | null;
  lastActivityAt: string | null;
}

export interface CampaignAnalytics {
  campaign: GrowthCampaign;
  windowDays: number;
  summary: CampaignAnalyticsSummary;
  series: CampaignAnalyticsPoint[];
}

export interface CampaignAnalyticsEnvelope extends ApiEnvelope<CampaignAnalytics> {
  data: CampaignAnalytics;
}
