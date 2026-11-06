import { ApiEnvelope } from '../auth/auth.models';

export type CommissionRank = 'Partner' | 'Builder' | 'Leader' | 'Ambassador';
export type CommissionStatus = 'Pending' | 'Released' | 'Voided' | 'Reversed';
export type MentorBonusStatus = 'scheduled' | 'paid' | 'forfeited' | 'cancelled' | 'clawed_back';

export interface CompensationPlan {
  rates: Array<{ level: number; rate: number; percent: number }>;
  ranks: Array<{ rank: CommissionRank; depth: number }>;
  mentorBonus: { amount: number; daysAfterActivation: number };
}

export interface CommissionEntry {
  id: string;
  orderId: string;
  saleType?: 'activation' | 'product';
  level: number;
  rate: number;
  amount: number;
  grossMargin: number;
  status: CommissionStatus;
  rankAtAccrual: CommissionRank;
  createdAt: string;
  releasedAt: string | null;
  voidedAt: string | null;
  recoveredAmount: number;
  outstandingAmount: number;
  earner: { id: string; name: string; username: string } | null;
  buyer: { id: string; name: string; username: string } | null;
}

export interface MentorBonus {
  id: string;
  orderId: string;
  amount: number;
  dueAt: string;
  expiresAt: string;
  status: MentorBonusStatus;
  paidAt: string | null;
  note: string | null;
  recoveredAmount: number;
  outstandingAmount: number;
  activationPartner: { id: string; name: string; username: string } | null;
  mentor: { id: string; name: string; username: string } | null;
}

export interface MyCompensation {
  partner: {
    id: string;
    name: string;
    username: string;
    balance: number;
    commissionRank: CommissionRank;
    depth: number;
    placed: boolean;
  };
  plan: CompensationPlan;
  summary: {
    pending: number;
    released: number;
    pendingCount: number;
    releasedCount: number;
    mentorPaid: number;
  };
  entries: CommissionEntry[];
  mentorBonuses: MentorBonus[];
}

export interface MyCompensationEnvelope extends ApiEnvelope<MyCompensation> {
  data: MyCompensation;
}

export interface CompensationPlanEnvelope extends ApiEnvelope<CompensationPlan> {
  data: CompensationPlan;
}

export interface PagedCompensationEnvelope<T> extends ApiEnvelope<T[]> {
  data: T[];
  meta: { page: number; limit: number; total: number; pages: number };
}

export type CommissionEntriesEnvelope = PagedCompensationEnvelope<CommissionEntry>;
export type MentorBonusesEnvelope = PagedCompensationEnvelope<MentorBonus>;

export interface ReleaseCommissionEnvelope extends ApiEnvelope<{ released: boolean; repeated: boolean; entry?: CommissionEntry }> {
  data: { released: boolean; repeated: boolean; entry?: CommissionEntry };
}

export interface MentorBonusRunResult {
  checked: number;
  paid: number;
  forfeited: number;
  held: number;
  failed: number;
}

export interface MentorBonusRunEnvelope extends ApiEnvelope<MentorBonusRunResult> {
  data: MentorBonusRunResult;
}

export interface SetRankEnvelope extends ApiEnvelope<{
  id: string;
  name: string;
  username: string;
  email: string;
  commissionRank: CommissionRank;
}> {
  data: {
    id: string;
    name: string;
    username: string;
    email: string;
    commissionRank: CommissionRank;
  };
}

export interface ProductCommissionSummary {
  orders: number;
  revenue: number;
  grossMargin: number;
  commissionableMargin: number;
  released: number;
  pending: number;
  voided: number;
  reversed: number;
  platformRetained: number;
  releasedRate: number;
  pendingRate: number;
}

export interface ProductCommissionModeRow {
  mode: 'personal' | 'resale' | 'mixed' | string;
  orders: number;
  revenue: number;
  grossMargin: number;
  commissionableMargin: number;
  released: number;
  pending: number;
  voided: number;
  reversed: number;
}

export interface ProductCommissionProductRow {
  productId: string;
  name: string;
  units: number;
  revenue: number;
  grossMargin: number;
  commissionableMargin: number;
  released: number;
  pending: number;
}

export interface ProductCommissionProblem {
  kind: 'missing_accrual' | 'fulfilled_not_released' | 'cancelled_not_voided';
  severity: 'error' | 'info';
  orderNumber: string;
  cartId: string;
  orderStatus: string;
  saleStatus: string;
  totalCost: number;
  grossMargin: number;
  commissionableMargin: number;
  entryCount: number;
  pendingCount: number;
  createdAt: string;
}

export interface ProductCommissionReport {
  range: { from: string; to: string };
  summary: ProductCommissionSummary;
  bySaleMode: ProductCommissionModeRow[];
  byProduct: ProductCommissionProductRow[];
  problems: ProductCommissionProblem[];
  problemCounts: {
    missing_accrual: number;
    fulfilled_not_released: number;
    cancelled_not_voided: number;
  };
  meta: { orders: number; truncated: boolean; generatedAt: string };
}

export interface ProductCommissionReportEnvelope extends ApiEnvelope<ProductCommissionReport> {
  data: ProductCommissionReport;
}

export interface ProductCommissionReconcileResult {
  range: { from: string; to: string };
  dryRun: boolean;
  scanned: number;
  missing: number;
  missingTotal: number;
  repaired: number;
  failed: number;
  failures: Array<{ cartId: string; orderNumber: string; message: string }>;
  samples: Array<{
    cartId: string;
    orderNumber: string;
    orderStatus: string;
    totalCost: number;
    createdAt: string;
  }>;
}

export interface ProductCommissionReconcileEnvelope extends ApiEnvelope<ProductCommissionReconcileResult> {
  data: ProductCommissionReconcileResult;
}
