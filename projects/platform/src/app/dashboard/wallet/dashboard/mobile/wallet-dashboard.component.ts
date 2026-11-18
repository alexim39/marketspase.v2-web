import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { EmptyStateComponent } from '@marketspase/shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '@marketspase/shared/ui/error-state/error-state.component';
import { MobileCardComponent } from '@marketspase/shared/ui/mobile-card/mobile-card.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { WalletTransaction } from '../../../../core/wallet/wallet.models';
import { WalletDashboardFacade } from '../state/wallet-dashboard.facade';
import { WalletCashflowChartComponent } from '../cashflow/wallet-cashflow-chart.component';

/**
 * Wallet dashboard — native mobile view.
 *
 * Shares the same facade as the desktop view: one load, one source of truth,
 * and no duplicate API calls when the device class changes.
 */
@Component({
  selector: 'async-wallet-dashboard-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    EmptyStateComponent,
    ErrorStateComponent,
    MatButtonModule,
    MatIconModule,
    MobileCardComponent,
    PageSkeletonComponent,
    RouterModule,
    WalletCashflowChartComponent,
  ],
  templateUrl: './wallet-dashboard.component.html',
  styleUrls: ['./wallet-dashboard.component.scss'],
})
export class WalletDashboardMobileComponent implements OnInit {
  private readonly facade = inject(WalletDashboardFacade);

  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly balance = this.facade.balance;
  protected readonly moneyIn = this.facade.moneyIn;
  protected readonly moneyOut = this.facade.moneyOut;
  protected readonly txCount = this.facade.txCount;
  protected readonly pendingCommissions = this.facade.pendingCommissions;
  protected readonly releasedCommissions = this.facade.releasedCommissions;
  protected readonly campaignHeld = this.facade.campaignHeld;
  protected readonly recent = this.facade.recent;

  ngOnInit(): void {
    this.facade.ensureLoaded();
  }

  protected isCreditTx(tx: WalletTransaction): boolean {
    return this.facade.isCreditTx(tx);
  }

  protected money(value: number, decimals = 2): string {
    return this.facade.money(value, decimals);
  }

  protected creditMoney(value: number, credit: boolean): string {
    return this.facade.creditMoney(value, credit);
  }

  protected reload(): void {
    this.facade.reload();
  }
}
