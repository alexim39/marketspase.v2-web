import { ApiEnvelope } from '../auth/auth.models';

export type CommissionStatus = 'Pending' | 'Released' | 'Voided' | 'Reversed';

export interface CommissionEntry {
  id: string;
  cartId: string;
  level: number;
  rate: number;
  amount: number;
  purchaseTotal: number;
  buyerUsername: string;
  buyerName: string;
  status: CommissionStatus;
  createdAt?: string;
  releasedAt?: string;
}

export interface CommissionSums {
  Pending: number;
  Released: number;
  Voided: number;
  Reversed: number;
  pendingCount: number;
  releasedCount: number;
  lifetime: number;
}

export interface LedgerEnvelope extends Omit<ApiEnvelope, 'data'> {
  data: { items: CommissionEntry[]; total: number; limit: number; skip: number; sums: CommissionSums };
}

export interface PerformanceData {
  partner: { id: string; plan: string };
  personalVolume: number;
  personalOrders: number;
  teamVolume: number;
  teamOrders: number;
  downlineCount: number;
  downlineTruncated: boolean;
  recruitsThisMonth: number;
  commissions: CommissionSums;
}

export interface PerformanceEnvelope extends ApiEnvelope<PerformanceData> {
  data: PerformanceData;
}

export interface PendingCart {
  cartId: string;
  total: number;
  entries: number;
  buyerUsername: string;
  buyerName: string;
  latest: string;
}

export interface PendingQueueEnvelope extends ApiEnvelope<{ items: PendingCart[]; total: number }> {
  data: { items: PendingCart[]; total: number };
}

export interface EarningsTrendBucket {
  label: string;
  total: number;
  count: number;
}

export interface EarningsTrend {
  months: number;
  buckets: EarningsTrendBucket[];
}

export interface EarningsTrendEnvelope extends ApiEnvelope<EarningsTrend> {
  data: EarningsTrend;
}
