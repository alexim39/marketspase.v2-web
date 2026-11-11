import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { TrainingService } from '../../../core/training/training.service';
import { CourseSummary, TrainingMilestone } from '../../../core/training/training.models';
import { ApiError, userError } from '../../../core/http/api-error';

type CourseFilter = 'all' | 'in-progress' | 'completed' | 'elective' | TrainingMilestone;

const FILTERS: Array<{ key: CourseFilter; label: string }> = [
  { key: 'all', label: 'All courses' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'ipo', label: 'IPO' },
  { key: 'qsg', label: 'QSG' },
  { key: 'smo', label: 'SMO' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'elective', label: 'Electives' },
];

/**
 * @title Academy catalogue — every published admin-created course.
 */
@Component({
  selector: 'async-training-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    PageSkeletonComponent,
    RouterModule,
  ],
  templateUrl: './training-list.component.html',
  styleUrls: ['./training-list.component.scss'],
})
export class TrainingListComponent implements OnInit {
  private readonly training = inject(TrainingService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly courses = signal<CourseSummary[]>([]);
  protected readonly query = signal('');
  protected readonly filter = signal<CourseFilter>('all');
  protected readonly filters = FILTERS;

  protected readonly filtered = computed(() => {
    const needle = this.query().trim().toLowerCase();
    const filter = this.filter();
    return this.courses().filter((course) => {
      if (filter === 'in-progress' && !(course.percent > 0 && !course.certified)) return false;
      if (filter === 'completed' && !course.certified) return false;
      if (filter === 'elective' && course.milestone) return false;
      if (['ipo', 'qsg', 'smo', 'leadership'].includes(filter) && course.milestone !== filter) return false;
      if (!needle) return true;
      return `${course.title} ${course.tagline} ${course.description}`.toLowerCase().includes(needle);
    });
  });
  protected readonly totalLessons = computed(() => this.courses().reduce((total, course) => total + course.lessons, 0));
  protected readonly completedLessons = computed(() => this.courses().reduce((total, course) => total + course.done, 0));
  protected readonly certifiedCount = computed(() => this.courses().filter((course) => course.certified).length);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.training.courses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.courses.set(response.data ?? []);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  protected courseLink(course: CourseSummary): (string | number)[] {
    return ['/dashboard/training/courses', course.id];
  }

  protected trackLabel(course: CourseSummary): string {
    return course.milestone ? `${course.milestone.toUpperCase()} track` : 'Elective';
  }

  protected cta(course: CourseSummary): string {
    if (course.certified) return 'Review course';
    if (course.percent > 0) return 'Continue';
    return 'Start course';
  }

  protected formatMinutes(minutes: number): string {
    const value = Math.max(0, Math.round(Number(minutes) || 0));
    return value >= 60 ? `${Math.floor(value / 60)}h ${value % 60}m` : `${value} min`;
  }
}
