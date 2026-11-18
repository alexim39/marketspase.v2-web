import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { WalletService } from '../../../../core/wallet/wallet.service';
import { WalletTransaction } from '../../../../core/wallet/wallet.models';
import { CompensationService } from '../../../../core/compensation/compensation.service';
import { MyCompensation } from '../../../../core/compensation/compensation.models';
import { CampaignsService } from '../../../../core/campaigns/campaigns.service';
import { GrowthCampaign } from '../../../../core/campaigns/campaigns.models';
import { ApiError } from '../../../../core/http/api-error';
import { formatMoney, formatSignedMoney, isWalletCredit } from '../../../../core/format/money';

/**
 * Shared wallet-dashboard state.
 *
 * Provided by the device-aware wrapper so the desktop and mobile views read
 * the exact same signals. `ensureLoaded()` is idempotent: resizing across the
 * 960px boundary swaps only the view and never repeats these requests.
 */
@Injectable()
export class WalletDashboardFacade {
  private readonly auth = inject(AuthService);
  private readonly wallet = inject(WalletService);
  private readonly compensationSvc = inject(CompensationService);
  private readonly campaignsSvc = inject(CampaignsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly txs = signal<WalletTransaction[]>([]);
  readonly compensation = signal<MyCompensation | null>(null);
  readonly campaigns = signal<GrowthCampaign[]>([]);

  readonly balance = computed(() => Number(this.auth.currentUser()?.['balance'] ?? 0));
  readonly moneyIn = computed(() => this.txs().reduce(
    (sum, t) => isWalletCredit(t) ? sum + Math.abs(Number(t.amount) || 0) : sum,
    0,
  ));
  readonly moneyOut = computed(() => this.txs().reduce(
    (sum, t) => !isWalletCredit(t) ? sum + Math.abs(Number(t.amount) || 0) : sum,
    0,
  ));
  readonly txCount = computed(() => this.txs().length);
  readonly pendingCommissions = computed(() => Number(this.compensation()?.summary?.pending ?? 0));
  readonly releasedCommissions = computed(() => Number(this.compensation()?.summary?.released ?? 0));
  readonly campaignHeld = computed(() => this.campaigns()
    .filter((c) => c.status !== 'Ended' && c.status !== 'Cancelled')
    .reduce((sum, c) => sum + Number(c.budget?.remaining ?? 0), 0));
  readonly recent = computed(() => [...this.txs()]
    .sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')))
    .slice(0, 6));

  private started = false;

  ensureLoaded(): void {
    if (this.started) return;
    this.started = true;
    this.load();
  }

  reload(): void {
    if (this.loading()) return;
    this.load();
  }

  isCreditTx(tx: WalletTransaction): boolean {
    return isWalletCredit(tx);
  }

  money(value: number, decimals = 2): string {
    return formatMoney(value, decimals);
  }

  creditMoney(value: number, credit: boolean): string {
    return formatSignedMoney(value, credit);
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    // Resolve the session first so WalletService can address the owner-scoped history.
    this.auth.me().pipe(
      catchError(() => of(null)),
      switchMap(() => forkJoin({
        txs: this.wallet.historyPage({ limit: 200, skip: 0 }).pipe(
          map((res) => res.data),
          catchError(() => of([])),
        ),
        compensation: this.compensationSvc.me().pipe(catchError(() => of(null))),
        campaigns: this.campaignsSvc.mine().pipe(catchError(() => of(null))),
      })),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: ({ txs, compensation, campaigns }) => {
        this.txs.set(txs ?? []);
        this.compensation.set(compensation?.data ?? null);
        this.campaigns.set(campaigns?.data ?? []);
        this.loading.set(false);
      },
      error: (err: ApiError) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }
}
