import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { AvatarComponent } from '../../../../_common/avatar.component';
import { FeedPost } from '../../../../core/community/community.models';
import type { PresenceStatus } from '../../../../core/presence/presence.service';

/**
 * One scannable team-feed card for the desktop community workspace.
 *
 * Presentational only: the parent owns data, presence and filtering, while the
 * whole card links into the full feed.
 */
@Component({
  selector: 'async-community-feed-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, MatIconModule, RouterModule],
  template: `
    <a class="post-card" routerLink="/dashboard/community/feed" [attr.data-kind]="post().kind">
      <div class="post-head">
        <async-avatar
          [photo]="post().author?.profileImage"
          [name]="post().author?.name ?? 'Teammate'"
          size="sm"
          [presence]="presence()" />
        <span class="post-author">
          <strong>{{ post().author?.name ?? 'Teammate' }}</strong>
          <span>{{ timeLabel() }} · {{ scopeLabel() }}</span>
        </span>
        @if (post().pinned) {
          <span class="pinned-chip"><mat-icon aria-hidden="true">push_pin</mat-icon> Pinned</span>
        }
        <span class="kind-chip" [attr.data-kind]="post().kind">
          <mat-icon aria-hidden="true">{{ kindIcon() }}</mat-icon>
          {{ kindLabel() }}
        </span>
      </div>

      @if (post().title) {
        <strong class="post-title">{{ post().title }}</strong>
      }
      <p class="post-body">{{ preview(post().body) }}</p>

      <div class="post-foot">
        <span><mat-icon aria-hidden="true">favorite</mat-icon>{{ post().likeCount }}</span>
        <span><mat-icon aria-hidden="true">chat_bubble</mat-icon>{{ post().commentCount }}</span>
        @if (post().saveCount > 0) {
          <span><mat-icon aria-hidden="true">bookmark</mat-icon>{{ post().saveCount }}</span>
        }
        @if (post().attachments?.length) {
          <span><mat-icon aria-hidden="true">attach_file</mat-icon>{{ post().attachments?.length }}</span>
        }
        <span class="post-open">Open feed <mat-icon aria-hidden="true">arrow_forward</mat-icon></span>
      </div>
    </a>
  `,
  styles: [`
    :host { display: block; }

    .post-card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 7px;
      overflow: hidden;
      padding: 13px 14px 12px 17px;
      border: 1px solid var(--ms-line);
      border-radius: 13px;
      background: var(--ms-surface);
      color: var(--ms-text);
      text-decoration: none;
    }

    .post-card::before {
      content: '';
      position: absolute;
      top: 14px;
      bottom: 14px;
      left: 0;
      width: 3px;
      border-radius: 0 3px 3px 0;
      background: var(--post-accent, var(--ms-primary));
      opacity: 0.62;
    }

    .post-card[data-kind='recognition'] { --post-accent: var(--ms-highlight); }
    .post-card[data-kind='announcement'] { --post-accent: var(--ms-secondary); }
    .post-card[data-kind='training'] { --post-accent: var(--ms-info); }
    .post-card[data-kind='event'] { --post-accent: var(--ms-success); }

    .post-card:hover {
      border-color: color-mix(in srgb, var(--ms-primary) 34%, var(--ms-line));
      background: color-mix(in srgb, var(--ms-primary-soft) 24%, var(--ms-surface));
    }

    .post-card:hover::before {
      opacity: 1;
    }

    .post-head {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .post-author {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }

    .post-author strong {
      overflow: hidden;
      font-size: 0.79rem;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .post-author span {
      color: var(--ms-text-muted);
      font-size: 0.64rem;
    }

    .pinned-chip,
    .kind-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      flex: none;
      padding: 3px 7px;
      border-radius: 999px;
      font-size: 0.58rem;
      font-weight: 750;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }

    .pinned-chip {
      background: var(--ms-primary-soft);
      color: var(--ms-primary-strong);
    }

    .pinned-chip mat-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }

    .kind-chip {
      background: var(--ms-surface-3);
      color: var(--ms-text-soft);
    }

    .kind-chip mat-icon {
      font-size: 13px;
      width: 13px;
      height: 13px;
    }

    .kind-chip[data-kind='recognition'] {
      background: var(--ms-highlight-soft);
      color: var(--ms-warning);
    }

    .kind-chip[data-kind='announcement'] {
      background: var(--ms-secondary-soft);
      color: var(--ms-secondary);
    }

    .kind-chip[data-kind='training'] {
      background: var(--ms-info-soft);
      color: var(--ms-info);
    }

    .kind-chip[data-kind='event'] {
      background: var(--ms-success-soft);
      color: var(--ms-success);
    }

    :host-context(html[data-theme='light']) .kind-chip[data-kind='recognition'] {
      color: #92400e;
    }

    :host-context(html[data-theme='light']) .kind-chip[data-kind='event'] {
      color: #047857;
    }

    .post-title {
      font-size: 0.91rem;
      line-height: 1.35;
    }

    .post-body {
      display: -webkit-box;
      overflow: hidden;
      margin: 0;
      color: var(--ms-text-muted);
      font-size: 0.78rem;
      line-height: 1.5;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
    }

    .post-foot {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-top: 7px;
      border-top: 1px solid var(--ms-line);
      color: var(--ms-text-muted);
      font-size: 0.67rem;
    }

    .post-foot span {
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }

    .post-foot mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
    }

    .post-open {
      margin-left: auto;
      color: var(--ms-primary-strong);
      font-weight: 700;
    }
  `],
})
export class CommunityFeedCardComponent {
  readonly post = input.required<FeedPost>();
  readonly presence = input<PresenceStatus>(null);
  readonly timeLabel = input('');
  readonly scopeLabel = input('');
  readonly kindLabel = input('');
  readonly kindIcon = input('forum');

  protected preview(body: string | null | undefined): string {
    const text = String(body ?? '').replace(/\s+/g, ' ').trim();
    return text.length > 220 ? `${text.slice(0, 219).trimEnd()}…` : text;
  }
}
