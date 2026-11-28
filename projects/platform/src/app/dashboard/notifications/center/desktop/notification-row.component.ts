import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { StoredNotificationItem } from '../../../../core/notifications/notification.models';

export type NotificationTone = 'info' | 'warn' | 'ok' | 'purple' | 'bad' | 'neutral';

/** Desktop list row — selecting it fills the reading pane on the right. */
@Component({
  selector: 'async-notification-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <button
      type="button"
      class="notif-row"
      [class.is-selected]="selected()"
      [class.is-unread]="!item().read"
      [class.is-urgent]="item().urgency && !item().read"
      (click)="selectedChange.emit(item())"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="item().title + ', ' + kindLabel() + ', ' + timeLabel() + (item().read ? '' : ', unread')">
      <span [class]="'row-icon notif-icon--' + kindTone()">
        <mat-icon aria-hidden="true">{{ item().icon }}</mat-icon>
        @if (!item().read) { <span class="unread-dot" aria-hidden="true"></span> }
      </span>

      <span class="row-copy">
        <span class="row-top">
          <span [class]="'kind-chip kind-chip--' + kindTone()">{{ kindLabel() }}</span>
          @if (item().urgency) { <span class="urgent-chip">Urgent</span> }
          @if (showPriority()) { <span [class]="'priority-chip priority-chip--' + item().priority">{{ item().priority }}</span> }
          <span class="row-time">{{ timeLabel() }}</span>
        </span>
        <strong class="row-title">{{ item().title }}</strong>
        <span class="row-snippet">{{ item().body }}</span>
        <span class="row-meta">{{ metaLabel() }}</span>
      </span>

      <mat-icon class="row-chev" aria-hidden="true">chevron_right</mat-icon>
    </button>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .notif-row { display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 10px 11px; border: 1px solid transparent; border-left: 3px solid transparent; border-radius: 10px; background: transparent; color: var(--ms-text); font: inherit; text-align: left; cursor: pointer; transition: background 120ms ease, border-color 120ms ease; }
    .notif-row:hover { background: var(--ms-canvas); }
    .notif-row:focus-visible { outline: 2px solid var(--ms-primary); outline-offset: -2px; }
    .notif-row.is-selected { border-color: color-mix(in srgb, var(--ms-primary) 28%, var(--ms-line)); border-left-color: var(--ms-primary); background: var(--ms-primary-soft); }
    .notif-row.is-unread:not(.is-selected) { border-left-color: var(--ms-primary); background: color-mix(in srgb, var(--ms-primary-soft) 26%, transparent); }
    .notif-row.is-urgent:not(.is-selected) { border-left-color: var(--ms-error); background: color-mix(in srgb, var(--ms-error-soft) 40%, transparent); }
    .row-icon { position: relative; display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 10px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .row-icon mat-icon { font-size: 19px; width: 19px; height: 19px; }
    .notif-icon--info { background: var(--ms-info-soft); color: var(--ms-info); }
    .notif-icon--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .notif-icon--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .notif-icon--purple { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .notif-icon--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .notif-icon--neutral { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .unread-dot { position: absolute; top: -2px; right: -2px; width: 9px; height: 9px; border: 2px solid var(--ms-surface); border-radius: 50%; background: var(--ms-primary); }
    .row-copy { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .row-top { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
    .kind-chip, .urgent-chip, .priority-chip { display: inline-flex; align-items: center; padding: 2px 6px; border-radius: 999px; font-size: 0.57rem; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; white-space: nowrap; }
    .kind-chip--info { background: var(--ms-info-soft); color: var(--ms-info); }
    .kind-chip--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .kind-chip--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .kind-chip--purple { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .kind-chip--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .kind-chip--neutral { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .urgent-chip { background: var(--ms-error-soft); color: var(--ms-error); }
    .priority-chip--critical, .priority-chip--high { background: var(--ms-error-soft); color: var(--ms-error); }
    .priority-chip--medium { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .row-time { margin-left: auto; color: var(--ms-text-muted); font-size: 0.62rem; white-space: nowrap; }
    .row-title { overflow: hidden; font-size: 0.86rem; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
    .notif-row:not(.is-unread) .row-title { font-weight: 600; color: var(--ms-text-soft); }
    .row-snippet { overflow: hidden; color: var(--ms-text-muted); font-size: 0.74rem; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
    .row-meta { overflow: hidden; color: var(--ms-text-muted); font-size: 0.63rem; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
    .row-chev { flex: none; margin-top: 9px; color: var(--ms-line-strong); font-size: 18px; width: 18px; height: 18px; }
    .notif-row.is-selected .row-chev { color: var(--ms-primary-strong); }
  `],
})
export class NotificationRowComponent {
  readonly item = input.required<StoredNotificationItem>();
  readonly kindLabel = input.required<string>();
  readonly kindTone = input.required<NotificationTone>();
  readonly timeLabel = input('');
  readonly categoryLabel = input('');
  readonly selected = input(false);

  readonly selectedChange = output<StoredNotificationItem>();

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
