import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { YouTubeApiService } from '@marketspase/shared/core/youtube/youtube-api.service';
import { ApiError, userError } from '../../../core/http/api-error';
import {
  AdminWeeklyVideo,
  AdminWeeklyVideosService,
  WeeklyComment,
  WeeklyVideoStats,
} from './admin-weekly-videos.service';

type PublishMode = 'draft' | 'now' | 'schedule';

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

const extractId = (input: string): string | null => {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  if (YOUTUBE_ID.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0] ?? '';
      return YOUTUBE_ID.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v') ?? '';
        return YOUTUBE_ID.test(id) ? id : null;
      }
      for (const prefix of ['/embed/', '/shorts/', '/live/', '/v/']) {
        if (url.pathname.startsWith(prefix)) {
          const id = url.pathname.slice(prefix.length).split('/')[0] ?? '';
          if (YOUTUBE_ID.test(id)) return id;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
};

const pad = (value: number) => String(value).padStart(2, '0');

const localDateTime = (date: Date): string => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
);

const nextMonday = (): Date => {
  const date = new Date();
  const day = date.getDay();
  const days = day === 1 ? 0 : (8 - day) % 7;
  date.setDate(date.getDate() + days);
  date.setHours(8, 0, 0, 0);
  if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 7);
  return date;
};

const mondayOf = (date: Date): string => {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return `${copy.getFullYear()}-${pad(copy.getMonth() + 1)}-${pad(copy.getDate())}`;
};

