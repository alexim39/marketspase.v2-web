import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule } from '@angular/router';
import { NgxEchartsDirective } from 'ngx-echarts';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { ChartThemeService } from '../../../core/charts/chart-theme.service';
import type { EChartsCoreOption } from '../../../core/charts/echarts-setup';
import { forkJoin } from 'rxjs';
import { GoalService } from '../../../core/goals/goal.service';
import { GOAL_KIND_LABELS, Goal, GoalKind, TrendBucket } from '../../../core/goals/goal.models';
import { ApiError } from '../../../core/http/api-error';

const UNIT_LABELS: Record<GoalKind, string> = {
  sales: 'sales volume',
  sales_orders: 'orders',
  team_volume: 'team volume',
  team_orders: 'team orders',
  active_team: 'active members',
  recruitment: 'recruits',
  team_recruitment: 'team recruits',
  conversion: 'conversions',
  new_prospects: 'new prospects',
  follow_ups: 'follow-ups',
  training: 'stamps',
};

const toInputDate = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * @title My goals — target definitions with live progress + sales trends.
 *
 * Progress numerators are computed server-side from source aggregates
 * (orders, recruits, prospects, network) — this page only renders them.
 * OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-goals',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe, MatButtonModule, MatChipsModule, MatDatepickerModule, MatNativeDateModule,
    MatIconModule, MatInputModule, MatProgressBarModule, MatSelectModule, NgxEchartsDirective,
    PageSkeletonComponent, ReactiveFormsModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>My Goals</span>
      </div>
    </section>

    <section class="goals-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Growth · Goals</p>
          <h1>My goals</h1>
          <p class="subtitle">Set measurable targets and watch live progress from your sales, team, pipeline and training. Every goal tells you the next place to act.</p>
        </div>
        <button mat-flat-button color="primary" type="button" (click)="toggleForm()">
          <mat-icon>{{ showForm() ? 'close' : 'add' }}</mat-icon>
          {{ showForm() ? 'Close composer' : 'New goal' }}
        </button>
      </header>

      @if (!loading() && goals().length > 0) {
        <section class="summary-strip" role="status" aria-label="Goal summary">
          <div class="summary-item">
            <span class="summary-icon"><mat-icon>flag</mat-icon></span>
            <div><strong>{{ activeCount() }}</strong><span>Active goals</span></div>
          </div>
          <div class="summary-item">
            <span class="summary-icon summary-icon--ok"><mat-icon>trending_up</mat-icon></span>
            <div><strong>{{ onTrackCount() }}</strong><span>On track</span></div>
          </div>
          <div class="summary-item">
            <span class="summary-icon summary-icon--bad"><mat-icon>trending_down</mat-icon></span>
            <div><strong>{{ behindCount() }}</strong><span>Behind pace</span></div>
          </div>
          <div class="summary-item">
            <span class="summary-icon summary-icon--info"><mat-icon>task_alt</mat-icon></span>
            <div><strong>{{ completeCount() }}</strong><span>Completed</span></div>
          </div>
        </section>
      }

      @if (showForm()) {
        <form class="goal-form" [formGroup]="form" (ngSubmit)="save()">
          <div class="form-head">
            <div>
              <p class="eyebrow">Goal composer</p>
              <h2>{{ editingId() ? 'Edit goal' : 'Create a goal' }}</h2>
              <p>Pick a metric, set a target and choose the window. Progress is calculated live from your actual activity.</p>
            </div>
            <button mat-icon-button type="button" (click)="toggleForm()" aria-label="Close goal composer">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="form-grid">
            <mat-form-field appearance="outline" class="span-2">
              <mat-label>Title</mat-label>
              <input matInput formControlName="title" placeholder="e.g. September sales push" maxlength="120" />
              <mat-hint>Optional — we will use the goal type if left blank.</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Goal type</mat-label>
              <mat-select formControlName="kind">
                @for (group of kindGroups; track group.label) {
                  <mat-optgroup [label]="group.label">
                    @for (k of group.kinds; track k) {
                      <mat-option [value]="k">{{ kindLabel(k) }}</mat-option>
                    }
                  </mat-optgroup>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Target</mat-label>
              <input matInput type="number" min="1" formControlName="target" />
              <span matSuffix class="target-unit">{{ unit(form.controls.kind.value) }}</span>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Start</mat-label>
              <input matInput [matDatepicker]="goalStartPicker" formControlName="startDate" />
              <mat-datepicker-toggle matSuffix [for]="goalStartPicker" />
              <mat-datepicker #goalStartPicker />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>End</mat-label>
              <input
                matInput
                [matDatepicker]="goalEndPicker"
                formControlName="endDate"
                [min]="form.controls.startDate.value"
              />
              <mat-datepicker-toggle matSuffix [for]="goalEndPicker" />
              <mat-datepicker #goalEndPicker />
            </mat-form-field>
          </div>

          <p class="form-hint">
            <mat-icon>straighten</mat-icon>
            Tracking {{ unit(form.controls.kind.value) }} — {{ kindHint(form.controls.kind.value) }}
          </p>

          <div class="form-actions">
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
              {{ saving() ? 'Saving…' : (editingId() ? 'Save changes' : 'Save goal') }}
            </button>
            @if (editingId()) {
              <button mat-stroked-button type="button" (click)="cancelEdit()" [disabled]="saving()">Cancel edit</button>
            }
            @if (formError(); as err) {
              <span class="error" role="alert">{{ err }}</span>
            }
          </div>
        </form>
      }

      @if (loading()) {
        <async-page-skeleton layout="dashboard" [rows]="3" label="your goals" [showHeader]="false" />
      }

      @if (error(); as err) {
        <div class="alert" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>{{ err }}</p>
          <button mat-stroked-button type="button" (click)="reload()">Retry</button>
        </div>
      }

      @if (notice(); as note) {
        <div class="notice" role="status">
          <mat-icon>celebration</mat-icon>
          {{ note }}
        </div>
      }

      @if (goals().length > 0) {
        <div class="filter-row" role="radiogroup" aria-label="Goal filter">
          <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'all'" [attr.aria-pressed]="filter() === 'all'" (click)="filter.set('all')">
            All <span>{{ goals().length }}</span>
          </button>
          <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'active'" [attr.aria-pressed]="filter() === 'active'" (click)="filter.set('active')">
            Active <span>{{ activeCount() }}</span>
          </button>
          <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'behind'" [attr.aria-pressed]="filter() === 'behind'" (click)="filter.set('behind')">
            Behind <span>{{ behindCount() }}</span>
          </button>
          <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'complete'" [attr.aria-pressed]="filter() === 'complete'" (click)="filter.set('complete')">
            Complete <span>{{ completeCount() }}</span>
          </button>
          <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'closed'" [attr.aria-pressed]="filter() === 'closed'" (click)="filter.set('closed')">
            Closed <span>{{ closedCount() }}</span>
          </button>
        </div>
      }

      @if (filtered().length > 0) {
        <ul class="goal-list">
          @for (goal of filtered(); track goal.id) {
            <li class="goal-card" [class.goal-card--complete]="goal.progress.complete" [class.goal-card--closed]="goal.status === 'closed'">
              <div class="goal-head">
                <span class="goal-icon"><mat-icon>{{ kindIcon(goal.kind) }}</mat-icon></span>
                <div class="goal-title">
                  <strong>{{ goal.title }}</strong>
                  <span>{{ kindLabel(goal.kind) }}</span>
                </div>
                <span class="status-pill status-pill--{{ statusTone(goal) }}">{{ status(goal).label }}</span>
              </div>

              <div class="progress-block">
                <div class="progress-meta">
                  <span>{{ goal.progress.current | number }} / {{ goal.target | number }} {{ unit(goal.kind) }}</span>
                  <strong>{{ goal.progress.percent }}%</strong>
                </div>
                <mat-progress-bar mode="determinate" [value]="goal.progress.percent" aria-label="Progress" />
              </div>

              <div class="goal-meta">
                <span class="meta-item"><mat-icon>calendar_today</mat-icon>{{ goal.progress.daysLeft }} days left</span>
                @if (!goal.progress.complete && goal.status !== 'closed') {
                  @if (goal.progress.forecast.willHit && goal.progress.forecast.etaDate) {
                    <span class="forecast forecast--ok"><mat-icon>trending_up</mat-icon>On pace · ~{{ goal.progress.forecast.projected | number }} by {{ goal.progress.forecast.etaDate | date:'mediumDate' }}</span>
                  } @else if (goal.progress.forecast.requiredDaily !== null) {
                    <span class="forecast forecast--warn"><mat-icon>schedule</mat-icon>Needs {{ goal.progress.forecast.requiredDaily | number }}/day · short {{ goal.progress.forecast.shortfall | number }}</span>
                  } @else {
                    <span class="forecast forecast--bad"><mat-icon>timer_off</mat-icon>Out of time · short {{ goal.progress.forecast.shortfall | number }}</span>
                  }
                }
                @if (goal.status === 'closed') {
                  <span class="meta-item"><mat-icon>archive</mat-icon>Closed — reopen to track again</span>
                }
              </div>

              <div class="goal-actions">
                <a mat-stroked-button [routerLink]="nextMove(goal).link">{{ nextMove(goal).label }} <mat-icon>arrow_forward</mat-icon></a>
                <span class="spacer"></span>
                @if (goal.progress.complete && goal.status !== 'closed') {
                  <button mat-flat-button color="primary" type="button" (click)="celebrate(goal)" [disabled]="actingId() === goal.id">
                    {{ actingId() === goal.id ? 'Sharing…' : 'Celebrate' }}
                  </button>
                }
                @if (goal.status !== 'closed' && !goal.progress.complete) {
                  <button mat-button type="button" (click)="startEdit(goal)" [disabled]="saving() || actingId() === goal.id">Edit</button>
                  <button mat-button type="button" (click)="duplicate(goal)" [disabled]="saving() || actingId() === goal.id">Duplicate</button>
                  <button mat-button type="button" (click)="closeGoal(goal)" [disabled]="actingId() === goal.id">
                    {{ actingId() === goal.id ? 'Saving…' : 'Mark done' }}
                  </button>
                } @else if (goal.status === 'closed') {
                  <button mat-button type="button" (click)="reopen(goal)" [disabled]="actingId() === goal.id">
                    {{ actingId() === goal.id ? 'Saving…' : 'Reopen' }}
                  </button>
                }
                @if (confirmDeleteId() === goal.id) {
                  <span class="delete-confirm" role="alertdialog" aria-label="Confirm goal deletion">
                    <strong>Delete?</strong> This cannot be undone.
                    <button mat-button type="button" (click)="confirmDeleteId.set(null)" [disabled]="deletingId() === goal.id">Keep</button>
                    <button mat-button color="warn" type="button" (click)="remove(goal.id)" [disabled]="deletingId() === goal.id">
                      {{ deletingId() === goal.id ? 'Deleting…' : 'Yes, delete' }}
                    </button>
                  </span>
                } @else {
                  <button
                    mat-button
                    color="warn"
                    type="button"
                    (click)="confirmDeleteId.set(goal.id)"
                    [disabled]="deletingId() === goal.id"
                    aria-label="Delete {{ goal.title }}"
                  >Delete</button>
                }
              </div>
            </li>
          }
        </ul>
      } @else if (!loading() && !error()) {
        @if (goals().length === 0) {
          <div class="empty-card">
            <span class="empty-icon"><mat-icon>flag</mat-icon></span>
            <h2>No goals yet</h2>
            <p>Goals turn your ambition into a measurable target. Start with a sales, recruitment, pipeline or training goal — progress updates automatically.</p>
            <button mat-flat-button color="primary" type="button" (click)="toggleForm()">Create your first goal</button>
          </div>
        } @else {
          <div class="empty-card">
            <span class="empty-icon"><mat-icon>filter_alt_off</mat-icon></span>
            <h2>No goals match</h2>
            <p>Try another filter to see the rest of your goals.</p>
            <button mat-stroked-button type="button" (click)="filter.set('all')">Show all goals</button>
          </div>
        }
      }

      @if (trendsChart(); as chart) {
        <section class="trends-card">
          <div class="trends-head">
            <div>
              <p class="eyebrow">Momentum</p>
              <h2>Sales trend</h2>
              <p>Personal sales volume across the last {{ trends().length }} months.</p>
            </div>
            <span class="trend-pill"><mat-icon>show_chart</mat-icon> Monthly</span>
          </div>
          <div echarts [options]="chart" class="chart" role="img" aria-label="Monthly personal sales volume chart"></div>
        </section>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 16px; }
    .breadcrumb a { text-decoration: none; }
    .goals-page { display: flex; flex-direction: column; gap: 24px; max-width: 1160px; margin: 0 auto; padding-bottom: 32px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 24px; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(2rem, 3vw, 2.5rem); letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .subtitle { margin: 0; max-width: 62em; color: var(--ms-text-muted); line-height: 1.6; }
    .page-head button mat-icon { margin-right: 6px; }

    .summary-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 8px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); }
    .summary-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-md); }
    .summary-icon { flex: none; width: 40px; height: 40px; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .summary-icon--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .summary-icon--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .summary-icon--info { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .summary-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .summary-item div { display: flex; flex-direction: column; gap: 1px; }
    .summary-item strong { font-family: var(--ms-font-display); font-size: 1.5rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .summary-item span:last-child { color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; }

    .goal-form { display: flex; flex-direction: column; gap: 16px; padding: 24px; background: var(--ms-surface); border: 1px solid var(--ms-primary); border-radius: var(--ms-radius-lg); box-shadow: var(--ms-shadow-md); }
    .form-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .form-head h2 { margin: 4px 0; font-size: 1.25rem; }
    .form-head p { margin: 0; color: var(--ms-text-muted); font-size: 0.875rem; line-height: 1.5; }
    .form-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px 16px; }
    .span-2 { grid-column: span 2; }
    .target-unit { color: var(--ms-text-muted); font-size: 0.8125rem; padding-right: 8px; }
    .form-hint { display: flex; align-items: center; gap: 8px; margin: 0; color: var(--ms-text-muted); font-size: 0.8125rem; line-height: 1.5; }
    .form-hint mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--ms-primary-strong); }
    .form-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; border-top: 1px solid var(--ms-line); padding-top: 16px; }
    .form-actions button { min-height: 44px; }
    .error { color: var(--ms-error); font-size: 0.875rem; }

    .filter-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .filter-btn { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--ms-line); background: var(--ms-surface); color: var(--ms-text); border-radius: 999px; padding: 8px 16px; min-height: 44px; cursor: pointer; font: inherit; font-size: 0.875rem; font-weight: 500; transition: border-color 160ms ease, background 160ms ease; }
    .filter-btn:hover { border-color: var(--ms-primary); }
    .filter-btn span { display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .filter-btn--active { border-color: var(--ms-primary); background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 600; }
    .filter-btn--active span { background: var(--ms-surface); color: var(--ms-primary-strong); }

    .goal-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    .goal-card { display: flex; flex-direction: column; gap: 16px; padding: 24px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); box-shadow: var(--ms-shadow-sm); }
    .goal-card--complete { border-left: 3px solid var(--ms-success); }
    .goal-card--closed { opacity: 0.72; border-left: 3px solid var(--ms-line); }
    .goal-head { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .goal-icon { flex: none; width: 44px; height: 44px; border-radius: var(--ms-radius-lg); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .goal-icon mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .goal-title { flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 2px; }
    .goal-title strong { font-size: 1.0625rem; font-weight: 600; }
    .goal-title span { color: var(--ms-text-muted); font-size: 0.8125rem; }
    .status-pill { border-radius: 999px; padding: 6px 14px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
    .status-pill--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .status-pill--info { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .status-pill--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .status-pill--neutral { background: var(--ms-canvas); color: var(--ms-text-muted); }

    .progress-block { display: flex; flex-direction: column; gap: 8px; }
    .progress-meta { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
    .progress-meta span { color: var(--ms-text-muted); font-size: 0.875rem; font-variant-numeric: tabular-nums; }
    .progress-meta strong { font-family: var(--ms-font-display); font-size: 1.25rem; font-variant-numeric: tabular-nums; }
    .goal-meta { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .meta-item, .forecast { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8125rem; }
    .meta-item { color: var(--ms-text-muted); }
    .meta-item mat-icon, .forecast mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .forecast { padding: 4px 10px; border-radius: 999px; font-weight: 600; }
    .forecast--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .forecast--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .forecast--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .goal-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; border-top: 1px solid var(--ms-line); padding-top: 16px; }
    .goal-actions a, .goal-actions button { min-height: 44px; }
    .goal-actions a mat-icon { font-size: 18px; width: 18px; height: 18px; margin-left: 4px; }
    .goal-actions .spacer { flex: 1; }
    .delete-confirm { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 0.8125rem; color: var(--ms-error); }
    .delete-confirm button { min-height: 36px; }

    .alert { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { flex: 1; margin: 0; }
    .notice { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-success-soft); color: var(--ms-success); font-size: 0.875rem; font-weight: 500; }

    .empty-card { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; padding: 48px 24px; background: var(--ms-surface); border: 1px dashed var(--ms-line); border-radius: var(--ms-radius-lg); color: var(--ms-text-muted); }
    .empty-card h2 { margin: 0; color: var(--ms-text); font-size: 1.25rem; }
    .empty-card p { margin: 0; max-width: 42em; line-height: 1.6; }
    .empty-icon { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .empty-icon mat-icon { font-size: 28px; width: 28px; height: 28px; }

    .trends-card { padding: 24px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); }
    .trends-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .trends-head h2 { margin: 4px 0; font-size: 1.25rem; }
    .trends-head p { margin: 0; color: var(--ms-text-muted); font-size: 0.875rem; }
    .trend-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; }
    .trend-pill mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .chart { height: 280px; width: 100%; }

    @media (max-width: 900px) {
      .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .summary-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 640px) {
      .goals-page { gap: 16px; }
      .goal-form, .goal-card, .trends-card { padding: 16px; }
      .form-grid { grid-template-columns: minmax(0, 1fr); }
      .span-2 { grid-column: auto; }
      .goal-actions .spacer { display: none; }
      .goal-actions a, .goal-actions button { flex: 1 1 auto; }
      .filter-btn { flex: 1; justify-content: center; }
    }
  `],
})
export class GoalsComponent implements OnInit {
  private readonly goalsApi = inject(GoalService);
  private readonly charts = inject(ChartThemeService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly deletingId = signal<string | null>(null);
  protected readonly actingId = signal<string | null>(null);
  protected readonly confirmDeleteId = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly showForm = signal(false);
  protected readonly goals = signal<Goal[]>([]);
  protected readonly trends = signal<TrendBucket[]>([]);
  protected readonly filter = signal<'all' | 'active' | 'behind' | 'complete' | 'closed'>('all');

  protected readonly kindGroups: Array<{ label: string; kinds: GoalKind[] }> = [
    { label: 'Sales & revenue', kinds: ['sales', 'sales_orders', 'team_volume', 'team_orders'] },
    { label: 'Team & leadership', kinds: ['active_team', 'recruitment', 'team_recruitment'] },
    { label: 'Pipeline & prospecting', kinds: ['conversion', 'new_prospects', 'follow_ups'] },
    { label: 'Training', kinds: ['training'] },
  ];

  protected readonly completeCount = computed(() => this.goals().filter((g) => g.progress.complete).length);
  protected readonly behindCount = computed(
    () => this.goals().filter((g) => g.status !== 'closed' && !g.progress.complete && !g.progress.onTrack).length,
  );
  protected readonly closedCount = computed(() => this.goals().filter((g) => g.status === 'closed').length);
  protected readonly activeCount = computed(
    () => this.goals().filter((g) => g.status !== 'closed' && !g.progress.complete).length,
  );
  protected readonly onTrackCount = computed(
    () => this.goals().filter((g) => g.status !== 'closed' && !g.progress.complete && g.progress.onTrack).length,
  );

  protected readonly filtered = computed(() => {
    const f = this.filter();
    return this.goals().filter((g) => {
      if (f === 'active') return g.status !== 'closed' && !g.progress.complete;
      if (f === 'behind') return g.status !== 'closed' && !g.progress.complete && !g.progress.onTrack;
      if (f === 'complete') return g.progress.complete;
      if (f === 'closed') return g.status === 'closed';
      return true;
    });
  });

  /** Sales trend chart — rebuilt on data or light/dark toggle. */
  protected readonly trendsChart = computed<EChartsCoreOption | null>(() => {
    const buckets = this.trends();
    if (buckets.length === 0) return null;
    const p = this.charts.palette();
    const ax = this.charts.axis();
    return {
      ...this.charts.base(),
      tooltip: { trigger: 'axis', valueFormatter: (v: number | string) => `${v}` },
      grid: { left: 48, right: 12, top: 24, bottom: 28 },
      xAxis: { type: 'category', data: buckets.map((b) => b.label), ...ax },
      yAxis: { type: 'value', ...ax },
      series: [
        {
          type: 'bar',
          data: buckets.map((b) => b.total),
          itemStyle: { color: p.gold, borderRadius: [6, 6, 0, 0] },
          emphasis: { itemStyle: { color: p.info } },
        },
      ],
    };
  });

  protected readonly form = this.fb.nonNullable.group({
    title: [''],
    kind: ['sales' as GoalKind, Validators.required],
    target: [100, [Validators.required, Validators.min(1)]],
    startDate: [new Date(), Validators.required],
    endDate: [new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), Validators.required],
  });

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ goals: this.goalsApi.mine(), trends: this.goalsApi.trends() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ goals, trends }) => {
          this.goals.set(goals.data ?? []);
          this.trends.set(trends.data?.buckets ?? []);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected toggleForm(): void {
    const opening = !this.showForm();
    this.showForm.set(opening);
    this.formError.set(null);
    if (opening) this.cancelEdit();
    else { this.editingId.set(null); }
  }

  protected startEdit(goal: Goal): void {
    this.form.reset({
      title: goal.title ?? '',
      kind: goal.kind,
      target: goal.target,
      startDate: new Date(goal.startDate),
      endDate: new Date(goal.endDate),
    });
    this.editingId.set(goal.id);
    this.showForm.set(true);
    this.formError.set(null);
    this.confirmDeleteId.set(null);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset({
      title: '',
      kind: 'sales' as GoalKind,
      target: 100,
      startDate: new Date(),
      endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
    });
  }

  protected save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.formError.set(null);
    const v = this.form.getRawValue();
    const payload = {
      title: v.title.trim(),
      kind: v.kind,
      target: Number(v.target),
      startDate: toInputDate(v.startDate),
      endDate: toInputDate(v.endDate),
    };
    const editing = this.editingId();
    const request = editing
      ? this.goalsApi.update(editing, payload)
      : this.goalsApi.create(payload);
    request
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showForm.set(false);
          this.editingId.set(null);
          this.reload();
        },
        error: (err: ApiError) => {
          this.saving.set(false);
          this.formError.set(err.message);
        },
      });
  }

  /** Copy a goal into its next period (same length, starts the day after it ends). */
  protected duplicate(goal: Goal): void {
    if (this.saving() || this.actingId()) return;
    this.actingId.set(goal.id);
    const start = new Date(goal.startDate).getTime();
    const end = new Date(goal.endDate).getTime();
    const length = Math.max(86400000, end - start);
    const nextStart = new Date(end + 86400000);
    const nextEnd = new Date(end + 86400000 + length);
    this.goalsApi
      .create({
        title: `${goal.title || this.kindLabel(goal.kind)} — next`.slice(0, 120),
        kind: goal.kind,
        target: goal.target,
        startDate: toInputDate(nextStart),
        endDate: toInputDate(nextEnd),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.reload();
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(err.message);
        },
      });
  }

  /** Manual done — closes tracking (auto Complete stays derived). */
  protected closeGoal(goal: Goal): void {
    if (this.actingId()) return;
    this.actingId.set(goal.id);
    this.goalsApi
      .update(goal.id, { status: 'closed' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.reload();
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(err.message);
        },
      });
  }

  protected celebrate(goal: Goal): void {
    if (this.actingId()) return;
    this.actingId.set(goal.id);
    this.error.set(null);
    this.notice.set(null);
    this.goalsApi
      .celebrate(goal.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          this.actingId.set(null);
          this.notice.set(res?.data?.duplicate ? 'Already shared in the community.' : 'Shared in the community — congratulations.');
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(err.message);
        },
      });
  }

  protected reopen(goal: Goal): void {
    if (this.actingId()) return;
    this.actingId.set(goal.id);
    this.goalsApi
      .update(goal.id, { status: 'active' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.reload();
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(err.message);
        },
      });
  }

  protected remove(id: string): void {
    this.deletingId.set(id);
    this.goalsApi
      .remove(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletingId.set(null);
          this.confirmDeleteId.set(null);
          this.goals.set(this.goals().filter((g) => g.id !== id));
        },
        error: (err: ApiError) => {
          this.deletingId.set(null);
          this.confirmDeleteId.set(null);
          this.error.set(err.message);
        },
      });
  }

  protected kindLabel(kind: GoalKind): string {
    return GOAL_KIND_LABELS[kind] ?? kind;
  }

  protected kindIcon(kind: GoalKind): string {
    switch (kind) {
      case 'sales': return 'storefront';
      case 'sales_orders': return 'shopping_bag';
      case 'team_volume': return 'groups';
      case 'team_orders': return 'receipt_long';
      case 'active_team': return 'bolt';
      case 'recruitment': return 'person_add';
      case 'team_recruitment': return 'group_add';
      case 'conversion': return 'conversion_path';
      case 'new_prospects': return 'person_search';
      case 'follow_ups': return 'forum';
      case 'training': return 'school';
      default: return 'flag';
    }
  }

  protected kindHint(kind: GoalKind): string {
    switch (kind) {
      case 'sales': return 'live personal order volume in naira.';
      case 'sales_orders': return 'count of your own completed orders.';
      case 'team_volume': return 'order volume across your downline.';
      case 'team_orders': return 'orders placed anywhere in your team.';
      case 'active_team': return 'team members with at least one order in the window.';
      case 'recruitment': return 'partners who joined directly under you.';
      case 'team_recruitment': return 'new partners placed anywhere in your downline.';
      case 'conversion': return 'prospects moved to Converted in your pipeline.';
      case 'new_prospects': return 'new prospects added to your pipeline.';
      case 'follow_ups': return 'prospects with at least one logged follow-up.';
      case 'training': return 'confirmed IPO, QSG and SMO stamps.';
      default: return '';
    }
  }

  protected unit(kind: GoalKind): string {
    return UNIT_LABELS[kind] ?? '';
  }

  protected statusTone(goal: Goal): 'ok' | 'info' | 'bad' | 'neutral' {
    if (goal.status === 'closed' || goal.progress.daysLeft === 0) return 'neutral';
    if (goal.progress.complete) return 'ok';
    return goal.progress.onTrack ? 'info' : 'bad';
  }

  protected status(goal: Goal): { label: string; color: string; text: string } {
    if (goal.status === 'closed') return { label: 'Closed', color: '#e0e0e0', text: '#424242' };
    if (goal.progress.complete) return { label: 'Complete', color: '#c8e6c9', text: '#1b5e20' };
    if (goal.progress.daysLeft === 0) return { label: 'Ended', color: '#e0e0e0', text: '#424242' };
    return goal.progress.onTrack
      ? { label: 'On track', color: '#bbdefb', text: '#0d47a1' }
      : { label: 'Behind pace', color: '#ffcdd2', text: '#b71c1c' };
  }

  /** Plain-span status pill — mat-chip repaints internals from theme tokens. */
  protected statusClass(goal: Goal): string {
    if (goal.status === 'closed' || goal.progress.daysLeft === 0) return 'dp-status dp-status--neutral';
    if (goal.progress.complete) return 'dp-status dp-status--ok';
    return goal.progress.onTrack ? 'dp-status dp-status--info' : 'dp-status dp-status--bad';
  }

  /** Where the work for this goal kind actually happens. */
  protected nextMove(goal: Goal): { label: string; link: string } {
    switch (goal.kind) {
      case 'recruitment':
      case 'team_recruitment':
        return { label: 'Invite & promote', link: '/dashboard/promote' };
      case 'conversion':
      case 'new_prospects':
      case 'follow_ups':
        return { label: 'Open pipeline', link: '/dashboard/prospects/pipeline' };
      case 'team_volume':
      case 'team_orders':
      case 'active_team':
        return { label: 'Open activation board', link: '/dashboard/mentorship/team/activation' };
      case 'training':
        return { label: 'Open training', link: '/dashboard/training' };
      case 'sales':
      case 'sales_orders':
      default:
        return { label: 'Open shop', link: '/dashboard/products' };
    }
  }
}
