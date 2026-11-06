import { WalletTransaction } from '../wallet/wallet.models';

/** Credit-family wallet transaction types; everything else is money out. */
const CREDIT_TYPE = /credit|deposit|refund|fund|release/i;

export function isWalletCredit(tx: Pick<WalletTransaction, 'type'>): boolean {
  return CREDIT_TYPE.test(`${tx.type ?? ''}`);
}

/**
 * Naira with the sign before the symbol: `−₦1,000`, never `₦-1,000`.
 * Non-finite values render as zero so a bad API row cannot break a table.
 */
export function formatMoney(value: number | null | undefined, decimals = 2): string {
  const raw = Number(value ?? 0);
  const n = Number.isFinite(raw) ? raw : 0;
  const abs = Math.abs(n).toLocaleString('en-NG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${n < 0 ? '−' : ''}₦${abs}`;
}

/** Ledger display: explicit `+` for credits, `−` for debits, then `formatMoney`. */
export function formatSignedMoney(value: number | null | undefined, credit: boolean, decimals = 2): string {
  return `${credit ? '+' : '−'}${formatMoney(Math.abs(Number(value ?? 0)), decimals)}`;
}
