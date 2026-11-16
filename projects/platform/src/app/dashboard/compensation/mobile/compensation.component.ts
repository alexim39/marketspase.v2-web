import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { MobileCardComponent } from '@marketspase/shared/ui/mobile-card/mobile-card.component';
import { MobilePageShellComponent } from '@marketspase/shared/ui/mobile-page-shell/mobile-page-shell.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { CompensationFacade } from '../state/compensation.facade';

@Component({
  selector: 'async-compensation-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MobileCardComponent,
    MobilePageShellComponent,
    PageSkeletonComponent,
    RouterModule,
  ],
  template: `
    <async-mobile-page-shell
      eyebrow="Wallet · Earnings"
      title="Earnings"
      backLink="/dashboard/wallet"
      backLabel="Back to wallet"
    >
      <p class="intro">Four income streams, one ledger. See what is pending, released and how your rank turns product activity into earnings.</p>

      @if (vm.loading()) {
        <async-page-skeleton layout="wallet" [rows]="4" label="your earnings" [showHeader]="false" />
      } @else {
        @if (vm.error(); as err) {
          <async-mobile-card>
            <p class="error" role="alert">{{ err }}</p>
          </async-mobile-card>
        }

        @if (vm.data(); as me) {
          <section class="hero">
            <span class="hero-label">Released lifetime earnings</span>
            <strong class="hero-value">{{ vm.money(vm.lifetimeEarned()) }}</strong>
            <p>{{ me.partner.commissionRank }} rank · earning through Level {{ me.partner.depth }}. Commissions accrue on product gross margin, never the full sale price.</p>
            <div class="hero-actions">
              <a mat-stroked-button routerLink="/dashboard/wallet/history">Wallet ledger</a>
              <button mat-stroked-button type="button" (click)="vm.downloadStatement()">
                <mat-icon>download</mat-icon> Statement
              </button>
            </div>
          </section>

          <section class="stat-list" aria-label="Earnings summary">
            <div><span>Available wallet</span><strong>{{ vm.money(me.partner.balance) }}</strong></div>
            <div><span>Pending release</span><strong>{{ vm.money(vm.pendingTotal()) }}</strong></div>
            <div><span>Mentor bonus paid</span><strong>{{ vm.money(me.summary.mentorPaid) }}</strong></div>
            <div><span>Rank source</span><strong>{{ me.partner.commissionRankSource === 'admin' ? 'Manual override' : 'Auto journey' }}</strong></div>
          </section>

          @if (vm.journey(); as j) {
            <div class="rank-strip">
              <mat-icon aria-hidden="true">route</mat-icon>
              <span>Journey: <strong>{{ j.levelLabel }}</strong> · {{ j.percent }}% to {{ j.nextLabel || 'top rank' }}</span>
              <a routerLink="/dashboard/learn">Open</a>
            </div>
          }

          <section aria-labelledby="streams-title">
            <div class="section-head"><h2 id="streams-title">Income streams</h2></div>
            <div class="stream-grid">
              <async-mobile-card class="stream-card">
                <span class="stream-icon"><mat-icon aria-hidden="true">shopping_bag</mat-icon></span>
                <h3>Product commissions</h3>
                <strong>{{ vm.money(vm.productReleased()) }}</strong>
                <small>{{ vm.productEntries().length }} entries · {{ vm.money(vm.productPending()) }} pending</small>
              </async-mobile-card>
              <async-mobile-card class="stream-card">
                <span class="stream-icon is-violet"><mat-icon aria-hidden="true">verified</mat-icon></span>
                <h3>Activation commissions</h3>
                <strong>{{ vm.money(vm.activationReleased()) }}</strong>
                <small>{{ vm.activationEntries().length }} entries · {{ vm.money(vm.activationPending()) }} pending</small>
              </async-mobile-card>
              <async-mobile-card class="stream-card">
                <span class="stream-icon is-amber"><mat-icon aria-hidden="true">volunteer_activism</mat-icon></span>
                <h3>Mentor bonus</h3>
                <strong>{{ vm.money(me.summary.mentorPaid) }}</strong>
                <small>{{ me.mentorBonuses.length }} bonuses · {{ vm.scheduledBonus() }} scheduled</small>
              </async-mobile-card>
              <async-mobile-card class="stream-card">
                <span class="stream-icon is-green"><mat-icon aria-hidden="true">storefront</mat-icon></span>
                <h3>Store &amp; resale</h3>
                <strong>{{ vm.money(vm.storeEarnings()?.released ?? 0) }}</strong>
                <small>{{ vm.storeEarnings()?.paidOrders ?? 0 }} orders · {{ vm.money(vm.storeEarnings()?.pending ?? 0) }} pending</small>
              </async-mobile-card>
            </div>
          </section>

          <async-mobile-card class="sim-card">
            <p class="eyebrow">Plan simulator</p>
            <h2>What could my team margin pay?</h2>
            <p class="muted">Enter a monthly product gross-margin figure to estimate the commission pool at your current rank depth. Illustrative only.</p>
            <label for="mobile-monthly-margin">Monthly team gross margin (₦)</label>
            <input
              id="mobile-monthly-margin"
              type="number"
              inputmode="numeric"
              min="0"
              step="1000"
              [value]="vm.simulatedMargin()"
              (input)="vm.setSimulatedMargin($any($event.target).valueAsNumber)"
            />
            <div class="sim-result">
              <span>Estimated commission at {{ me.partner.commissionRank }} depth</span>
              <strong>{{ vm.money(vm.simulatedCommission()) }}</strong>
            </div>
          </async-mobile-card>

          <async-mobile-card class="plan-card">
            <div class="section-head"><h2>Levels and rank depth</h2><span>{{ vm.money(me.plan.mentorBonus.amount) }} bonus</span></div>
            <div class="rate-grid">
              @for (rate of me.plan.rates; track rate.level) {
                <div class="rate" [class.earned]="rate.level <= me.partner.depth"><span>L{{ rate.level }}</span><strong>{{ rate.percent }}%</strong></div>
              }
            </div>
            <div class="rank-list">
              @for (rank of me.plan.ranks; track rank.rank) {
                <div [class.current]="rank.rank === me.partner.commissionRank"><span>{{ rank.rank }}</span><strong>Levels 1–{{ rank.depth }}</strong></div>
              }
            </div>
          </async-mobile-card>

          <section aria-labelledby="entries-title">
            <div class="section-head"><h2 id="entries-title">Commission entries</h2><span>{{ me.entries.length }}</span></div>
            @if (me.entries.length === 0) {
              <async-mobile-card>
                <p class="empty">No commissions yet. Product sales and activations in your team create entries here.</p>
              </async-mobile-card>
            } @else {
              <div class="entry-list">
                @for (entry of me.entries; track entry.id) {
                  <async-mobile-card class="entry-card">
                    <div class="entry-top">
                      <span class="entry-copy">
                        <strong>{{ entry.buyer?.name || 'Partner' }}</strong>
                        <small>{{ entry.createdAt | date:'mediumDate' }} · L{{ entry.level }} · {{ entry.rate * 100 | number:'1.0-1' }}%</small>
                      </span>
                      <strong class="entry-amount">{{ vm.money(entry.amount) }}</strong>
                    </div>
                    <div class="entry-bottom">
                      <span class="chip" [class.paid]="entry.status === 'Released'" [class.pending]="entry.status === 'Pending'" [class.bad]="entry.status === 'Voided' || entry.status === 'Reversed'">{{ entry.status }}</span>
                      <span class="muted">{{ entry.saleType === 'product' ? 'Product order' : 'Activation' }} · margin {{ vm.money(entry.grossMargin) }}</span>
                    </div>
                  </async-mobile-card>
                }
              </div>
            }
          </section>

          <section aria-labelledby="bonus-title">
            <div class="section-head"><h2 id="bonus-title">Mentor bonuses</h2><span>{{ me.mentorBonuses.length }}</span></div>
            @if (me.mentorBonuses.length === 0) {
              <async-mobile-card><p class="empty">No mentor bonus yet. Bonuses are paid when a partner you referred activates.</p></async-mobile-card>
            } @else {
              <div class="entry-list">
                @for (bonus of me.mentorBonuses; track bonus.id) {
                  <async-mobile-card class="entry-card">
                    <div class="entry-top">
                      <span class="entry-copy">
                        <strong>{{ bonus.activationPartner?.name || 'Placed partner' }}</strong>
                        <small>Due {{ bonus.dueAt | date:'mediumDate' }} · {{ bonus.activationPartner?.username }}</small>
                      </span>
                      <strong class="entry-amount">{{ vm.money(bonus.amount) }}</strong>
                    </div>
                    <div class="entry-bottom">
                      <span class="chip" [class.paid]="bonus.status === 'paid'" [class.pending]="bonus.status === 'scheduled'" [class.bad]="bonus.status === 'forfeited' || bonus.status === 'cancelled'">{{ vm.bonusLabel(bonus) }}</span>
                    </div>
                  </async-mobile-card>
                }
              </div>
            }
          </section>

          <a mat-flat-button color="primary" routerLink="/dashboard/wallet">Withdraw from wallet</a>
        }
      }
    </async-mobile-page-shell>
  `,
  styles: [`
    .intro { margin: 0 0 12px; color: var(--ms-text-muted); font-size: 0.84rem; line-height: 1.5; }

    .hero {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 20px;
      border-radius: var(--ms-radius-2xl);
      background: linear-gradient(125deg, #121024 0%, #24204b 58%, #3f4bb8 100%);
      color: #fff;
      box-shadow: var(--ms-shadow-glow);
    }

    .hero-label { color: rgba(255,255,255,0.64); font-size: 0.66rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
    .hero-value { font-family: var(--ms-font-display); font-size: clamp(2.2rem, 10vw, 3rem); font-variant-numeric: tabular-nums; letter-spacing: -0.04em; line-height: 1; }
    .hero p { margin: 4px 0 0; color: rgba(255,255,255,0.7); font-size: 0.78rem; line-height: 1.5; }
    .hero-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
    .hero-actions a, .hero-actions button { min-height: 44px; }

    .stat-list { display: flex; flex-direction: column; padding: 4px 14px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-xl); background: var(--ms-surface); }
    .stat-list div { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 46px; border-top: 1px solid var(--ms-line); }
    .stat-list div:first-child { border-top: 0; }
    .stat-list span { color: var(--ms-text-muted); font-size: 0.78rem; }
    .stat-list strong { font-size: 0.82rem; font-variant-numeric: tabular-nums; text-align: right; }

    .rank-strip { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 10px 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); color: var(--ms-text-muted); font-size: 0.72rem; }
    .rank-strip mat-icon { color: var(--ms-primary-strong); font-size: 17px; width: 17px; height: 17px; }
    .rank-strip a { margin-left: auto; display: inline-flex; align-items: center; min-height: 44px; color: var(--ms-primary-strong); font-weight: 650; text-decoration: none; }

    .section-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 2px 0 8px; }
    .section-head h2 { margin: 0; font-size: 0.95rem; letter-spacing: -0.02em; }
    .section-head span { color: var(--ms-text-muted); font-size: 0.7rem; }

    .stream-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .stream-card { padding: 12px; }
    .stream-icon { display: inline-grid; width: 30px; height: 30px; place-items: center; border-radius: var(--ms-radius-md); background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .stream-icon.is-violet { background: var(--ms-primary-soft); }
    .stream-icon.is-amber { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .stream-icon.is-green { background: var(--ms-success-soft); color: var(--ms-success); }
    .stream-icon mat-icon { width: 17px; height: 17px; font-size: 17px; }
    .stream-card h3 { margin: 6px 0 2px; font-size: 0.72rem; font-weight: 650; color: var(--ms-text-muted); }
    .stream-card strong { display: block; font-family: var(--ms-font-display); font-size: 1.05rem; font-variant-numeric: tabular-nums; }
    .stream-card small { display: block; margin-top: 2px; color: var(--ms-text-muted); font-size: 0.64rem; line-height: 1.35; }

    .eyebrow { margin: 0 0 4px; color: var(--ms-primary-strong); font-size: 0.64rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
    .sim-card h2, .plan-card h2 { margin: 0; font-size: 0.95rem; }
    .muted { margin: 4px 0 10px; color: var(--ms-text-muted); font-size: 0.75rem; line-height: 1.45; }
    .sim-card label { display: block; margin: 6px 0; color: var(--ms-text-muted); font-size: 0.72rem; font-weight: 650; }
    .sim-card input { width: 100%; min-height: 46px; padding: 0 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); background: var(--ms-canvas); color: var(--ms-text); font: inherit; font-size: 1rem; box-sizing: border-box; }
    .sim-result { display: flex; flex-direction: column; gap: 2px; margin-top: 10px; padding: 10px 12px; border-radius: var(--ms-radius-md); background: var(--ms-primary-soft); }
    .sim-result span { color: var(--ms-text-muted); font-size: 0.68rem; }
    .sim-result strong { color: var(--ms-primary-strong); font-family: var(--ms-font-display); font-size: 1.35rem; font-variant-numeric: tabular-nums; }

    .rate-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    .rate { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 8px 4px; border: 1px dashed var(--ms-line); border-radius: var(--ms-radius-md); background: var(--ms-canvas); }
    .rate.earned { border: 1px solid var(--ms-primary); background: var(--ms-primary-soft); }
    .rate span { color: var(--ms-text-muted); font-size: 0.62rem; font-weight: 700; }
    .rate strong { font-size: 0.9rem; }

    .rank-list { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
    .rank-list div { display: flex; justify-content: space-between; padding: 7px 9px; border-radius: var(--ms-radius-md); background: var(--ms-canvas); font-size: 0.76rem; }
    .rank-list .current { background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 700; }

    .entry-list { display: flex; flex-direction: column; gap: 8px; }
    .entry-card { padding: 12px; }
    .entry-top { display: flex; align-items: flex-start; gap: 10px; }
    .entry-copy { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .entry-copy strong { overflow: hidden; font-size: 0.82rem; text-overflow: ellipsis; white-space: nowrap; }
    .entry-copy small { color: var(--ms-text-muted); font-size: 0.68rem; }
    .entry-amount { flex: none; font-size: 0.85rem; font-variant-numeric: tabular-nums; }
    .entry-bottom { display: flex; align-items: center; gap: 8px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--ms-line); flex-wrap: wrap; }
    .entry-bottom .muted { margin: 0; }

    .chip { border-radius: var(--ms-radius-pill); padding: 3px 8px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.62rem; font-weight: 700; text-transform: uppercase; }
    .chip.paid { background: var(--ms-success-soft); color: var(--ms-success); }
    .chip.pending { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .chip.bad { background: var(--ms-error-soft); color: var(--ms-error); }

    .empty { margin: 0; color: var(--ms-text-muted); font-size: 0.8rem; line-height: 1.5; }
    .error { margin: 0; color: var(--ms-error); font-size: 0.8rem; }
  `],
})
export class CompensationMobileComponent implements OnInit {
  protected readonly vm = inject(CompensationFacade);

  ngOnInit(): void {
    this.vm.ensureLoaded();
  }
}
