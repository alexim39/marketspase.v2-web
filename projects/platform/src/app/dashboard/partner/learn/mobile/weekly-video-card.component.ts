import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { CurrentWeeklyVideo, WeeklyVideoPublic } from '../../../../core/weekly-video/weekly-video.models';

/** Immersive weekly briefing card for the mobile learn hub. */
@Component({
  selector: 'async-weekly-video-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, RouterModule],
  template: `
    <a
      class="weekly-card"
      routerLink="/dashboard/learn/video-of-the-week"
      [attr.aria-label]="'Video of the week: ' + video().title">
      <span class="video-art">
        @if (video().thumbnailUrl) {
          <img [src]="video().thumbnailUrl" alt="" loading="eager" decoding="async" (error)="hideImage($event)" />
        }
        <span class="video-scrim" aria-hidden="true"></span>
        <span class="play-badge" aria-hidden="true"><mat-icon>play_arrow</mat-icon></span>
        @if (duration()) {
          <span class="video-duration">{{ duration() }}</span>
        }
        @if (weekly().progress; as progress) {
          @if (progress.percent > 0) {
            <span class="video-progress" aria-hidden="true"><span [style.width.%]="progress.percent"></span></span>
          }
        }
      </span>

      <span class="video-body">
        <span class="video-kicker">
          <span class="eyebrow">Video of the week</span>
          @if (weekly().engagement.currentStreak > 0) {
            <span class="streak">
              <mat-icon aria-hidden="true">local_fire_department</mat-icon>
              {{ weekly().engagement.currentStreak }}-week streak
            </span>
          }
        </span>
        <strong>{{ video().title }}</strong>
        <span class="video-meta">@if (video().weekLabel) { {{ video().weekLabel }} · }{{ status() }}</span>
        <span class="video-cta">{{ cta() }} <mat-icon aria-hidden="true">arrow_forward</mat-icon></span>
      </span>
    </a>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .weekly-card { display: flex; flex-direction: column; overflow: hidden; border: 1px solid color-mix(in srgb, var(--ms-primary) 24%, var(--ms-line)); border-radius: 18px; background: var(--ms-surface); color: var(--ms-text); text-decoration: none; box-shadow: 0 8px 24px rgba(20, 18, 43, 0.08); }
    .weekly-card:active { transform: scale(0.995); }
    .video-art { position: relative; display: block; width: 100%; aspect-ratio: 16 / 9; max-height: 230px; overflow: hidden; background: linear-gradient(135deg, var(--ms-primary-soft), var(--ms-secondary-soft)); }
    .video-art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .video-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0, 0, 0, 0.04) 20%, rgba(0, 0, 0, 0.62) 100%); }
    .play-badge { position: absolute; inset: 0; width: 54px; height: 54px; margin: auto; display: grid; place-items: center; border-radius: 50%; background: rgba(255, 255, 255, 0.94); color: #101018; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3); }
    .play-badge mat-icon { margin-left: 2px; font-size: 30px; width: 30px; height: 30px; }
    .video-duration { position: absolute; right: 10px; bottom: 10px; padding: 3px 7px; border-radius: 6px; background: rgba(0, 0, 0, 0.72); color: #fff; font-size: 0.68rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .video-progress { position: absolute; right: 0; bottom: 0; left: 0; height: 3px; background: rgba(255, 255, 255, 0.3); }
    .video-progress > span { display: block; height: 100%; background: var(--ms-primary); }
    .video-body { display: flex; flex-direction: column; gap: 3px; padding: 11px 12px 12px; }
    .video-kicker { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.64rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .streak { display: inline-flex; align-items: center; gap: 2px; padding: 2px 7px; border-radius: 999px; background: var(--ms-warning-soft); color: var(--ms-warning); font-size: 0.62rem; font-weight: 750; white-space: nowrap; }
    .streak mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .video-body strong { display: -webkit-box; overflow: hidden; font-size: 1rem; line-height: 1.3; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .video-meta { overflow: hidden; color: var(--ms-text-muted); font-size: 0.7rem; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
    .video-cta { display: inline-flex; align-items: center; gap: 2px; margin-top: 2px; color: var(--ms-primary-strong); font-size: 0.74rem; font-weight: 800; }
    .video-cta mat-icon { font-size: 16px; width: 16px; height: 16px; }
  `],
})
export class WeeklyVideoCardComponent {
  readonly weekly = input.required<CurrentWeeklyVideo>();
  readonly video = input.required<WeeklyVideoPublic>();

  protected readonly cta = computed(() => {
    const weekly = this.weekly();
    if (weekly.progress?.completed) return weekly.reflection ? 'View briefing' : 'Write reflection';
    if (weekly.progress && weekly.progress.percent > 0) return 'Continue watching';
    return 'Watch now';
  });

  protected readonly status = computed(() => {
    const weekly = this.weekly();
    if (weekly.progress?.completed) return weekly.reflection ? 'Week complete' : 'Reflection pending';
    if (weekly.progress && weekly.progress.percent > 0) return `${weekly.progress.percent}% watched`;
    return 'Latest briefing';
  });

  protected readonly duration = computed(() => {
    const seconds = Number(this.video().durationSeconds) || 0;
    if (seconds <= 0) return '';
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  });

  protected hideImage(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    if (image) image.style.display = 'none';
  }
}
