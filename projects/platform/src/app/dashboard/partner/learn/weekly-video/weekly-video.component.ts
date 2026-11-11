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
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { YouTubeApiService } from '@marketspase/shared/core/youtube/youtube-api.service';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { ApiError, userError } from '../../../../core/http/api-error';
import { WeeklyVideoService } from '../../../../core/weekly-video/weekly-video.service';
import {
  CurrentWeeklyVideo,
  WeeklyVideoHistoryItem,
  WeeklyVideoProgress,
  WeeklyVideoPublic,
  WeeklyVideoReflection,
} from '../../../../core/weekly-video/weekly-video.models';

type PlayerState = 'idle' | 'starting' | 'ready' | 'playing' | 'ended' | 'error';

@Component({
  selector: 'async-weekly-video',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    PageSkeletonComponent,
    RouterModule,
  ],
  host: { '(document:visibilitychange)': 'onVisibilityChange()' },
  templateUrl: './weekly-video.component.html',
  styleUrls: ['./weekly-video.component.scss'],
})
export class WeeklyVideoComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly videoApi = inject(WeeklyVideoService);
  private readonly youtube = inject(YouTubeApiService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('playerHost') private playerHost?: ElementRef<HTMLElement>;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<CurrentWeeklyVideo | null>(null);
  protected readonly history = signal<WeeklyVideoHistoryItem[]>([]);
  protected readonly playerState = signal<PlayerState>('idle');
  protected readonly playerError = signal<string | null>(null);
  protected readonly playing = signal(false);
  protected readonly muted = signal(false);
  protected readonly captions = signal(false);
  protected readonly ended = signal(false);
  protected readonly verifiedPercent = signal(0);
  protected readonly comments = signal<WeeklyVideoReflection[]>([]);
  protected readonly commentsTotal = signal(0);
  protected readonly commentsLoading = signal(false);
  protected readonly commentsLoadingMore = signal(false);
  protected readonly commentsHasMore = signal(false);
  protected readonly commentsCursor = signal<string | null>(null);
  protected readonly commentsError = signal<string | null>(null);
  protected readonly heartbeatError = signal<string | null>(null);
  protected readonly reflectionText = signal('');
  protected readonly reflectionSaving = signal(false);
  protected readonly reflectionError = signal<string | null>(null);
  protected readonly reflectionNotice = signal<string | null>(null);
  protected readonly editingReflection = signal(false);
  protected readonly actionBusy = signal(false);
  protected readonly sessionId = signal<string | null>(null);

  private player: any = null;
  private heartbeatTimer: number | null = null;
  private heartbeatBusy = false;
  private commentsLoadedFor: string | null = null;
  private readonly commentsPageSize = 20;

  protected readonly video = computed(() => this.data()?.video ?? null);
  protected readonly progress = computed(() => this.data()?.progress ?? null);
  protected readonly reflection = computed(() => this.data()?.reflection ?? null);
  protected readonly engagement = computed(() => this.data()?.engagement ?? null);
  protected readonly remainingPercent = computed(() => {
    const required = this.engagement()?.completionPercent ?? 90;
    return Math.max(0, Math.ceil((required - this.verifiedPercent()) * 10) / 10);
  });
  protected readonly weekCommitted = computed(() => Boolean(this.progress()?.completed && this.reflection()));
  protected readonly isCurrentWeek = computed(() => {
    const video = this.video();
    const engagement = this.engagement();
    return Boolean(video && engagement && video.weekStart === engagement.currentWeek);
  });
  protected readonly statusLabel = computed(() => {
    if (!this.video()) return 'No video';
    if (this.weekCommitted()) return 'Week complete';
    if (this.progress()?.completed) return 'Reflection pending';
    if ((this.progress()?.percent ?? 0) > 0) return 'In progress';
    return 'Not started';
  });
  protected readonly reflectionReady = computed(() => this.reflectionText().trim().length >= 20);
  protected readonly pastVideos = computed(() => {
    const currentId = this.video()?.id;
    return this.history().filter((item) => item.id !== currentId);
  });
  protected readonly playerActive = computed(() => (
    this.playerState() === 'ready'
    || this.playerState() === 'playing'
    || this.playerState() === 'ended'
  ));

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params.get('id');
        this.load(id);
      });
  }

  ngOnDestroy(): void {
    this.clearTimers();
    this.destroyPlayer();
  }

  protected load(id: string | null): void {
    this.loading.set(true);
    this.error.set(null);
    this.resetPlayer();
    this.comments.set([]);
    this.commentsTotal.set(0);
    this.commentsHasMore.set(false);
    this.commentsCursor.set(null);
    this.commentsLoadingMore.set(false);
    this.commentsError.set(null);
    this.reflectionText.set('');
    this.reflectionError.set(null);
    this.reflectionNotice.set(null);
    this.editingReflection.set(false);

    const main = id ? this.videoApi.detail(id) : this.videoApi.current();
    forkJoin({
      main: main.pipe(catchError((err) => {
        this.error.set(userError(err as ApiError));
        return of(null);
      })),
      history: this.videoApi.list().pipe(catchError(() => of(null))),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: ({ main: response, history }) => {
        if (!response) return;
        const current = response.data ?? null;
        this.data.set(current);
        this.history.set(history?.data?.items ?? []);
        this.verifiedPercent.set(current?.progress?.percent ?? 0);
        if (current?.progress?.completed) this.loadComments();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected retry(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.load(id);
  }

  protected async startVideo(): Promise<void> {
    const video = this.video();
    if (!video || this.actionBusy()) return;
    this.actionBusy.set(true);
    this.playerError.set(null);
    this.playerState.set('starting');
    try {
      const response = await new Promise<WeeklyVideoProgress | null>((resolve, reject) => {
        this.videoApi.startWatch(video.id).subscribe({
          next: (res) => {
            if (!res.data) {
              reject(new Error('The watch session was not created.'));
              return;
            }
            this.sessionId.set(res.data.sessionId);
            resolve(res.data.progress);
          },
          error: reject,
        });
      });
      if (response) this.updateProgress(response);
      await this.createPlayer(video, response?.lastPositionSeconds ?? 0);
    } catch (err) {
      this.playerState.set('error');
      this.playerError.set(userError(err as ApiError));
    } finally {
      this.actionBusy.set(false);
    }
  }

  protected togglePlay(): void {
    if (!this.player) return;
    try {
      const state = this.player.getPlayerState();
      if (state === 1) {
        this.player.pauseVideo();
        this.playing.set(false);
        this.sendHeartbeat();
      } else {
        this.player.playVideo();
        this.playing.set(true);
        this.playerState.set('playing');
      }
    } catch {
      this.playerError.set('The player is not ready yet.');
    }
  }

  protected toggleMute(): void {
    if (!this.player) return;
    try {
      if (this.player.isMuted()) {
        this.player.unMute();
        this.muted.set(false);
      } else {
        this.player.mute();
        this.muted.set(true);
      }
    } catch {
      // ignore a player that is not ready
    }
  }

  protected toggleCaptions(): void {
    if (!this.player) return;
    try {
      const next = !this.captions();
      this.player.setOption('captions', 'track', next ? { languageCode: 'en' } : {});
      this.captions.set(next);
    } catch {
      this.playerError.set('Captions are not available for this video.');
    }
  }

  protected toggleFullscreen(): void {
    try {
      const iframe = this.player?.getIframe?.() as HTMLIFrameElement | undefined;
      if (!iframe) return;
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void iframe.requestFullscreen?.();
      }
    } catch {
      // fullscreen can be blocked by the browser
    }
  }

  protected replay(): void {
    if (!this.player) return;
    try {
      this.ended.set(false);
      this.playerState.set('ready');
      this.player.seekTo(0, true);
      this.player.playVideo();
      this.playing.set(true);
    } catch {
      this.playerError.set('The player is not ready yet.');
    }
  }

  protected onVisibilityChange(): void {
    if (document.visibilityState !== 'hidden' || !this.player) return;
    try {
      if (this.player.getPlayerState() === 1) {
        this.player.pauseVideo();
        this.playing.set(false);
        this.sendHeartbeat(undefined, false);
      }
    } catch {
      // ignore
    }
  }

  protected async loadComments(force = false): Promise<void> {
    const video = this.video();
    if (!video || !this.progress()?.completed) return;
    if (!force && this.commentsLoadedFor === video.id) return;
    this.commentsLoading.set(true);
    this.commentsError.set(null);
    if (force) {
      this.comments.set([]);
      this.commentsTotal.set(0);
      this.commentsHasMore.set(false);
      this.commentsCursor.set(null);
      this.commentsLoadedFor = null;
    }
    try {
      const data = await new Promise<{
        items: WeeklyVideoReflection[];
        total: number;
        hasMore: boolean;
        nextCursor: string | null;
      } | null>((resolve, reject) => {
        this.videoApi.comments(video.id, { limit: this.commentsPageSize }).subscribe({
          next: (res) => {
            if (!res.data) {
              resolve(null);
              return;
            }
            resolve({
              items: res.data.items ?? [],
              total: res.data.total ?? 0,
              hasMore: res.data.hasMore === true,
              nextCursor: res.data.nextCursor ?? null,
            });
          },
          error: reject,
        });
      });
      if (data) {
        this.comments.set(data.items);
        this.commentsTotal.set(data.total);
        this.commentsHasMore.set(data.hasMore);
        this.commentsCursor.set(data.nextCursor);
        this.commentsLoadedFor = video.id;
      }
    } catch {
      this.commentsError.set('Reflections could not be loaded. Please try again.');
    } finally {
      this.commentsLoading.set(false);
    }
  }

  protected async loadMoreComments(): Promise<void> {
    const video = this.video();
    const cursor = this.commentsCursor();
    if (!video || !cursor || !this.commentsHasMore() || this.commentsLoadingMore()) return;
    this.commentsLoadingMore.set(true);
    this.commentsError.set(null);
    try {
      const data = await new Promise<{
        items: WeeklyVideoReflection[];
        total: number;
        hasMore: boolean;
        nextCursor: string | null;
      } | null>((resolve, reject) => {
        this.videoApi.comments(video.id, {
          limit: this.commentsPageSize,
          cursor,
        }).subscribe({
          next: (res) => {
            if (!res.data) {
              resolve(null);
              return;
            }
            resolve({
              items: res.data.items ?? [],
              total: res.data.total ?? 0,
              hasMore: res.data.hasMore === true,
              nextCursor: res.data.nextCursor ?? null,
            });
          },
          error: reject,
        });
      });
      if (data) {
        const seen = new Set(this.comments().map((item) => item.id));
        const appended = data.items.filter((item) => !seen.has(item.id));
        this.comments.update((current) => [...current, ...appended]);
        this.commentsTotal.set(data.total);
        this.commentsHasMore.set(data.hasMore);
        this.commentsCursor.set(data.nextCursor);
      }
    } catch {
      this.commentsError.set('More reflections could not be loaded. Please try again.');
    } finally {
      this.commentsLoadingMore.set(false);
    }
  }

  protected async submitReflection(): Promise<void> {
    const video = this.video();
    const body = this.reflectionText().trim();
    if (!video || this.reflectionSaving()) return;
    if (body.length < 20) {
      this.reflectionError.set('Write at least 20 characters about what you learned.');
      return;
    }
    this.reflectionSaving.set(true);
    this.reflectionError.set(null);
    this.reflectionNotice.set(null);
    try {
      const result = await new Promise<{ comment: WeeklyVideoReflection; engagement: CurrentWeeklyVideo['engagement'] } | null>((resolve, reject) => {
        this.videoApi.reflect(video.id, body).subscribe({
          next: (res) => resolve(res.data ?? null),
          error: reject,
        });
      });
      if (result?.comment) {
        this.data.update((current) => current ? {
          ...current,
          reflection: result.comment,
          engagement: result.engagement ?? current.engagement,
        } : current);
        this.reflectionNotice.set('Reflection saved. Thank you for doing the work.');
        this.editingReflection.set(false);
        this.reflectionText.set(result.comment.body);
        await this.loadComments(true);
      }
    } catch (err) {
      this.reflectionError.set(userError(err as ApiError));
    } finally {
      this.reflectionSaving.set(false);
    }
  }

  protected editReflection(): void {
    const reflection = this.reflection();
    if (!reflection) return;
    this.reflectionText.set(reflection.body);
    this.editingReflection.set(true);
    this.reflectionNotice.set(null);
    this.reflectionError.set(null);
  }

  protected cancelEditReflection(): void {
    this.editingReflection.set(false);
    this.reflectionText.set(this.reflection()?.body ?? '');
    this.reflectionError.set(null);
  }

  protected selectHistory(item: WeeklyVideoHistoryItem): void {
    if (item.id === this.video()?.id) return;
    void this.router.navigate(['/dashboard/learn/video-of-the-week', item.id]);
  }

  protected goCurrent(): void {
    void this.router.navigate(['/dashboard/learn/video-of-the-week']);
  }

  protected historyStatus(item: WeeklyVideoHistoryItem): string {
    if (item.progress?.completed && item.reflected) return 'Complete';
    if (item.progress?.completed) return 'Reflection pending';
    if ((item.progress?.percent ?? 0) > 0) return `${Math.round(item.progress?.percent ?? 0)}% watched`;
    return 'Not started';
  }

  protected historyTone(item: WeeklyVideoHistoryItem): string {
    if (item.progress?.completed && item.reflected) return 'ok';
    if (item.progress?.completed) return 'warn';
    if ((item.progress?.percent ?? 0) > 0) return 'info';
    return 'muted';
  }

  protected formatDuration(seconds: number): string {
    const total = Math.max(Number(seconds) || 0, 0);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  protected authorName(reflection: WeeklyVideoReflection): string {
    return reflection.author?.name || reflection.author?.username || 'Member';
  }

  protected initials(reflection: WeeklyVideoReflection): string {
    return this.authorName(reflection).slice(0, 1).toUpperCase();
  }

  protected reflectionCountLabel(): string {
    const count = this.commentsTotal() || this.data()?.commentCount || 0;
    return count === 1 ? '1 reflection' : `${count} reflections`;
  }

  private async createPlayer(video: WeeklyVideoPublic, resumeAt: number): Promise<void> {
    const host = this.playerHost?.nativeElement;
    if (!host) throw new Error('Player host is not ready.');
    this.clearTimers();
    this.destroyPlayer();
    host.innerHTML = '';
    const mount = document.createElement('div');
    mount.style.width = '100%';
    mount.style.height = '100%';
    host.appendChild(mount);
    this.player = await this.youtube.createPlayer(mount, {
      videoId: video.youtubeId,
      width: '100%',
      height: '100%',
      host: 'https://www.youtube-nocookie.com',
      playerVars: {
        controls: 0,
        disablekb: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        enablejsapi: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: (event: any) => {
          this.player = event.target;
          this.playerState.set('ready');
          try {
            this.player.setPlaybackRate(1);
            if (resumeAt > 0 && resumeAt < video.durationSeconds - 1) {
              this.player.seekTo(resumeAt, true);
            }
            this.player.playVideo();
            this.playing.set(true);
          } catch {
            // browser autoplay policies may keep the player paused
          }
          this.startTimers();
        },
        onStateChange: (event: any) => {
          const state = Number(event.data);
          if (state === 1) {
            this.playerState.set('playing');
            this.playing.set(true);
            this.ended.set(false);
          } else if (state === 2 || state === 3 || state === 5) {
            this.playing.set(false);
          } else if (state === 0) {
            this.playing.set(false);
            this.ended.set(true);
            this.playerState.set('ended');
            this.sendHeartbeat(video.durationSeconds, true, true);
          }
        },
        onError: () => {
          this.playerState.set('error');
          this.playerError.set('YouTube could not play this video. It may not allow embedding. Contact support.');
        },
      },
    });
  }

  private startTimers(): void {
    this.clearTimers();
    this.heartbeatTimer = window.setInterval(() => this.sendHeartbeat(), 10000);
  }

  private clearTimers(): void {
    if (this.heartbeatTimer !== null) window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private sendHeartbeat(
    positionOverride?: number,
    playingOverride?: boolean,
    visibleOverride?: boolean,
  ): void {
    const video = this.video();
    const sessionId = this.sessionId();
    if (!video || !sessionId || !this.player) return;
    if (this.heartbeatBusy) {
      if (visibleOverride === true && playingOverride === true) {
        window.setTimeout(() => this.sendHeartbeat(positionOverride, playingOverride, visibleOverride), 1200);
      }
      return;
    }
    let position = positionOverride;
    let playing = playingOverride;
    try {
      position = position ?? (Number(this.player.getCurrentTime()) || 0);
      playing = playing ?? (this.player.getPlayerState() === 1);
    } catch {
      return;
    }
    this.heartbeatBusy = true;
    this.videoApi.heartbeat(video.id, {
      sessionId,
      positionSeconds: Math.max(0, Math.round((position ?? 0) * 10) / 10),
      playing: playing === true,
      visible: visibleOverride ?? (document.visibilityState !== 'hidden' && !this.ended()),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.heartbeatBusy = false;
        this.heartbeatError.set(null);
        if (response.data) this.updateProgress(response.data);
        if (response.data?.completed) this.loadComments();
      },
      error: () => {
        this.heartbeatBusy = false;
        this.heartbeatError.set('Watch progress could not be saved. Check your connection.');
      },
    });
  }

  private updateProgress(progress: WeeklyVideoProgress): void {
    this.data.update((current) => current ? { ...current, progress } : current);
    this.verifiedPercent.set(progress.percent);
  }

  private resetPlayer(): void {
    this.clearTimers();
    this.destroyPlayer();
    this.playerState.set('idle');
    this.playerError.set(null);
    this.playing.set(false);
    this.muted.set(false);
    this.captions.set(false);
    this.ended.set(false);
    this.verifiedPercent.set(0);
    this.sessionId.set(null);
    this.heartbeatError.set(null);
    this.commentsLoadedFor = null;
  }

  private destroyPlayer(): void {
    try {
      this.player?.destroy?.();
    } catch {
      // ignore a player that is already gone
    }
    this.player = null;
  }
}
