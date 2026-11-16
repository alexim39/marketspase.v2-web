import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { AvatarComponent } from '../../../../../_common/avatar.component';
import { PresenceService, PresenceStatus } from '../../../../../core/presence/presence.service';
import { WeeklyVideoService } from '../../../../../core/weekly-video/weekly-video.service';
import {
  CurrentWeeklyVideo,
  WeeklyVideoComments,
  WeeklyVideoReflection,
} from '../../../../../core/weekly-video/weekly-video.models';
import { ApiError, userError } from '../../../../../core/http/api-error';

/**
 * Dedicated reflection explorer. The weekly video page keeps a compact
 * preview; this page owns search and paged browsing so a large team thread
 * never turns the learning page into an endless feed.
 */
@Component({
  selector: 'async-weekly-video-reflections',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    RouterModule,
    PageSkeletonComponent,
    AvatarComponent,
  ],
  templateUrl: './reflections.component.html',
  styleUrls: ['./reflections.component.scss'],
})
export class WeeklyVideoReflectionsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly videoApi = inject(WeeklyVideoService);
  private readonly presence = inject(PresenceService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly videoId = signal('');
  protected readonly video = signal<CurrentWeeklyVideo | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly unlocked = signal(false);
  protected readonly items = signal<WeeklyVideoReflection[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly pageSize = 20;
  protected readonly listLoading = signal(false);
  protected readonly listError = signal<string | null>(null);
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly search = signal('');
  protected readonly presenceMap = signal<Record<string, string | null>>({});
  private requestSeq = 0;

  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  protected readonly rangeStart = computed(() => (this.total() === 0 ? 0 : this.page() * this.pageSize + 1));
  protected readonly rangeEnd = computed(() => Math.min((this.page() + 1) * this.pageSize, this.total()));
  protected readonly pageNumbers = computed(() => {
    const total = this.pages();
    const current = this.page();
    const size = Math.min(5, total);
    const start = Math.max(0, Math.min(current - 2, total - size));
    return Array.from({ length: size }, (_, index) => start + index);
  });

  ngOnInit(): void {
    const id = String(this.route.snapshot.paramMap.get('id') ?? '').trim();
    this.videoId.set(id);
    this.searchControl.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.search.set(String(value ?? '').trim());
        this.page.set(0);
        void this.loadPage(0);
      });

    if (!id) {
      this.error.set('Weekly video not found.');
      this.loading.set(false);
      return;
    }

    this.videoApi.detail(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.video.set(response.data ?? null);
          this.loading.set(false);
          if (!response.data?.commentsUnlocked) {
            this.unlocked.set(false);
            return;
          }
          this.unlocked.set(true);
          void this.loadPage(0);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  protected authorName(reflection: WeeklyVideoReflection): string {
    return reflection.author?.name || reflection.author?.username || 'Member';
  }

  protected presenceOf(authorId: string | null | undefined): PresenceStatus {
    if (!authorId) return null;
    return this.presence.statusOf(this.presenceMap()[String(authorId)] ?? null);
  }

  private refreshPresence(): void {
    const ids = this.items()
      .map((item) => item.author?.id)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) return;
    this.presence.lookup(ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((map) => {
        this.presenceMap.update((current) => ({ ...current, ...map }));
      });
  }

  protected clearSearch(): void {
    this.searchControl.setValue('');
  }

  protected goToPage(page: number): void {
    if (page < 0 || page >= this.pages() || page === this.page() || this.listLoading()) return;
    void this.loadPage(page);
  }

  protected retry(): void {
    if (!this.videoId()) return;
    void this.loadPage(this.page());
  }

  private async loadPage(page: number): Promise<void> {
    const id = this.videoId();
    if (!id) return;
    const seq = ++this.requestSeq;
    this.listLoading.set(true);
    this.listError.set(null);
    try {
      const data = await new Promise<WeeklyVideoComments | null>((resolve, reject) => {
        this.videoApi.comments(id, {
          limit: this.pageSize,
          skip: page * this.pageSize,
          q: this.search(),
        }).subscribe({
          next: (response) => resolve(response.data ?? null),
          error: reject,
        });
      });
      if (seq !== this.requestSeq) return;
      if (!data) return;
      this.unlocked.set(data.unlocked);
      if (!data.unlocked) {
        this.items.set([]);
        this.total.set(data.total ?? 0);
        return;
      }
      this.items.set(data.items ?? []);
      this.total.set(data.total ?? 0);
      this.page.set(page);
      this.refreshPresence();
    } catch (err) {
      if (seq !== this.requestSeq) return;
      this.listError.set(userError(err as ApiError));
    } finally {
      if (seq === this.requestSeq) this.listLoading.set(false);
    }
  }
}
