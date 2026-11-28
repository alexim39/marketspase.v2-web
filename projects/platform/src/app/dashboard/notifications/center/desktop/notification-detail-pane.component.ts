import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StoredNotificationItem } from '../../../../core/notifications/notification.models';
import { NotificationTone } from './notification-row.component';

export interface NotificationDetailView {
  item: StoredNotificationItem;
  kindLabel: string;
  kindTone: NotificationTone;
  categoryLabel: string;
  timeLabel: string;
}

export type NotificationDetailAction = 'open' | 'read' | 'unread' | 'archive' | 'delete' | 'mute' | 'dismiss';

/** Sticky desktop reading pane with complete notification actions. */
@Component({
  selector: 'async-notification-detail-pane',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <aside class="detail-pane" aria-label="Notification details">
      @if (view(); as view) {
        <header class="detail-top">
          <div class="detail-nav">
            <button mat-icon-button type="button" (click)="step.emit(-1)" [disabled]="!canStep()" aria-label="Previous notification">
              <mat-icon>keyboard_arrow_up</mat-icon>
            </button>
            <button mat-icon-button type="button" (click)="step.emit(1)" [disabled]="!canStep()" aria-label="Next notification">
              <mat-icon>keyboard_arrow_down</mat-icon>
            </button>
          </div>
          <span class="detail-label">Notification detail</span>
          <button mat-icon-button type="button" (click)="closed.emit()" aria-label="Close details">
            <mat-icon>close</mat-icon>
          </button>
        </header>

        <div class="detail-scroll">
          <div class="detail-heading">
            <span [class]="'notif-icon notif-icon--' + view.kindTone">
              <mat-icon aria-hidden="true">{{ view.item.icon }}</mat-icon>
            </span>
            <div class="detail-title">
              <div class="detail-kicker">
                <span [class]="'kind-chip kind-chip--' + view.kindTone">{{ view.kindLabel }}</span>
                @if (view.item.urgency) { <span class="urgent-chip">Urgent</span> }
                @if (view.item.priority !== 'low') {
                  <span [class]="'priority-chip priority-chip--' + view.item.priority">{{ view.item.priority }}</span>
                }
                <span class="detail-time">{{ view.timeLabel }}</span>
              </div>
              <h2>{{ view.item.title }}</h2>
            </div>
          </div>

          <p class="detail-body">{{ view.item.body }}</p>

          <dl class="detail-meta">
            <div><dt>Category</dt><dd>{{ view.categoryLabel }}</dd></div>
            <div><dt>Source</dt><dd>{{ sourceLabel() }}</dd></div>
            <div><dt>Type</dt><dd>{{ view.item.origin === 'stored' ? 'Saved alert' : 'Live reminder' }}</dd></div>
            <div><dt>Status</dt><dd>{{ view.item.read ? 'Read' : 'Unread' }}</dd></div>
          </dl>

          @if (view.item.link) {
            <button mat-flat-button color="primary" type="button" class="detail-open" (click)="action.emit('open')" [disabled]="busy()">
              <mat-icon>open_in_new</mat-icon>
              Open notification
            </button>
          }

          <div class="detail-actions">
            @if (view.item.origin === 'stored') {
              @if (view.item.read) {
                <button mat-stroked-button type="button" (click)="action.emit('unread')" [disabled]="busy()">
                  <mat-icon>mark_email_unread</mat-icon> Mark unread
                </button>
              } @else {
                <button mat-stroked-button type="button" (click)="action.emit('read')" [disabled]="busy()">
                  <mat-icon>mark_email_read</mat-icon> Mark read
                </button>
              }
              <button mat-stroked-button type="button" (click)="action.emit('archive')" [disabled]="busy()">
                <mat-icon>archive</mat-icon> Archive
              </button>
              <button mat-stroked-button type="button" (click)="action.emit('mute')" [disabled]="busy()">
                <mat-icon>notifications_off</mat-icon> Mute these
              </button>
              @if (confirming()) {
                <div class="detail-confirm" role="alert">
                  <span>Delete this notification permanently?</span>
                  <div>
                    <button mat-button color="warn" type="button" (click)="confirmDelete()" [disabled]="busy()">Delete</button>
                    <button mat-button type="button" (click)="confirmId.set(null)">Cancel</button>
                  </div>
                </div>
              } @else {
                <button mat-stroked-button color="warn" type="button" (click)="requestDelete()" [disabled]="busy()">
                  <mat-icon>delete</mat-icon> Delete
                </button>
              }
            } @else {
              <button mat-stroked-button type="button" (click)="action.emit('dismiss')" [disabled]="busy()">
                <mat-icon>done</mat-icon> Dismiss
              </button>
            }
          </div>

          <p class="detail-note">{{ view.item.read ? 'This notification is read.' : 'This notification is unread.' }}</p>
        </div>
      } @else {
        <div class="detail-empty">
          <span class="empty-art"><mat-icon>notifications</mat-icon></span>
          <h2>Select a notification</h2>
          <p>Choose an alert from the feed to read the full message, mark it read, archive it or open the related screen.</p>
          <div class="empty-tips">
            <span><mat-icon>done_all</mat-icon> Mark everything read from the header</span>
            <span><mat-icon>archive</mat-icon> Archive or mute alerts you no longer need</span>
            <span><mat-icon>keyboard_arrow_up</mat-icon> Use the arrows to move between alerts</span>
          </div>
        </div>
      }
    </aside>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .detail-pane { position: sticky; top: 88px; display: flex; flex-direction: column; max-height: calc(100vh - 112px); overflow: hidden; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); box-shadow: var(--ms-shadow-sm); }
    .detail-top { display: flex; align-items: center; gap: 4px; padding: 5px 8px; border-bottom: 1px solid var(--ms-line); background: var(--ms-surface); }
    .detail-nav { display: flex; }
    .detail-label { flex: 1; text-align: center; color: var(--ms-text-muted); font-size: 0.66rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
    .detail-scroll { flex: 1; padding: 14px; overflow-y: auto; }
    .detail-heading { display: flex; align-items: flex-start; gap: 10px; }
    .notif-icon { display: grid; place-items: center; flex: none; width: 42px; height: 42px; border-radius: 12px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .notif-icon mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .notif-icon--info { background: var(--ms-info-soft); color: var(--ms-info); }
    .notif-icon--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .notif-icon--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .notif-icon--purple { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .notif-icon--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .notif-icon--neutral { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .detail-title { flex: 1; min-width: 0; }
    .detail-kicker { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
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
    .detail-time { margin-left: auto; color: var(--ms-text-muted); font-size: 0.62rem; white-space: nowrap; }
    .detail-title h2 { margin: 4px 0 0; font-size: 1.08rem; line-height: 1.35; letter-spacing: -0.01em; }
    .detail-body { margin: 14px 0; color: var(--ms-text-soft); font-size: 0.86rem; line-height: 1.6; white-space: pre-line; }
    .detail-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0 0 14px; padding: 10px; border-radius: 10px; background: var(--ms-canvas); }
    .detail-meta div { min-width: 0; }
    .detail-meta dt { color: var(--ms-text-muted); font-size: 0.6rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
    .detail-meta dd { margin: 1px 0 0; overflow-wrap: anywhere; font-size: 0.76rem; line-height: 1.4; }
    .detail-open { width: 100%; min-height: 44px; }
    .detail-open mat-icon { margin-right: 4px; }
    .detail-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 8px; }
    .detail-actions > button { min-width: 0; min-height: 42px; }
    .detail-actions mat-icon { margin-right: 3px; }
    .detail-confirm { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 6px; padding: 9px 10px; border-radius: 10px; background: var(--ms-error-soft); color: var(--ms-error); font-size: 0.74rem; line-height: 1.4; }
    .detail-confirm > div { display: flex; justify-content: flex-end; gap: 4px; }
    .detail-confirm button { min-height: 36px; }
    .detail-note { margin: 10px 0 0; color: var(--ms-text-muted); font-size: 0.68rem; }
    .detail-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 380px; padding: 30px 22px; text-align: center; }
    .empty-art { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .empty-art mat-icon { font-size: 27px; width: 27px; height: 27px; }
    .detail-empty h2 { margin: 2px 0 0; font-size: 1.05rem; }
    .detail-empty p { margin: 0; max-width: 28em; color: var(--ms-text-muted); font-size: 0.8rem; line-height: 1.5; }
    .empty-tips { display: flex; flex-direction: column; gap: 6px; width: 100%; max-width: 280px; margin-top: 10px; padding: 10px; border-radius: 10px; background: var(--ms-canvas); text-align: left; }
    .empty-tips span { display: flex; align-items: flex-start; gap: 5px; color: var(--ms-text-muted); font-size: 0.72rem; line-height: 1.4; }
    .empty-tips mat-icon { flex: none; margin-top: 1px; color: var(--ms-primary-strong); font-size: 15px; width: 15px; height: 15px; }
  `],
})
export class NotificationDetailPaneComponent {
  readonly view = input<NotificationDetailView | null>(null);
  readonly canStep = input(false);
  readonly busy = input(false);

  readonly action = output<NotificationDetailAction>();
  readonly step = output<1 | -1>();
  readonly closed = output<void>();

  protected readonly confirmId = signal<string | null>(null);
  protected readonly confirming = computed(() => this.confirmId() === this.view()?.item.id);
  protected readonly sourceLabel = computed(() => {
    const view = this.view();
    if (!view) return '—';
    const tag = String(view.item.tag ?? '').trim();
    const category = view.categoryLabel.trim();
    if (!tag || tag.toLowerCase() === category.toLowerCase()) return '—';
    return tag;
  });
  private readonly resetDeleteConfirm = effect(() => {
    this.view()?.item.id;
    this.confirmId.set(null);
  });

  protected requestDelete(): void {
    const item = this.view()?.item;
    if (item) this.confirmId.set(item.id);
  }

  protected confirmDelete(): void {
    this.confirmId.set(null);
    this.action.emit('delete');
  }
}
