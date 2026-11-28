import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { ProgressionService } from '../../../../core/progression/progression.service';
import { APP_RANKS, AppRank, Journey, appRankIndex } from '../../../../core/progression/progression.models';
import { GoalService } from '../../../../core/goals/goal.service';
import { Goal } from '../../../../core/goals/goal.models';
import { TrainingService } from '../../../../core/training/training.service';
import { CourseSummary } from '../../../../core/training/training.models';
import { WeeklyVideoService } from '../../../../core/weekly-video/weekly-video.service';
import { CurrentWeeklyVideo } from '../../../../core/weekly-video/weekly-video.models';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApiError, userError } from '../../../../core/http/api-error';
import { WeeklyVideoCardComponent } from './weekly-video-card.component';
import { LearnCourseCardComponent } from './course-card.component';
import { LearnGoalCardComponent } from './goal-card.component';

interface Shortcut {
  label: string;
  icon: string;
  link: string;
}

/** Native mobile learning hub: weekly briefing, rank journey, courses and goals. */
@Component({
  selector: 'async-learn-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LearnCourseCardComponent, LearnGoalCardComponent, MatButtonModule, MatIconModule,
    PageSkeletonComponent, RouterModule, WeeklyVideoCardComponent,
  ],
  template: `
    <section class="learn-page">
      <header class="learn-hero">
        <div class="hero-top">
          <a mat-icon-button routerLink="/dashboard" aria-label="Back to dashboard">
            <mat-icon>arrow_back</mat-icon>
          </a>
          <div class="hero-title">
            <p class="eyebrow">Academy · Learn</p>
            <h1>Your next step is clear</h1>
          </div>
          <button mat-icon-button type="button" (click)="reload()" [disabled]="loading()" aria-label="Refresh learning hub">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
        <p class="hero-lede">Rank progress, courses and goals — the shortest path to your next rank.</p>
        <div class="hero-actions">
          <a mat-flat-button color="primary" routerLink="/dashboard/training"><mat-icon>school</mat-icon> Academy</a>
          <a mat-stroked-button routerLink="/dashboard/progress"><mat-icon>trending_up</mat-icon> My level</a>
        </div>
      </header>

      @if (initialLoading()) {
        <async-page-skeleton layout="cards" [rows]="4" label="your learning plan" [showHeader]="false" />
      }

      @if (loading() && loadedOnce()) {
        <div class="loading-strip" role="status" aria-label="Updating learning hub"></div>
      }

      @if (error(); as err) {
        <div class="alert" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>{{ err }}</p>
          <button mat-stroked-button type="button" (click)="reload()">Retry</button>
        </div>
      }

      @if (weeklyVideo(); as weekly) {
        @if (weekly.video; as video) {
          <async-weekly-video-card [weekly]="weekly" [video]="video" />
        }
      }

      <section class="journey-card" aria-label="Rank journey">
        <div class="section-head">
          <div>
            <p class="eyebrow">Rank journey</p>
            <h2>{{ currentRank() }} <span>→ {{ nextRank()?.label ?? 'Top rank' }}</span></h2>
          </div>
          <a mat-button routerLink="/dashboard/progress">Full progress</a>
        </div>

        <div class="rank-track" role="list" aria-label="Rank path">
          @for (rank of ranks; track rank.rank; let i = $index) {
            <span class="rank-step" role="listitem" [class.is-done]="i < currentRankIndex()" [class.is-current]="i === currentRankIndex()">
              <span class="rank-node">
                @if (i < currentRankIndex()) { <mat-icon>check</mat-icon> } @else { {{ i + 1 }} }
              </span>
              <span class="rank-name">{{ rank.label }}</span>
            </span>
          }
        </div>

        <div class="rank-meter" role="progressbar" [attr.aria-valuenow]="rankPercent()" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="'Rank progress: ' + rankPercent() + '%'">
          <span [style.width.%]="rankPercent()"></span>
        </div>
        <div class="rank-meter-label"><span>Rank progress</span><strong>{{ rankPercent() }}%</strong></div>

        @if (nextRank(); as next) {
          <div class="next-steps">
            <div class="next-steps-head">
              <span>What’s left for {{ next.label }}</span>
              <strong>{{ nextSteps().length }} step{{ nextSteps().length === 1 ? '' : 's' }}</strong>
            </div>
            <ul>
              @for (step of nextSteps(); track step) {
                <li><mat-icon aria-hidden="true">radio_button_unchecked</mat-icon><span>{{ step }}</span></li>
              } @empty {
                <li class="ready"><mat-icon aria-hidden="true">check_circle</mat-icon><span>You’re on track for this rank.</span></li>
              }
            </ul>
          </div>
        } @else {
          <p class="top-rank"><mat-icon aria-hidden="true">workspace_premium</mat-icon> You are at the top rank — keep leading.</p>
        }
      </section>

      <section class="pulse" aria-label="Learning pulse">
        <div class="section-head">
          <div>
            <p class="eyebrow">At a glance</p>
            <h2>Learning pulse</h2>
          </div>
        </div>
        <div class="pulse-grid">
          <a class="pulse-tile" routerLink="/dashboard/training">
            <span class="pulse-icon"><mat-icon aria-hidden="true">verified</mat-icon></span>
            <strong>{{ coreTrainingCount() }}/4</strong>
            <span>Core trainings</span>
            <span class="pulse-dots" aria-hidden="true">
              @for (n of [1, 2, 3, 4]; track n) {
                <span class="pulse-dot" [class.is-on]="n <= coreTrainingCount()"></span>
              }
            </span>
            <span class="pulse-action">Open academy <mat-icon aria-hidden="true">arrow_forward</mat-icon></span>
          </a>

          <a class="pulse-tile" routerLink="/dashboard/training/courses">
            <span class="pulse-icon pulse-icon--info"><mat-icon aria-hidden="true">menu_book</mat-icon></span>
            <strong>{{ coursesInProgress() }}</strong>
            <span>Courses in progress</span>
            <span class="pulse-note">{{ certifiedCourses() }} certified</span>
            <span class="pulse-action">Continue <mat-icon aria-hidden="true">arrow_forward</mat-icon></span>
          </a>

          <a class="pulse-tile" routerLink="/dashboard/goals">
            <span class="pulse-icon pulse-icon--ok"><mat-icon aria-hidden="true">flag</mat-icon></span>
            <strong>{{ activeGoals().length === 0 ? '—' : goalsOnTrack() + '/' + activeGoals().length }}</strong>
            <span>Goals on track</span>
            <span class="pulse-note">{{ activeGoals().length === 0 ? 'No active goals' : activeGoals().length + ' in flight' }}</span>
            <span class="pulse-action">Manage goals <mat-icon aria-hidden="true">arrow_forward</mat-icon></span>
          </a>

          <a class="pulse-tile" routerLink="/dashboard/learn/video-of-the-week">
            <span class="pulse-icon pulse-icon--warn"><mat-icon aria-hidden="true">local_fire_department</mat-icon></span>
            <strong>{{ weeklyStreak() }}</strong>
            <span>Week streak</span>
            <span class="pulse-note">{{ weeklyStreak() === 0 ? 'Start this week' : 'Keep it going' }}</span>
            <span class="pulse-action">Weekly briefing <mat-icon aria-hidden="true">arrow_forward</mat-icon></span>
          </a>
        </div>
      </section>

      <section class="courses" aria-label="Continue learning">
        <div class="section-head">
          <div>
            <p class="eyebrow">Academy</p>
            <h2>Continue learning</h2>
          </div>
          <a mat-button routerLink="/dashboard/training/courses">All courses</a>
        </div>

        @if (continueCourses().length === 0) {
          <div class="empty-card">
            <span class="empty-icon"><mat-icon>school</mat-icon></span>
            <strong>No course progress yet</strong>
            <p>Start with the fundamentals and unlock your next rank.</p>
            <a mat-flat-button color="primary" routerLink="/dashboard/training/courses">Browse courses</a>
          </div>
        } @else {
          <div class="course-list">
            @for (course of continueCourses(); track course.id) {
              <async-learn-course-card [course]="course" />
            }
          </div>
        }
      </section>

      <section class="goals" aria-label="Goals in flight">
        <div class="section-head">
          <div>
            <p class="eyebrow">Targets</p>
            <h2>Goals in flight</h2>
          </div>
          <a mat-button routerLink="/dashboard/goals">Manage</a>
        </div>

        @if (activeGoals().length === 0) {
          <div class="empty-card">
            <span class="empty-icon"><mat-icon>flag</mat-icon></span>
            <strong>No active goals</strong>
            <p>Set one target and give your week a finish line.</p>
            <a mat-flat-button color="primary" routerLink="/dashboard/goals">Set a goal</a>
          </div>
        } @else {
          <div class="goal-list">
            @for (goal of activeGoals(); track goal.id) {
              <async-learn-goal-card [goal]="goal" />
            }
          </div>
          <p class="goal-foot">{{ goalsOnTrack() }} of {{ activeGoals().length }} active goals on track.</p>
        }
      </section>

      <section class="shortcuts" aria-label="Quick links">
        <div class="section-head">
          <div>
            <p class="eyebrow">Shortcuts</p>
            <h2>More ways to learn</h2>
          </div>
        </div>
        <div class="shortcut-grid">
          @for (shortcut of shortcuts; track shortcut.link) {
            <a class="shortcut" [routerLink]="shortcut.link">
              <span class="shortcut-icon"><mat-icon aria-hidden="true">{{ shortcut.icon }}</mat-icon></span>
              <span>{{ shortcut.label }}</span>
              <mat-icon class="shortcut-arrow" aria-hidden="true">arrow_forward</mat-icon>
            </a>
          }
        </div>
      </section>
    </section>
  `,
  styles: [`
    :host { display: block; -webkit-tap-highlight-color: transparent; }
    .learn-page { display: flex; flex-direction: column; gap: 14px; max-width: 720px; margin: 0 auto; padding-bottom: 28px; }

    .learn-hero { padding: 14px; border: 1px solid color-mix(in srgb, var(--ms-primary) 16%, var(--ms-line)); border-radius: 20px; background: linear-gradient(155deg, var(--ms-primary-soft), var(--ms-surface) 70%); }
    .hero-top { display: flex; align-items: center; gap: 8px; }
    .hero-top > a, .hero-top > button { flex: none; background: color-mix(in srgb, var(--ms-surface) 72%, transparent); }
    .hero-title { flex: 1; min-width: 0; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.66rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .hero-title h1 { margin: 1px 0 0; font-size: clamp(1.5rem, 6vw, 1.75rem); line-height: 1.15; letter-spacing: -0.03em; }
    .hero-lede { margin: 9px 0 12px; max-width: 42em; color: var(--ms-text-muted); font-size: 0.82rem; line-height: 1.55; }
    .hero-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .hero-actions a { min-width: 0; min-height: 44px; }
    .hero-actions mat-icon { margin-right: 4px; }

    .loading-strip { position: relative; height: 3px; overflow: hidden; border-radius: 999px; background: var(--ms-line); }
    .loading-strip::after { content: ''; position: absolute; inset: 0; width: 38%; border-radius: inherit; background: var(--ms-primary); animation: slide-bar 1.05s ease-in-out infinite; }

    .section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; }
    .section-head > div { min-width: 0; }
    .section-head h2 { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px; margin: 1px 0 0; font-size: 1rem; line-height: 1.3; }
    .section-head h2 span { color: var(--ms-text-muted); font-size: 0.72rem; font-weight: 600; }
    .section-head > a { flex: none; min-height: 40px; }

    .journey-card { padding: 12px; border: 1px solid var(--ms-line); border-radius: 16px; background: linear-gradient(145deg, color-mix(in srgb, var(--ms-primary-soft) 55%, var(--ms-surface)), var(--ms-surface)); box-shadow: 0 4px 14px rgba(20, 18, 43, 0.04); }
    .rank-track { display: flex; align-items: flex-start; margin-top: 14px; }
    .rank-step { position: relative; display: flex; flex: 1; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
    .rank-step::before { content: ''; position: absolute; top: 13px; left: 50%; width: 100%; height: 2px; background: var(--ms-line); z-index: 0; }
    .rank-step:last-child::before { display: none; }
    .rank-step.is-done::before { background: var(--ms-success); }
    .rank-node { position: relative; z-index: 1; display: grid; place-items: center; width: 28px; height: 28px; border: 2px solid var(--ms-line); border-radius: 50%; background: var(--ms-surface); color: var(--ms-text-muted); font-size: 0.66rem; font-weight: 800; }
    .rank-node mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .rank-step.is-done .rank-node { border-color: var(--ms-success); background: var(--ms-success); color: var(--ms-ink); }
    .rank-step.is-current .rank-node { border-color: var(--ms-primary); background: var(--ms-primary); color: var(--ms-ink); box-shadow: 0 0 0 3px var(--ms-primary-soft); }
    .rank-name { max-width: 100%; overflow: hidden; color: var(--ms-text-muted); font-size: 0.6rem; font-weight: 700; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
    .rank-step.is-done .rank-name { color: var(--ms-success); }
    .rank-step.is-current .rank-name { color: var(--ms-text); }
    .rank-meter { height: 6px; margin-top: 13px; overflow: hidden; border-radius: 999px; background: var(--ms-line); }
    .rank-meter > span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--ms-primary), var(--ms-secondary)); transition: width 240ms ease; }
    .rank-meter-label { display: flex; justify-content: space-between; gap: 8px; margin-top: 4px; color: var(--ms-text-muted); font-size: 0.64rem; }
    .rank-meter-label strong { color: var(--ms-text); font-variant-numeric: tabular-nums; }
    .next-steps { margin-top: 10px; padding: 9px 10px; border-radius: 11px; background: var(--ms-canvas); }
    .next-steps-head { display: flex; justify-content: space-between; gap: 8px; color: var(--ms-text-muted); font-size: 0.64rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .next-steps-head strong { color: var(--ms-primary-strong); font-weight: 800; white-space: nowrap; }
    .next-steps ul { display: flex; flex-direction: column; gap: 5px; margin: 7px 0 0; padding: 0; list-style: none; }
    .next-steps li { display: flex; align-items: flex-start; gap: 5px; color: var(--ms-text); font-size: 0.73rem; line-height: 1.4; }
    .next-steps li mat-icon { flex: none; margin-top: 1px; color: var(--ms-text-muted); font-size: 15px; width: 15px; height: 15px; }
    .next-steps li.ready { color: var(--ms-success); font-weight: 700; }
    .next-steps li.ready mat-icon { color: var(--ms-success); }
    .top-rank { display: flex; align-items: center; gap: 5px; margin: 10px 0 0; padding: 8px 9px; border-radius: 10px; background: var(--ms-success-soft); color: var(--ms-success); font-size: 0.74rem; font-weight: 700; }
    .top-rank mat-icon { font-size: 17px; width: 17px; height: 17px; }

    .pulse { display: flex; flex-direction: column; gap: 8px; }
    .pulse-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .pulse-tile { display: flex; flex-direction: column; gap: 1px; min-width: 0; padding: 10px; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); color: var(--ms-text); text-decoration: none; box-shadow: 0 4px 12px rgba(20, 18, 43, 0.04); }
    .pulse-tile:active { transform: scale(0.985); }
    .pulse-icon { display: grid; place-items: center; width: 30px; height: 30px; margin-bottom: 2px; border-radius: 9px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .pulse-icon--info { background: var(--ms-info-soft); color: var(--ms-info); }
    .pulse-icon--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .pulse-icon--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .pulse-icon mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .pulse-tile strong { font-family: var(--ms-font-display); font-size: 1.2rem; line-height: 1.15; font-variant-numeric: tabular-nums; }
    .pulse-tile > span:not(.pulse-icon, .pulse-dots, .pulse-action, .pulse-note) { color: var(--ms-text-muted); font-size: 0.68rem; font-weight: 650; }
    .pulse-dots { display: flex; gap: 3px; margin-top: 3px; }
    .pulse-dot { flex: 1; height: 4px; border-radius: 999px; background: var(--ms-line); }
    .pulse-dot.is-on { background: var(--ms-success); }
    .pulse-note { color: var(--ms-text-muted); font-size: 0.62rem; line-height: 1.35; }
    .pulse-action { display: inline-flex; align-items: center; gap: 2px; margin-top: auto; padding-top: 4px; color: var(--ms-primary-strong); font-size: 0.64rem; font-weight: 800; }
    .pulse-action mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .courses, .goals, .shortcuts { display: flex; flex-direction: column; gap: 8px; }
    .course-list, .goal-list { display: flex; flex-direction: column; gap: 8px; }
    .goal-foot { margin: 0; color: var(--ms-text-muted); font-size: 0.7rem; }

    .shortcut-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .shortcut { display: flex; align-items: center; gap: 8px; min-width: 0; min-height: 62px; padding: 9px 10px; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); color: var(--ms-text); text-decoration: none; }
    .shortcut:active { transform: scale(0.985); }
    .shortcut-icon { display: grid; place-items: center; flex: none; width: 32px; height: 32px; border-radius: 9px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .shortcut-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .shortcut > span:not(.shortcut-icon) { flex: 1; min-width: 0; font-size: 0.74rem; font-weight: 650; line-height: 1.3; }
    .shortcut-arrow { flex: none; color: var(--ms-text-muted); font-size: 17px; width: 17px; height: 17px; }

    .empty-card { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 24px 18px; text-align: center; border: 1px dashed var(--ms-line-strong); border-radius: 16px; background: var(--ms-surface); }
    .empty-icon { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 50%; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .empty-icon mat-icon { font-size: 23px; width: 23px; height: 23px; }
    .empty-card strong { font-size: 0.92rem; }
    .empty-card p { margin: 0; max-width: 30em; color: var(--ms-text-muted); font-size: 0.78rem; line-height: 1.5; }
    .empty-card a, .empty-card button { min-height: 44px; margin-top: 2px; }

    .alert { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; padding: 11px 12px; border-radius: 14px; background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { flex: 1; min-width: 170px; margin: 0; font-size: 0.8rem; }
    .alert button { min-height: 40px; }

    @media (min-width: 700px) {
      .pulse-grid, .shortcut-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .course-list, .goal-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (prefers-reduced-motion: reduce) {
      .loading-strip::after { animation: none; width: 100%; opacity: 0.5; }
      .rank-meter > span { transition: none; }
    }
    @keyframes slide-bar { 0% { transform: translateX(-110%); } 100% { transform: translateX(290%); } }
  `],
})
export class LearnHubMobileComponent implements OnInit {
  private readonly progression = inject(ProgressionService);
  private readonly auth = inject(AuthService);
  private readonly goalsSvc = inject(GoalService);
  private readonly training = inject(TrainingService);
  private readonly weeklyVideos = inject(WeeklyVideoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly loadedOnce = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly journey = signal<Journey | null>(null);
  protected readonly goals = signal<Goal[]>([]);
  protected readonly courses = signal<CourseSummary[]>([]);
  protected readonly weeklyVideo = signal<CurrentWeeklyVideo | null>(null);

  protected readonly ranks = APP_RANKS;
  protected readonly shortcuts: Shortcut[] = [
    { label: 'Academy dashboard', icon: 'school', link: '/dashboard/training' },
    { label: 'Courses & bookmarks', icon: 'menu_book', link: '/dashboard/training/courses' },
    { label: 'Tutorials', icon: 'smart_display', link: '/dashboard/training/tutorials' },
    { label: 'Analytics', icon: 'insights', link: '/dashboard/training/analytics' },
  ];

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
  protected readonly certifiedCourses = computed(() =>
    this.courses().filter((c) => c.certified).length);
  protected readonly activeGoals = computed(() =>
    this.goals()
      .filter((g) => g.status !== 'closed' && !g.progress?.complete)
      .slice(0, 3));
  protected readonly goalsOnTrack = computed(() =>
    this.activeGoals().filter((g) => g.progress?.onTrack).length);
  protected readonly continueCourses = computed(() => {
    const rank = (c: CourseSummary): number => c.percent > 0 && c.percent < 100 ? 0 : c.percent >= 100 ? 2 : 1;
    return [...this.courses()]
      .sort((a, b) => rank(a) - rank(b) || b.percent - a.percent)
      .slice(0, 4);
  });
  protected readonly weeklyStreak = computed(() => this.weeklyVideo()?.engagement.currentStreak ?? 0);
  protected readonly initialLoading = computed(() => this.loading() && !this.loadedOnce());
  protected readonly rankPercent = computed(() => {
    const percent = this.journey()?.percent;
    if (typeof percent === 'number' && Number.isFinite(percent)) {
      return Math.max(0, Math.min(100, Math.round(percent)));
    }
    return Math.round((this.currentRankIndex() / (APP_RANKS.length - 1)) * 100);
  });
  protected readonly nextSteps = computed<string[]>(() => {
    const journey = this.journey();
    if (journey) return (journey.missing ?? []).map((item) => item.label).slice(0, 4);
    return this.nextRank()?.criteria.slice(0, 4) ?? [];
  });

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      journey: this.progression.mine().pipe(catchError(() => of(null))),
      goals: this.goalsSvc.mine().pipe(catchError(() => of(null))),
      courses: this.training.courses().pipe(catchError(() => of(null))),
      weekly: this.weeklyVideos.current().pipe(catchError(() => of(null))),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.loading.set(false);
        this.loadedOnce.set(true);
      }),
    ).subscribe({
      next: ({ journey, goals, courses, weekly }) => {
        this.journey.set(journey?.data ?? null);
        this.goals.set(goals?.data ?? []);
        this.courses.set(courses?.data ?? []);
        this.weeklyVideo.set(weekly?.data ?? null);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }
}
