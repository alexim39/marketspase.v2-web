import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StoredNotificationItem } from '../../../../core/notifications/notification.models';

export interface NotificationSheetData {
  item: StoredNotificationItem;
  kindLabel: string;
  kindTone: string;
  categoryLabel: string;
  timeLabel: string;
}

export type NotificationSheetAction =
  | 'open'
  | 'read'
  | 'unread'
  | 'archive'
  | 'delete'
  | 'mute'
  | 'dismiss';

/** Native action sheet for a single notification. */
@Component({
  selector: 'async-notification-detail-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="notif-sheet" role="dialog" aria-modal="true" [attr.aria-label]="data.item.title">
      <span class="sheet-handle" aria-hidden="true"></span>

      <header class="sheet-head">
        <span [class]="'notif-icon notif-icon--' + data.kindTone">
          <mat-icon aria-hidden="true">{{ data.item.icon }}</mat-icon>
        </span>
        <div class="sheet-title">
          <span class="sheet-kicker">
            <span [class]="'kind-chip kind-chip--' + data.kindTone">{{ data.kindLabel }}</span>
            <span>{{ data.timeLabel }}</span>
          </span>
          <h2>{{ data.item.title }}</h2>
        </div>
        <button mat-icon-button type="button" (click)="close()" aria-label="Close notification">
          <mat-icon>close</mat-icon>
        </button>
      </header>

      <p class="sheet-body">{{ data.item.body }}</p>

      <div class="sheet-meta">
        <span>{{ data.categoryLabel }}</span>
        @if (tagLabel()) { <span>{{ tagLabel() }}</span> }
        <span>{{ data.item.origin === 'stored' ? 'Saved alert' : 'Live alert' }}</span>
      </div>

      @if (data.item.link) {
        <button mat-flat-button color="primary" type="button" class="primary-action" (click)="select('open')">
          <mat-icon>open_in_new</mat-icon>
          Open notification
        </button>
      }

      <div class="sheet-actions">
        @if (data.item.origin === 'stored') {
          @if (data.item.read) {
            <button mat-stroked-button type="button" (click)="select('unread')">
              <mat-icon>mark_email_unread</mat-icon> Mark unread
            </button>
          } @else {
            <button mat-stroked-button type="button" (click)="select('read')">
              <mat-icon>mark_email_read</mat-icon> Mark read
            </button>
          }
          <button mat-stroked-button type="button" (click)="select('archive')">
            <mat-icon>archive</mat-icon> Archive
          </button>
          <button mat-stroked-button type="button" (click)="select('mute')">
            <mat-icon>notifications_off</mat-icon> Mute these
          </button>
          @if (confirmDelete()) {
            <div class="delete-confirm" role="alert">
              <span>Delete this notification permanently?</span>
              <div>
                <button mat-button color="warn" type="button" (click)="select('delete')">Delete</button>
                <button mat-button type="button" (click)="confirmDelete.set(false)">Cancel</button>
              </div>
            </div>
          } @else {
            <button mat-stroked-button color="warn" type="button" (click)="confirmDelete.set(true)">
              <mat-icon>delete</mat-icon> Delete
            </button>
          }
        } @else {
          <button mat-stroked-button type="button" (click)="select('dismiss')">
            <mat-icon>done</mat-icon> Dismiss
          </button>
        }
      </div>

      <button mat-button type="button" class="sheet-close" (click)="close()">Close</button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .notif-sheet { display: flex; flex-direction: column; gap: 11px; max-height: 88vh; padding: 8px 16px calc(16px + var(--ms-safe-bottom)); overflow-y: auto; background: var(--ms-surface); color: var(--ms-text); }
    .sheet-handle { width: 42px; height: 4px; flex: none; margin: 0 auto 2px; border-radius: 999px; background: var(--ms-line-strong); }
    .sheet-head { display: flex; align-items: flex-start; gap: 9px; }
    .notif-icon { display: grid; place-items: center; flex: none; width: 42px; height: 42px; border-radius: 12px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .notif-icon mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .notif-icon--info { background: var(--ms-info-soft); color: var(--ms-info); }
    .notif-icon--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .notif-icon--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .notif-icon--purple { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .notif-icon--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .notif-icon--neutral { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .sheet-title { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .sheet-kicker { display: flex; align-items: center; gap: 6px; color: var(--ms-text-muted); font-size: 0.62rem; }
    .kind-chip { display: inline-flex; align-items: center; padding: 2px 6px; border-radius: 999px; font-size: 0.58rem; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; white-space: nowrap; }
    .kind-chip--info { background: var(--ms-info-soft); color: var(--ms-info); }
    .kind-chip--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .kind-chip--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .kind-chip--purple { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .kind-chip--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .kind-chip--neutral { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .sheet-title h2 { margin: 0; font-size: 1.02rem; line-height: 1.3; letter-spacing: -0.01em; }
    .sheet-body { margin: 0; color: var(--ms-text-soft); font-size: 0.84rem; line-height: 1.55; white-space: pre-line; }
    .sheet-meta { display: flex; flex-wrap: wrap; gap: 5px; }
    .sheet-meta span { padding: 3px 8px; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.62rem; font-weight: 650; }
    .primary-action { width: 100%; min-height: 48px; }
    .primary-action mat-icon { margin-right: 4px; }
    .sheet-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
    .sheet-actions > button { min-width: 0; min-height: 46px; }
    .sheet-actions mat-icon { margin-right: 3px; }
    .delete-confirm { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 11px; background: var(--ms-error-soft); color: var(--ms-error); font-size: 0.75rem; line-height: 1.4; }
    .delete-confirm > div { display: flex; justify-content: flex-end; gap: 4px; }
    .delete-confirm button { min-height: 40px; }
    .sheet-close { width: 100%; min-height: 44px; margin-top: 1px; }
  `],
})
export class NotificationDetailSheetComponent {
  protected readonly data = inject<NotificationSheetData>(MAT_BOTTOM_SHEET_DATA);
  private readonly sheetRef = inject<MatBottomSheetRef<NotificationDetailSheetComponent, NotificationSheetAction | null>>(MatBottomSheetRef);
  protected readonly confirmDelete = signal(false);
  protected readonly tagLabel = computed(() => {
    const tag = String(this.data.item.tag ?? '').trim();
    if (!tag) return '';
    return tag.toLowerCase() === this.data.categoryLabel.trim().toLowerCase() ? '' : tag;
  });

  protected select(action: NotificationSheetAction): void {
    this.sheetRef.dismiss(action);
  }

  protected close(): void {
    this.sheetRef.dismiss(null);
  }
}
