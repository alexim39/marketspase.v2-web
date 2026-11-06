import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { TrainingService } from '../../../core/training/training.service';
import { CourseSummary } from '../../../core/training/training.models';
import { ApiError } from '../../../core/http/api-error';

type LibraryFilter = 'all' | 'ipo' | 'qsg' | 'smo' | 'leadership' | 'bookmarks' | 'recent';

const FILTER_LABELS: Record<LibraryFilter, string> = {
  all: 'All', ipo: 'IPO', qsg: 'QSG', smo: 'SMO', leadership: 'Leadership', bookmarks: 'Bookmarks', recent: 'Recent',
};

/**
 * @title Training library — searchable course repository.
 *
 * Categories mirror the PRD (IPO/QSG/SMO/Leadership plus bookmarks/recent).
 * Content is the versioned catalog; progress comes from the training store
 * so the list never diverges from the Academy. Bookmarks + recently viewed
 * are per-device (localStorage), never server state. OnPush + signals.
 */
@Component({
  selector: 'async-training-library',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule, MatSelectModule, PageSkeletonComponent, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/training">Academy</a> &gt;
        <span>Library</span>
      </div>
    </section>

    <section class="library-page">
      <div class="page-head">
        <div>
          <h2>Training Library</h2>
          <p class="subtitle">Search every course — filter by track, bookmark for later, pick up where you left off.</p>
        </div>
        <a mat-button routerLink="/dashboard/training">Back to dashboard</a>
      </div>

      <div class="toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Search</mat-label>
          <input matInput type="search" [value]="query()" (input)="query.set($any($event.target).value)" placeholder="Title, tagline or lesson" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Category</mat-label>
          <mat-select [value]="filter()" (selectionChange)="filter.set($event.value)">
            @for (f of filters; track f) {
              <mat-option [value]="f">{{ labels[f] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      @if (loading()) {
        <async-page-skeleton layout="cards" [rows]="4" label="training library" [showHeader]="false" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (filtered().length > 0) {
        <div class="course-grid">
          @for (c of filtered(); track c.id) {
            <div class="dp-card course-card">
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
                <button mat-icon-button (click)="toggleBookmark(c.id)" [attr.aria-label]="isBookmarked(c.id) ? 'Remove bookmark' : 'Bookmark'">
                  <mat-icon>{{ isBookmarked(c.id) ? 'bookmark' : 'bookmark_border' }}</mat-icon>
                </button>
                <a mat-button [routerLink]="['/dashboard/training/courses', c.id]" (click)="markRecent(c.id)">Open</a>
              </div>
            </div>
          }
        </div>
      } @else if (!loading() && !error()) {
        <p class="empty">No courses match — try another search or category.</p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .library-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .page-head a { min-height: 44px; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
    .toolbar { display: flex; gap: 0.75em; flex-wrap: wrap; align-items: center; }
    .toolbar mat-form-field { flex: 1; min-width: 200px; }
    .course-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.75em; }
    .course-card { padding: 1em; display: flex; flex-direction: column; gap: 0.6em; }
    .course-card p { margin: 0; }
    .course-top { display: flex; justify-content: space-between; align-items: center; gap: 0.6em; }
    .course-top mat-chip mat-icon { font-size: 16px; height: 16px; width: 16px; }
    .course-foot { display: flex; justify-content: space-between; align-items: center; gap: 0.5em; }
    .course-foot a, .course-foot button { min-height: 44px; }
    .course-foot button[mat-icon-button] { width: 44px; height: 44px; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    html[data-theme='dark'] .error { color: #e89a9a; }
    .empty { color: var(--ms-text-muted); }
  `],
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

  protected readonly filters: LibraryFilter[] = ['all', 'ipo', 'qsg', 'smo', 'leadership', 'bookmarks', 'recent'];
  protected readonly labels = FILTER_LABELS;

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const f = this.filter();
    const bm = this.bookmarks();
    const rc = this.recent();
    return this.courses().filter((c) => {
      if (f === 'bookmarks' && !bm.has(c.id)) return false;
      if (f === 'recent' && !rc.includes(c.id)) return false;
      if (f !== 'all' && f !== 'bookmarks' && f !== 'recent' && c.id !== f) return false;
      if (!q) return true;
      return `${c.title} ${c.tagline}`.toLowerCase().includes(q);
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
    this.training
      .courses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.courses.set(res.data ?? []);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected isBookmarked(id: string): boolean {
    return this.bookmarks().has(id);
  }

  protected toggleBookmark(id: string): void {
    this.bookmarks.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      this.saveBookmarks(next);
      return next;
    });
  }

  protected markRecent(id: string): void {
    this.recent.update((list) => {
      const next = [id, ...list.filter((x) => x !== id)].slice(0, 10);
      try { localStorage.setItem('dp-library-recent', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  private loadBookmarks(): Set<string> {
    try {
      const raw = localStorage.getItem('dp-library-bookmarks');
      const ids = raw ? (JSON.parse(raw) as unknown) : [];
      return new Set(Array.isArray(ids) ? ids.map(String) : []);
    } catch { return new Set(); }
  }

  private saveBookmarks(set: Set<string>): void {
    try { localStorage.setItem('dp-library-bookmarks', JSON.stringify([...set])); } catch {}
  }

  private loadRecent(): string[] {
    try {
      const raw = localStorage.getItem('dp-library-recent');
      const ids = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(ids) ? ids.map(String).slice(0, 10) : [];
    } catch { return []; }
  }
}
