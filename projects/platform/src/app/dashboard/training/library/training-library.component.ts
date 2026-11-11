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
import { CourseSummary } from '../../../core/training/training.models';
import { ApiError, userError } from '../../../core/http/api-error';

type LibraryFilter = 'all' | 'ipo' | 'qsg' | 'smo' | 'leadership' | 'elective' | 'bookmarks' | 'recent';

const FILTERS: Array<{ key: LibraryFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'ipo', label: 'IPO' },
  { key: 'qsg', label: 'QSG' },
  { key: 'smo', label: 'SMO' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'elective', label: 'Electives' },
  { key: 'bookmarks', label: 'Bookmarks' },
  { key: 'recent', label: 'Recent' },
];

/**
 * @title Training library — searchable, bookmarkable course repository.
 *
 * Content is the live published Academy catalogue. Bookmarks and recently
 * viewed courses stay per-device in localStorage.
 */
@Component({
  selector: 'async-training-library',
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
  templateUrl: './training-library.component.html',
  styleUrls: ['./training-library.component.scss'],
})
export class TrainingLibraryComponent implements OnInit {
  private readonly training = inject(TrainingService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly courses = signal<CourseSummary[]>([]);
  protected readonly query = signal('');
  protected readonly filter = signal<LibraryFilter>('all');
  protected readonly bookmarks = signal<Set<string>>(new Set());
  protected readonly recent = signal<string[]>([]);
  protected readonly filters = FILTERS;

  protected readonly filtered = computed(() => {
    const query = this.query().trim().toLowerCase();
    const filter = this.filter();
    const bookmarks = this.bookmarks();
    const recent = this.recent();
    return this.courses().filter((course) => {
      if (filter === 'bookmarks' && !bookmarks.has(course.id)) return false;
      if (filter === 'recent' && !recent.includes(course.id)) return false;
      if (filter === 'elective' && course.milestone) return false;
      if (['ipo', 'qsg', 'smo', 'leadership'].includes(filter) && course.milestone !== filter) return false;
      if (!query) return true;
      return `${course.title} ${course.tagline} ${course.description}`.toLowerCase().includes(query);
    });
  });

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
      try { localStorage.setItem('dp-library-recent', JSON.stringify(next)); } catch { /* storage may be disabled */ }
      return next;
    });
  }

  protected trackLabel(course: CourseSummary): string {
    return course.milestone ? course.milestone.toUpperCase() : 'Elective';
  }

  protected formatMinutes(minutes: number): string {
    const value = Math.max(0, Math.round(Number(minutes) || 0));
    return value >= 60 ? `${Math.floor(value / 60)}h ${value % 60}m` : `${value} min`;
  }

  private loadBookmarks(): Set<string> {
    try {
      const raw = localStorage.getItem('dp-library-bookmarks');
      const ids = raw ? JSON.parse(raw) as unknown : [];
      return new Set(Array.isArray(ids) ? ids.map(String) : []);
    } catch { return new Set(); }
  }

  private saveBookmarks(set: Set<string>): void {
    try { localStorage.setItem('dp-library-bookmarks', JSON.stringify([...set])); } catch { /* storage may be disabled */ }
  }

  private loadRecent(): string[] {
    try {
      const raw = localStorage.getItem('dp-library-recent');
      const ids = raw ? JSON.parse(raw) as unknown : [];
      return Array.isArray(ids) ? ids.map(String).slice(0, 10) : [];
    } catch { return []; }
  }
}
