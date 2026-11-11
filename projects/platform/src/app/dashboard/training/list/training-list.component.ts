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

type CourseFilter = 'all' | 'in-progress' | 'completed' | 'elective' | 'bookmarks' | 'recent' | TrainingMilestone;

const FILTERS: Array<{ key: CourseFilter; label: string }> = [
  { key: 'all', label: 'All courses' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'ipo', label: 'IPO' },
  { key: 'qsg', label: 'QSG' },
  { key: 'smo', label: 'SMO' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'elective', label: 'Electives' },
  { key: 'bookmarks', label: 'Bookmarks' },
  { key: 'recent', label: 'Recently viewed' },
];

const BOOKMARK_KEY = 'dp-library-bookmarks';
const RECENT_KEY = 'dp-library-recent';

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
  protected readonly bookmarks = signal<Set<string>>(new Set());
  protected readonly recent = signal<string[]>([]);
  protected readonly filters = FILTERS;

  protected readonly filtered = computed(() => {
    const needle = this.query().trim().toLowerCase();
    const filter = this.filter();
    const bookmarks = this.bookmarks();
    const recent = this.recent();
    const matches = this.courses().filter((course) => {
      if (filter === 'bookmarks' && !bookmarks.has(course.id)) return false;
      if (filter === 'recent' && !recent.includes(course.id)) return false;
      if (filter === 'in-progress' && !(course.percent > 0 && !course.certified)) return false;
      if (filter === 'completed' && !course.certified) return false;
      if (filter === 'elective' && course.milestone) return false;
      if (['ipo', 'qsg', 'smo', 'leadership'].includes(filter) && course.milestone !== filter) return false;
      if (!needle) return true;
      return `${course.title} ${course.tagline} ${course.description}`.toLowerCase().includes(needle);
    });
    if (filter === 'recent') {
      return [...matches].sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
    }
    return matches;
  });
  protected readonly totalLessons = computed(() => this.courses().reduce((total, course) => total + course.lessons, 0));
  protected readonly completedLessons = computed(() => this.courses().reduce((total, course) => total + course.done, 0));
  protected readonly certifiedCount = computed(() => this.courses().filter((course) => course.certified).length);

  ngOnInit(): void {
    this.bookmarks.set(this.loadBookmarks());
    this.recent.set(this.loadRecent());
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

  protected isBookmarked(id: string): boolean {
    return this.bookmarks().has(id);
  }

  protected toggleBookmark(id: string): void {
    this.bookmarks.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      this.saveBookmarks(next);
      return next;
    });
  }

  protected markRecent(id: string): void {
    this.recent.update((list) => {
      const next = [id, ...list.filter((item) => item !== id)].slice(0, 10);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage may be disabled */ }
      return next;
    });
  }

  protected emptyTitle(): string {
    if (this.filter() === 'bookmarks') return 'No bookmarked courses yet';
    if (this.filter() === 'recent') return 'Nothing viewed recently';
    return 'No courses match this view';
  }

  protected emptyMessage(): string {
    if (this.filter() === 'bookmarks') return 'Use the bookmark button on a course cover to save it here for later.';
    if (this.filter() === 'recent') return 'Courses you open will appear here so you can pick them up again quickly.';
    return 'Try another filter or clear your search. New courses appear here as soon as they are published.';
  }

  protected clearFilters(): void {
    this.query.set('');
    this.filter.set('all');
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

  private loadBookmarks(): Set<string> {
    try {
      const raw = localStorage.getItem(BOOKMARK_KEY);
      const ids = raw ? JSON.parse(raw) as unknown : [];
      return new Set(Array.isArray(ids) ? ids.map(String) : []);
    } catch { return new Set(); }
  }

  private saveBookmarks(set: Set<string>): void {
    try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...set])); } catch { /* storage may be disabled */ }
  }

  private loadRecent(): string[] {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      const ids = raw ? JSON.parse(raw) as unknown : [];
      return Array.isArray(ids) ? ids.map(String).slice(0, 10) : [];
    } catch { return []; }
  }
}
