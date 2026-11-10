import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
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
import { Journey } from '../../core/progression/progression.models';
import {
  MentorBonus,
  MyCompensation,
} from '../../core/compensation/compensation.models';
import { ApiError, userError } from '../../core/http/api-error';
import { formatMoney } from '../../core/format/money';

@Component({
  selector: 'async-compensation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, MatButtonModule, MatIconModule, PageSkeletonComponent, RouterModule],
  template: `
    <section class="comp-page">
      <div class="page-head">
        <div>
          <p class="eyebrow">Compensation</p>
          <h1>Your partner rank and commission ledger</h1>
          <p class="muted">Commissions accrue on product gross margin after your placement is confirmed. Pending entries are released by the finance desk.</p>
        </div>
        <a mat-stroked-button routerLink="/dashboard/wallet">Wallet</a>
      </div>

      @if (loading()) {
        <async-page-skeleton layout="wallet" [rows]="3" label="your compensation" [showHeader]="false" />
      } @else {
        @if (error(); as err) {
          <div class="alert" role="alert"><mat-icon>error_outline</mat-icon><p>{{ err }}</p></div>
        }
        @if (data(); as me) {
          <div class="hero">
            <div class="rank-mark"><mat-icon>workspace_premium</mat-icon></div>
            <div class="hero-copy">
              <p class="eyebrow">Commission rank</p>
              <h2>{{ me.partner.commissionRank }}</h2>
              <p class="muted">Earns through Level {{ me.partner.depth }}. @if (!me.partner.placed) { Your placement is pending, so new commissions wait for a campaign owner. }</p>
              @if (me.partner.commissionRankSource === 'admin') {
                <p class="rank-source rank-source--admin">
                  <mat-icon>lock_person</mat-icon>
                  Manual override
                  @if (me.partner.commissionRankOverrideUntil) { · until {{ me.partner.commissionRankOverrideUntil | date: 'mediumDate' }} }
                  @if (me.partner.commissionRankReason) { · {{ me.partner.commissionRankReason }} }
                </p>
              } @else {
                <p class="rank-source"><mat-icon>auto_awesome</mat-icon> Auto-synced from your journey rank</p>
              }
              @if (journey(); as j) {
                <p class="rank-source"><mat-icon>route</mat-icon> Journey rank: <strong>{{ j.levelLabel }}</strong> · {{ j.percent }}% to {{ j.nextLabel || 'top rank' }}</p>
              }
            </div>
            <div class="hero-stats">
              <span><small>Wallet</small><strong>₦{{ me.partner.balance | number: '1.0-0' }}</strong></span>
              <span><small>Pending</small><strong>₦{{ me.summary.pending | number: '1.0-0' }}</strong></span>
              <span><small>Released</small><strong>₦{{ me.summary.released | number: '1.0-0' }}</strong></span>
            </div>
          </div>

          @if (journey(); as j) {
            @if (me.partner.commissionRankSource !== 'admin' && j.levelLabel !== me.partner.commissionRank) {
              <div class="alert info" role="status">
                <mat-icon>sync_problem</mat-icon>
                <p>Your journey rank is <strong>{{ j.levelLabel }}</strong> but your commission rank is <strong>{{ me.partner.commissionRank }}</strong>. This should sync automatically; if it persists, contact support.</p>
              </div>
            }
          }

          <div class="summary-grid">
            <div class="panel stat"><mat-icon>hourglass_top</mat-icon><div><small>Pending commission</small><strong>₦{{ me.summary.pending | number: '1.0-0' }}</strong><span>{{ me.summary.pendingCount }} entr{{ me.summary.pendingCount === 1 ? 'y' : 'ies' }}</span></div></div>
            <div class="panel stat"><mat-icon>account_balance_wallet</mat-icon><div><small>Released to wallet</small><strong>₦{{ me.summary.released | number: '1.0-0' }}</strong><span>{{ me.summary.releasedCount }} entr{{ me.summary.releasedCount === 1 ? 'y' : 'ies' }}</span></div></div>
            <div class="panel stat"><mat-icon>volunteer_activism</mat-icon><div><small>Mentor bonus earned</small><strong>₦{{ me.summary.mentorPaid | number: '1.0-0' }}</strong><span>Paid immediately</span></div></div>
          </div>

          <div class="content-grid">
            <div class="panel">
              <div class="panel-head"><div><p class="eyebrow">Plan</p><h2>Levels and rank depth</h2></div><span class="pill">{{ me.plan.mentorBonus.amount | number: '1.0-0' }} mentor bonus</span></div>
              <div class="rate-grid">
                @for (rate of me.plan.rates; track rate.level) {
                  <div class="rate" [class.earned]="rate.level <= me.partner.depth"><span>Level {{ rate.level }}</span><strong>{{ rate.percent }}%</strong></div>
                }
              </div>
              <p class="muted small">Commission is calculated on product gross margin, never on the full product price and never on campaign spend.</p>
              <div class="rank-list">
                @for (rank of me.plan.ranks; track rank.rank) {
                  <div [class.current]="rank.rank === me.partner.commissionRank"><span>{{ rank.rank }}</span><strong>Levels 1–{{ rank.depth }}</strong></div>
                }
              </div>
            </div>

            <div class="panel">
              <div class="panel-head"><div><p class="eyebrow">Mentor bonus</p><h2>Activation bonus</h2></div><span class="pill">₦{{ me.plan.mentorBonus.amount | number: '1.0-0' }}</span></div>
              @if (me.mentorBonuses.length === 0) {
                <div class="empty"><mat-icon>volunteer_activism</mat-icon><p>No mentor bonus yet. Bonuses are paid to the referral mentor immediately when a referred partner activates.</p></div>
              } @else {
                <div class="bonus-list">
                  @for (bonus of me.mentorBonuses; track bonus.id) {
                    <article class="bonus-row">
                      <div><strong>{{ bonus.activationPartner?.name || 'Placed partner' }}</strong><p class="muted">Due {{ bonus.dueAt | date: 'mediumDate' }} · {{ bonus.activationPartner?.username }}</p></div>
                      <span class="amount">₦{{ bonus.amount | number: '1.0-0' }}</span>
                      <span class="chip" [class.paid]="bonus.status === 'paid'" [class.pending]="bonus.status === 'scheduled'" [class.bad]="bonus.status === 'forfeited' || bonus.status === 'cancelled'">{{ bonusLabel(bonus) }}</span>
                    </article>
                  }
                </div>
              }
            </div>
          </div>

          <div class="panel ledger">
            <div class="panel-head"><div><p class="eyebrow">Ledger</p><h2>Commission entries</h2></div><span class="pill">{{ me.entries.length }}</span></div>
            @if (me.entries.length === 0) {
              <div class="empty"><mat-icon>receipt_long</mat-icon><p>No commissions yet. Product sales and activations in your team create entries here.</p></div>
            } @else {
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Source</th><th>Level</th><th>Gross margin</th><th>Commission</th><th>Status</th></tr></thead>
                  <tbody>
                    @for (entry of me.entries; track entry.id) {
                      <tr>
                        <td>{{ entry.createdAt | date: 'mediumDate' }}</td>
                        <td>
                          <strong>{{ entry.buyer?.name || 'Partner' }}</strong>
                          <small>{{ entry.buyer?.username }}</small>
                          <small class="sale-type">{{ entry.saleType === 'product' ? 'Product order' : 'Activation' }}</small>
                        </td>
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
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .comp-page { max-width: 1180px; margin: 0 auto; padding: 24px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 18px; }
    .page-head h1 { margin: 4px 0 6px; font-size: clamp(1.6rem, 3vw, 2.2rem); line-height: 1.12; }
    .page-head p { margin: 0; line-height: 1.5; max-width: 720px; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
    .muted { color: var(--ms-text-muted); }
    .small { font-size: 0.8rem; }
    .panel { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 16px; padding: 18px; box-shadow: 0 16px 40px rgba(15, 13, 28, 0.05); }
    .loading { display: grid; gap: 12px; place-items: center; padding: 46px; }
    .hero { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 22px; border-radius: 18px; color: #fff; background: linear-gradient(135deg, #14122b, #2b2760 58%, #4f46e5); margin-bottom: 16px; }
    .hero h2 { margin: 3px 0 4px; font-size: 1.9rem; }
    .hero .eyebrow { color: #c7d2fe; }
    .hero .muted { color: rgba(255,255,255,0.72); margin: 0; }
    .rank-mark { width: 58px; height: 58px; flex: 0 0 58px; border-radius: 16px; display: grid; place-items: center; background: rgba(255,255,255,0.14); }
    .rank-mark mat-icon { font-size: 34px; width: 34px; height: 34px; }
    .hero-copy { flex: 1; min-width: 220px; }
    .rank-source { display: flex; align-items: center; gap: 5px; margin: 4px 0 0; color: rgba(255,255,255,0.78); font-size: 0.78rem; line-height: 1.4; }
    .rank-source mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .rank-source--admin { color: #fde68a; }
    .hero-stats { display: flex; gap: 22px; flex-wrap: wrap; }
    .hero-stats span { display: grid; gap: 2px; }
    .hero-stats small { color: rgba(255,255,255,0.65); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; }
    .hero-stats strong { font-size: 1.02rem; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
    .stat { display: flex; gap: 10px; align-items: center; }
    .stat mat-icon { color: var(--ms-primary-strong); }
    .stat div { display: grid; gap: 1px; }
    .stat small { color: var(--ms-text-muted); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .stat strong { font-size: 1.15rem; font-variant-numeric: tabular-nums; }
    .stat span { color: var(--ms-text-muted); font-size: 0.75rem; }
    .content-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr); gap: 16px; align-items: start; margin-bottom: 16px; }
    .panel-head { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; margin-bottom: 12px; }
    .panel-head h2 { margin: 3px 0 0; font-size: 1.12rem; }
    .pill { background: var(--ms-primary-soft); color: var(--ms-primary-strong); border-radius: 999px; padding: 4px 9px; font-size: 0.72rem; font-weight: 800; white-space: nowrap; }
    .rate-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; margin-bottom: 10px; }
    .rate { padding: 10px 7px; border-radius: 9px; background: var(--ms-surface); border: 1px dashed var(--ms-line); display: grid; gap: 2px; text-align: center; }
    .rate.earned { border: 1px solid var(--ms-primary); background: var(--ms-primary-soft); }
    .rate span { font-size: 0.65rem; color: var(--ms-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .rate strong { font-size: 1rem; }
    .rank-list { display: grid; gap: 5px; margin-top: 12px; }
    .rank-list div { display: flex; justify-content: space-between; padding: 7px 9px; border-radius: 8px; background: var(--ms-canvas); font-size: 0.82rem; }
    .rank-list .current { background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 800; }
    .bonus-list { display: grid; gap: 8px; }
    .bonus-row { display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--ms-line); border-radius: 10px; flex-wrap: wrap; }
    .bonus-row > div { flex: 1; min-width: 160px; }
    .bonus-row p { margin: 2px 0 0; font-size: 0.78rem; }
    .amount { font-weight: 800; font-variant-numeric: tabular-nums; }
    .chip { border-radius: 999px; padding: 3px 8px; font-size: 0.67rem; font-weight: 800; text-transform: uppercase; background: var(--ms-canvas); color: var(--ms-text-muted); }
    .chip.paid { background: var(--ms-success-soft); color: var(--ms-success); }
    .chip.pending { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .chip.bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .ledger { margin-bottom: 16px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 720px; }
    th, td { text-align: left; padding: 11px 10px; border-bottom: 1px solid var(--ms-line); }
    th { color: var(--ms-text-muted); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; }
    tbody tr:last-child td { border-bottom: 0; }
    td small { display: block; color: var(--ms-text-muted); font-size: 0.72rem; }
    td small.sale-type { color: var(--ms-primary-strong); font-weight: 700; font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .money { font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .empty { display: grid; place-items: center; gap: 6px; padding: 32px 14px; text-align: center; color: var(--ms-text-muted); }
    .empty mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .empty p { margin: 0; line-height: 1.5; }
    .alert { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 12px; background: var(--ms-error-soft); color: var(--ms-error); margin-bottom: 14px; }
    .alert p { margin: 0; flex: 1; }
    .alert.info { background: var(--ms-info-soft); color: var(--ms-info); }
    @media (max-width: 900px) { .comp-page { padding: 16px; } .page-head { flex-direction: column; } .content-grid, .summary-grid { grid-template-columns: minmax(0, 1fr); } }
    @media (max-width: 560px) { .rate-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  `],
})
export class CompensationComponent implements OnInit {
  private readonly service = inject(CompensationService);
  private readonly progression = inject(ProgressionService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<MyCompensation | null>(null);
  protected readonly journey = signal<Journey | null>(null);

  ngOnInit(): void {
    forkJoin({
      compensation: this.service.me(),
      journey: this.progression.mine().pipe(catchError(() => of(null))),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: ({ compensation, journey }) => {
        this.data.set(compensation.data);
        this.journey.set(journey?.data ?? null);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
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
}
