import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { TutorialGroup, TutorialService } from '../../../core/tutorials/tutorial.service';
import { ApiError } from '../../../core/http/api-error';

/**
 * @title Platform tutorials — how-to videos by app area.
 *
 * YouTube embeds (nocookie) behind a click-to-load facade so a full
 * library never tanks page speed. Embed URLs are built from verified
 * ids only — raw admin strings never reach an iframe.
 * OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-tutorials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/training">Academy</a> &gt;
        <span>Tutorials</span>
      </div>
    </section>

    <section class="tutorials-page">
      <div class="page-head">
        <div>
          <h2>Platform tutorials</h2>
          <p class="subtitle">Short videos for every part of the app — watch, then try it.</p>
        </div>
        <a mat-button routerLink="/dashboard/training">Academy</a>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading tutorials" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (groups().length > 0) {
        @for (group of groups(); track group.area) {
          <div class="dp-card area-card">
            <h3>{{ group.area }}</h3>
            <div class="video-grid">
              @for (video of group.items; track video.id) {
                <article class="video-card">
                  @if (openId() === video.id) {
                    <div class="player">
                      <iframe
                        [src]="embedUrl(video.youtubeId)"
                        title="{{ video.title }}"
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                        referrerpolicy="strict-origin-when-cross-origin"
                      ></iframe>
                    </div>
                  } @else {
                    <button class="thumb" (click)="openId.set(video.id)" [attr.aria-label]="'Play ' + video.title">
                      <img [src]="thumbUrl(video.youtubeId)" [alt]="video.title" loading="lazy" />
                      <span class="play"><mat-icon aria-hidden="true">play_circle</mat-icon></span>
                    </button>
                  }
                  <div class="video-meta">
                    <strong>{{ video.title }}</strong>
                    @if (video.description) {
                      <span class="muted">{{ video.description }}</span>
                    }
                  </div>
                </article>
              }
            </div>
          </div>
        }
      } @else if (!loading() && !error()) {
        <p class="empty">No tutorials yet — check back soon.</p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .tutorials-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); }
    .area-card { padding: 1em; display: flex; flex-direction: column; gap: 0.75em; }
    .area-card h3 { margin: 0; font-size: 1em; }
    .video-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 0.75em; }
    .video-card { display: flex; flex-direction: column; gap: 0.5em; }
    .thumb {
      position: relative; padding: 0; border: 1px solid var(--ms-line);
      border-radius: 10px; overflow: hidden; cursor: pointer;
      background: var(--ms-canvas); min-height: 44px;
    }
    .thumb img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; }
    .play {
      position: absolute; inset: 0; display: flex;
      align-items: center; justify-content: center;
    }
    .play mat-icon { font-size: 56px; height: 56px; width: 56px; color: #fff; text-shadow: 0 2px 12px rgba(0,0,0,0.6); }
    .player { aspect-ratio: 16 / 9; border-radius: 10px; overflow: hidden; border: 1px solid var(--ms-line); background: #000; }
    .player iframe { width: 100%; height: 100%; border: 0; display: block; }
    .video-meta { display: flex; flex-direction: column; gap: 0.15em; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .empty { color: var(--ms-text-muted); }
  `],
})
export class TutorialsComponent implements OnInit {
  private readonly tutorials = inject(TutorialService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly groups = signal<TutorialGroup[]>([]);
  protected readonly openId = signal<string | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.tutorials
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.groups.set(res.data?.groups ?? []);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  /** nocookie embed built from the verified id — never raw input. */
  protected embedUrl(youtubeId: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?rel=0`,
    );
  }

  protected thumbUrl(youtubeId: string): string {
    return `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`;
  }
}
