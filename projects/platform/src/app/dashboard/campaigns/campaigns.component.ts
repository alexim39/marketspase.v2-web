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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OnboardingService } from '../../core/onboarding/onboarding.service';
import { OnboardingStatus } from '../../core/onboarding/onboarding.models';
import { CampaignsService } from '../../core/campaigns/campaigns.service';
import {
  GrowthCampaign,
  MyAllocation,
  PlacedPartner,
} from '../../core/campaigns/campaigns.models';
import { ApiError, userError } from '../../core/http/api-error';
import { States } from '../../_common/services/countries';
import { CampaignAnalyticsDialogComponent } from './analytics/campaign-analytics.component';

type CampaignTab = 'studio' | 'campaigns' | 'placement';

@Component({
  selector: 'async-growth-campaigns',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    MatTooltipModule,
    PageSkeletonComponent,
    ReactiveFormsModule,
    RouterModule,
  ],
  template: `
    <section class="campaign-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Partner acquisition · Growth engine</p>
          <h1>Fund central acquisition. Receive activated partners.</h1>
          <p class="muted">Your budget is held for MarketSpase ad operations. It stays separate from commissions and rank volume, and allocation follows the fairness rules shown below.</p>
        </div>
        <div class="head-actions">
          <a mat-stroked-button routerLink="/dashboard">Dashboard</a>
        </div>
      </header>

      @if (loading()) {
        <async-page-skeleton layout="cards" [rows]="4" label="your campaigns" [showHeader]="false" />
      } @else {
        @if (error(); as err) {
          <div class="alert" role="alert">
            <mat-icon>error_outline</mat-icon><p>{{ err }}</p>
            <button mat-icon-button type="button" (click)="error.set(null)" aria-label="Dismiss"><mat-icon>close</mat-icon></button>
          </div>
        }

        @if (!eligible()) {
          <div class="panel gate">
            <mat-icon class="gate-icon">verified_user</mat-icon>
            <div>
              <h2>Activation and identity step are required</h2>
              <p class="muted">
                @if (partner()?.accountState !== 'partner') {
                  Activate your partner account with the starter product before funding growth campaigns.
                } @else {
                  Complete the identity step in activation to unlock campaign funding.
                }
              </p>
              <a mat-flat-button color="primary" routerLink="/dashboard/activate">Open activation</a>
            </div>
          </div>
        } @else {
          <!-- Allocation status + explainability -->
          <div class="allocation-strip">
            @if (allocation()?.allocation; as placed) {
              <div class="allocation-icon"><mat-icon>hub</mat-icon></div>
              <div class="allocation-copy">
                <strong>Placed under {{ placed.owner?.name || 'a campaign owner' }}</strong>
                <p class="muted">{{ placed.campaign?.name }} · allocated {{ placed.allocatedAt | date: 'mediumDate' }} · score {{ placed.score.total }}/100</p>
                @if (placed.explanation?.length) {
                  <ul class="why">
                    @for (reason of placed.explanation; track reason) {
                      <li>{{ reason }}</li>
                    }
                  </ul>
                }
              </div>
            } @else if (allocation()?.queue; as queue) {
              <div class="allocation-icon"><mat-icon>hourglass_top</mat-icon></div>
              <div class="allocation-copy">
                <strong>You are in the allocation queue</strong>
                <p class="muted">
                  @if (queue.position) { Position #{{ queue.position }} · } waiting since {{ queue.enteredAt | date: 'mediumDate' }}. You can fund a campaign while you wait.
                </p>
              </div>
            } @else {
              <div class="allocation-icon"><mat-icon>info</mat-icon></div>
              <div class="allocation-copy">
                <strong>No active placement</strong>
                <p class="muted">You will be queued automatically when your activation is valid. You can still fund a campaign now.</p>
              </div>
            }
          </div>

          <!-- Portfolio summary -->
          <div class="summary-row">
            <div class="summary-card">
              <span>Funded budget</span>
              <strong>₦{{ totals().total | number: '1.0-0' }}</strong>
            </div>
            <div class="summary-card">
              <span>Spent</span>
              <strong>₦{{ totals().spent | number: '1.0-0' }}</strong>
            </div>
            <div class="summary-card">
              <span>Remaining</span>
              <strong>₦{{ totals().remaining | number: '1.0-0' }}</strong>
            </div>
            <div class="summary-card">
              <span>Active campaigns</span>
              <strong>{{ totals().active }}</strong>
            </div>
            <div class="summary-card">
              <span>Partners placed under you</span>
              <strong>{{ placedPartners().length }}</strong>
            </div>
          </div>

          <!-- Tabs -->
          <nav class="tabs" aria-label="Campaign sections">
            <button mat-button type="button" [class.active]="tab() === 'studio'" (click)="setTab('studio')">
              <mat-icon>rocket_launch</mat-icon> Campaign Studio
            </button>
            <button mat-button type="button" [class.active]="tab() === 'campaigns'" (click)="setTab('campaigns')">
              <mat-icon>campaign</mat-icon> My campaigns
            </button>
            <button mat-button type="button" [class.active]="tab() === 'placement'" (click)="setTab('placement')">
              <mat-icon>group_add</mat-icon> Placement
            </button>
          </nav>

          @switch (tab()) {
            @case ('studio') {
              <div class="content-grid">
                <div class="panel">
                  <div class="panel-head">
                    <div><p class="eyebrow">New campaign</p><h2>Fund a growth campaign</h2></div>
                    <span class="min-badge">Min ₦{{ requiredBudget() | number: '1.0-0' }}</span>
                  </div>
                  <p class="muted intro">The full budget leaves your wallet now. Each allocated prospect costs ₦{{ costPerProspect | number }}. Unspent budget is returned when the campaign is rejected, cancelled before activation, or closed by AI Admin.</p>

                  <form [formGroup]="form" (ngSubmit)="fund()" class="form-grid">
                    <mat-form-field appearance="outline" class="span-2">
                      <mat-label>Campaign name</mat-label>
                      <input matInput formControlName="name" maxlength="80" placeholder="e.g. Lagos young professionals - August" />
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Theme</mat-label>
                      <mat-select formControlName="category">
                        @for (category of categories; track category) {
                          <mat-option [value]="category">{{ category }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Budget (₦)</mat-label>
                      <input matInput type="number" formControlName="budgetAmount" [min]="requiredBudget()" step="550" />
                      <mat-hint>Minimum ₦{{ requiredBudget() | number: '1.0-0' }} for {{ formSlots() }} slots at ₦{{ costPerProspect | number }} each.</mat-hint>
                      @if (form.controls.budgetAmount.touched && !budgetCoverage()) {
                        <mat-error>Budget must cover all {{ formSlots() }} partner slots.</mat-error>
                      }
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Partner slots</mat-label>
                      <input matInput type="number" formControlName="capacityTotal" [min]="minProspects" max="20" />
                      <mat-icon matSuffix class="info-icon" [matTooltip]="'The total number of activated partners this campaign can receive. Each allocated prospect uses one slot and costs ₦' + (costPerProspect | number) + ' from the campaign budget.'" aria-label="Partner slots information">info_outline</mat-icon>
                      <mat-hint>Total prospects this campaign can receive. Minimum {{ minProspects }}.</mat-hint>
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Maximum per week</mat-label>
                      <input matInput type="number" formControlName="maxPerWeek" [min]="1" [max]="formSlots()" />
                      <mat-icon matSuffix class="info-icon" [matTooltip]="'The maximum number of new prospects allocated to this campaign in one week. This spreads the budget and prevents all allocations happening at once.'" aria-label="Maximum per week information">info_outline</mat-icon>
                      <mat-hint>Weekly allocation cap — spreads prospects through the campaign.</mat-hint>
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="span-2">
                      <mat-label>Can receive prospects from</mat-label>
                      <mat-select formControlName="targetStates" multiple (selectionChange)="onStatesChange($event.value)">
                        <mat-option [value]="allStates">All states</mat-option>
                        @for (state of states; track state) {
                          <mat-option [value]="state">{{ state }}</mat-option>
                        }
                      </mat-select>
                      <mat-hint>Select one or more preferred states. If none of those states has an available prospect, allocation falls back to other eligible states.</mat-hint>
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Start date</mat-label>
                      <input matInput [matDatepicker]="startPicker" formControlName="startAt" />
                      <mat-datepicker-toggle matIconSuffix [for]="startPicker"></mat-datepicker-toggle>
                      <mat-datepicker #startPicker></mat-datepicker>
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>End date</mat-label>
                      <input matInput [matDatepicker]="endPicker" formControlName="endAt" [min]="form.controls.startAt.value ?? today" />
                      <mat-datepicker-toggle matIconSuffix [for]="endPicker"></mat-datepicker-toggle>
                      <mat-datepicker #endPicker></mat-datepicker>
                      @if (!form.controls.noEndDate.value && form.controls.endAt.touched && !form.controls.endAt.value) {
                        <mat-error>Choose an end date or tick “No end date”.</mat-error>
                      }
                      @if (dateRangeInvalid()) {
                        <mat-error>End date must be on or after the start date.</mat-error>
                      }
                    </mat-form-field>
                    <mat-checkbox formControlName="noEndDate" class="span-2" (change)="onNoEndDateChange($event.checked)">
                      No end date — run until the budget or partner slots are exhausted
                    </mat-checkbox>
                    <mat-form-field appearance="outline" class="span-2">
                      <mat-label>Campaign brief</mat-label>
                      <textarea matInput rows="3" formControlName="brief" maxlength="600" placeholder="Audience, angle, offer and what the ad should say."></textarea>
                    </mat-form-field>
                  </form>

                  <div class="wallet-box">
                    <div><span class="muted small">Wallet balance</span><strong>₦{{ wallet() | number: '1.0-0' }}</strong></div>
                    @if (shortfall(); as gap) {
                      <div class="shortfall"><span>Need ₦{{ gap | number: '1.0-0' }} more</span><a mat-stroked-button routerLink="/dashboard/wallet/deposit">Fund wallet</a></div>
                    } @else {
                      <span class="ready"><mat-icon>check_circle</mat-icon>Budget covered</span>
                    }
                  </div>

                  <button mat-flat-button color="primary" type="button" class="submit" (click)="fund()" [disabled]="!canFund() || busy()">
                    {{ busy() ? 'Funding campaign…' : 'Fund campaign' }}
                  </button>
                </div>

                <aside class="panel side-panel">
                  <div class="panel-head">
                    <div><p class="eyebrow">What happens next</p><h2>Campaign summary</h2></div>
                  </div>
                  <div class="side-summary">
                    <div><span>Budget held</span><strong>₦{{ formBudget() | number: '1.0-0' }}</strong></div>
                    <div><span>Cost per prospect</span><strong>₦{{ costPerProspect | number }}</strong></div>
                    <div><span>Partner slots</span><strong>{{ formSlots() }}</strong></div>
                    <div><span>Max per week</span><strong>{{ formMaxPerWeek() }}</strong></div>
                  </div>
                  <ol class="steps">
                    <li><strong>You fund the budget.</strong><span>The full amount leaves your wallet and is held for ad operations. Each prospect allocated costs ₦{{ costPerProspect | number }}.</span></li>
                    <li><strong>Instant activation.</strong><span>Your campaign goes live as soon as funding clears. If you chose a future start date, allocation waits until that date.</span></li>
                    <li><strong>Fair allocation.</strong><span>The engine places activated partners using wait time, capped contribution, preferred states, capacity and support. If no preferred-state prospect is available, it falls back to other eligible states.</span></li>
                    <li><strong>Automatic close-out.</strong><span>When the budget or partner slots are exhausted, the campaign ends and any unspent budget returns to your wallet.</span></li>
                  </ol>
                  <p class="fine">Campaign spend stays separate from commissionable volume and rank volume. Allocation follows the fairness rules and available capacity.</p>
                </aside>
              </div>
            }

            @case ('campaigns') {
              <div class="panel">
                <div class="panel-head">
                  <div><p class="eyebrow">My portfolio</p><h2>Funded campaigns</h2></div>
                  <span class="count">{{ campaigns().length }}</span>
                </div>
                <p class="muted small campaign-note">Open analytics on any campaign to see joins, activations and 7-day activity.</p>
                @if (campaigns().length === 0) {
                  <div class="empty"><mat-icon>campaign</mat-icon><p>No funded campaigns yet. Start in Campaign Studio.</p><button mat-flat-button color="primary" type="button" (click)="setTab('studio')">Open Studio</button></div>
                } @else {
                  <div class="campaign-list">
                    @for (campaign of campaigns(); track campaign.id) {
                      <article class="campaign-card">
                        <div class="campaign-top">
                          <div><strong>{{ campaign.name }}</strong><p class="muted">{{ campaign.category || 'General growth' }}</p></div>
                          <span class="chip" [class.active]="campaign.status === 'Active'" [class.pending]="campaign.status === 'Pending'" [class.paused]="campaign.status === 'Paused'" [class.ended]="campaign.status === 'Ended'">{{ campaign.status }}</span>
                        </div>
                        <div class="stats">
                          <span><small>Budget</small><strong>₦{{ campaign.budget.total | number: '1.0-0' }}</strong></span>
                          <span><small>Spent</small><strong>₦{{ campaign.budget.spent | number: '1.0-0' }}</strong></span>
                          <span><small>Remaining</small><strong>₦{{ campaign.budget.remaining | number: '1.0-0' }}</strong></span>
                          <span><small>Partners</small><strong>{{ campaign.capacity.allocated }}/{{ campaign.capacity.total }}</strong></span>
                        </div>
                        <p class="muted flight">
                          {{ campaign.flight.startAt | date: 'mediumDate' }}
                          @if (campaign.flight.endAt) { – {{ campaign.flight.endAt | date: 'mediumDate' }} } @else { · continuous }
                        </p>
                        @if (campaign.status === 'Pending') {
                          <p class="muted small">Legacy campaign awaiting review. Budget is held and refundable.</p>
                        }
                        <div class="campaign-actions">
                          <button mat-button type="button" (click)="openAnalytics(campaign)">
                            <mat-icon>insights</mat-icon> View analytics
                          </button>
                          @if (campaign.trackingUrl) {
                            <a mat-button [href]="campaign.trackingUrl" target="_blank" rel="noopener">Open join page</a>
                            <button mat-button type="button" (click)="copyTracking(campaign)">
                              {{ copiedCampaignId() === campaign.id ? 'Copied' : 'Copy link' }}
                            </button>
                          }
                          @if (campaign.status === 'Active') {
                            <button mat-button type="button" (click)="pause(campaign)" [disabled]="busy()">Pause</button>
                          }
                          @if (campaign.status === 'Paused') {
                            <button mat-button type="button" (click)="resume(campaign)" [disabled]="busy()">Resume</button>
                          }
                          @if (campaign.status === 'Pending') {
                            <button mat-button type="button" class="danger" (click)="cancel(campaign)" [disabled]="busy()">Cancel & refund</button>
                          }
                        </div>
                      </article>
                    }
                  </div>
                }
              </div>
            }

            @case ('placement') {
              <div class="panel placed-panel">
                <div class="panel-head">
                  <div><p class="eyebrow">Team placement</p><h2>Partners placed under you</h2></div>
                  <span class="count">{{ placedPartners().length }}</span>
                </div>
                @if (placedPartners().length === 0) {
                  <div class="empty"><mat-icon>group_add</mat-icon><p>No activated partners have been placed under you yet. Keep funding and the allocation engine will fill your capacity.</p></div>
                } @else {
                  <div class="placed-list">
                    @for (placement of placedPartners(); track placement.id) {
                      <article class="placed-row">
                        <div class="avatar">{{ initials(placement.partner?.name) }}</div>
                        <div class="placed-body">
                          <strong>{{ placement.partner?.name || 'Partner' }}</strong>
                          <p class="muted">{{ placement.partner?.state || 'State unknown' }} · {{ placement.campaign?.name }} · {{ placement.allocatedAt | date: 'mediumDate' }}</p>
                        </div>
                        <span class="score">Score {{ placement.score.total }}</span>
                      </article>
                    }
                  </div>
                }
              </div>
            }
          }
        }
      }
    </section>
  `,
  styles: [`
    .campaign-page { max-width: 1200px; margin: 0 auto; padding: 32px 0 48px; }
    .page-head { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin-bottom: 24px; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(2rem, 3vw, 2.5rem); line-height: 1.1; letter-spacing: -0.03em; }
    .page-head p { margin: 0; line-height: 1.6; max-width: 720px; }
    .head-actions { display: flex; gap: 8px; flex-wrap: wrap; flex: none; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .muted { color: var(--ms-text-muted); }
    .small { font-size: 0.875rem; }
    .panel { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); padding: 24px; box-shadow: var(--ms-shadow-sm); }
    .loading { display: grid; gap: 16px; place-items: center; padding: 48px; }
    .content-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.8fr); gap: 24px; align-items: start; }
    .panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
    .panel-head h2 { margin: 4px 0 0; font-size: 1.125rem; }
    .campaign-note { margin: -8px 0 16px; }
    .intro { margin: 0 0 16px; line-height: 1.6; }
    .min-badge, .count { border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); padding: 4px 12px; font-size: 0.75rem; font-weight: 700; white-space: nowrap; }
    .info-icon { color: var(--ms-text-muted); font-size: 18px; width: 18px; height: 18px; cursor: help; }
    mat-checkbox.span-2 { margin: 4px 0 12px; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; }
    .span-2 { grid-column: span 2; }
    mat-form-field { width: 100%; }
    .wallet-box { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-canvas); margin: 8px 0 16px; flex-wrap: wrap; }
    .wallet-box > div { display: grid; gap: 2px; }
    .wallet-box strong { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
    .shortfall { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; color: var(--ms-warning); font-weight: 600; }
    .ready { color: var(--ms-success); font-weight: 600; display: inline-flex; gap: 8px; align-items: center; }
    .ready mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .submit { width: 100%; min-height: 48px; font-weight: 700; }
    .allocation-strip { display: flex; gap: 16px; align-items: flex-start; background: linear-gradient(120deg, var(--ms-primary-soft), var(--ms-surface)); border: 1px solid var(--ms-primary); border-radius: var(--ms-radius-lg); padding: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .allocation-icon { width: 40px; height: 40px; flex: 0 0 40px; border-radius: var(--ms-radius-lg); display: grid; place-items: center; background: var(--ms-surface); color: var(--ms-primary-strong); }
    .allocation-copy { flex: 1; min-width: 220px; }
    .allocation-copy p { margin: 4px 0 0; line-height: 1.6; }
    .why { margin: 8px 0 0; padding-left: 24px; color: var(--ms-text-muted); font-size: 0.875rem; line-height: 1.6; }
    .why li { margin-bottom: 2px; }
    .summary-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .summary-card { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); padding: 16px; display: flex; flex-direction: column; gap: 4px; }
    .summary-card span { color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
    .summary-card strong { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
    .tabs { display: flex; gap: 4px; flex-wrap: wrap; border-bottom: 1px solid var(--ms-line); margin-bottom: 16px; }
    .tabs button { border-radius: var(--ms-radius-sm) var(--ms-radius-sm) 0 0; min-height: 44px; color: var(--ms-text-muted); }
    .tabs button.active { background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 600; }
    .tabs mat-icon { margin-right: 4px; }
    .side-panel { position: sticky; top: 88px; }
    .side-summary { display: grid; gap: 8px; margin-bottom: 16px; }
    .side-summary div { display: flex; justify-content: space-between; gap: 16px; padding: 8px 12px; border-radius: var(--ms-radius-sm); background: var(--ms-canvas); }
    .side-summary strong { font-variant-numeric: tabular-nums; }
    .steps { margin: 0 0 16px; padding-left: 24px; display: grid; gap: 12px; }
    .steps li { line-height: 1.5; }
    .steps strong { display: block; }
    .steps span { color: var(--ms-text-muted); font-size: 0.875rem; }
    .fine { margin: 0; color: var(--ms-text-muted); font-size: 0.8125rem; line-height: 1.6; }
    .gate { display: flex; gap: 24px; align-items: flex-start; }
    .gate h2 { margin: 0 0 8px; }
    .gate p { margin: 0 0 16px; line-height: 1.6; }
    .gate-icon { font-size: 40px; width: 40px; height: 40px; color: var(--ms-primary-strong); }
    .campaign-list { display: grid; gap: 16px; }
    .campaign-card { border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); padding: 16px; }
    .campaign-top { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .campaign-top p { margin: 4px 0 0; }
    .chip { padding: 4px 10px; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .chip.active { background: var(--ms-success-soft); color: var(--ms-success); }
    .chip.pending { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .chip.paused { background: var(--ms-info-soft); color: var(--ms-info); }
    .chip.ended { background: var(--ms-error-soft); color: var(--ms-error); }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 16px 0 8px; }
    .stats span { display: grid; gap: 2px; padding: 8px; border-radius: var(--ms-radius-sm); background: var(--ms-canvas); }
    .stats small { color: var(--ms-text-muted); font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .stats strong { font-size: 0.9375rem; font-variant-numeric: tabular-nums; }
    .flight { margin: 8px 0; font-size: 0.8125rem; }
    .campaign-actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
    .danger { color: var(--ms-error); }
    .empty { display: grid; place-items: center; gap: 8px; padding: 48px 16px; color: var(--ms-text-muted); text-align: center; }
    .empty mat-icon { font-size: 40px; width: 40px; height: 40px; }
    .empty p { margin: 0; line-height: 1.6; }
    .placed-panel { margin-top: 0; }
    .placed-list { display: grid; gap: 8px; }
    .placed-row { display: flex; gap: 16px; align-items: center; padding: 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); }
    .placed-body { flex: 1; min-width: 0; }
    .placed-body p { margin: 2px 0 0; line-height: 1.5; }
    .avatar { width: 40px; height: 40px; flex: 0 0 40px; border-radius: 50%; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 700; }
    .score { font-size: 0.75rem; font-weight: 600; color: var(--ms-primary-strong); background: var(--ms-primary-soft); border-radius: 999px; padding: 4px 8px; white-space: nowrap; }
    .alert { display: flex; gap: 12px; align-items: flex-start; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-error-soft); color: var(--ms-error); margin-bottom: 16px; }
    .alert p { margin: 0; flex: 1; line-height: 1.5; }
    @media (max-width: 900px) {
      .page-head { flex-direction: column; }
      .content-grid { grid-template-columns: minmax(0, 1fr); }
      .side-panel { position: static; }
    }
    @media (max-width: 560px) {
      .form-grid { grid-template-columns: minmax(0, 1fr); }
      .span-2 { grid-column: span 1; }
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `],
})
export class CampaignsComponent implements OnInit {
  private readonly onboarding = inject(OnboardingService);
  private readonly campaignsService = inject(CampaignsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  protected readonly costPerProspect = 550;
  protected readonly minProspects = 2;
  protected readonly minBudget = this.costPerProspect * this.minProspects;
  protected readonly allStates = '__all__';
  protected readonly states = States;
  protected readonly today = new Date();
  private lastStates: string[] = [this.allStates];
  protected readonly categories = [
    'Health optimization',
    'Financial leverage system',
    'Network marketing',
    'Online business opportunity',
    'Personal development',
    'Wealth & investing',
    'Fitness & wellness',
    'Beauty & skincare',
    'Business & entrepreneurship',
    'Education & skills',
    'Real estate',
    'Youth empowerment',
  ];

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<OnboardingStatus | null>(null);
  protected readonly campaigns = signal<GrowthCampaign[]>([]);
  protected readonly allocation = signal<MyAllocation | null>(null);
  protected readonly placedPartners = signal<PlacedPartner[]>([]);
  protected readonly copiedCampaignId = signal<string | null>(null);
  protected readonly tab = signal<CampaignTab>('studio');
  protected readonly partner = computed(() => this.status()?.partner ?? null);
  protected readonly wallet = computed(() => Number(this.partner()?.balance ?? 0));
  protected readonly eligible = computed(() => (
    this.partner()?.accountState === 'partner'
    && this.partner()?.kycStatus === 'verified'
  ));

  /** Portfolio totals across every funded campaign. */
  protected readonly totals = computed(() => {
    const list = this.campaigns();
    const total = list.reduce((sum, c) => sum + Number(c.budget?.total ?? 0), 0);
    const spent = list.reduce((sum, c) => sum + Number(c.budget?.spent ?? 0), 0);
    const remaining = list.reduce((sum, c) => sum + Number(c.budget?.remaining ?? 0), 0);
    const active = list.filter((c) => c.status === 'Active').length;
    return { total, spent, remaining, active };
  });

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
    category: ['Network marketing'],
    brief: [''],
    budgetAmount: [this.minBudget, [Validators.required, Validators.min(this.minBudget)]],
    capacityTotal: [this.minProspects, [Validators.required, Validators.min(this.minProspects), Validators.max(20)]],
    maxPerWeek: [2, [Validators.required, Validators.min(1), Validators.max(10)]],
    targetStates: [[this.allStates], Validators.required],
    startAt: [new Date(), Validators.required],
    endAt: [{ value: null as Date | null, disabled: true }],
    noEndDate: [true],
  });

  ngOnInit(): void {
    this.form.controls.capacityTotal.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const required = this.requiredBudget();
        if (this.form.controls.budgetAmount.value < required) {
          this.form.controls.budgetAmount.setValue(required, { emitEvent: false });
        }
        const maxWeek = Math.min(this.form.controls.maxPerWeek.value, this.formSlots());
        if (maxWeek !== this.form.controls.maxPerWeek.value) {
          this.form.controls.maxPerWeek.setValue(Math.max(maxWeek, 1), { emitEvent: false });
        }
      });
    this.syncEndDateState();
    this.refresh();
  }

  protected setTab(tab: CampaignTab): void {
    this.tab.set(tab);
  }

  protected formBudget(): number {
    return Number(this.form.controls.budgetAmount.value ?? 0);
  }

  protected formSlots(): number {
    return Number(this.form.controls.capacityTotal.value ?? 0);
  }

  protected formMaxPerWeek(): number {
    return Number(this.form.controls.maxPerWeek.value ?? 0);
  }

  protected requiredBudget(): number {
    return Math.max(this.minBudget, this.formSlots() * this.costPerProspect);
  }

  protected budgetCoverage(): boolean {
    return this.formBudget() >= this.requiredBudget();
  }

  protected dateRangeInvalid(): boolean {
    const start = this.form.controls.startAt.value;
    const end = this.form.controls.endAt.value;
    if (!start || !end || this.form.controls.noEndDate.value) return false;
    return end.getTime() < start.getTime();
  }

  protected endDateMissing(): boolean {
    return !this.form.controls.noEndDate.value && !this.form.controls.endAt.value;
  }

  protected onNoEndDateChange(noEndDate: boolean): void {
    if (noEndDate) {
      this.form.controls.endAt.disable({ emitEvent: false });
      this.form.controls.endAt.setValue(null, { emitEvent: false });
    } else {
      this.form.controls.endAt.enable({ emitEvent: false });
    }
  }

  /** All states is a UI sentinel; the API treats an empty array as "all". */
  protected onStatesChange(values: string[]): void {
    if (values.includes(this.allStates)) {
      const hadAll = this.lastStates.includes(this.allStates);
      const next = hadAll
        ? values.filter((value) => value !== this.allStates)
        : [this.allStates];
      this.form.controls.targetStates.setValue(next, { emitEvent: false });
      this.lastStates = [...next];
      return;
    }
    this.form.controls.targetStates.setValue(values, { emitEvent: false });
    this.lastStates = [...values];
  }

  protected shortfall(): number {
    return Math.max(0, Number(this.form.controls.budgetAmount.value ?? 0) - this.wallet());
  }

  protected canFund(): boolean {
    return this.eligible()
      && this.form.valid
      && this.budgetCoverage()
      && !this.endDateMissing()
      && !this.dateRangeInvalid()
      && this.shortfall() === 0
      && !this.busy();
  }

  protected fund(): void {
    if (!this.canFund()) {
      this.form.markAllAsTouched();
      if (!this.budgetCoverage()) {
        this.error.set(`Budget must cover ${this.formSlots()} partner slots at ₦${this.costPerProspect.toLocaleString()} each (₦${this.requiredBudget().toLocaleString()}).`);
      } else if (this.endDateMissing()) {
        this.error.set('Choose an end date or tick “No end date”.');
      } else if (this.dateRangeInvalid()) {
        this.error.set('End date must be on or after the start date.');
      } else if (this.shortfall() > 0) {
        this.error.set('Your wallet balance is too low for this budget. Fund your wallet first.');
      }
      return;
    }
    const value = this.form.getRawValue();
    const start = value.startAt;
    const end = value.endAt;
    const states = value.targetStates.includes(this.allStates) ? [] : value.targetStates;
    this.busy.set(true);
    this.error.set(null);
    this.campaignsService.create({
      name: value.name,
      category: value.category,
      brief: value.brief,
      budgetAmount: Number(value.budgetAmount),
      capacityTotal: Number(value.capacityTotal),
      maxPerWeek: Number(value.maxPerWeek),
      targetStates: states,
      ageRange: 'All',
      gender: 'All',
      ...(start ? { startAt: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0).toISOString() } : {}),
      ...(!value.noEndDate && end
        ? { endAt: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59).toISOString() }
        : {}),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.busy.set(false)),
    ).subscribe({
      next: () => {
        this.form.reset({
          name: '',
          category: 'Network marketing',
          brief: '',
          budgetAmount: this.minBudget,
          capacityTotal: this.minProspects,
          maxPerWeek: 2,
          targetStates: [this.allStates],
          startAt: new Date(),
          endAt: null,
          noEndDate: true,
        });
        this.lastStates = [this.allStates];
        this.syncEndDateState();
        this.tab.set('campaigns');
        this.refresh();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  private syncEndDateState(): void {
    const noEnd = this.form.controls.noEndDate.value;
    if (noEnd) this.form.controls.endAt.disable({ emitEvent: false });
    else this.form.controls.endAt.enable({ emitEvent: false });
  }

  protected copyTracking(campaign: GrowthCampaign): void {
    const url = String(campaign.trackingUrl ?? '').trim();
    if (!url) return;
    if (!navigator.clipboard?.writeText) {
      this.error.set('Copying is not available in this browser. Open the join page and copy the address instead.');
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => {
        this.copiedCampaignId.set(campaign.id);
        globalThis.setTimeout(() => {
          if (this.copiedCampaignId() === campaign.id) this.copiedCampaignId.set(null);
        }, 2000);
      },
      () => this.error.set('Could not copy the campaign link. Open the join page and copy the address instead.'),
    );
  }

  protected openAnalytics(campaign: GrowthCampaign): void {
    this.dialog.open(CampaignAnalyticsDialogComponent, {
      data: campaign,
      width: '1040px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      panelClass: 'campaign-analytics-panel',
      restoreFocus: true,
    });
  }

  protected cancel(campaign: GrowthCampaign): void {
    if (!globalThis.confirm(`Cancel "${campaign.name}" and return the unspent budget to your wallet?`)) return;
    this.busy.set(true);
    this.campaignsService.cancel(campaign.id, 'Owner cancelled from campaigns page').pipe(
      finalize(() => this.busy.set(false)),
    ).subscribe({
      next: () => this.refresh(),
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected pause(campaign: GrowthCampaign): void {
    this.busy.set(true);
    this.campaignsService.pause(campaign.id).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => this.refresh(),
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected initials(name: string | undefined): string {
    return String(name ?? '').split(/\s+/).filter(Boolean).slice(0, 2)
      .map((part) => part[0]?.toUpperCase()).join('') || 'P';
  }

  protected resume(campaign: GrowthCampaign): void {
    this.busy.set(true);
    this.campaignsService.resume(campaign.id).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => this.refresh(),
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  private refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      status: this.onboarding.status(),
      campaigns: this.campaignsService.mine(),
      allocation: this.campaignsService.myAllocation(),
      placed: this.campaignsService.myPlacedPartners(),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: ({ status, campaigns, allocation, placed }) => {
        this.status.set(status.data);
        this.campaigns.set(campaigns.data);
        this.allocation.set(allocation.data);
        this.placedPartners.set(placed.data);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }
}