@Component({
  selector: 'async-admin-weekly-videos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    ReactiveFormsModule,
    RouterModule,
  ],
  templateUrl: './admin-weekly-videos.component.html',
  styleUrls: ['./admin-weekly-videos.component.scss'],
})
export class AdminWeeklyVideosComponent implements OnInit, OnDestroy {
  private readonly api = inject(AdminWeeklyVideosService);
  private readonly youtube = inject(YouTubeApiService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('previewHost') private previewHost?: ElementRef<HTMLElement>;

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly detecting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly rows = signal<AdminWeeklyVideo[]>([]);
  protected readonly showForm = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly previewId = signal<string | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly stats = signal<WeeklyVideoStats | null>(null);
  protected readonly statsLoading = signal(false);
  protected readonly commentsLoadingMore = signal(false);
  protected readonly busyId = signal<string | null>(null);
  protected readonly archiveConfirm = signal<string | null>(null);
  protected readonly displayedColumns = ['week', 'video', 'status', 'delivery', 'engagement', 'actions'];
  protected readonly participantColumns = ['member', 'watch', 'completed', 'reflection', 'lastSeen'];
  protected readonly commentColumns = ['author', 'reflection', 'status', 'action'];

  protected readonly selected = computed(() => (
    this.rows().find((row) => row.id === this.selectedId()) ?? null
  ));
  protected readonly editing = computed(() => (
    this.rows().find((row) => row.id === this.editingId()) ?? null
  ));
  protected readonly isPublished = computed(() => this.editing()?.status === 'published');

  protected readonly form = this.fb.nonNullable.group({
    youtubeUrl: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(300)]],
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
    weekStart: [mondayOf(new Date()), Validators.required],
    durationSeconds: [0, [Validators.required, Validators.min(15), Validators.max(14400)]],
    publishMode: ['now' as PublishMode, Validators.required],
    publishAt: [localDateTime(nextMonday())],
  });

  private player: any = null;

  ngOnInit(): void {
    this.form.controls.youtubeUrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const id = extractId(value);
        const changed = id !== this.previewId();
        this.previewId.set(id);
        if (changed) {
          this.form.controls.durationSeconds.setValue(0);
          this.detecting.set(false);
        }
        this.formError.set(null);
      });
    this.form.controls.publishMode.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((mode) => {
        this.formError.set(null);
        if (mode === 'schedule') {
          const date = new Date(this.form.controls.publishAt.value);
          if (!Number.isNaN(date.getTime())) this.form.controls.weekStart.setValue(mondayOf(date));
        }
      });
    this.form.controls.publishAt.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (this.form.controls.publishMode.value !== 'schedule') return;
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) this.form.controls.weekStart.setValue(mondayOf(date));
      });
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.rows.set(response.data?.items ?? []);
        this.loading.set(false);
      },
      error: (err: ApiError) => {
        this.error.set(userError(err));
        this.loading.set(false);
      },
    });
  }

  protected startNew(): void {
    this.destroyPlayer();
    this.enableEditingFields();
    this.editingId.set(null);
    this.selectedId.set(null);
    this.stats.set(null);
    this.showForm.set(true);
    this.formError.set(null);
    this.previewId.set(null);
    this.form.reset({
      youtubeUrl: '',
      title: '',
      description: '',
      weekStart: mondayOf(new Date()),
      durationSeconds: 0,
      publishMode: 'now',
      publishAt: localDateTime(nextMonday()),
    });
  }

  protected startEdit(row: AdminWeeklyVideo): void {
    this.destroyPlayer();
    this.editingId.set(row.id);
    this.selectedId.set(row.id);
    this.showForm.set(true);
    this.formError.set(null);
    this.previewId.set(row.youtubeId);
    this.form.reset({
      youtubeUrl: row.youtubeUrl ?? `https://www.youtube.com/watch?v=${row.youtubeId}`,
      title: row.title,
      description: row.description,
      weekStart: row.weekStart,
      durationSeconds: row.durationSeconds,
      publishMode: row.status === 'scheduled' ? 'schedule' : 'now',
      publishAt: row.publishAt ? localDateTime(new Date(row.publishAt)) : localDateTime(nextMonday()),
    });
    if (row.status === 'published' || row.status === 'archived') {
      this.form.controls.youtubeUrl.disable();
      this.form.controls.weekStart.disable();
      this.form.controls.durationSeconds.disable();
    } else {
      this.form.controls.youtubeUrl.enable();
      this.form.controls.weekStart.enable();
      this.form.controls.durationSeconds.enable();
    }
    this.loadStats(row.id);
  }

  protected cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.destroyPlayer();
    this.formError.set(null);
    this.enableEditingFields();
  }

  protected thumb(id: string | null | undefined): string {
    return id ? `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg` : '';
  }

  protected previewTitle(): string {
    return this.form.controls.title.value || 'Weekly video preview';
  }

  protected durationLabel(seconds: number): string {
    const total = Math.max(Number(seconds) || 0, 0);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${pad(secs)}`;
  }

  protected statusTone(status: string): string {
    if (status === 'published') return 'ok';
    if (status === 'scheduled') return 'info';
    if (status === 'archived') return 'muted';
    return 'warn';
  }

  protected completionTone(value: number): string {
    if (value >= 80) return 'ok';
    if (value >= 40) return 'warn';
    return 'bad';
  }

  protected async loadPreview(): Promise<void> {
    const id = extractId(this.form.controls.youtubeUrl.value);
    if (!id) {
      this.formError.set('Paste a valid YouTube link first.');
      return;
    }
    this.previewId.set(id);
    this.detecting.set(true);
    this.formError.set(null);
    try {
      this.destroyPlayer();
      const host = this.previewHost?.nativeElement;
      if (!host) throw new Error('Preview is not ready yet.');
      host.innerHTML = '';
      const mount = document.createElement('div');
      mount.style.width = '100%';
      mount.style.height = '100%';
      host.appendChild(mount);
      this.player = await this.youtube.createPlayer(mount, {
        videoId: id,
        width: '100%',
        height: '100%',
        playerVars: {
          controls: 1,
          rel: 0,
          playsinline: 1,
          modestbranding: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            const duration = Math.round(Number(event.target.getDuration()) || 0);
            if (duration > 0) {
              this.form.controls.durationSeconds.setValue(duration);
              this.form.controls.durationSeconds.markAsDirty();
            }
            const data = event.target.getVideoData?.() ?? {};
            if (!this.form.controls.title.value && data.title) {
              this.form.controls.title.setValue(String(data.title).slice(0, 120));
            }
            this.detecting.set(false);
          },
          onError: () => {
            this.formError.set('YouTube could not load this video. Check that embedding is allowed, then enter the duration manually.');
            this.detecting.set(false);
          },
        },
      });
    } catch (error) {
      this.detecting.set(false);
      this.formError.set(error instanceof Error ? error.message : 'Could not load the YouTube preview.');
    }
  }

  protected async save(mode: PublishMode): Promise<void> {
    if (this.saving() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    this.notice.set(null);
    const raw = this.form.getRawValue();
    if (mode === 'schedule') {
      const scheduled = new Date(raw.publishAt);
      if (Number.isNaN(scheduled.getTime())) {
        this.formError.set('Choose a valid date and time to schedule the video.');
        this.saving.set(false);
        return;
      }
    }
    const payload = {
      youtubeUrl: raw.youtubeUrl,
      title: raw.title.trim(),
      description: raw.description.trim(),
      weekStart: raw.weekStart,
      durationSeconds: Number(raw.durationSeconds),
    };
    try {
      const saved = this.editingId()
        ? await new Promise<AdminWeeklyVideo>((resolve, reject) => {
          this.api.update(this.editingId() as string, payload).subscribe({
            next: (response) => {
              if (!response.data) {
                reject(new Error('The server did not return the saved video.'));
                return;
              }
              resolve(response.data);
            },
            error: reject,
          });
        })
        : await new Promise<AdminWeeklyVideo>((resolve, reject) => {
          this.api.create(payload).subscribe({
            next: (response) => {
              if (!response.data) {
                reject(new Error('The server did not return the saved video.'));
                return;
              }
              resolve(response.data);
            },
            error: reject,
          });
        });

      if (mode !== 'draft') {
        const publishAt = mode === 'schedule'
          ? new Date(raw.publishAt).toISOString()
          : null;
        const published = await new Promise<{ scheduled: boolean; notification?: { delivered?: number } | null }>((resolve, reject) => {
          this.api.publish(saved.id, publishAt).subscribe({
            next: (response) => {
              if (!response.data) {
                reject(new Error('The server did not return the publish result.'));
                return;
              }
              resolve(response.data);
            },
            error: reject,
          });
        });
        this.notice.set(published.scheduled
          ? `Scheduled for ${new Date(raw.publishAt).toLocaleString()}.`
          : `Published — ${published.notification?.delivered ?? 0} members notified.`);
      } else {
        this.notice.set('Draft saved.');
      }
      this.showForm.set(false);
      this.editingId.set(null);
      this.destroyPlayer();
      this.enableEditingFields();
      this.reload();
    } catch (error) {
      this.formError.set(userError(error as ApiError));
    } finally {
      this.saving.set(false);
    }
  }

  protected publishNow(row: AdminWeeklyVideo): void {
    if (this.busyId()) return;
    this.busyId.set(row.id);
    this.error.set(null);
    this.api.publish(row.id).subscribe({
      next: (response) => {
        this.busyId.set(null);
        const delivered = response.data?.notification?.delivered ?? 0;
        this.notice.set(`${row.title} published — ${delivered} members notified.`);
        this.reload();
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        this.error.set(userError(err));
      },
    });
  }

  protected archive(row: AdminWeeklyVideo): void {
    if (this.busyId()) return;
    if (this.archiveConfirm() !== row.id) {
      this.archiveConfirm.set(row.id);
      return;
    }
    this.archiveConfirm.set(null);
    this.busyId.set(row.id);
    this.api.archive(row.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.notice.set(`${row.title} archived.`);
        if (this.selectedId() === row.id) this.selectedId.set(null);
        this.reload();
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        this.error.set(userError(err));
      },
    });
  }

  protected retryNotify(row: AdminWeeklyVideo): void {
    if (this.busyId()) return;
    this.busyId.set(row.id);
    this.api.notify(row.id).subscribe({
      next: (response) => {
        this.busyId.set(null);
        this.notice.set(`Notifications retried — ${response.data?.notification?.delivered ?? 0} delivered.`);
        this.reload();
        if (this.selectedId() === row.id) this.loadStats(row.id);
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        this.error.set(userError(err));
      },
    });
  }

  protected toggleStats(row: AdminWeeklyVideo): void {
    if (this.selectedId() === row.id) {
      this.selectedId.set(null);
      this.stats.set(null);
      return;
    }
    this.selectedId.set(row.id);
    this.loadStats(row.id);
  }

  protected loadStats(id: string): void {
    this.statsLoading.set(true);
    this.api.stats(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.stats.set(response.data ?? null);
        this.statsLoading.set(false);
      },
      error: (err: ApiError) => {
        this.error.set(userError(err));
        this.statsLoading.set(false);
      },
    });
  }

  protected async loadMoreAdminComments(): Promise<void> {
    const id = this.selectedId();
    const current = this.stats();
    if (!id || !current || this.commentsLoadingMore()) return;
    const loaded = current.comments.items.length;
    if (loaded >= current.comments.total) return;
    this.commentsLoadingMore.set(true);
    try {
      const data = await new Promise<{ items: WeeklyComment[]; total: number } | null>((resolve, reject) => {
        this.api.comments(id, { limit: 50, skip: loaded }).subscribe({
          next: (response) => {
            if (!response.data) {
              resolve(null);
              return;
            }
            resolve({ items: response.data.items ?? [], total: response.data.total ?? 0 });
          },
          error: reject,
        });
      });
      if (data) {
        this.stats.update((stats) => {
          if (!stats) return stats;
          const seen = new Set(stats.comments.items.map((item) => item.id));
          const appended = data.items.filter((item) => !seen.has(item.id));
          return {
            ...stats,
            comments: {
              items: [...stats.comments.items, ...appended],
              total: data.total,
            },
          };
        });
      }
    } catch (error) {
      this.error.set(userError(error as ApiError));
    } finally {
      this.commentsLoadingMore.set(false);
    }
  }

  protected async toggleComment(comment: WeeklyComment): Promise<void> {
    const next = comment.status === 'visible' ? 'hidden' : 'visible';
    this.busyId.set(comment.id);
    try {
      await new Promise<void>((resolve, reject) => {
        this.api.moderateComment(comment.id, next).subscribe({
          next: () => resolve(),
          error: reject,
        });
      });
      this.notice.set(next === 'hidden' ? 'Reflection hidden.' : 'Reflection restored.');
      if (this.selectedId()) this.loadStats(this.selectedId() as string);
    } catch (error) {
      this.error.set(userError(error as ApiError));
    } finally {
      this.busyId.set(null);
    }
  }

  protected canEdit(row: AdminWeeklyVideo): boolean {
    return row.status !== 'archived';
  }

  protected canPublish(row: AdminWeeklyVideo): boolean {
    return row.status === 'draft' || row.status === 'scheduled';
  }

  protected authorName(author: { name?: string; username?: string } | null): string {
    return author?.name || author?.username || 'Member';
  }

  protected initials(author: { name?: string; username?: string } | null): string {
    const name = this.authorName(author);
    return name.slice(0, 1).toUpperCase();
  }

  private enableEditingFields(): void {
    this.form.controls.youtubeUrl.enable();
    this.form.controls.weekStart.enable();
    this.form.controls.durationSeconds.enable();
  }

  private destroyPlayer(): void {
    try {
      this.player?.destroy?.();
    } catch {
      // ignore a player that was already removed
    }
    this.player = null;
  }

  ngOnDestroy(): void {
    this.destroyPlayer();
  }
}
