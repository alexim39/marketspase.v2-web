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
import { CampaignsService } from '../../../core/campaigns/campaigns.service';
import {
  AdminAllocationRow,
  AdminGrowthCampaign,
  CampaignAttributionRow,
  CampaignQueueRow,
} from '../../../core/campaigns/campaigns.models';
import { ApiError, userError } from '../../../core/http/api-error';

@Component({
  selector: 'async-admin-growth',
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
    <section class="admin-growth">
      <div class="page-head">
        <div>
          <p class="eyebrow">Admin desk</p>
          <h1>Growth campaigns</h1>
          <p class="muted">Monitor live campaigns, run fair partner allocation and close out spend. New campaigns activate automatically; Pending is reserved for legacy review.</p>
        </div>
        <div class="head-actions">
          <button mat-stroked-button type="button" (click)="runAll()" [disabled]="allocating() || loading()">
            <mat-icon>hub</mat-icon>
            {{ allocating() ? 'Allocating…' : 'Run allocation' }}
          </button>
          <button mat-stroked-button type="button" (click)="reload()" [disabled]="loading()">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
        </div>
      </div>

      @if (error(); as err) {
        <div class="alert" role="alert"><mat-icon>error_outline</mat-icon><p>{{ err }}</p><button mat-icon-button type="button" (click)="error.set(null)" aria-label="Dismiss"><mat-icon>close</mat-icon></button></div>
      }

      <div class="filters">
        @for (filter of filters; track filter.value) {
          <button type="button" [class.active]="status() === filter.value" (click)="setStatus(filter.value)">{{ filter.label }}</button>
        }
      </div>

      <div class="layout">
        <div class="panel">
          <div class="panel-head">
            <div><p class="eyebrow">Campaigns</p><h2>Live campaigns and close-out queue</h2></div>
            <span class="count">{{ campaigns().length }}</span>
          </div>
          @if (loading()) { <mat-progress-bar mode="indeterminate" aria-label="Loading" /> }
          @if (campaigns().length === 0 && !loading()) {
            <div class="empty"><mat-icon>campaign</mat-icon><p>No {{ status() || 'funded' }} campaigns.</p></div>
          } @else {
            <div class="campaign-list">
              @for (campaign of campaigns(); track campaign.id) {
                <article class="campaign-card">
                  <div class="card-top">
                    <div>
                      <strong>{{ campaign.name }}</strong>
                      <p class="muted">{{ campaign.owner?.name }} · {{ campaign.owner?.email }}</p>
                    </div>
                    <span class="chip" [class.active]="campaign.status === 'Active'" [class.pending]="campaign.status === 'Pending'" [class.paused]="campaign.status === 'Paused'" [class.ended]="campaign.status === 'Ended'">{{ campaign.status }}</span>
                  </div>
                  <div class="stats">
                    <span><small>Budget</small><strong>₦{{ campaign.budget.total | number: '1.0-0' }}</strong></span>
                    <span><small>Remaining</small><strong>₦{{ campaign.budget.remaining | number: '1.0-0' }}</strong></span>
                    <span><small>Partners</small><strong>{{ campaign.capacity.allocated }}/{{ campaign.capacity.total }}</strong></span>
                    <span><small>Week cap</small><strong>{{ campaign.capacity.maxPerWeek }}</strong></span>
                  </div>
                  <p class="muted small">
                    {{ campaign.flight.startAt | date: 'mediumDate' }}
                    @if (campaign.flight.endAt) { – {{ campaign.flight.endAt | date: 'mediumDate' }} } @else { · continuous }
                    · States: {{ campaign.targetAudience.states.length ? campaign.targetAudience.states.join(', ') : 'All' }}
                  </p>
                  <div class="actions">
                    @if (campaign.status === 'Pending') {
                      <button mat-flat-button color="primary" type="button" (click)="activate(campaign)" [disabled]="busyId() === campaign.id">Activate</button>
                      <button mat-button type="button" class="danger" (click)="startReject(campaign)" [disabled]="busyId() === campaign.id">Reject & refund</button>
                    }
                    @if (campaign.status === 'Active') {
                      <button mat-button type="button" (click)="pause(campaign)" [disabled]="busyId() === campaign.id">Pause</button>
                      <button mat-button type="button" (click)="runOne(campaign)" [disabled]="allocating() || busyId() === campaign.id">Allocate</button>
                    }
                    @if (campaign.status === 'Paused') {
                      <button mat-button type="button" (click)="resume(campaign)" [disabled]="busyId() === campaign.id">Resume</button>
                    }
                    @if (campaign.status === 'Active' || campaign.status === 'Paused') {
                      <button mat-button type="button" (click)="startEnd(campaign)" [disabled]="busyId() === campaign.id">End</button>
                    }
                  </div>
                </article>
              }
            </div>
          }
        </div>

        <div class="panel">
          <div class="panel-head">
            <div><p class="eyebrow">Fair allocation</p><h2>Activation queue</h2></div>
            <span class="count">{{ queue().length }}</span>
          </div>
          @if (queueLoading()) { <mat-progress-bar mode="indeterminate" aria-label="Loading" /> }
          @if (queue().length === 0 && !queueLoading()) {
            <div class="empty"><mat-icon>task_alt</mat-icon><p>The activation queue is empty.</p></div>
          } @else {
            <div class="queue-list">
              @for (row of queue(); track row.queueEntryId) {
                <article class="queue-row">
                  <div class="position">#{{ row.position }}</div>
                  <div class="queue-body">
                    <strong>{{ row.partner?.name || 'Missing partner' }}</strong>
                    <p class="muted small">{{ row.partner?.state || 'State unknown' }} · waiting {{ row.waitDays }} days · KYC {{ row.partner?.kycStatus }}</p>
                    @if (!row.eligible) { <p class="reason">{{ row.reasons.join(' · ') }}</p> }
                  </div>
                  <span class="eligibility" [class.ok]="row.eligible">{{ row.eligible ? 'Eligible' : 'Blocked' }}</span>
                </article>
              }
            </div>
          }
        </div>
      </div>

      <div class="panel allocation-panel">
        <div class="panel-head">
          <div><p class="eyebrow">Placement controls</p><h2>Manual allocation and reversal</h2></div>
          <span class="count">{{ allocations().length }} active</span>
        </div>
        <p class="muted small">Manual placement bypasses the fairness score but still obeys campaign capacity, budget, weekly caps and partner eligibility. Every override and reversal is audited.</p>
        <div class="placement-form">
          <mat-form-field appearance="outline">
            <mat-label>Active campaign</mat-label>
            <mat-select [ngModel]="overrideCampaignId()" (ngModelChange)="overrideCampaignId.set($event)">
              @for (campaign of activeCampaigns(); track campaign.id) {
                <mat-option [value]="campaign.id">{{ campaign.name }} · {{ campaign.owner?.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Eligible queued partner</mat-label>
            <mat-select [ngModel]="overridePartnerId()" (ngModelChange)="overridePartnerId.set($event)">
              @for (row of eligibleQueue(); track row.queueEntryId) {
                <mat-option [value]="row.partner?.id">{{ row.partner?.name }} · {{ row.partner?.state || 'State unknown' }} · {{ row.waitDays }}d</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="reason-field">
            <mat-label>Override reason</mat-label>
            <input matInput [ngModel]="overrideReason()" (ngModelChange)="overrideReason.set($event)" maxlength="500" placeholder="Phone placement correction, verified by ops" />
          </mat-form-field>
          <button mat-flat-button color="primary" type="button" (click)="overridePlacement()" [disabled]="!overrideCampaignId() || !overridePartnerId() || overrideReason().trim().length < 3">
            Place manually
          </button>
        </div>

        @if (allocationsLoading()) { <mat-progress-bar mode="indeterminate" aria-label="Loading allocations" /> }
        @if (allocations().length === 0 && !allocationsLoading()) {
          <div class="empty"><mat-icon>hub</mat-icon><p>No active placements.</p></div>
        } @else {
          <div class="allocation-list">
            @for (row of allocations(); track row.id) {
              <article class="allocation-row">
                <div class="allocation-main">
                  <strong>{{ row.partner?.name || 'Partner' }}</strong>
                  <span class="muted small">{{ row.partner?.email }} · placed {{ row.allocatedAt | date: 'mediumDate' }}</span>
                  <span class="muted small">Campaign: {{ row.campaign?.name || '—' }} · Owner: {{ row.owner?.name || '—' }}</span>
                </div>
                <span class="muted small">Score {{ row.score?.total ?? 0 }}</span>
                <button mat-stroked-button color="warn" type="button" (click)="reversePlacement(row)" [disabled]="reversingId() === row.id">
                  {{ reversingId() === row.id ? 'Reversing…' : 'Reverse' }}
                </button>
              </article>
            }
          </div>
        }
      </div>

      @if (reverseTarget(); as target) {
        <div class="panel action-panel">
          <div>
            <p class="eyebrow">Reverse placement</p>
            <h3>{{ target.partner?.name || 'Partner' }} · {{ target.campaign?.name || 'Campaign' }}</h3>
            <p class="muted">The partner returns to the queue and the campaign slot/cost is released. This is audited.</p>
          </div>
          <mat-form-field appearance="outline"><mat-label>Reason</mat-label><textarea matInput rows="2" [ngModel]="reverseReason()" (ngModelChange)="reverseReason.set($event)" maxlength="500" placeholder="Wrong owner, duplicate allocation, data correction…"></textarea></mat-form-field>
          <div class="actions">
            <button mat-flat-button color="warn" type="button" (click)="submitReverse()" [disabled]="reversingId() === target.id || reverseReason().trim().length < 3">
              {{ reversingId() === target.id ? 'Reversing…' : 'Reverse allocation' }}
            </button>
            <button mat-button type="button" (click)="cancelReverse()" [disabled]="reversingId() === target.id">Cancel</button>
          </div>
        </div>
      }

      <div class="panel attribution-panel">
        <div class="panel-head">
          <div><p class="eyebrow">Attribution</p><h2>Signups by campaign link</h2></div>
          <span class="count">{{ attribution().length }}</span>
        </div>
        @if (attributionLoading()) { <mat-progress-bar mode="indeterminate" aria-label="Loading" /> }
        @if (attribution().length === 0 && !attributionLoading()) {
          <div class="empty"><mat-icon>insights</mat-icon><p>No attributed signups yet. Share a campaign tracking link (<code>/join?campaign=…</code>) to start measuring.</p></div>
        } @else {
          <div class="attribution-list">
            @for (row of attribution(); track row.campaignCode) {
              <article class="attribution-row">
                <div class="attribution-main">
                  <strong>{{ row.campaign?.name || 'Untracked campaign' }}</strong>
                  <span class="muted small">{{ row.campaignCode }}@if (row.campaign) { · {{ row.campaign.status }} }</span>
                </div>
                <div class="attribution-stats">
                  <span><small>Signups</small><strong>{{ row.signups }}</strong></span>
                  <span><small>Activated</small><strong>{{ row.activated }}</strong></span>
                  <span><small>KYC</small><strong>{{ row.kycVerified }}</strong></span>
                  <span><small>Rate</small><strong>{{ row.activationRate }}%</strong></span>
                </div>
                <span class="muted small">{{ row.lastSignupAt | date: 'mediumDate' }}</span>
              </article>
            }
          </div>
        }
      </div>

      @if (rejectTarget(); as target) {
        <div class="panel action-panel">
          <div><p class="eyebrow">Reject campaign</p><h3>{{ target.name }}</h3><p class="muted">The full remaining budget is returned to {{ target.owner?.name }} and the campaign closes.</p></div>
          <mat-form-field appearance="outline"><mat-label>Reason</mat-label><textarea matInput rows="2" [ngModel]="rejectReason()" (ngModelChange)="rejectReason.set($event)" placeholder="Budget below pilot minimum, brief incomplete…"></textarea></mat-form-field>
          <div class="actions"><button mat-flat-button color="primary" type="button" (click)="submitReject()" [disabled]="busyId() === target.id || rejectReason().trim().length < 3">Reject & refund</button><button mat-button type="button" (click)="cancelPanels()">Cancel</button></div>
        </div>
      }

      @if (endTarget(); as target) {
        <div class="panel action-panel">
          <div><p class="eyebrow">Close campaign</p><h3>{{ target.name }}</h3><p class="muted">Report actual ad spend. The remaining budget is credited back to {{ target.owner?.name }}.</p></div>
          <div class="end-fields">
            <mat-form-field appearance="outline"><mat-label>Recorded spend (₦)</mat-label><input matInput type="number" [ngModel]="spentAmount()" (ngModelChange)="spentAmount.set($event)" [min]="0" [max]="target.budget.total - target.budget.refunded" /></mat-form-field>
            <mat-form-field appearance="outline" class="note"><mat-label>Close-out note</mat-label><input matInput [ngModel]="endNote()" (ngModelChange)="endNote.set($event)" placeholder="Meta ads 1-14 Nov, reach 12.4k" /></mat-form-field>
          </div>
          <p class="muted small">Refund preview: ₦{{ refundPreview(target) | number: '1.0-0' }}</p>
          <div class="actions"><button mat-flat-button color="primary" type="button" (click)="submitEnd()" [disabled]="busyId() === target.id">End campaign</button><button mat-button type="button" (click)="cancelPanels()">Cancel</button></div>
        </div>
      }
    </section>
  `,
  styles: [`
    .admin-growth { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
    .page-head h1 { margin: 4px 0 6px; font-size: clamp(1.6rem, 3vw, 2.1rem); }
    .page-head p { margin: 0; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .muted { color: var(--ms-text-muted); }
    .small { font-size: 0.78rem; }
    .head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .filters { display: flex; gap: 7px; flex-wrap: wrap; margin-bottom: 14px; }
    .filters button { border: 1px solid var(--ms-line); background: var(--ms-surface); color: var(--ms-text); border-radius: 999px; padding: 6px 12px; font: inherit; font-size: 0.82rem; cursor: pointer; }
    .filters button.active { border-color: var(--ms-primary); background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .layout { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: 16px; align-items: start; }
    .panel { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 14px; padding: 18px; margin-bottom: 14px; }
    .panel-head { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; margin-bottom: 12px; }
    .panel-head h2 { margin: 4px 0 0; font-size: 1.12rem; }
    .count { border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); padding: 4px 9px; font-size: 0.74rem; font-weight: 800; }
    .campaign-list, .queue-list { display: grid; gap: 10px; }
    .campaign-card { border: 1px solid var(--ms-line); border-radius: 11px; padding: 12px; }
    .card-top { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
    .card-top p { margin: 3px 0 0; line-height: 1.4; }
    .chip { border-radius: 999px; padding: 4px 9px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.67rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
    .chip.active { background: var(--ms-success-soft); color: var(--ms-success); }
    .chip.pending { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .chip.paused { background: var(--ms-info-soft); color: var(--ms-info); }
    .chip.ended { background: var(--ms-error-soft); color: var(--ms-error); }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin: 10px 0 6px; }
    .stats span { display: grid; gap: 1px; padding: 7px; border-radius: 8px; background: var(--ms-canvas); }
    .stats small { color: var(--ms-text-muted); font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .stats strong { font-size: 0.82rem; font-variant-numeric: tabular-nums; }
    .actions { display: flex; gap: 4px; justify-content: flex-end; flex-wrap: wrap; margin-top: 8px; }
    .danger { color: var(--ms-error); }
    .queue-row { display: flex; gap: 10px; align-items: center; padding: 10px; border: 1px solid var(--ms-line); border-radius: 10px; }
    .attribution-panel { margin-top: 4px; }
    .allocation-panel { margin-top: 14px; }
    .placement-form { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr) auto; gap: 10px; align-items: center; margin: 10px 0 14px; }
    .placement-form mat-form-field { width: 100%; }
    .placement-form button { min-height: 44px; white-space: nowrap; }
    .allocation-list { display: flex; flex-direction: column; }
    .allocation-row { display: flex; gap: 12px; align-items: center; padding: 10px 2px; border-top: 1px solid var(--ms-line); flex-wrap: wrap; }
    .allocation-row:first-child { border-top: none; }
    .allocation-main { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 2px; }
    .allocation-row button { min-height: 38px; }
    @media (max-width: 900px) { .placement-form { grid-template-columns: 1fr; } }
    .attribution-list { display: flex; flex-direction: column; }
    .attribution-row { display: flex; gap: 12px; align-items: center; padding: 10px 2px; border-top: 1px solid var(--ms-line); flex-wrap: wrap; }
    .attribution-row:first-child { border-top: none; }
    .attribution-main { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 2px; }
    .attribution-stats { display: flex; gap: 14px; flex-wrap: wrap; }
    .attribution-stats span { display: flex; flex-direction: column; gap: 1px; }
    .attribution-stats small { color: var(--ms-text-muted); font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .attribution-stats strong { font-size: 0.88rem; font-variant-numeric: tabular-nums; }
    .position { width: 36px; height: 36px; flex: 0 0 36px; border-radius: 9px; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 800; font-size: 0.82rem; }
    .queue-body { flex: 1; min-width: 0; }
    .queue-body p { margin: 2px 0 0; line-height: 1.35; }
    .reason { color: var(--ms-warning); font-size: 0.75rem; }
    .eligibility { font-size: 0.7rem; font-weight: 800; border-radius: 999px; padding: 4px 8px; background: var(--ms-error-soft); color: var(--ms-error); white-space: nowrap; }
    .eligibility.ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .empty { display: grid; place-items: center; gap: 6px; padding: 34px 16px; color: var(--ms-text-muted); text-align: center; }
    .empty mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .empty p { margin: 0; }
    .alert { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 12px; background: var(--ms-error-soft); color: var(--ms-error); margin-bottom: 14px; }
    .alert p { margin: 0; flex: 1; }
    .action-panel { display: grid; gap: 10px; }
    .action-panel h3 { margin: 3px 0 5px; }
    .action-panel p { margin: 0; line-height: 1.45; }
    .end-fields { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 10px; }
    @media (max-width: 900px) { .admin-growth { padding: 16px; } .page-head { flex-direction: column; } .layout { grid-template-columns: minmax(0, 1fr); } }
    @media (max-width: 560px) { .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } .end-fields { grid-template-columns: minmax(0, 1fr); } }
  `],
})
export class AdminGrowthComponent implements OnInit {
  private readonly campaignsService = inject(CampaignsService);
  private readonly snack = inject(MatSnackBar);

  protected readonly filters = [
    { label: 'Pending', value: 'Pending' },
    { label: 'Active', value: 'Active' },
    { label: 'Paused', value: 'Paused' },
    { label: 'Ended', value: 'Ended' },
    { label: 'Cancelled', value: 'Cancelled' },
    { label: 'All', value: '' },
  ];

  protected readonly status = signal('Active');
  protected readonly campaigns = signal<AdminGrowthCampaign[]>([]);
  protected readonly activeCampaignList = signal<AdminGrowthCampaign[]>([]);
  protected readonly queue = signal<CampaignQueueRow[]>([]);
  protected readonly attribution = signal<CampaignAttributionRow[]>([]);
  protected readonly allocations = signal<AdminAllocationRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly queueLoading = signal(false);
  protected readonly attributionLoading = signal(false);
  protected readonly allocationsLoading = signal(false);
  protected readonly allocating = signal(false);
  protected readonly busyId = signal<string | null>(null);
  protected readonly reversingId = signal<string | null>(null);
  protected readonly reverseTarget = signal<AdminAllocationRow | null>(null);
  protected readonly reverseReason = signal('');
  protected readonly overrideCampaignId = signal('');
  protected readonly overridePartnerId = signal('');
  protected readonly overrideReason = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly rejectTarget = signal<AdminGrowthCampaign | null>(null);
  protected readonly rejectReason = signal('');
  protected readonly endTarget = signal<AdminGrowthCampaign | null>(null);
  protected readonly spentAmount = signal(0);
  protected readonly endNote = signal('');

  ngOnInit(): void {
    this.reload();
  }

  protected setStatus(value: string): void {
    this.status.set(value);
    this.loadCampaigns();
  }

  protected reload(): void {
    this.loadCampaigns();
    this.loadActiveCampaigns();
    this.loadQueue();
    this.loadAllocations();
    this.loadAttribution();
  }

  protected activeCampaigns(): AdminGrowthCampaign[] {
    return this.activeCampaignList();
  }

  protected eligibleQueue(): CampaignQueueRow[] {
    return this.queue().filter((row) => row.eligible && row.partner);
  }

  protected overridePlacement(): void {
    const campaignId = this.overrideCampaignId();
    const partnerId = this.overridePartnerId();
    const reason = this.overrideReason().trim();
    if (!campaignId || !partnerId) {
      this.error.set('Choose a campaign and a queued partner.');
      return;
    }
    if (reason.length < 3) {
      this.error.set('Add a reason for the manual placement.');
      return;
    }
    this.busyId.set(campaignId);
    this.error.set(null);
    this.campaignsService.adminOverrideAllocation(campaignId, partnerId, reason).pipe(
      finalize(() => this.busyId.set(null)),
    ).subscribe({
      next: () => {
        this.snack.open('Partner placed manually', 'Close', { duration: 4000 });
        this.overridePartnerId.set('');
        this.overrideReason.set('');
        this.reload();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected reversePlacement(allocation: AdminAllocationRow): void {
    if (this.reversingId()) return;
    this.reverseTarget.set(allocation);
    this.reverseReason.set('');
  }

  protected cancelReverse(): void {
    this.reverseTarget.set(null);
    this.reverseReason.set('');
  }

  protected submitReverse(): void {
    const target = this.reverseTarget();
    const reason = this.reverseReason().trim();
    if (!target || reason.length < 3) {
      this.snack.open('Add a short reason before reversing.', 'Close', { duration: 3000 });
      return;
    }
    this.reversingId.set(target.id);
    this.error.set(null);
    this.campaignsService.adminReverseAllocation(target.id, reason).pipe(
      finalize(() => this.reversingId.set(null)),
    ).subscribe({
      next: () => {
        this.snack.open('Allocation reversed and partner returned to the queue', 'Close', { duration: 4000 });
        this.cancelReverse();
        this.reload();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected activate(campaign: AdminGrowthCampaign): void {
    this.act(campaign.id, this.campaignsService.adminActivate(campaign.id), 'Campaign activated');
  }

  protected pause(campaign: AdminGrowthCampaign): void {
    this.act(campaign.id, this.campaignsService.adminPause(campaign.id), 'Campaign paused');
  }

  protected resume(campaign: AdminGrowthCampaign): void {
    this.act(campaign.id, this.campaignsService.adminResume(campaign.id), 'Campaign resumed');
  }

  protected runAll(): void {
    this.run(undefined);
  }

  protected runOne(campaign: AdminGrowthCampaign): void {
    this.run(campaign.id);
  }

  protected startReject(campaign: AdminGrowthCampaign): void {
    this.endTarget.set(null);
    this.rejectTarget.set(campaign);
    this.rejectReason.set('');
  }

  protected submitReject(): void {
    const target = this.rejectTarget();
    if (!target || this.rejectReason().trim().length < 3) return;
    this.busyId.set(target.id);
    this.error.set(null);
    this.campaignsService.adminReject(target.id, this.rejectReason().trim()).pipe(
      finalize(() => this.busyId.set(null)),
    ).subscribe({
      next: () => {
        this.snack.open('Campaign rejected and budget returned', 'Close', { duration: 4000 });
        this.cancelPanels();
        this.reload();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected startEnd(campaign: AdminGrowthCampaign): void {
    this.rejectTarget.set(null);
    this.endTarget.set(campaign);
    this.spentAmount.set(Number(campaign.budget.spent) || 0);
    this.endNote.set('');
  }

  protected refundPreview(campaign: AdminGrowthCampaign): number {
    const unrefunded = Math.max(Number(campaign.budget.total) - Number(campaign.budget.refunded || 0), 0);
    return Math.max(unrefunded - Number(this.spentAmount() || 0), 0);
  }

  protected submitEnd(): void {
    const target = this.endTarget();
    if (!target) return;
    const spent = Number(this.spentAmount());
    const maxSpend = Math.max(Number(target.budget.total) - Number(target.budget.refunded || 0), 0);
    if (!Number.isFinite(spent) || spent < 0 || spent > maxSpend) {
      this.error.set('Spent amount cannot exceed the unrefunded campaign budget.');
      return;
    }
    this.busyId.set(target.id);
    this.error.set(null);
    this.campaignsService.adminEnd(target.id, spent, this.endNote().trim() || undefined).pipe(
      finalize(() => this.busyId.set(null)),
    ).subscribe({
      next: () => {
        this.snack.open('Campaign ended and unspent budget returned', 'Close', { duration: 4000 });
        this.cancelPanels();
        this.reload();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected cancelPanels(): void {
    this.rejectTarget.set(null);
    this.rejectReason.set('');
    this.endTarget.set(null);
    this.spentAmount.set(0);
    this.endNote.set('');
  }

  private run(campaignId?: string): void {
    this.allocating.set(true);
    this.error.set(null);
    this.campaignsService.adminAllocate(campaignId, 20).pipe(
      finalize(() => this.allocating.set(false)),
    ).subscribe({
      next: (response) => {
        const count = response.data.allocated.length;
        this.snack.open(`Allocated ${count} partner${count === 1 ? '' : 's'}`, 'Close', { duration: 4000 });
        this.reload();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  private act(campaignId: string, request: ReturnType<CampaignsService['adminActivate']>, message: string): void {
    this.busyId.set(campaignId);
    this.error.set(null);
    request.pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: () => {
        this.snack.open(message, 'Close', { duration: 3000 });
        this.reload();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  private loadCampaigns(): void {
    this.loading.set(true);
    this.campaignsService.adminList({ status: this.status() || undefined }).pipe(
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: (response) => this.campaigns.set(response.data),
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  private loadActiveCampaigns(): void {
    this.campaignsService.adminList({ status: 'Active', limit: 100 }).subscribe({
      next: (response) => this.activeCampaignList.set(response.data ?? []),
      error: () => this.activeCampaignList.set([]),
    });
  }

  private loadQueue(): void {    this.queueLoading.set(true);
    this.campaignsService.adminQueue().pipe(
      finalize(() => this.queueLoading.set(false)),
    ).subscribe({
      next: (response) => this.queue.set(response.data),
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  private loadAllocations(): void {
    this.allocationsLoading.set(true);
    this.campaignsService.adminAllocations('active').pipe(
      finalize(() => this.allocationsLoading.set(false)),
    ).subscribe({
      next: (response) => this.allocations.set(response.data ?? []),
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  private loadAttribution(): void {
    this.attributionLoading.set(true);
    this.campaignsService.adminAttribution().pipe(
      finalize(() => this.attributionLoading.set(false)),
    ).subscribe({
      next: (response) => this.attribution.set(response.data ?? []),
      // Attribution is a reporting aid — never block the operational desk.
      error: () => this.attribution.set([]),
    });
  }
}
