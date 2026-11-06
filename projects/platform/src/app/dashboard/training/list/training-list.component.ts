import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { forkJoin } from 'rxjs';
import { TrainingService } from '../../../core/training/training.service';
import { Certificate, CourseSummary } from '../../../core/training/training.models';
import { downloadCert, certNumber } from '../../../core/training/cert';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';

/**
 * @title Training Center — IPO, QSG, SMO and Leadership.
 *
 * Course cards with live progress plus earned certificates.
 * Certificates check ladder milestones server-side.
 * OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-training-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatCardModule, MatChipsModule, MatIconModule, MatProgressBarModule, PageSkeletonComponent, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>Training Center</span>
      </div>
    </section>

    <section class="training-page">
      <div class="page-head">
        <div>
          <h2>Training Center</h2>
          <p class="subtitle">Take IPO, QSG and SMO online — certificates count toward promotion.</p>
        </div>
        <a mat-button routerLink="/dashboard/progress">My Journey</a>
      </div>

      @if (loading()) {
        <async-page-skeleton layout="cards" [rows]="4" label="courses" [showHeader]="false" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (courses().length === 0 && !loading() && !error()) {
        <p class="empty">No courses available right now — check back soon.</p>
      }

      @if (courses().length > 0) {
        <div class="course-grid">
          @for (course of courses(); track course.id) {
            <mat-card class="course-card">
              <mat-card-content>
                <div class="course-top">
                  <strong>{{ course.title }}</strong>
                  @if (course.certified) {
                    <mat-chip highlighted><mat-icon>verified</mat-icon> Certified</mat-chip>
                  } @else if (course.done > 0) {
                    <span class="muted">{{ course.percent }}%</span>
                  } @else {
                    <span class="muted">Not started</span>
                  }
                </div>
                <p class="muted">{{ course.tagline }}</p>
                <mat-progress-bar mode="determinate" [value]="course.percent" aria-label="Progress" />
                <div class="course-foot">
                  <span class="muted">{{ course.done }}/{{ course.total }} lessons</span>
                  <a mat-button [routerLink]="['/dashboard/training/courses', course.id]">{{ course.done > 0 && !course.certified ? 'Continue' : course.certified ? 'Review' : 'Start' }}</a>
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>
      }

      @if (certificates().length > 0) {
        <h3>Certificates ({{ certificates().length }})</h3>
        <ul class="cert-list">
          @for (cert of certificates(); track cert.courseId) {
            <li class="dp-card cert">
              <mat-icon>workspace_premium</mat-icon>
              <div>
                <strong>{{ cert.title }}</strong>
                <span class="muted"> · {{ certNumber(cert) }}</span>
              </div>
              <span class="spacer"></span>
              <button mat-button (click)="download(cert)">Download</button>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .training-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .training-page h3 { margin: 0.5em 0 0; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); }
    .course-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.75em; }
    .course-card mat-card-content { display: flex; flex-direction: column; gap: 0.6em; }
    .course-card p { margin: 0; }
    .course-top { display: flex; justify-content: space-between; align-items: center; gap: 0.6em; }
    .course-top mat-chip mat-icon { font-size: 16px; height: 16px; width: 16px; }
    .course-foot { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.4em; }
    .course-foot a, .cert button, .page-head a, .error button { min-height: 44px; }
    .empty { color: var(--ms-text-muted); }
    .cert-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5em; }
    .cert { display: flex; gap: 0.7em; align-items: center; padding: 0.7em 1em; }
    .cert .spacer { flex: 1; }
    .cert mat-icon { color: var(--ms-primary-strong); }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
  `],
})
export class TrainingListComponent implements OnInit {
  private readonly training = inject(TrainingService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly courses = signal<CourseSummary[]>([]);
  protected readonly certificates = signal<Certificate[]>([]);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ courses: this.training.courses(), certs: this.training.certificates() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ courses, certs }) => {
          this.courses.set(courses.data ?? []);
          this.certificates.set(certs.data ?? []);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected certNumber = certNumber;

  protected download(cert: Certificate): void {
    const user = this.auth.currentUser();
    const name = [user?.name, user?.surname].filter(Boolean).join(' ') || user?.username || 'Partner';
    downloadCert(cert, name);
  }
}
