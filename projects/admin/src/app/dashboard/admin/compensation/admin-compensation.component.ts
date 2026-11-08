import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import { CompensationService } from '../../../core/compensation/compensation.service';
import {
  CommissionEntry,
  CommissionRank,
  CompensationPlan,
  MentorBonus,
  ProductCommissionProblem,
  ProductCommissionReconcileResult,
  ProductCommissionReport,
} from '../../../core/compensation/compensation.models';
import { ApiError, userError } from '../../../core/http/api-error';

type Tab = 'entries' | 'bonuses' | 'product';

@Component({
  selector: 'async-admin-compensation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  template: `
    <section class="admin-comp">
      <div class="page-head">
        <div>
          <p class="eyebrow">Admin desk</p>
          <h1>Compensation</h1>
          <p class="muted">Commissions auto-release when an order is fulfilled. This desk handles exceptions, mentor bonuses and commission ranks.</p>
        </div>
        <button mat-stroked-button type="button" (click)="runBonuses()" [disabled]="running()">
          <mat-icon>volunteer_activism</mat-icon>
          {{ running() ? 'Running…' : 'Run due bonuses' }}
        </button>
      </div>

      @if (error(); as err) {
        <div class="alert" role="alert"><mat-icon>error_outline</mat-icon><p>{{ err }}</p><button mat-icon-button type="button" (click)="error.set(null)" aria-label="Dismiss"><mat-icon>close</mat-icon></button></div>
      }

      @if (plan(); as p) {
        <div class="dp-card plan-card">
          <div class="plan-head">
            <div>
              <p class="eyebrow">Growth compensation plan</p>
              <h3>Unilevel on gross margin</h3>
              <p class="muted small">Fixed plan. Rank depth caps which levels each partner earns.</p>
            </div>
            <span class="chip paid">Active</span>
          </div>
          <div class="plan-grid">
            <div class="rates">
              @for (rate of p.rates; track rate.level) {
                <div class="rate"><span>L{{ rate.level }}</span><strong>{{ rate.percent }}%</strong></div>
              }
            </div>
            <div class="depth-list">
              @for (rank of p.ranks; track rank.rank) {
                <span><strong>{{ rank.rank }}</strong> earns L1–{{ rank.depth }}</span>
              }
            </div>
          </div>
          <p class="muted small plan-foot">Mentor bonus ₦{{ p.mentorBonus.amount | number: '1.0-0' }} · paid immediately on activation. Commission depth is assigned manually; journey rank follows the training gates.</p>
        </div>
      }

      <div class="rank-card">
        <div>
          <p class="eyebrow">Commission rank control</p>
          <h2>Set commission rank</h2>
          <p class="muted small">Rank controls how deep the member earns (Partner L1, Builder L1–2, Leader L1–3, Ambassador L1–5). Rank is assigned manually after review.</p>
        </div>
        <div class="rank-form">
          <mat-form-field appearance="outline"><mat-label>Username, email or partner id</mat-label><input matInput [ngModel]="rankIdentifier()" (ngModelChange)="rankIdentifier.set($event)" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Rank</mat-label><mat-select [ngModel]="rankValue()" (ngModelChange)="rankValue.set($event)"><mat-option value="Partner">Partner</mat-option><mat-option value="Builder">Builder</mat-option><mat-option value="Leader">Leader</mat-option><mat-option value="Ambassador">Ambassador</mat-option></mat-select></mat-form-field>
          <button mat-flat-button color="primary" type="button" (click)="setRank()" [disabled]="rankBusy() || rankIdentifier().trim().length < 3">{{ rankBusy() ? 'Saving…' : 'Set rank' }}</button>
        </div>
      </div>

      <div class="tabs">
        <button type="button" [class.active]="tab() === 'entries'" (click)="setTab('entries')"><mat-icon>receipt_long</mat-icon> Commissions</button>
        <button type="button" [class.active]="tab() === 'bonuses'" (click)="setTab('bonuses')"><mat-icon>volunteer_activism</mat-icon> Mentor bonuses</button>
        <button type="button" [class.active]="tab() === 'product'" (click)="setTab('product')"><mat-icon>insights</mat-icon> Product economics</button>
      </div>

      @if (tab() === 'entries') {
        <p class="muted small auto-note">Activation commissions release automatically when the activation order is fulfilled. The Release button is for manual exceptions only.</p>
        <div class="filters">
          @for (filter of entryFilters; track filter.value) {
            <button type="button" [class.active]="entryStatus() === filter.value" (click)="setEntryStatus(filter.value)">{{ filter.label }}</button>
          }
        </div>
        <div class="dp-card">
          @if (entriesLoading()) { <mat-progress-bar mode="indeterminate" aria-label="Loading" /> }
          @if (entries().length === 0 && !entriesLoading()) {
            <div class="empty"><mat-icon>receipt_long</mat-icon><p>No {{ entryStatus() || 'commission' }} entries.</p></div>
          } @else {
            <div class="table-wrap">
              <table>
                <thead><tr><th>Earner</th><th>Source</th><th>Level</th><th>Amount</th><th>Status</th><th>Created</th><th></th></tr></thead>
                <tbody>
                  @for (entry of entries(); track entry.id) {
                    <tr>
                      <td><strong>{{ entry.earner?.name || 'Partner' }}</strong><small>{{ entry.earner?.username }}</small></td>
                      <td>{{ entry.buyer?.name || 'Partner' }}<small>{{ entry.buyer?.username }}</small></td>
                      <td>L{{ entry.level }} · {{ entry.rate * 100 | number: '1.0-1' }}%</td>
                      <td class="money">₦{{ entry.amount | number: '1.0-0' }}</td>
                      <td><span class="chip" [class.paid]="entry.status === 'Released'" [class.pending]="entry.status === 'Pending'" [class.bad]="entry.status === 'Voided' || entry.status === 'Reversed'">{{ entry.status }}</span></td>
                      <td>{{ entry.createdAt | date: 'mediumDate' }}</td>
                      <td class="actions">
                        @if (entry.status === 'Pending') {
                          <button mat-stroked-button type="button" (click)="release(entry)" [disabled]="busyId() === entry.id">Release</button>
                          <button mat-button type="button" class="danger" (click)="startVoid(entry)" [disabled]="busyId() === entry.id">Void</button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        @if (voidTarget(); as target) {
          <div class="dp-card action-panel">
            <div><p class="eyebrow">Void commission</p><h3>{{ target.earner?.name }} · ₦{{ target.amount | number: '1.0-0' }}</h3><p class="muted">Voiding removes a pending entry. Released entries need a reversal.</p></div>
            <mat-form-field appearance="outline"><mat-label>Reason</mat-label><textarea matInput rows="2" [ngModel]="voidReason()" (ngModelChange)="voidReason.set($event)" placeholder="Duplicate accrual, refund, correction…"></textarea></mat-form-field>
            <div class="actions"><button mat-flat-button color="primary" type="button" (click)="submitVoid()" [disabled]="busyId() === target.id || voidReason().trim().length < 3">Void entry</button><button mat-button type="button" (click)="cancelVoid()">Cancel</button></div>
          </div>
        }
      } @else if (tab() === 'bonuses') {
        <div class="filters">
          @for (filter of bonusFilters; track filter.value) {
            <button type="button" [class.active]="bonusStatus() === filter.value" (click)="setBonusStatus(filter.value)">{{ filter.label }}</button>
          }
        </div>
        <div class="dp-card">
          @if (bonusesLoading()) { <mat-progress-bar mode="indeterminate" aria-label="Loading" /> }
          @if (bonuses().length === 0 && !bonusesLoading()) {
            <div class="empty"><mat-icon>volunteer_activism</mat-icon><p>No {{ bonusStatus() || 'mentor bonus' }} records.</p></div>
          } @else {
            <div class="bonus-list">
              @for (bonus of bonuses(); track bonus.id) {
                <article class="bonus-row">
                  <div class="bonus-body"><strong>{{ bonus.activationPartner?.name || 'Partner' }}</strong><p class="muted">Mentor: {{ bonus.mentor?.name || 'Not placed yet' }} · due {{ bonus.dueAt | date: 'medium' }} · expires {{ bonus.expiresAt | date: 'mediumDate' }}</p>@if (bonus.note) { <p class="reason">{{ bonus.note }}</p> }</div>
                  <span class="amount">₦{{ bonus.amount | number: '1.0-0' }}</span>
                  <span class="chip" [class.paid]="bonus.status === 'paid'" [class.pending]="bonus.status === 'scheduled'" [class.bad]="bonus.status === 'forfeited' || bonus.status === 'cancelled' || bonus.status === 'clawed_back'">{{ bonusLabel(bonus) }}</span>
                </article>
              }
            </div>
          }
        </div>
      } @else {
        <div class="report-head">
          <div>
            <p class="eyebrow">Product economics</p>
            <h2>Product commission health</h2>
            <p class="muted small">
              Growth-plan product orders only. Product commissions release automatically on fulfillment. Reconciliation repairs missing accruals; it never releases or voids an entry.
            </p>
          </div>
          <div class="report-actions">
            <mat-form-field appearance="outline" class="date-field">
              <mat-label>From</mat-label>
              <input matInput type="date" [ngModel]="reportFrom()" (ngModelChange)="reportFrom.set($event)" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="date-field">
              <mat-label>To</mat-label>
              <input matInput type="date" [ngModel]="reportTo()" (ngModelChange)="reportTo.set($event)" />
            </mat-form-field>
            <button mat-stroked-button type="button" (click)="loadProductReport()" [disabled]="reportLoading()">
              <mat-icon>refresh</mat-icon> Refresh
            </button>
            <button mat-stroked-button type="button" (click)="downloadCsv()" [disabled]="!report()">
              <mat-icon>download</mat-icon> CSV
            </button>
          </div>
        </div>

        @if (reportLoading()) {
          <mat-progress-bar mode="indeterminate" aria-label="Loading product report" />
        }

        @if (report(); as r) {
          <div class="summary-grid report-summary">
            <div class="stat"><mat-icon>shopping_bag</mat-icon><div><small>Orders</small><strong>{{ r.summary.orders }}</strong><span>₦{{ r.summary.revenue | number:'1.0-0' }} revenue</span></div></div>
            <div class="stat"><mat-icon>trending_up</mat-icon><div><small>Gross margin</small><strong>₦{{ r.summary.grossMargin | number:'1.0-0' }}</strong><span>commissionable ₦{{ r.summary.commissionableMargin | number:'1.0-0' }}</span></div></div>
            <div class="stat"><mat-icon>payments</mat-icon><div><small>Released commission</small><strong>₦{{ r.summary.released | number:'1.0-0' }}</strong><span>{{ r.summary.releasedRate }}% of commissionable</span></div></div>
            <div class="stat"><mat-icon>pending_actions</mat-icon><div><small>Pending commission</small><strong>₦{{ r.summary.pending | number:'1.0-0' }}</strong><span>{{ r.summary.pendingRate }}% of commissionable</span></div></div>
            <div class="stat"><mat-icon>account_balance</mat-icon><div><small>Platform retained</small><strong>₦{{ r.summary.platformRetained | number:'1.0-0' }}</strong><span>gross margin − released commission</span></div></div>
          </div>

          <div class="dp-card report-card">
            <div class="section-head">
              <div><p class="eyebrow">Exceptions</p><h3>Orders needing attention</h3></div>
              <span class="chip" [class.bad]="totalProblems(r) > 0" [class.paid]="totalProblems(r) === 0">{{ totalProblems(r) }} found</span>
            </div>
            <div class="problem-counts">
              <span><strong>{{ r.problemCounts.missing_accrual }}</strong> missing accrual</span>
              <span><strong>{{ r.problemCounts.fulfilled_not_released }}</strong> fulfilled, not released</span>
              <span><strong>{{ r.problemCounts.cancelled_not_voided }}</strong> cancelled, not voided</span>
            </div>

            @if (r.problems.length === 0) {
              <p class="muted report-empty">No discrepancies in this date range.</p>
            } @else {
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Order</th><th>Problem</th><th>Status</th><th>Total</th><th>Margin</th><th>Entries</th></tr></thead>
                  <tbody>
                    @for (problem of r.problems; track problem.cartId) {
                      <tr>
                        <td><strong>{{ problem.orderNumber || problem.cartId }}</strong><small>{{ problem.createdAt | date:'mediumDate' }}</small></td>
                        <td>{{ problemLabel(problem) }}</td>
                        <td>{{ problem.orderStatus }}<small>sale: {{ problem.saleStatus }}</small></td>
                        <td>₦{{ problem.totalCost | number:'1.0-0' }}</td>
                        <td>₦{{ problem.grossMargin | number:'1.0-0' }}</td>
                        <td>{{ problem.entryCount }}<small>{{ problem.pendingCount }} pending</small></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            <div class="reconcile-actions">
              <button mat-stroked-button type="button" (click)="scanReconcile()" [disabled]="reconciling()">
                <mat-icon>manage_search</mat-icon> {{ reconciling() ? 'Scanning…' : 'Scan missing accruals' }}
              </button>
              @if (reconcileResult(); as rr) {
                @if (!rr.dryRun) {
                  <span class="muted">Repaired {{ rr.repaired }} of {{ rr.missing }}; {{ rr.failed }} failed.</span>
                } @else if (rr.missing > 0) {
                  <button mat-flat-button color="primary" type="button" (click)="applyReconcile()" [disabled]="reconciling()">
                    Repair {{ rr.missing }} missing accrual{{ rr.missing === 1 ? '' : 's' }}
                  </button>
                  @if (rr.missingTotal > rr.missing) {
                    <span class="muted">Showing the first {{ rr.missing }} of {{ rr.missingTotal }}; scan again after this repair.</span>
                  }
                } @else {
                  <span class="muted">No missing accruals found.</span>
                }
              }
            </div>
          </div>

          <div class="report-grid">
            <div class="dp-card report-card">
              <div class="section-head"><div><p class="eyebrow">Mix</p><h3>By sale mode</h3></div></div>
              @if (r.bySaleMode.length === 0) {
                <p class="muted report-empty">No product orders in this range.</p>
              } @else {
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>Mode</th><th>Orders</th><th>Revenue</th><th>Margin</th><th>Released</th></tr></thead>
                    <tbody>
                      @for (row of r.bySaleMode; track row.mode) {
                        <tr>
                          <td>{{ modeLabel(row.mode) }}</td>
                          <td>{{ row.orders }}</td>
                          <td>₦{{ row.revenue | number:'1.0-0' }}</td>
                          <td>₦{{ row.grossMargin | number:'1.0-0' }}</td>
                          <td>₦{{ row.released | number:'1.0-0' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>

            <div class="dp-card report-card">
              <div class="section-head"><div><p class="eyebrow">Products</p><h3>By product</h3></div></div>
              @if (r.byProduct.length === 0) {
                <p class="muted report-empty">No product orders in this range.</p>
              } @else {
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>Product</th><th>Units</th><th>Revenue</th><th>Margin</th><th>Released</th></tr></thead>
                    <tbody>
                      @for (row of r.byProduct; track row.productId) {
                        <tr>
                          <td><strong>{{ row.name }}</strong></td>
                          <td>{{ row.units }}</td>
                          <td>₦{{ row.revenue | number:'1.0-0' }}</td>
                          <td>₦{{ row.grossMargin | number:'1.0-0' }}</td>
                          <td>₦{{ row.released | number:'1.0-0' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>

          @if (r.meta.truncated) {
            <p class="muted small">Showing the latest {{ r.meta.orders }} orders in this range. Narrow the dates for a complete view.</p>
          }
        } @else if (!reportLoading()) {
          <div class="dp-card empty">
            <mat-icon>insights</mat-icon>
            <p>No report loaded.</p>
            <button mat-stroked-button type="button" (click)="loadProductReport()">Load report</button>
          </div>
        }
      }
    </section>
  `,

  styles: [`
    .admin-comp { max-width: 1160px; margin: 0 auto; padding: 24px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
    .page-head h1 { margin: 4px 0 6px; font-size: clamp(1.6rem, 3vw, 2.1rem); }
    .page-head p { margin: 0; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .muted { color: var(--ms-text-muted); }
    .small { font-size: 0.8rem; }
    .plan-card { padding: 16px; margin-bottom: 14px; }
    .plan-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .plan-head h3 { margin: 3px 0 4px; }
    .plan-head p { margin: 0; }
    .plan-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: 14px; align-items: center; }
    .rates { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
    .rate { display: flex; flex-direction: column; gap: 2px; background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: 10px; padding: 8px 10px; }
    .rate span { color: var(--ms-text-muted); font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; }
    .rate strong { font-size: 1.05rem; font-variant-numeric: tabular-nums; }
    .depth-list { display: flex; flex-direction: column; gap: 5px; font-size: 0.82rem; color: var(--ms-text-muted); }
    .depth-list strong { color: var(--ms-text); }
    .plan-foot { margin: 12px 0 0; }
    .rank-card { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 16px; align-items: center; background: linear-gradient(120deg, var(--ms-primary-soft), var(--ms-surface)); border: 1px solid var(--ms-primary); border-radius: 14px; padding: 16px; margin-bottom: 14px; }
    .rank-card h2 { margin: 3px 0 5px; }
    .rank-card p { margin: 0; line-height: 1.45; }
    .rank-form { display: grid; grid-template-columns: minmax(0, 1fr) 160px auto; gap: 8px; align-items: center; }
    .rank-form mat-form-field { width: 100%; }
    .tabs { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .tabs button { border: 1px solid var(--ms-line); background: var(--ms-surface); color: var(--ms-text); border-radius: 999px; padding: 8px 13px; display: inline-flex; gap: 6px; align-items: center; font: inherit; cursor: pointer; }
    .tabs button.active { border-color: var(--ms-primary); background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .tabs mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .filters { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
    .auto-note { margin: 0 0 10px; }
    .filters button { border: 1px solid var(--ms-line); background: var(--ms-surface); color: var(--ms-text); border-radius: 999px; padding: 5px 11px; font: inherit; font-size: 0.8rem; cursor: pointer; }
    .filters button.active { border-color: var(--ms-primary); background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .dp-card { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 14px; overflow: hidden; margin-bottom: 14px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 820px; }
    th, td { text-align: left; padding: 12px 13px; border-bottom: 1px solid var(--ms-line); }
    th { color: var(--ms-text-muted); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; }
    tbody tr:last-child td { border-bottom: 0; }
    td small { display: block; color: var(--ms-text-muted); font-size: 0.72rem; }
    .money { font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .chip { border-radius: 999px; padding: 3px 8px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.67rem; font-weight: 800; text-transform: uppercase; white-space: nowrap; }
    .chip.paid { background: var(--ms-success-soft); color: var(--ms-success); }
    .chip.pending { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .chip.bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .actions { display: flex; gap: 4px; justify-content: flex-end; flex-wrap: wrap; }
    .danger { color: var(--ms-error); }
    .empty { display: grid; place-items: center; gap: 6px; padding: 40px 16px; color: var(--ms-text-muted); text-align: center; }
    .empty mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .empty p { margin: 0; }
    .alert { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 12px; background: var(--ms-error-soft); color: var(--ms-error); margin-bottom: 14px; }
    .alert p { margin: 0; flex: 1; }
    .action-panel { padding: 16px; display: grid; gap: 8px; }
    .action-panel h3 { margin: 3px 0 0; }
    .action-panel p { margin: 0; line-height: 1.45; }
    .bonus-list { display: grid; }
    .bonus-row { display: flex; align-items: center; gap: 12px; padding: 13px; border-bottom: 1px solid var(--ms-line); flex-wrap: wrap; }
    .bonus-row:last-child { border-bottom: 0; }
    .bonus-body { flex: 1; min-width: 240px; }
    .bonus-body p { margin: 3px 0 0; line-height: 1.4; }
    .reason { color: var(--ms-warning); font-size: 0.78rem; }
    .amount { font-weight: 800; font-variant-numeric: tabular-nums; }
    .report-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; }
    .report-head h2 { margin: 3px 0 4px; font-size: 1.15rem; }
    .report-head p { margin: 0; line-height: 1.45; }
    .report-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .date-field { width: 150px; }
    .report-summary { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); }
    .report-card { padding: 16px; }
    .report-card .section-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
    .report-card h3 { margin: 2px 0 0; font-size: 1rem; }
    .report-card table { min-width: 560px; }
    .problem-counts { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; color: var(--ms-text-muted); font-size: 0.8rem; }
    .problem-counts strong { color: var(--ms-text); }
    .report-empty { margin: 8px 0; }
    .reconcile-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
    .report-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-bottom: 14px; }
    .report-grid .dp-card { margin-bottom: 0; }
    @media (max-width: 900px) { .report-grid { grid-template-columns: 1fr; } }
    @media (max-width: 900px) { .admin-comp { padding: 16px; } .page-head { flex-direction: column; } .rank-card { grid-template-columns: minmax(0, 1fr); } .rank-form { grid-template-columns: minmax(0, 1fr); } .plan-grid { grid-template-columns: minmax(0, 1fr); } .rates { grid-template-columns: repeat(auto-fit, minmax(64px, 1fr)); } }
  `],
})
export class AdminCompensationComponent implements OnInit {
  private readonly service = inject(CompensationService);
  private readonly snack = inject(MatSnackBar);

  protected readonly tab = signal<Tab>('entries');
  protected readonly plan = signal<CompensationPlan | null>(null);
  protected readonly entryStatus = signal('Pending');
  protected readonly bonusStatus = signal('scheduled');
  protected readonly entries = signal<CommissionEntry[]>([]);
  protected readonly bonuses = signal<MentorBonus[]>([]);
  protected readonly entriesLoading = signal(false);
  protected readonly bonusesLoading = signal(false);
  protected readonly busyId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly voidTarget = signal<CommissionEntry | null>(null);
  protected readonly voidReason = signal('');
  protected readonly rankIdentifier = signal('');
  protected readonly rankValue = signal<CommissionRank>('Builder');
  protected readonly rankBusy = signal(false);
  protected readonly running = signal(false);

  protected readonly report = signal<ProductCommissionReport | null>(null);
  protected readonly reportLoading = signal(false);
  protected readonly reportFrom = signal(this.dateDaysAgo(90));
  protected readonly reportTo = signal(this.dateDaysAgo(0));
  protected readonly reconcileResult = signal<ProductCommissionReconcileResult | null>(null);
  protected readonly reconciling = signal(false);

  protected readonly entryFilters = [
    { label: 'Pending', value: 'Pending' },
    { label: 'Released', value: 'Released' },
    { label: 'Voided', value: 'Voided' },
    { label: 'Reversed', value: 'Reversed' },
    { label: 'All', value: '' },
  ];

  protected readonly bonusFilters = [
    { label: 'Scheduled', value: 'scheduled' },
    { label: 'Paid', value: 'paid' },
    { label: 'Forfeited', value: 'forfeited' },
    { label: 'Cancelled', value: 'cancelled' },
    { label: 'All', value: '' },
  ];

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'product' && !this.report() && !this.reportLoading()) {
      this.loadProductReport();
    }
  }

  ngOnInit(): void {
    this.reload();
  }

  protected setEntryStatus(value: string): void {
    this.entryStatus.set(value);
    this.loadEntries();
  }

  protected setBonusStatus(value: string): void {
    this.bonusStatus.set(value);
    this.loadBonuses();
  }

  protected release(entry: CommissionEntry): void {
    this.busyId.set(entry.id);
    this.error.set(null);
    this.service.release(entry.id).pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: () => {
        this.snack.open('Commission released to wallet', 'Close', { duration: 3000 });
        this.loadEntries();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected startVoid(entry: CommissionEntry): void {
    this.voidTarget.set(entry);
    this.voidReason.set('');
  }

  protected cancelVoid(): void {
    this.voidTarget.set(null);
    this.voidReason.set('');
  }

  protected submitVoid(): void {
    const target = this.voidTarget();
    const reason = this.voidReason().trim();
    if (!target || reason.length < 3) return;
    this.busyId.set(target.id);
    this.service.void(target.id, reason).pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: () => {
        this.snack.open('Commission voided', 'Close', { duration: 3000 });
        this.cancelVoid();
        this.loadEntries();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected runBonuses(): void {
    this.running.set(true);
    this.error.set(null);
    this.service.runBonuses().pipe(finalize(() => this.running.set(false))).subscribe({
      next: (response) => {
        const result = response.data;
        this.snack.open(`Bonuses: ${result.paid} paid, ${result.forfeited} forfeited, ${result.held} held`, 'Close', { duration: 5000 });
        this.loadBonuses();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected setRank(): void {
    const identifier = this.rankIdentifier().trim();
    if (identifier.length < 3) return;
    this.rankBusy.set(true);
    this.error.set(null);
    this.service.setRank(identifier, this.rankValue()).pipe(finalize(() => this.rankBusy.set(false))).subscribe({
      next: (response) => {
        this.snack.open(`${response.data.name} is now ${response.data.commissionRank}`, 'Close', { duration: 4000 });
        this.rankIdentifier.set('');
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

  protected totalProblems(report: ProductCommissionReport): number {
    return report.problemCounts.missing_accrual
      + report.problemCounts.fulfilled_not_released
      + report.problemCounts.cancelled_not_voided;
  }

  protected problemLabel(problem: ProductCommissionProblem): string {
    if (problem.kind === 'missing_accrual') return 'Missing commission accrual';
    if (problem.kind === 'fulfilled_not_released') return 'Fulfilled, commission not released';
    return 'Cancelled, commission not voided';
  }

  protected modeLabel(mode: string): string {
    if (mode === 'resale') return 'Resale';
    if (mode === 'mixed') return 'Mixed';
    return 'Personal';
  }

  private dateDaysAgo(days: number): string {
    return new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
  }

  protected loadProductReport(): void {
    this.reportLoading.set(true);
    this.error.set(null);
    this.service.productReport({
      from: this.reportFrom(),
      to: this.reportTo(),
    }).pipe(finalize(() => this.reportLoading.set(false))).subscribe({
      next: (response) => this.report.set(response.data),
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected scanReconcile(): void {
    this.reconciling.set(true);
    this.reconcileResult.set(null);
    this.error.set(null);
    this.service.reconcileProductCommissions({
      from: this.reportFrom(),
      to: this.reportTo(),
      apply: false,
    }).pipe(finalize(() => this.reconciling.set(false))).subscribe({
      next: (response) => {
        this.reconcileResult.set(response.data);
        this.snack.open(
          response.data.missing > 0
            ? `${response.data.missing} missing accrual${response.data.missing === 1 ? '' : 's'} found`
            : 'No missing accruals found',
          'Close',
          { duration: 4000 },
        );
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected applyReconcile(): void {
    this.reconciling.set(true);
    this.error.set(null);
    this.service.reconcileProductCommissions({
      from: this.reportFrom(),
      to: this.reportTo(),
      apply: true,
    }).pipe(finalize(() => this.reconciling.set(false))).subscribe({
      next: (response) => {
        this.reconcileResult.set(response.data);
        this.snack.open(
          `Repaired ${response.data.repaired} of ${response.data.missing} missing accruals`,
          'Close',
          { duration: 5000 },
        );
        this.loadProductReport();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected downloadCsv(): void {
    const report = this.report();
    if (!report) return;
    const rows = [
      ['Product', 'Units', 'Revenue', 'Gross margin', 'Commissionable margin', 'Released commission', 'Pending commission'],
      ...report.byProduct.map((row) => [
        row.name,
        row.units,
        row.revenue,
        row.grossMargin,
        row.commissionableMargin,
        row.released,
        row.pending,
      ]),
      [],
      ['Orders', report.summary.orders],
      ['Revenue', report.summary.revenue],
      ['Gross margin', report.summary.grossMargin],
      ['Commissionable margin', report.summary.commissionableMargin],
      ['Released commission', report.summary.released],
      ['Pending commission', report.summary.pending],
      ['Platform retained', report.summary.platformRetained],
    ];
    const csv = rows.map((row) => row.map((value) => this.csvCell(value)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `product-commissions-${this.reportFrom()}-to-${this.reportTo()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  private csvCell(value: unknown): string {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  private reload(): void {
    this.loadPlan();
    this.loadEntries();
    this.loadBonuses();
  }

  private loadPlan(): void {
    this.service.plan().subscribe({
      next: (response) => this.plan.set(response.data ?? null),
      error: () => this.plan.set(null),
    });
  }

  private loadEntries(): void {
    this.entriesLoading.set(true);
    this.service.adminEntries({ status: this.entryStatus() || undefined }).pipe(
      finalize(() => this.entriesLoading.set(false)),
    ).subscribe({
      next: (response) => this.entries.set(response.data),
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  private loadBonuses(): void {
    this.bonusesLoading.set(true);
    this.service.adminBonuses({ status: this.bonusStatus() || undefined }).pipe(
      finalize(() => this.bonusesLoading.set(false)),
    ).subscribe({
      next: (response) => this.bonuses.set(response.data),
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }
}
