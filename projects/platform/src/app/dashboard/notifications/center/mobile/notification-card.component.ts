import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { StoredNotificationItem } from '../../../../core/notifications/notification.models';

/** One tappable notification row in the mobile centre feed. */
@Component({
  selector: 'async-notification-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <button
      type="button"
      class="notif-card"
      [class.is-unread]="!item().read"
      [class.is-urgent]="item().urgency && !item().read"
      (click)="selected.emit(item())"
      [attr.aria-label]="item().title + ', ' + kindLabel() + ', ' + timeLabel() + (item().read ? '' : ', unread')">
      <span [class]="'notif-icon notif-icon--' + kindTone()">
        <mat-icon aria-hidden="true">{{ item().icon }}</mat-icon>
        @if (!item().read) {
          <span class="unread-dot" aria-hidden="true"></span>
        }
      </span>

      <span class="notif-copy">
        <span class="notif-top">
          <span [class]="'kind-chip kind-chip--' + kindTone()">{{ kindLabel() }}</span>
          @if (item().urgency) {
            <span class="urgent-chip">Urgent</span>
          }
          @if (showPriority()) {
            <span [class]="'priority-chip priority-chip--' + item().priority">{{ item().priority }}</span>
          }
          <span class="notif-time">{{ timeLabel() }}</span>
        </span>
        <strong>{{ item().title }}</strong>
        <span class="notif-body">{{ item().body }}</span>
        <span class="notif-meta">{{ metaLabel() }}</span>
      </span>

      <mat-icon class="notif-chev" aria-hidden="true">chevron_right</mat-icon>
    </button>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .notif-card { display: flex; align-items: flex-start; gap: 9px; width: 100%; padding: 10px; border: 1px solid var(--ms-line); border-left: 3px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); color: var(--ms-text); font: inherit; text-align: left; cursor: pointer; box-shadow: 0 4px 12px rgba(20, 18, 43, 0.04); }
    .notif-card:active { transform: scale(0.995); }
    .notif-card.is-unread { border-left-color: var(--ms-primary); background: color-mix(in srgb, var(--ms-primary-soft) 32%, var(--ms-surface)); }
    .notif-card.is-urgent { border-left-color: var(--ms-error); background: color-mix(in srgb, var(--ms-error-soft) 52%, var(--ms-surface)); }
    .notif-icon { position: relative; display: grid; place-items: center; flex: none; width: 40px; height: 40px; border-radius: 12px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .notif-icon mat-icon { font-size: 21px; width: 21px; height: 21px; }
    .notif-icon--info { background: var(--ms-info-soft); color: var(--ms-info); }
    .notif-icon--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .notif-icon--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .notif-icon--purple { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .notif-icon--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .notif-icon--neutral { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .unread-dot { position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; border: 2px solid var(--ms-surface); border-radius: 50%; background: var(--ms-primary); }
    .notif-copy { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .notif-top { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
    .kind-chip, .urgent-chip, .priority-chip { display: inline-flex; align-items: center; padding: 2px 6px; border-radius: 999px; font-size: 0.58rem; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; white-space: nowrap; }
    .kind-chip--info { background: var(--ms-info-soft); color: var(--ms-info); }
    .kind-chip--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .kind-chip--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .kind-chip--purple { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .kind-chip--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .kind-chip--neutral { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .urgent-chip { background: var(--ms-error-soft); color: var(--ms-error); }
    .priority-chip--critical, .priority-chip--high { background: var(--ms-error-soft); color: var(--ms-error); }
    .priority-chip--medium { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .notif-time { margin-left: auto; color: var(--ms-text-muted); font-size: 0.62rem; white-space: nowrap; }
    .notif-copy strong { display: -webkit-box; overflow: hidden; margin-top: 1px; font-size: 0.86rem; line-height: 1.3; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .notif-body { display: -webkit-box; overflow: hidden; color: var(--ms-text-muted); font-size: 0.72rem; line-height: 1.4; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .notif-meta { overflow: hidden; color: var(--ms-text-muted); font-size: 0.63rem; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
    .notif-chev { flex: none; margin-top: 9px; color: var(--ms-text-muted); font-size: 19px; width: 19px; height: 19px; }
  `],
})
export class NotificationCardComponent {
  readonly item = input.required<StoredNotificationItem>();
  readonly kindLabel = input.required<string>();
  readonly kindTone = input.required<string>();
  readonly timeLabel = input('');
  readonly categoryLabel = input('');

  readonly selected = output<StoredNotificationItem>();

  protected readonly metaLabel = computed(() => {
    const category = this.categoryLabel().trim();
    const tag = String(this.item().tag ?? '').trim();
    if (!tag || tag.toLowerCase() === category.toLowerCase()) return category;
    return `${category} · ${tag}`;
  });

  protected showPriority(): boolean {
    const item = this.item();
    return item.origin === 'stored' && item.priority !== 'low' && !item.urgency;
  }
}
