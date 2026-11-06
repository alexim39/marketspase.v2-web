import { ApiEnvelope } from '../auth/auth.models';

/** Normalized wallet transaction (legacy rows vary by writer). */
export interface WalletTransaction {
  id: string;
  amount: number;
  reference: string;
  status: string;
  method: string;
  type: string;
  at: string | null;
}

export interface WalletHistoryEnvelope extends ApiEnvelope<WalletTransaction[]> {
  data: WalletTransaction[];
}
