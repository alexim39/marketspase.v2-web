import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { ProgressionService } from '../../../core/progression/progression.service';
import { APP_RANKS, AppRank, Journey, appRankIndex } from '../../../core/progression/progression.models';
import { GoalService } from '../../../core/goals/goal.service';
import { Goal, GOAL_KIND_LABELS } from '../../../core/goals/goal.models';
import { TrainingService } from '../../../core/training/training.service';
import { CourseSummary } from '../../../core/training/training.models';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError, userError } from '../../../core/http/api-error';

/**
 * Learn hub — four-rank progress, course progress and goals in one
 * landing. Reads existing progression/goals/training endpoints.
 */
@Component({
  selector: 'async-learn-hub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    PageSkeletonComponent,
    RouterModule,
  ],
  template: `
    <section class="learn-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Learn · Level up</p>
          <h1>Your next step is clear</h1>
          <p class="muted">Rank progress, courses and goals — the shortest path to your next rank.</p>
        </div>
        <div class="head-actions">
          <a mat-flat-button color="primary" routerLink="/dashboard/training">Academy</a>
          <a mat-stroked-button routerLink="/dashboard/progress">My level</a>
        </div>
      </header>

      @if (loading()) {
        <async-page-skeleton layout="dashboard" [rows]="3" label="your learning plan" [showHeader]="false" />
      }

      @if (error(); as err) {
        <div class="alert" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>{{ err }}</p>
          <button mat-button type="button" (click)="reload()">Retry</button>
        </div>
      }

      <div class="metrics">
        <div class="metric">
          <span>Current rank</span>
          <strong class="metric-text">{{ currentRank() }}</strong>
          <a routerLink="/dashboard/progress">View progress</a>
        </div>
        <div class="metric">
          <span>Next rank</span>
          <strong class="metric-text">{{ nextRank()?.label ?? 'Top rank' }}</strong>
          <span class="metric-note">{{ coreTrainingCount() }}/4 core trainings recorded</span>
        </div>
        <div class="metric">
          <span>Core training</span>
          <strong>{{ coreTrainingCount() }}/4</strong>
          <span class="metric-note">Recorded automatically</span>
        </div>
        <div class="metric metric--attention">
          <span>Courses in progress</span>
          <strong>{{ coursesInProgress() }}</strong>
          <a routerLink="/dashboard/training/courses">Continue</a>
        </div>
      </div>

      <div class="columns">
        <div class="main">
          <!-- Continue learning -->
          <div class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Academy</p>
                <h2>Continue learning</h2>
              </div>
              <a mat-button routerLink="/dashboard/training/courses">All courses</a>
            </div>

            @if (continueCourses().length === 0) {
              <div class="empty">
                <mat-icon>school</mat-icon>
                <p>No course progress yet. Start with the fundamentals and unlock your next rank.</p>
                <a mat-flat-button color="primary" routerLink="/dashboard/training/courses">Browse courses</a>
              </div>
            } @else {
              <ul class="course-list">
                @for (course of continueCourses(); track course.id) {
                  <li>
                    <div class="course-main">
                      <strong>{{ course.title }}</strong>
                      <span class="muted">{{ course.done }} of {{ course.total }} lessons · {{ course.percent }}%</span>
                      <mat-progress-bar mode="determinate" [value]="course.percent" [attr.aria-label]="'Course progress: ' + course.title" />
                    </div>
                    @if (course.certified) {
                      <span class="pill pill--ok">Certified</span>
                    } @else if (course.percent > 0) {
                      <span class="pill">In progress</span>
                    } @else {
                      <span class="pill pill--muted">Not started</span>
                    }
                    <a mat-button [routerLink]="['training/courses', course.id]">{{ course.percent > 0 ? 'Resume' : 'Start' }}</a>
                  </li>
                }
              </ul>
            }
          </div>

          <!-- Goals -->
          <div class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Targets</p>
                <h2>Goals in flight</h2>
              </div>
              <a mat-button routerLink="/dashboard/goals">Manage goals</a>
            </div>

            @if (activeGoals().length === 0) {
              <div class="empty">
                <mat-icon>flag</mat-icon>
                <p>No active goals. Set one target and give your week a finish line.</p>
                <a mat-flat-button color="primary" routerLink="/dashboard/goals">Set a goal</a>
              </div>
            } @else {
              <ul class="goal-list">
                @for (goal of activeGoals(); track goal.id) {
                  <li>
                    <div class="goal-main">
                      <strong>{{ goal.title }}</strong>
                      <span class="muted">{{ kindLabel(goal) }} · {{ goal.progress.current | number }}/{{ goal.target | number }} · {{ goal.progress.daysLeft }}d left</span>
                      <mat-progress-bar mode="determinate" [value]="goal.progress.percent" [attr.aria-label]="'Goal progress: ' + goal.title" />
                    </div>
                    <span class="pill" [class.pill--ok]="goal.progress.onTrack" [class.pill--warn]="!goal.progress.onTrack">
                      {{ goal.progress.onTrack ? 'On track' : 'Behind' }}
                    </span>
                  </li>
                }
              </ul>
              <p class="goal-foot muted">{{ goalsOnTrack() }} of {{ activeGoals().length }} active goals on track.</p>
            }
          </div>
        </div>

        <aside class="side">
          <!-- Next rank -->
          <div class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Next rank</p>
                <h2>{{ nextRank()?.label ?? 'Top rank' }}</h2>
              </div>
            </div>
            @if (nextRank(); as next) {
              <ul class="missing-list">
                @for (criterion of next.criteria; track criterion) {
                  <li>{{ criterion }}</li>
                }
              </ul>
            } @else {
              <p class="muted ready">You are at the top rank — keep leading.</p>
            }
            <a mat-button routerLink="/dashboard/progress">See full progress</a>
          </div>

          <!-- Shortcuts -->
          <div class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Shortcuts</p>
                <h2>Learn your way</h2>
              </div>
            </div>
            <div class="quick-grid">
              <a routerLink="/dashboard/training"><mat-icon>school</mat-icon><span>Academy dashboard</span></a>
              <a routerLink="/dashboard/training/library"><mat-icon>local_library</mat-icon><span>Library</span></a>
              <a routerLink="/dashboard/training/tutorials"><mat-icon>smart_display</mat-icon><span>Tutorials</span></a>
              <a routerLink="/dashboard/training/analytics"><mat-icon>insights</mat-icon><span>Analytics</span></a>
            </div>
          </div>
        </aside>
      </div>
    </section>
  `,
  styles: [`
    .learn-page { max-width: 1180px; margin: 0 auto; padding: 24px 0 48px; display: flex; flex-direction: column; gap: 16px; }
    .page-head { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(1.7rem, 3vw, 2.4rem); line-height: 1.1; letter-spacing: -0.03em; }
    .page-head p { margin: 0; line-height: 1.55; max-width: 620px; }
    .head-actions { display: flex; gap: 8px; flex-wrap: wrap; flex: none; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
    .muted { color: var(--ms-text-muted); }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
    .metric { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; }
    .metric > span:first-child { color: var(--ms-text-muted); font-size: 0.72em; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .metric strong { font-size: 1.6em; font-variant-numeric: tabular-nums; line-height: 1.15; }
    .metric-text { font-size: 1.15em; padding-top: 0.3em; }
    .metric a { font-size: 0.8em; font-weight: 700; color: var(--ms-primary-strong); text-decoration: none; margin-top: 2px; }
    .metric a:hover { text-decoration: underline; }
    .metric-note { font-size: 0.8em; color: var(--ms-text-muted); }
    .metric--attention { border-left: 4px solid var(--ms-primary); }
    .columns { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr); gap: 16px; align-items: start; }
    .main, .side { display: flex; flex-direction: column; gap: 16px; }
    .panel { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); padding: 18px; box-shadow: var(--ms-shadow-sm); }
    .panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .panel-head h2 { margin: 4px 0 0; font-size: 1.15rem; }
    .score { border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); padding: 5px 12px; font-size: 0.9rem; font-weight: 800; }
    .course-list, .goal-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .course-list li, .goal-list li { display: flex; align-items: center; gap: 12px; padding: 12px 2px; border-top: 1px solid var(--ms-line); }
    .course-list li:first-child, .goal-list li:first-child { border-top: none; }
    .course-main, .goal-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .course-main strong, .goal-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .course-main span, .goal-main span { font-size: 0.82em; }
    .course-main mat-progress-bar, .goal-main mat-progress-bar { margin-top: 2px; border-radius: 999px; }
    .course-list a { flex: none; min-height: 40px; }
    .pill { flex: none; border-radius: 999px; background: var(--ms-info-soft); color: var(--ms-info); font-size: 0.72em; font-weight: 800; padding: 4px 8px; white-space: nowrap; }
    .pill--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .pill--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .pill--muted { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .goal-foot { margin: 0.6em 0 0; font-size: 0.85em; }
    .missing-list { list-style: none; margin: 12px 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .missing-list li { display: flex; flex-direction: column; gap: 1px; padding: 8px 10px; border-radius: var(--ms-radius-sm); background: var(--ms-canvas); font-size: 0.88em; font-weight: 600; }
    .missing-list span { font-weight: 400; font-size: 0.92em; }
    .ready { margin: 12px 0; }
    .quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .quick-grid a { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); color: var(--ms-text); text-decoration: none; font-size: 0.85em; font-weight: 600; min-height: 74px; }
    .quick-grid a:hover { background: var(--ms-primary-soft); }
    .quick-grid mat-icon { color: var(--ms-primary-strong); }
    .empty { display: grid; place-items: center; gap: 8px; padding: 30px 16px; color: var(--ms-text-muted); text-align: center; }
    .empty mat-icon { font-size: 38px; width: 38px; height: 38px; }
    .empty p { margin: 0; line-height: 1.5; }
    .alert { display: flex; gap: 10px; align-items: center; padding: 12px 14px; border-radius: var(--ms-radius-md); background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { margin: 0; flex: 1; line-height: 1.5; }
    @media (max-width: 900px) {
      .page-head { flex-direction: column; }
      .columns { grid-template-columns: 1fr; }
    }
  `],
})
export class LearnHubComponent implements OnInit {
  private readonly progression = inject(ProgressionService);
  private readonly auth = inject(AuthService);
  private readonly goalsSvc = inject(GoalService);
  private readonly training = inject(TrainingService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly journey = signal<Journey | null>(null);
  protected readonly goals = signal<Goal[]>([]);
  protected readonly courses = signal<CourseSummary[]>([]);

  protected readonly currentRank = computed<AppRank>(() =>
    ((this.journey()?.levelLabel ?? this.auth.currentUser()?.commissionRank) as AppRank | undefined) ?? 'Partner');
  protected readonly currentRankIndex = computed(() => appRankIndex(this.currentRank()));
  protected readonly nextRank = computed(() => {
    const label = this.journey()?.nextLabel as AppRank | null | undefined;
    if (label) return APP_RANKS.find((r) => r.rank === label) ?? null;
    return APP_RANKS[this.currentRankIndex() + 1] ?? null;
  });
  protected readonly coreTrainingCount = computed(() => {
    const miles = (this.journey()?.milestones ?? {}) as Record<string, { done?: boolean }>;
    return ['ipo', 'qsg', 'smo', 'leadership'].filter((key) => miles?.[key]?.done === true).length;
  });

  protected readonly coursesInProgress = computed(() =>
    this.courses().filter((c) => c.percent > 0 && c.percent < 100).length);

  protected readonly activeGoals = computed(() =>
    this.goals()
      .filter((g) => g.status !== 'closed' && !g.progress?.complete)
      .slice(0, 3));

  protected readonly goalsOnTrack = computed(() =>
    this.activeGoals().filter((g) => g.progress?.onTrack).length);

  protected readonly continueCourses = computed(() => {
    const list = [...this.courses()];
    const rank = (c: CourseSummary): number => c.percent > 0 && c.percent < 100 ? 0 : c.percent >= 100 ? 2 : 1;
    return list
      .sort((a, b) => rank(a) - rank(b) || b.percent - a.percent)
      .slice(0, 4);
  });

  ngOnInit(): void {
    this.reload();
  }

  protected kindLabel(goal: Goal): string {
    return GOAL_KIND_LABELS[goal.kind] ?? 'Goal';
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      journey: this.progression.mine().pipe(catchError(() => of(null))),
      goals: this.goalsSvc.mine().pipe(catchError(() => of(null))),
      courses: this.training.courses().pipe(catchError(() => of(null))),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: ({ journey, goals, courses }) => {
        this.journey.set(journey?.data ?? null);
        this.goals.set(goals?.data ?? []);
        this.courses.set(courses?.data ?? []);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }
}
