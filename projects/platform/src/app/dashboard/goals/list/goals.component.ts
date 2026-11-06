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
import { ChartThemeService } from '../../../core/charts/chart-theme.service';
import type { EChartsCoreOption } from '../../../core/charts/echarts-setup';
import { forkJoin } from 'rxjs';
import { GoalService } from '../../../core/goals/goal.service';
import { GOAL_KIND_LABELS, Goal, GoalKind, TrendBucket } from '../../../core/goals/goal.models';
import { ApiError } from '../../../core/http/api-error';

const UNIT_LABELS: Record<GoalKind, string> = {
  sales: 'sales volume',
  recruitment: 'recruits',
  team_volume: 'team volume',
  conversion: 'conversions',
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
    ReactiveFormsModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>My Goals</span>
      </div>
    </section>

    <section class="goals-page">
      <div class="page-head">
        <div>
          <h2>My Goals</h2>
          <p class="subtitle">
            @if (completeCount() > 0) {
              <strong class="done">{{ completeCount() }} complete.</strong>
            }
            @if (behindCount() > 0) {
              <strong class="behind">{{ behindCount() }} behind pace.</strong>
            }
            @if (closedCount() > 0) {
              <span class="muted">{{ closedCount() }} closed.</span>
            }
            @if (completeCount() === 0 && behindCount() === 0 && closedCount() === 0 && !loading()) {
              Set a target below to start tracking.
            }
          </p>
        </div>
        <button mat-button (click)="toggleForm()">{{ showForm() ? 'Cancel' : 'New goal' }}</button>
      </div>

      @if (goals().length > 0) {
        <div class="filter-row" role="radiogroup" aria-label="Goal filter">
          <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'all'" [attr.aria-pressed]="filter() === 'all'" (click)="filter.set('all')">All</button>
          <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'active'" [attr.aria-pressed]="filter() === 'active'" (click)="filter.set('active')">Active</button>
          <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'behind'" [attr.aria-pressed]="filter() === 'behind'" (click)="filter.set('behind')">Behind</button>
          <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'complete'" [attr.aria-pressed]="filter() === 'complete'" (click)="filter.set('complete')">Complete</button>
          <button type="button" class="filter-btn" [class.filter-btn--active]="filter() === 'closed'" [attr.aria-pressed]="filter() === 'closed'" (click)="filter.set('closed')">Closed</button>
        </div>
      }

      @if (showForm()) {
        <form class="goal-form" [formGroup]="form" (ngSubmit)="save()">
          <h3 class="form-title">{{ editingId() ? 'Edit goal' : 'New goal' }}</h3>
          <mat-form-field appearance="outline">
            <mat-label>Title</mat-label>
            <input matInput formControlName="title" placeholder="e.g. September sales push" maxlength="120" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Goal type</mat-label>
            <mat-select formControlName="kind">
              @for (k of kinds; track k) {
                <mat-option [value]="k">{{ kindLabel(k) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Target</mat-label>
            <input matInput type="number" min="1" formControlName="target" />
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
          <div class="form-actions">
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving()">
              {{ saving() ? 'Saving…' : (editingId() ? 'Save changes' : 'Save goal') }}
            </button>
            @if (editingId()) {
              <button mat-button type="button" (click)="cancelEdit()" [disabled]="saving()">Cancel</button>
            }
            @if (formError(); as err) {
              <span class="error" role="alert">{{ err }}</span>
            }
          </div>
        </form>
      }

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (notice(); as note) {
        <p class="notice" role="status">{{ note }}</p>
      }

      @if (filtered().length > 0) {
        <ul class="goal-list">
          @for (goal of filtered(); track goal.id) {
            <li class="goal-card" [class.goal-card--complete]="goal.progress.complete" [class.goal-card--closed]="goal.status === 'closed'">
              <div class="goal-top">
                <div>
                  <strong>{{ goal.title }}</strong>
                  <span class="muted"> · {{ kindLabel(goal.kind) }}</span>
                </div>
                <span [class]="statusClass(goal)"
                >{{ status(goal).label }}</span>
              </div>
              <mat-progress-bar mode="determinate" [value]="goal.progress.percent" aria-label="Progress" />
              <div class="goal-meta">
                <span>{{ goal.progress.current | number }} / {{ goal.target | number }} {{ unit(goal.kind) }}</span>
                <span class="muted">{{ goal.progress.daysLeft }} days left</span>
                @if (!goal.progress.complete && goal.status !== 'closed') {
                  @if (goal.progress.forecast.willHit && goal.progress.forecast.etaDate) {
                    <span class="forecast-ok">On pace · ~{{ goal.progress.forecast.projected | number }} by {{ goal.progress.forecast.etaDate | date:'mediumDate' }}</span>
                  } @else if (goal.progress.forecast.requiredDaily !== null) {
                    <span class="forecast-warn">Needs {{ goal.progress.forecast.requiredDaily | number }}/day · short {{ goal.progress.forecast.shortfall | number }}</span>
                  } @else {
                    <span class="forecast-warn">Out of time · short {{ goal.progress.forecast.shortfall | number }}</span>
                  }
                }
                @if (goal.status === 'closed') {
                  <span class="muted">Closed — reopen to track again.</span>
                }
              </div>
              <div class="goal-actions">
                <a mat-button [routerLink]="nextMove(goal).link">{{ nextMove(goal).label }}</a>
                <span class="spacer"></span>
                @if (goal.progress.complete && goal.status !== 'closed') {
                  <button mat-button color="primary" (click)="celebrate(goal)" [disabled]="actingId() === goal.id">
                    {{ actingId() === goal.id ? 'Sharing…' : 'Celebrate' }}
                  </button>
                }
                @if (goal.status !== 'closed' && !goal.progress.complete) {
                  <button mat-button (click)="startEdit(goal)" [disabled]="saving() || actingId() === goal.id">Edit</button>
                  <button mat-button (click)="duplicate(goal)" [disabled]="saving() || actingId() === goal.id">Duplicate</button>
                  <button mat-button (click)="closeGoal(goal)" [disabled]="actingId() === goal.id">
                    {{ actingId() === goal.id ? 'Saving…' : 'Mark done' }}
                  </button>
                } @else if (goal.status === 'closed') {
                  <button mat-button (click)="reopen(goal)" [disabled]="actingId() === goal.id">
                    {{ actingId() === goal.id ? 'Saving…' : 'Reopen' }}
                  </button>
                }
                @if (confirmDeleteId() === goal.id) {
                  <span class="delete-confirm" role="alertdialog" aria-label="Confirm goal deletion">
                    <strong>Delete?</strong> This cannot be undone.
                    <button mat-button (click)="confirmDeleteId.set(null)" [disabled]="deletingId() === goal.id">Keep</button>
                    <button mat-button color="warn" (click)="remove(goal.id)" [disabled]="deletingId() === goal.id">
                      {{ deletingId() === goal.id ? 'Deleting…' : 'Yes, delete' }}
                    </button>
                  </span>
                } @else {
                  <button
                    mat-button
                    color="warn"
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
          <p class="empty">No goals yet — create your first one above.</p>
        } @else {
          <p class="empty">No goals match — <button mat-button (click)="filter.set('all')">show all</button></p>
        }
      }

      @if (trendsChart(); as chart) {
        <div class="trends">
          <h3>Sales trend — last {{ trends().length }} months</h3>
          <div echarts [options]="chart" class="chart" role="img" aria-label="Monthly personal sales volume chart"></div>
        </div>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .goals-page { display: flex; flex-direction: column; gap: 1.25em; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); }
    .done { color: var(--ms-success); }
    .behind { color: var(--ms-error); }
    .goal-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75em; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 10px; padding: 1em; }
    .form-title { margin: 0; font-size: 1em; grid-column: 1 / -1; }
    .form-actions { display: flex; align-items: center; gap: 0.75em; flex-wrap: wrap; grid-column: 1 / -1; }
    .form-actions button { min-height: 44px; }
    .filter-row { display: flex; gap: 0.4em; flex-wrap: wrap; }
    .filter-btn { border: 1px solid var(--ms-line); background: transparent; border-radius: 999px; padding: 0.5em 1em; min-height: 44px; cursor: pointer; color: inherit; font: inherit; font-size: 0.85rem; }
    .filter-btn--active { border-color: var(--ms-primary); background: var(--ms-primary-soft); font-weight: 700; }
    .goal-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75em; }
    .goal-card { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 10px; padding: 0.9em 1em; display: flex; flex-direction: column; gap: 0.6em; }
    .goal-card--complete { border-left: 4px solid var(--ms-success); }
    .goal-card--closed { opacity: 0.75; border-left: 4px solid var(--ms-line); }
    .goal-top { display: flex; justify-content: space-between; align-items: center; gap: 0.6em; flex-wrap: wrap; }
    .goal-meta { display: flex; align-items: center; gap: 1em; flex-wrap: wrap; font-size: 0.9em; }
    .goal-actions { display: flex; align-items: center; gap: 0.4em; flex-wrap: wrap; border-top: 1px solid var(--ms-line); padding-top: 0.5em; }
    .goal-actions a, .goal-actions button { min-height: 44px; }
    .goal-actions .spacer { flex: 1; }
    .delete-confirm { display: inline-flex; align-items: center; gap: 0.4em; flex-wrap: wrap; font-size: 0.85em; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .forecast-ok { color: var(--ms-success); font-size: 0.85em; font-weight: 600; }
    .forecast-warn { color: var(--ms-error); font-size: 0.85em; font-weight: 600; }
    .error { color: var(--ms-error); }
    .notice { color: var(--ms-success); }
    .empty { color: var(--ms-text-muted); }
    .trends { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 10px; padding: 1em; }
    .trends h3 { margin: 0 0 0.75em; font-size: 1em; }
    .chart { height: 260px; width: 100%; }
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

  protected readonly kinds: GoalKind[] = ['sales', 'recruitment', 'team_volume', 'conversion'];

  protected readonly completeCount = computed(() => this.goals().filter((g) => g.progress.complete).length);
  protected readonly behindCount = computed(
    () => this.goals().filter((g) => g.status !== 'closed' && !g.progress.complete && !g.progress.onTrack).length,
  );
  protected readonly closedCount = computed(() => this.goals().filter((g) => g.status === 'closed').length);

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

  protected unit(kind: GoalKind): string {
    return UNIT_LABELS[kind] ?? '';
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
        return { label: 'Open pipeline', link: '/dashboard/prospects/pipeline' };
      case 'conversion':
        return { label: 'Work pipeline', link: '/dashboard/prospects/pipeline' };
      case 'team_volume':
        return { label: 'Open activation board', link: '/dashboard/mentorship/team/activation' };
      case 'sales':
      default:
        return { label: 'Open shop', link: '/dashboard/products' };
    }
  }
}
