import { ApiEnvelope } from '../auth/auth.models';

export interface AdminFinanceTransaction {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string | null;
  partnerUsername: string | null;
  amount: number;
  status: string;
  method: string;
  type: string;
  reference: string;
  date: string | null;
  bank: string | null;
  bankCode: string | null;
  accountName: string | null;
  accountLast4: string | null;
  payoutMode: string | null;
  transferStatus: string | null;
  failureReason: string | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
  createdAt: string | null;
}

export interface AdminFinanceTransactionList {
  items: AdminFinanceTransaction[];
  total: number;
  limit: number;
  skip: number;
  totals: { amount: number; count: number };
}

export interface AdminFinanceTransactionEnvelope extends ApiEnvelope<AdminFinanceTransactionList> {
  data: AdminFinanceTransactionList;
}
