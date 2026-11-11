import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { catchError, forkJoin, of } from 'rxjs';
import { TrainingService } from '../../../core/training/training.service';
import { Certificate, CourseSummary, TrainingMilestone } from '../../../core/training/training.models';
import { certNumber, downloadCert } from '../../../core/training/cert';
import { ProgressionService } from '../../../core/progression/progression.service';
import { APP_RANKS, AppRank, Journey, appRankIndex } from '../../../core/progression/progression.models';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';

const MILESTONES: Array<{ key: TrainingMilestone; label: string; note: string }> = [
  { key: 'ipo', label: 'IPO', note: 'Understand the business' },
  { key: 'qsg', label: 'QSG', note: 'Build the habit' },
  { key: 'smo', label: 'SMO', note: 'Lead the system' },
  { key: 'leadership', label: 'Leadership', note: 'Develop leaders' },
];

/**
 * @title Leadership Academy — a calm, practical learning home.
 *
 * Every course is admin-created. The page prioritises the single next action,
 * then shows the rank journey, the full catalogue and earned certificates.
 */
@Component({
  selector: 'async-training-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressBarModule, PageSkeletonComponent, RouterModule],
  templateUrl: './academy-dashboard.component.html',
  styleUrls: ['./academy-dashboard.component.scss'],
})
export class AcademyDashboardComponent implements OnInit {
  private readonly training = inject(TrainingService);
  private readonly progression = inject(ProgressionService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly journey = signal<Journey | null>(null);
  protected readonly courses = signal<CourseSummary[]>([]);
  protected readonly certificates = signal<Certificate[]>([]);
  protected readonly milestones = MILESTONES;
  protected readonly certNumber = certNumber;

  protected readonly currentRank = computed<AppRank>(() =>
    ((this.journey()?.levelLabel ?? this.auth.currentUser()?.commissionRank) as AppRank | undefined) ?? 'Partner');
  protected readonly nextRank = computed(() => {
    const label = this.journey()?.nextLabel as AppRank | null | undefined;
    if (label) return APP_RANKS.find((rank) => rank.rank === label) ?? null;
    return APP_RANKS[appRankIndex(this.currentRank()) + 1] ?? null;
  });
  protected readonly overallPercent = computed(() => {
    const courses = this.courses();
    if (courses.length === 0) return 0;
    return Math.round(courses.reduce((total, course) => total + course.percent, 0) / courses.length);
  });
  protected readonly completedCourses = computed(() => this.courses().filter((course) => course.certified).length);
  protected readonly lessonsDone = computed(() => this.courses().reduce((total, course) => total + course.done, 0));
  protected readonly continueCourse = computed<CourseSummary | null>(() => {
    const courses = this.courses();
    return courses
      .filter((course) => course.percent > 0 && !course.certified)
      .sort((a, b) => b.percent - a.percent)[0]
      ?? courses.find((course) => !course.certified)
      ?? courses[0]
      ?? null;
  });
  protected readonly featuredCourses = computed(() => this.courses().slice(0, 6));
  protected readonly recentCertificates = computed(() =>
    [...this.certificates()].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 4));
  protected readonly nextMilestone = computed(() => {
    const stamps = this.journey()?.milestones as Record<string, { done?: boolean }> | undefined;
    return this.milestones.find((milestone) => stamps?.[milestone.key]?.done !== true) ?? null;
  });

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      journey: this.progression.mine().pipe(catchError(() => of(null))),
      courses: this.training.courses().pipe(catchError((err) => {
        this.error.set(this.message(err));
        return of(null);
      })),
      certs: this.training.certificates().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ journey, courses, certs }) => {
          this.journey.set((journey as { data?: Journey } | null)?.data ?? null);
          this.courses.set((courses as { data?: CourseSummary[] } | null)?.data ?? []);
          this.certificates.set((certs as { data?: Certificate[] } | null)?.data ?? []);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(this.message(err));
          this.loading.set(false);
        },
      });
  }

  protected courseForMilestone(key: TrainingMilestone): CourseSummary | null {
    return this.courses().find((course) => course.milestone === key) ?? null;
  }

  protected milestoneDone(key: TrainingMilestone): boolean {
    const stamps = this.journey()?.milestones as Record<string, { done?: boolean }> | undefined;
    return stamps?.[key]?.done === true;
  }

  protected milestonePercent(key: TrainingMilestone): number {
    return this.courseForMilestone(key)?.percent ?? 0;
  }

  protected milestoneLink(key: TrainingMilestone): string[] | null {
    const course = this.courseForMilestone(key);
    return course ? ['/dashboard/training/courses', course.id] : null;
  }

  protected continueLink(course: CourseSummary): string[] {
    return ['/dashboard/training/courses', course.id];
  }

  protected courseCta(course: CourseSummary): string {
    if (course.certified) return 'Review course';
    if (course.percent > 0) return 'Continue learning';
    return 'Start course';
  }

  protected trackLabel(course: CourseSummary): string {
    return course.milestone ? `${course.milestone.toUpperCase()} track` : 'Elective';
  }

  protected formatMinutes(minutes: number): string {
    const value = Math.max(0, Math.round(Number(minutes) || 0));
    if (value >= 60) {
      const hours = Math.floor(value / 60);
      const mins = value % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${value} min`;
  }

  protected progressStyle(percent: number): string {
    const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    return `conic-gradient(var(--ms-primary) ${value * 3.6}deg, var(--ms-surface-3) 0deg)`;
  }

  protected download(cert: Certificate): void {
    const user = this.auth.currentUser();
    const name = [user?.name, user?.surname].filter(Boolean).join(' ') || user?.username || 'Partner';
    downloadCert(cert, name);
  }

  private message(err: unknown): string {
    return err instanceof Error ? err.message : 'The Academy could not load. Please try again.';
  }
}
