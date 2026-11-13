import { ApiEnvelope } from '../auth/auth.models';

export interface FeatureEventCount {
  event?: string;
  feature?: string;
  count: number;
  partners: number;
}

export interface FeatureAdoption {
  days: number;
  generatedAt: string;
  events: {
    total: number;
    partners: number;
    byEvent: FeatureEventCount[];
    byFeature: FeatureEventCount[];
  };
  launch: {
    views: number;
    completions: number;
    nextActions: number;
    completionRate: number | null;
    timeToFirstCommission: { sample: number; medianDays: number | null; p90Days: number | null };
  };
  ora: {
    send: { proposed: number; executed: number; skipped: number; failed: number };
    sendApprovalRate: number | null;
    actionsProposed: number;
  };
  retention: {
    customers: number;
    repeatCustomers: number;
    repeatRate: number | null;
    dormant: number;
    outreach: number;
    convertedAfterOutreach: number;
    conversionRate: number | null;
    repeatCustomerRevenue: number;
  };
  mentor: { checkins: number; activeMentors: number };
  roi: { tabViews: number; analyticsOpens: number };
  trust: { exports: number };
  featureCounts: Record<string, number>;
}

export type FeatureAdoptionEnvelope = ApiEnvelope<FeatureAdoption>;

export interface RecurringRevenue {
  days: number;
  generatedAt: string;
  customers: number;
  repeatCustomers: number;
  loyalCustomers: number;
  dormantCustomers: number;
  orders: number;
  avgOrdersPerCustomer: number;
  repeatRate: number | null;
  revenue: number;
  repeatCustomerRevenue: number;
  repeatRevenueShare: number | null;
  paidOrderCount: number;
  topRepeatProducts: Array<{ name: string; units: number; buyers: number }>;
  recommendation: string;
}

export type RecurringRevenueEnvelope = ApiEnvelope<RecurringRevenue>;
