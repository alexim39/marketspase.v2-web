import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, SlicePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TrainingService } from '../../../core/training/training.service';
import { Certificate, CourseSummary } from '../../../core/training/training.models';
import { downloadCert, certNumber } from '../../../core/training/cert';
import { AuthService } from '../../../core/auth/auth.service';
import { ProgressionService } from '../../../core/progression/progression.service';
import { APP_RANKS, AppRank, Journey, TRAINING_TRACK, appRankIndex } from '../../../core/progression/progression.models';
import { EventService } from '../../../core/events/event.service';
import { CommunityEvent } from '../../../core/events/event.models';
import { ApiError } from '../../../core/http/api-error';

/**
 * @title Leadership Academy dashboard — your learning journey at a glance.
 *
 * Composes only existing signals (journey + course progress + certificates
 * + upcoming events) — no new backend state. OnPush + signals, fully
 * typed, fail-soft so one failing slice never blanks the page. This is
 * P1 of the Academy roadmap; later phases add quizzes, coach pairing
 */
@Component({
  selector: 'async-academy-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, SlicePipe, MatButtonModule, MatCardModule, MatChipsModule, MatIconModule, MatProgressBarModule, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>Leadership Academy</span>
      </div>
    </section>

    <section class="dashboard-page">
      <div class="page-head">
        <div>
          <h2>Leadership Academy & Development Center</h2>
          <p class="subtitle">From Partner to Ambassador — your rank, your courses, your next move.</p>
        </div>
        <div class="head-actions">
          <a mat-button routerLink="tutorials">Tutorials</a>
          <a mat-button routerLink="analytics">Analytics</a>
          <a mat-button routerLink="coach">My Coach</a>
          <a mat-button routerLink="library">Library</a>
          <a mat-button routerLink="courses">Browse courses</a>
        </div>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      <div class="dp-card journey-card">
        <div class="journey-top">
          <div>
            <span class="muted">Current rank</span>
            <strong class="journey-level">{{ currentRank() }}</strong>
            <span class="muted">{{ nextRank()?.label ? 'Next: ' + nextRank()?.label : 'Top rank' }}</span>
          </div>
          <a mat-button routerLink="/dashboard/progress">Open My Progress</a>
        </div>
        <ul class="missing">
          @for (t of trainingTrack; track t.key) {
            <li>{{ t.label }} — {{ trainingDone(t.key) ? 'recorded automatically' : 'not completed yet' }}</li>
          }
        </ul>
      </div>

      @if (courses().length > 0) {
        <h3>Assigned courses</h3>
        <div class="course-grid">
          @for (c of courses(); track c.id) {
            <mat-card class="course-card" [class.course-card--done]="c.certified">
              <mat-card-content>
                <div class="course-top">
                  <strong>{{ c.title }}</strong>
                  @if (c.certified) {
                    <mat-chip highlighted><mat-icon>verified</mat-icon> Certified</mat-chip>
                  } @else if (c.done > 0) {
                    <span class="muted">{{ c.percent }}%</span>
                  } @else {
                    <span class="muted">Not started</span>
                  }
                </div>
                <p class="muted">{{ c.tagline }}</p>
                <mat-progress-bar mode="determinate" [value]="c.percent" aria-label="Progress" />
                <div class="course-foot">
                  <span class="muted">{{ c.done }}/{{ c.total }} lessons</span>
                  <a mat-button [routerLink]="['courses', c.id]">{{ c.done > 0 && !c.certified ? 'Continue' : c.certified ? 'Review' : 'Start' }}</a>
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>
      }

      @if (certificates().length > 0) {
        <h3>Certifications ({{ certificates().length }})</h3>
        <ul class="cert-list">
          @for (cert of certificates(); track cert.courseId) {
            <li class="dp-card cert">
              <mat-icon>workspace_premium</mat-icon>
              <div>
                <strong>{{ cert.title }}</strong>
                <span class="muted"> · {{ certNumber(cert) }} · {{ cert.at | date:'mediumDate' }}</span>
              </div>
              <span class="spacer"></span>
              <button mat-button (click)="download(cert)">Download</button>
            </li>
          }
        </ul>
      } @else if (!loading()) {
        <p class="empty">No certifications yet — complete a course to earn your first.</p>
      }

      @if (events().length > 0) {
        <h3>Upcoming training sessions</h3>
        <ul class="event-list">
          @for (e of events(); track e.id) {
            <li class="dp-card event-card">
              <div class="event-top">
                <strong>{{ e.title }}</strong>
                <span class="muted">{{ e.startsAt | date:'medium' }}@if (e.location) { · {{ e.location }}}</span>
              </div>
              <p class="muted">{{ e.body | slice:0:160 }}@if (e.body.length > 160) {…}</p>
              <a mat-button routerLink="/dashboard/community/events">View events</a>
            </li>
          }
        </ul>
      }

      @if (upcomingEmpty() && !loading()) {
        <p class="empty">No upcoming sessions — check back soon or ask your coach.</p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .dashboard-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .dashboard-page h3 { margin: 0.5em 0 0; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .head-actions { display: flex; gap: 0.5em; flex-wrap: wrap; }
    .head-actions a { min-height: 44px; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
    .journey-card { padding: 1em; display: flex; flex-direction: column; gap: 0.75em; }
    .journey-top { display: flex; flex-direction: column; gap: 0.5em; }
    .journey-level { display: block; font-size: 1.3em; margin-top: 0.15em; }
    .missing { margin: 0; padding-left: 1.2em; font-size: 0.9em; }
    .missing li { margin: 0.15em 0; }
    .course-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.75em; }
    .course-card mat-card-content { display: flex; flex-direction: column; gap: 0.6em; }
    .course-card p { margin: 0; }
    .course-card--done { border-left: 4px solid var(--ms-success); }
    .course-top { display: flex; justify-content: space-between; align-items: center; gap: 0.6em; }
    .course-top mat-chip mat-icon { font-size: 16px; height: 16px; width: 16px; }
    .course-foot { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.4em; }
    .course-foot a, .cert a, .cert button, .event-top a { min-height: 44px; }
    .cert-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5em; }
    .cert { display: flex; gap: 0.7em; align-items: center; padding: 0.7em 1em; }
    .cert .spacer { flex: 1; }
    .cert mat-icon { color: var(--ms-primary-strong); }
    .event-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6em; }
    .event-card { padding: 0.9em 1em; display: flex; flex-direction: column; gap: 0.35em; }
    .event-card p { margin: 0; }
    .event-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75em; flex-wrap: wrap; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    html[data-theme='dark'] .error { color: #e89a9a; }
    .empty { color: var(--ms-text-muted); }
  `],
})
export class AcademyDashboardComponent implements OnInit {
  private readonly training = inject(TrainingService);
  private readonly auth = inject(AuthService);
  private readonly progress = inject(ProgressionService);
  private readonly eventsApi = inject(EventService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly journey = signal<Journey | null>(null);
  protected readonly courses = signal<CourseSummary[]>([]);
  protected readonly certificates = signal<Certificate[]>([]);
  protected readonly events = signal<CommunityEvent[]>([]);

  protected readonly trainingTrack = TRAINING_TRACK;
  protected readonly currentRank = computed<AppRank>(() =>
    (this.auth.currentUser()?.commissionRank as AppRank | undefined) ?? 'Partner');
  protected readonly nextRank = computed(() =>
    APP_RANKS[appRankIndex(this.currentRank()) + 1] ?? null);

  protected trainingDone(key: string): boolean {
    const stamp = (this.journey()?.milestones?.[key] ?? {}) as { done?: boolean };
    return stamp.done === true;
  }

  protected readonly upcomingEmpty = computed(() => this.events().length === 0 && !this.loading());

  protected certNumber = certNumber;

  protected download(cert: Certificate): void {
    const user = this.auth.currentUser();
    const name = [user?.name, user?.surname].filter(Boolean).join(' ') || user?.username || 'Partner';
    downloadCert(cert, name);
  }

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      journey: this.progress.mine().pipe(catchError(() => of(null))),
      courses: this.training.courses().pipe(catchError(() => of(null))),
      certs: this.training.certificates().pipe(catchError(() => of(null))),
      events: this.eventsApi.upcoming(5).pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ journey, courses, certs, events }) => {
          this.journey.set((journey as { data?: Journey } | null)?.data ?? null);
          this.courses.set((courses as { data?: CourseSummary[] } | null)?.data ?? []);
          this.certificates.set((certs as { data?: Certificate[] } | null)?.data ?? []);
          this.events.set((events as { data?: { items?: CommunityEvent[] } } | null)?.data?.items?.slice(0, 3) ?? []);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }
}
