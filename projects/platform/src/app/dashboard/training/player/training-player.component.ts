import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { YouTubeApiService } from '@marketspase/shared/core/youtube/youtube-api.service';
import { Lesson } from '../../../core/training/training.models';

type PlayerState = 'idle' | 'starting' | 'ready' | 'playing' | 'ended' | 'error';

/**
 * Secure learning player for admin-added YouTube lessons.
 *
 * Same rules as Video of the Week: click-to-load, no seek bar, no keyboard
 * seeking, progress stops when the tab is hidden or playback pauses. The
 * parent owns the API call so the server remains the verification authority.
 */
@Component({
  selector: 'async-training-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
  host: { '(document:visibilitychange)': 'onVisibilityChange()' },
  templateUrl: './training-player.component.html',
  styleUrls: ['./training-player.component.scss'],
})
export class TrainingPlayerComponent implements OnChanges, OnDestroy {
  private readonly youtube = inject(YouTubeApiService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) lesson!: Lesson;
  @Input() verifiedPercent = 0;
  @Input() startSeconds = 0;
  @Input() requiredPercent = 90;

  @Output() verify = new EventEmitter<{ percent: number; seconds: number; ended: boolean }>();

  @ViewChild('playerHost') private playerHost?: ElementRef<HTMLElement>;

  protected readonly playerState = signal<PlayerState>('idle');
  protected readonly playerError = signal<string | null>(null);
  protected readonly playing = signal(false);
  protected readonly muted = signal(false);
  protected readonly captions = signal(false);
  protected readonly ended = signal(false);
  protected readonly starting = signal(false);

  private player: any = null;
  private heartbeatTimer: number | null = null;
  private heartbeatBusy = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lesson'] && !changes['lesson'].firstChange) {
      this.reset();
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
    this.destroyPlayer();
  }

  protected startVideo(): void {
    if (!this.lesson?.youtubeId || this.starting()) return;
    this.starting.set(true);
    this.playerError.set(null);
    this.playerState.set('starting');
    void this.createPlayer();
  }

  protected togglePlay(): void {
    if (!this.player) return;
    try {
      if (this.player.getPlayerState() === 1) {
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
    } catch { /* player not ready */ }
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
      if (document.fullscreenElement) void document.exitFullscreen();
      else void iframe.requestFullscreen?.();
    } catch { /* browser may block fullscreen */ }
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

  protected requestFullscreen(): void {
    this.toggleFullscreen();
  }

  protected formatDuration(seconds: number): string {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  protected onVisibilityChange(): void {
    if (document.visibilityState !== 'hidden' || !this.player) return;
    try {
      if (this.player.getPlayerState() === 1) {
        this.player.pauseVideo();
        this.playing.set(false);
        this.sendHeartbeat();
      }
    } catch { /* ignore */ }
  }

  private async createPlayer(): Promise<void> {
    const host = this.playerHost?.nativeElement;
    if (!host) {
      this.playerState.set('error');
      this.playerError.set('The player could not start. Reload the lesson and try again.');
      this.starting.set(false);
      return;
    }
    this.clearTimer();
    this.destroyPlayer();
    host.innerHTML = '';
    const mount = document.createElement('div');
    mount.style.width = '100%';
    mount.style.height = '100%';
    host.appendChild(mount);
    try {
      this.player = await this.youtube.createPlayer(mount, {
        videoId: this.lesson.youtubeId,
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
            this.starting.set(false);
            this.playerState.set('ready');
            try {
              this.player.setPlaybackRate(1);
              const duration = Number(this.player.getDuration()) || this.lesson.durationSec || 0;
              const resume = Math.min(Math.max(this.startSeconds, 0), Math.max(duration - 1, 0));
              if (resume > 0 && !this.lesson.completed) this.player.seekTo(resume, true);
              this.player.playVideo();
              this.playing.set(true);
              this.playerState.set('playing');
            } catch {
              // Browser autoplay rules may keep it paused; the controls work.
            }
            this.startTimer();
          },
          onStateChange: (event: any) => {
            const state = Number(event.data);
            if (state === 1) {
              this.playing.set(true);
              this.ended.set(false);
              this.playerState.set('playing');
            } else if (state === 2 || state === 3 || state === 5) {
              this.playing.set(false);
            } else if (state === 0) {
              this.playing.set(false);
              this.ended.set(true);
              this.playerState.set('ended');
              const duration = Number(this.player.getDuration()) || this.lesson.durationSec || 0;
              this.emitVerify(duration, true);
            }
          },
          onError: () => {
            this.starting.set(false);
            this.playerState.set('error');
            this.playerError.set('YouTube could not play this video. It may not allow embedding. Contact support.');
          },
        },
      });
    } catch (error) {
      this.starting.set(false);
      this.playerState.set('error');
      this.playerError.set(error instanceof Error ? error.message : 'Could not load the YouTube player.');
    }
  }

  private startTimer(): void {
    this.clearTimer();
    this.heartbeatTimer = window.setInterval(() => this.sendHeartbeat(), 10000);
  }

  private clearTimer(): void {
    if (this.heartbeatTimer !== null) window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private sendHeartbeat(): void {
    if (!this.player || this.heartbeatBusy) return;
    let seconds = 0;
    try {
      seconds = Number(this.player.getCurrentTime()) || 0;
    } catch {
      return;
    }
    this.emitVerify(seconds, false);
  }

  private emitVerify(seconds: number, ended: boolean): void {
    if (!this.player || this.heartbeatBusy) return;
    const duration = Number(this.player.getDuration()) || this.lesson.durationSec || 0;
    const safeSeconds = Math.max(0, Math.round(seconds));
    const percent = duration > 0
      ? Math.min(100, Math.max(0, Math.round((safeSeconds / duration) * 100)))
      : 0;
    this.heartbeatBusy = true;
    this.verify.emit({ percent, seconds: safeSeconds, ended });
    window.setTimeout(() => { this.heartbeatBusy = false; }, 800);
  }

  private reset(): void {
    this.clearTimer();
    this.destroyPlayer();
    this.playerState.set('idle');
    this.playerError.set(null);
    this.playing.set(false);
    this.muted.set(false);
    this.captions.set(false);
    this.ended.set(false);
    this.starting.set(false);
  }

  private destroyPlayer(): void {
    try {
      this.player?.destroy?.();
    } catch { /* already gone */ }
    this.player = null;
  }
}
