import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { CourseSummary } from '../../../../core/training/training.models';

/** Compact mobile course row with cover, progress and a single resume target. */
@Component({
  selector: 'async-learn-course-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, RouterModule],
  template: `
    <a
      class="course-card"
      [routerLink]="['/dashboard/training/courses', course().id]"
      [queryParams]="course().nextLessonId ? { lesson: course().nextLessonId } : null"
      [attr.aria-label]="course().title + ', ' + status().label + ', ' + course().percent + '% complete'">
      <span class="course-art">
        <mat-icon aria-hidden="true">menu_book</mat-icon>
        @if (course().coverUrl) {
          <img [src]="course().coverUrl" alt="" loading="lazy" decoding="async" (error)="hideImage($event)" />
        }
        @if (course().certified) {
          <span class="cert-badge" aria-hidden="true"><mat-icon>verified</mat-icon></span>
        }
      </span>

      <span class="course-copy">
        <span class="course-top">
          <strong>{{ course().title }}</strong>
          <span [class]="'course-status course-status--' + status().tone">{{ status().label }}</span>
        </span>
        @if (course().tagline) {
          <span class="course-tagline">{{ course().tagline }}</span>
        }
        <span class="course-bar" aria-hidden="true"><span [style.width.%]="course().percent"></span></span>
        <span class="course-meta">
          {{ course().done }} of {{ course().total }} lessons · {{ course().percent }}%
          @if (course().estimatedMinutes > 0) { · ~{{ course().estimatedMinutes }} min }
        </span>
        <span class="course-cta">{{ cta() }} <mat-icon aria-hidden="true">arrow_forward</mat-icon></span>
      </span>
    </a>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .course-card { display: flex; align-items: flex-start; gap: 10px; padding: 10px; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); color: var(--ms-text); text-decoration: none; box-shadow: 0 4px 12px rgba(20, 18, 43, 0.04); }
    .course-card:active { transform: scale(0.995); }
    .course-art { position: relative; display: grid; place-items: center; flex: none; width: 64px; height: 64px; overflow: hidden; border-radius: 12px; background: linear-gradient(135deg, var(--ms-primary-soft), var(--ms-secondary-soft)); color: var(--ms-primary-strong); }
    .course-art > mat-icon { font-size: 26px; width: 26px; height: 26px; }
    .course-art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .cert-badge { position: absolute; right: 2px; bottom: 2px; display: grid; place-items: center; width: 19px; height: 19px; border-radius: 50%; background: var(--ms-success); color: var(--ms-ink); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3); }
    .cert-badge mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .course-copy { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
    .course-top { display: flex; align-items: flex-start; gap: 6px; }
    .course-top strong { display: -webkit-box; overflow: hidden; flex: 1; font-size: 0.86rem; line-height: 1.3; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .course-status { flex: none; padding: 2px 7px; border-radius: 999px; font-size: 0.59rem; font-weight: 800; white-space: nowrap; }
    .course-status--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .course-status--info { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .course-status--muted { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .course-tagline { display: -webkit-box; overflow: hidden; color: var(--ms-text-muted); font-size: 0.69rem; line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .course-bar { display: block; height: 5px; overflow: hidden; border-radius: 999px; background: var(--ms-line); }
    .course-bar > span { display: block; height: 100%; border-radius: inherit; background: var(--ms-primary); transition: width 200ms ease; }
    .course-meta { color: var(--ms-text-muted); font-size: 0.63rem; line-height: 1.35; }
    .course-cta { display: inline-flex; align-items: center; gap: 2px; margin-top: 1px; color: var(--ms-primary-strong); font-size: 0.68rem; font-weight: 800; }
    .course-cta mat-icon { font-size: 15px; width: 15px; height: 15px; }
  `],
})
export class LearnCourseCardComponent {
  readonly course = input.required<CourseSummary>();

  protected readonly status = computed<{ label: string; tone: 'ok' | 'info' | 'muted' }>(() => {
    const course = this.course();
    if (course.certified) return { label: 'Certified', tone: 'ok' };
    if (course.percent >= 100) return { label: 'Complete', tone: 'ok' };
    if (course.percent > 0) return { label: 'In progress', tone: 'info' };
    return { label: 'Not started', tone: 'muted' };
  });

  protected readonly cta = computed(() => {
    const course = this.course();
    if (course.certified || course.percent >= 100) return 'Review';
    if (course.percent > 0) return 'Resume';
    return 'Start';
  });

  protected hideImage(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    if (image) image.style.display = 'none';
  }
}
