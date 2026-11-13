import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, catchError, forkJoin, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { CompensationService } from '../../core/compensation/compensation.service';
import { ProgressionService } from '../../core/progression/progression.service';
import { StoreService } from '../../core/store/store.service';
import { Journey } from '../../core/progression/progression.models';
import { MentorBonus, MyCompensation } from '../../core/compensation/compensation.models';
import { StoreEarnings } from '../../core/store/store.models';
import { ApiError, userError } from '../../core/http/api-error';
import { formatMoney } from '../../core/format/money';

@Component({
  selector: 'async-compensation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, MatButtonModule, MatIconModule, PageSkeletonComponent, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>Earnings</span>
      </div>
    </section>

    <section class="earnings-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Wallet · Earnings</p>
          <h1>Know exactly how you earn</h1>
          <p class="subtitle">Four income streams, one ledger. See what is pending, what has been released and how your rank turns product activity into earnings.</p>
        </div>
        <div class="head-actions">
          <button mat-stroked-button type="button" (click)="downloadStatement()" [disabled]="!data()">
            <mat-icon>download</mat-icon>
            Download statement
          </button>
          <a mat-flat-button color="primary" routerLink="/dashboard/wallet">
            <mat-icon>account_balance_wallet</mat-icon>
            Withdraw
          </a>
        </div>
      </header>

      @if (loading()) {
        <async-page-skeleton layout="wallet" [rows]="4" label="your earnings" [showHeader]="false" />
      } @else {
        @if (error(); as err) {
          <div class="alert" role="alert"><mat-icon>error_outline</mat-icon><p>{{ err }}</p></div>
        }

        @if (data(); as me) {
          <section class="earnings-hero">
            <div class="hero-main">
              <span class="hero-eyebrow">Released lifetime earnings</span>
              <strong class="hero-value">{{ money(lifetimeEarned()) }}</strong>
              <p>{{ me.partner.commissionRank }} rank · earning through Level {{ me.partner.depth }}. Commissions accrue on product gross margin, never on the full sale price.</p>
              <div class="hero-actions">
                <a mat-stroked-button routerLink="/dashboard/wallet/history">Open wallet ledger</a>
                <a mat-button routerLink="/dashboard/settings/billing">Payout settings</a>
              </div>
            </div>
            <div class="hero-stats">
              <div><span>Available wallet</span><strong>{{ money(me.partner.balance) }}</strong></div>
              <div><span>Pending release</span><strong>{{ money(pendingTotal()) }}</strong></div>
              <div><span>Mentor bonus paid</span><strong>{{ money(me.summary.mentorPaid) }}</strong></div>
              <div><span>Rank source</span><strong class="rank-source">{{ me.partner.commissionRankSource === 'admin' ? 'Manual override' : 'Auto journey' }}</strong></div>
            </div>
          </section>

          @if (journey(); as j) {
            <div class="rank-strip">
              <mat-icon>route</mat-icon>
              <span>Journey: <strong>{{ j.levelLabel }}</strong> · {{ j.percent }}% to {{ j.nextLabel || 'top rank' }}</span>
              @if (me.partner.commissionRankSource !== 'admin' && j.levelLabel !== me.partner.commissionRank) {
                <span class="rank-warning">Commission rank is syncing — contact support if this persists.</span>
              }
              <a mat-button routerLink="/dashboard/learn">Open progress</a>
            </div>
          }

          <section class="stream-grid" aria-label="Income streams">
            <article class="stream-card">
              <span class="stream-icon"><mat-icon>shopping_bag</mat-icon></span>
              <div class="stream-head"><h2>Product commissions</h2><span class="stream-pill">{{ productEntries().length }} entries</span></div>
              <strong>{{ money(productReleased()) }}</strong>
              <p>Released from personal and team product orders.</p>
              <span class="stream-pending">{{ money(productPending()) }} pending</span>
            </article>
            <article class="stream-card">
              <span class="stream-icon stream-icon--violet"><mat-icon>verified</mat-icon></span>
              <div class="stream-head"><h2>Activation commissions</h2><span class="stream-pill">{{ activationEntries().length }} entries</span></div>
              <strong>{{ money(activationReleased()) }}</strong>
              <p>Earned when activation orders settle in your team.</p>
              <span class="stream-pending">{{ money(activationPending()) }} pending</span>
            </article>
            <article class="stream-card">
              <span class="stream-icon stream-icon--amber"><mat-icon>volunteer_activism</mat-icon></span>
              <div class="stream-head"><h2>Mentor bonus</h2><span class="stream-pill">{{ me.mentorBonuses.length }} bonuses</span></div>
              <strong>{{ money(me.summary.mentorPaid) }}</strong>
              <p>Paid when a partner you supported activates.</p>
              <span class="stream-pending">{{ scheduledBonus() }} scheduled</span>
            </article>
            <article class="stream-card">
              <span class="stream-icon stream-icon--green"><mat-icon>storefront</mat-icon></span>
              <div class="stream-head"><h2>Store &amp; resale</h2><span class="stream-pill">{{ storeEarnings()?.paidOrders ?? 0 }} orders</span></div>
              <strong>{{ money(storeEarnings()?.released ?? 0) }}</strong>
              <p>Released store orders and retail margin.</p>
              <span class="stream-pending">{{ money(storeEarnings()?.pending ?? 0) }} pending</span>
            </article>
          </section>

          <div class="earnings-grid">
            <section class="panel simulator">
              <div class="panel-head">
                <div><p class="eyebrow">Plan simulator</p><h2>What could my team margin pay?</h2></div>
                <span class="pill">Illustrative</span>
              </div>
              <p class="panel-copy">Enter a monthly product gross-margin figure and see the commission pool at your current rank depth. This is an estimate, not a promise.</p>
              <label class="sim-label" for="monthly-margin">Monthly team gross margin (₦)</label>
              <div class="sim-input">
                <span>₦</span>
                <input id="monthly-margin" type="number" min="0" step="1000" [value]="simulatedMargin()" (input)="setSimulatedMargin($any($event.target).valueAsNumber)" />
              </div>
              <div class="sim-result">
                <span>Estimated commission at {{ me.partner.commissionRank }} depth (Levels 1–{{ me.partner.depth }})</span>
                <strong>{{ money(simulatedCommission()) }}</strong>
              </div>
              <div class="sim-bars" aria-hidden="true">
                @for (rate of payableRates(); track rate.level) {
                  <div><span>L{{ rate.level }} · {{ rate.percent }}%</span><i [style.width.%]="rate.percent / 9 * 100"></i></div>
                }
              </div>
              <p class="sim-note">Assumes the margin is spread evenly across your payable levels. Excludes mentor bonus, store margin and any rank changes.</p>
            </section>

            <section class="panel">
              <div class="panel-head"><div><p class="eyebrow">Plan</p><h2>Levels and rank depth</h2></div><span class="pill">{{ money(me.plan.mentorBonus.amount) }} mentor bonus</span></div>
              <div class="rate-grid">
                @for (rate of me.plan.rates; track rate.level) {
                  <div class="rate" [class.earned]="rate.level <= me.partner.depth"><span>Level {{ rate.level }}</span><strong>{{ rate.percent }}%</strong></div>
                }
              </div>
              <p class="panel-copy small">Commission is calculated on product gross margin, never the full product price and never campaign spend.</p>
              <div class="rank-list">
                @for (rank of me.plan.ranks; track rank.rank) {
                  <div [class.current]="rank.rank === me.partner.commissionRank"><span>{{ rank.rank }}</span><strong>Levels 1–{{ rank.depth }}</strong></div>
                }
              </div>
            </section>
          </div>

          <section class="panel ledger">
            <div class="panel-head">
              <div><p class="eyebrow">Ledger</p><h2>Commission entries</h2></div>
              <span class="pill">{{ me.entries.length }}</span>
            </div>
            @if (me.entries.length === 0) {
              <div class="empty"><mat-icon>receipt_long</mat-icon><p>No commissions yet. Product sales and activations in your team create entries here.</p><a mat-stroked-button routerLink="/dashboard/products/my-store">Share your store</a></div>
            } @else {
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Source</th><th>Level</th><th>Gross margin</th><th>Commission</th><th>Status</th></tr></thead>
                  <tbody>
                    @for (entry of me.entries; track entry.id) {
                      <tr>
                        <td>{{ entry.createdAt | date: 'mediumDate' }}</td>
                        <td><strong>{{ entry.buyer?.name || 'Partner' }}</strong><small>{{ entry.buyer?.username }}</small><small class="sale-type">{{ entry.saleType === 'product' ? 'Product order' : 'Activation' }}</small></td>
                        <td>L{{ entry.level }} · {{ entry.rate * 100 | number: '1.0-1' }}%</td>
                        <td>{{ money(entry.grossMargin) }}</td>
                        <td class="money">{{ money(entry.amount) }}</td>
                        <td><span class="chip" [class.paid]="entry.status === 'Released'" [class.pending]="entry.status === 'Pending'" [class.bad]="entry.status === 'Voided' || entry.status === 'Reversed'">{{ entry.status }}</span></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>

          <section class="panel bonus-panel">
            <div class="panel-head"><div><p class="eyebrow">Mentor bonus</p><h2>Activation bonuses</h2></div><span class="pill">{{ me.mentorBonuses.length }}</span></div>
            @if (me.mentorBonuses.length === 0) {
              <div class="empty"><mat-icon>volunteer_activism</mat-icon><p>No mentor bonus yet. Bonuses are paid immediately when a partner you referred activates.</p></div>
            } @else {
              <div class="bonus-list">
                @for (bonus of me.mentorBonuses; track bonus.id) {
                  <article class="bonus-row">
                    <div><strong>{{ bonus.activationPartner?.name || 'Placed partner' }}</strong><p class="muted">Due {{ bonus.dueAt | date: 'mediumDate' }} · {{ bonus.activationPartner?.username }}</p></div>
                    <span class="amount">{{ money(bonus.amount) }}</span>
                    <span class="chip" [class.paid]="bonus.status === 'paid'" [class.pending]="bonus.status === 'scheduled'" [class.bad]="bonus.status === 'forfeited' || bonus.status === 'cancelled'">{{ bonusLabel(bonus) }}</span>
                  </article>
                }
              </div>
            }
          </section>
        }
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 16px; }
    .breadcrumb a { text-decoration: none; }
    .earnings-page { display: flex; flex-direction: column; gap: 24px; max-width: 1200px; margin: 0 auto; padding-bottom: 32px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; flex-wrap: wrap; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(2rem, 3vw, 2.5rem); letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .subtitle { margin: 0; max-width: 62em; color: var(--ms-text-muted); line-height: 1.6; }
    .head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .head-actions mat-icon { margin-right: 6px; }
    .earnings-hero { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.9fr); gap: 24px; padding: 24px; border-radius: var(--ms-radius-2xl); background: linear-gradient(125deg, #121024 0%, #24204b 58%, #3f4bb8 100%); color: #fff; box-shadow: var(--ms-shadow-md); }
    .hero-eyebrow { color: rgba(255,255,255,0.62); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
    .hero-value { display: block; margin: 8px 0; font-family: var(--ms-font-display); font-size: clamp(2.5rem, 5vw, 4rem); font-weight: 700; line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
    .hero-main p { margin: 0; max-width: 48em; color: rgba(255,255,255,0.7); font-size: 0.9375rem; line-height: 1.6; }
    .hero-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
    .hero-stats { display: grid; gap: 8px; align-content: center; }
    .hero-stats div { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 10px 16px; border-radius: var(--ms-radius-md); background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); }
    .hero-stats span { color: rgba(255,255,255,0.65); font-size: 0.75rem; font-weight: 600; }
    .hero-stats strong { font-variant-numeric: tabular-nums; text-align: right; }
    .rank-source { font-size: 0.8125rem; }
    .rank-strip { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 12px 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); color: var(--ms-text-muted); font-size: 0.8125rem; }
    .rank-strip mat-icon { color: var(--ms-primary-strong); font-size: 18px; width: 18px; height: 18px; }
    .rank-warning { color: var(--ms-warning); }
    .rank-strip a { margin-left: auto; }
    .stream-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .stream-card { display: flex; flex-direction: column; gap: 6px; padding: 16px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); }
    .stream-icon { width: 40px; height: 40px; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .stream-icon--violet { background: var(--ms-primary-soft); }
    .stream-icon--amber { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .stream-icon--green { background: var(--ms-success-soft); color: var(--ms-success); }
    .stream-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .stream-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .stream-head h2 { margin: 0; font-size: 0.875rem; }
    .stream-pill { color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 600; white-space: nowrap; }
    .stream-card > strong { font-family: var(--ms-font-display); font-size: 1.5rem; font-variant-numeric: tabular-nums; }
    .stream-card p { margin: 0; color: var(--ms-text-muted); font-size: 0.75rem; line-height: 1.5; }
    .stream-pending { margin-top: auto; color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 600; }
    .earnings-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: 16px; align-items: start; }
    .panel { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); padding: 24px; }
    .panel-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
    .panel-head h2 { margin: 4px 0 0; font-size: 1.125rem; }
    .pill { background: var(--ms-primary-soft); color: var(--ms-primary-strong); border-radius: 999px; padding: 4px 10px; font-size: 0.6875rem; font-weight: 700; white-space: nowrap; }
    .panel-copy { margin: 0 0 16px; color: var(--ms-text-muted); font-size: 0.875rem; line-height: 1.6; }
    .panel-copy.small { font-size: 0.8125rem; }
    .sim-label { display: block; margin-bottom: 6px; color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; }
    .sim-input { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); background: var(--ms-canvas); }
    .sim-input span { color: var(--ms-text-muted); font-weight: 700; }
    .sim-input input { flex: 1; border: 0; background: transparent; color: var(--ms-text); font: inherit; font-size: 1.125rem; font-weight: 600; outline: none; }
    .sim-result { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-top: 12px; padding: 12px 16px; border-radius: var(--ms-radius-md); background: var(--ms-primary-soft); }
    .sim-result span { color: var(--ms-text-muted); font-size: 0.75rem; }
    .sim-result strong { font-family: var(--ms-font-display); font-size: 1.5rem; color: var(--ms-primary-strong); font-variant-numeric: tabular-nums; }
    .sim-bars { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
    .sim-bars div { display: grid; grid-template-columns: 70px minmax(0, 1fr); align-items: center; gap: 8px; }
    .sim-bars span { color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 700; }
    .sim-bars i { display: block; height: 6px; border-radius: 999px; background: var(--ms-primary); max-width: 100%; }
    .sim-note { margin: 12px 0 0; color: var(--ms-text-muted); font-size: 0.75rem; line-height: 1.5; }
    .rate-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; margin-bottom: 10px; }
    .rate { padding: 10px 7px; border-radius: var(--ms-radius-sm); background: var(--ms-canvas); border: 1px dashed var(--ms-line); display: grid; gap: 2px; text-align: center; }
    .rate.earned { border: 1px solid var(--ms-primary); background: var(--ms-primary-soft); }
    .rate span { font-size: 0.625rem; color: var(--ms-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .rate strong { font-size: 1rem; }
    .rank-list { display: grid; gap: 5px; margin-top: 12px; }
    .rank-list div { display: flex; justify-content: space-between; padding: 7px 10px; border-radius: var(--ms-radius-sm); background: var(--ms-canvas); font-size: 0.8125rem; }
    .rank-list .current { background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 700; }
    .ledger { margin-top: 0; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 720px; }
    th, td { text-align: left; padding: 12px 10px; border-bottom: 1px solid var(--ms-line); }
    th { color: var(--ms-text-muted); font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.06em; }
    tbody tr:last-child td { border-bottom: 0; }
    td small { display: block; color: var(--ms-text-muted); font-size: 0.75rem; }
    td small.sale-type { color: var(--ms-primary-strong); font-weight: 700; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .money { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .chip { border-radius: 999px; padding: 4px 10px; font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; background: var(--ms-canvas); color: var(--ms-text-muted); white-space: nowrap; }
    .chip.paid { background: var(--ms-success-soft); color: var(--ms-success); }
    .chip.pending { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .chip.bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .empty { display: grid; place-items: center; gap: 8px; padding: 40px 16px; text-align: center; color: var(--ms-text-muted); }
    .empty mat-icon { font-size: 36px; width: 36px; height: 36px; }
    .empty p { margin: 0; max-width: 40em; line-height: 1.6; }
    .bonus-list { display: grid; }
    .bonus-row { display: flex; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--ms-line); flex-wrap: wrap; }
    .bonus-row:last-child { border-bottom: 0; }
    .bonus-row > div { flex: 1; min-width: 180px; }
    .bonus-row p { margin: 2px 0 0; font-size: 0.75rem; }
    .amount { font-weight: 700; font-variant-numeric: tabular-nums; }
    .muted { color: var(--ms-text-muted); }
    .alert { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { flex: 1; margin: 0; }
    @media (max-width: 1000px) {
      .stream-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .earnings-grid, .earnings-hero { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 640px) {
      .panel { padding: 16px; }
      .stream-grid { grid-template-columns: minmax(0, 1fr); }
      .rate-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .head-actions { width: 100%; }
      .head-actions a, .head-actions button { flex: 1; justify-content: center; }
    }
  `],
})
export class CompensationComponent implements OnInit {
  private readonly service = inject(CompensationService);
  private readonly progression = inject(ProgressionService);
  private readonly store = inject(StoreService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<MyCompensation | null>(null);
  protected readonly journey = signal<Journey | null>(null);
  protected readonly storeEarnings = signal<StoreEarnings | null>(null);
  protected readonly simulatedMargin = signal(100000);

  protected readonly productEntries = computed(() => this.data()?.entries.filter((e) => e.saleType !== 'activation') ?? []);
  protected readonly activationEntries = computed(() => this.data()?.entries.filter((e) => e.saleType === 'activation') ?? []);

  protected readonly lifetimeEarned = computed(() => {
    const me = this.data();
    return Number(me?.summary.released ?? 0) + Number(me?.summary.mentorPaid ?? 0) + Number(this.storeEarnings()?.released ?? 0);
  });
  protected readonly pendingTotal = computed(() => {
    const me = this.data();
    return Number(me?.summary.pending ?? 0) + Number(this.storeEarnings()?.pending ?? 0);
  });

  protected readonly productReleased = computed(() => this.sumEntries(this.productEntries(), 'Released'));
  protected readonly productPending = computed(() => this.sumEntries(this.productEntries(), 'Pending'));
  protected readonly activationReleased = computed(() => this.sumEntries(this.activationEntries(), 'Released'));
  protected readonly activationPending = computed(() => this.sumEntries(this.activationEntries(), 'Pending'));
  protected readonly scheduledBonus = computed(() => (this.data()?.mentorBonuses ?? []).filter((b) => b.status === 'scheduled').length);
  protected readonly payableRates = computed(() => {
    const me = this.data();
    if (!me) return [];
    return me.plan.rates.filter((rate) => rate.level <= me.partner.depth);
  });
  protected readonly simulatedCommission = computed(() => {
    const me = this.data();
    const rates = this.payableRates();
    if (!me || rates.length === 0) return 0;
    const margin = Math.max(0, Number(this.simulatedMargin()) || 0);
    const perLevel = margin / rates.length;
    return rates.reduce((sum, rate) => sum + perLevel * rate.rate, 0);
  });

  ngOnInit(): void {
    forkJoin({
      compensation: this.service.me(),
      journey: this.progression.mine().pipe(catchError(() => of(null))),
      store: this.store.earnings().pipe(catchError(() => of(null))),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: ({ compensation, journey, store }) => {
        this.data.set(compensation.data);
        this.journey.set(journey?.data ?? null);
        this.storeEarnings.set(store?.data ?? null);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected setSimulatedMargin(value: number): void {
    this.simulatedMargin.set(Number.isFinite(value) ? Math.max(0, value) : 0);
  }

  protected bonusLabel(bonus: MentorBonus): string {
    if (bonus.status === 'scheduled') return 'Scheduled';
    if (bonus.status === 'paid') return 'Paid';
    if (bonus.status === 'clawed_back') return 'Clawed back';
    if (bonus.status === 'cancelled') return 'Cancelled';
    return 'Forfeited';
  }

  protected money(value: number): string {
    return formatMoney(value, 0);
  }

  protected downloadStatement(): void {
    const me = this.data();
    if (!me) return;
    const rows: Array<Array<string | number>> = [
      ['Date', 'Source', 'Sale type', 'Level', 'Rate', 'Gross margin', 'Commission', 'Status'],
      ...me.entries.map((entry) => [
        new Date(entry.createdAt).toISOString().slice(0, 10),
        `${entry.buyer?.name ?? 'Partner'}${entry.buyer?.username ? ` (@${entry.buyer.username})` : ''}`,
        entry.saleType ?? 'activation',
        entry.level,
        `${Math.round(entry.rate * 1000) / 10}%`,
        entry.grossMargin,
        entry.amount,
        entry.status,
      ]),
      ...me.mentorBonuses.map((bonus) => [
        new Date(bonus.dueAt).toISOString().slice(0, 10),
        `Mentor bonus — ${bonus.activationPartner?.name ?? 'Placed partner'}`,
        'mentor bonus',
        '',
        '',
        '',
        bonus.amount,
        bonus.status,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `marketspase-earnings-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private sumEntries(entries: MyCompensation['entries'], status: 'Released' | 'Pending'): number {
    return entries.filter((entry) => entry.status === status).reduce((sum, entry) => sum + entry.amount, 0);
  }
}
