import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { NotificationStreamService } from '../../../core/notifications/notification-stream.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ApiError } from '../../../core/http/api-error';

/**
 * @title Notification dropdown — live latest-unread panel.
 * Fed by NotificationStreamService (polling today, sockets later):
 * updates without page refresh, badge stays in sync.
 */
@Component({
  selector: 'async-notification-bell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterModule],
  template: `
    <div class="bell-panel" role="dialog" aria-label="Latest notifications" (click)="$event.stopPropagation()">
      <div class="bell-head">
        <strong>Notifications</strong>
        @if (stream.unreadCount() > 0) {
          <span class="pill" role="status">{{ stream.unreadCount() }} unread</span>
        }
      </div>
      @if (stream.latest().length > 0) {
        <ul class="bell-list">
          @for (item of stream.latest(); track item.id) {
            <li class="bell-item" [class.bell-item--urgent]="item.urgency">
              <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
              <div class="bell-body">
                <span class="bell-title">{{ item.title }}</span>
                <span class="bell-tag">{{ item.tag }}</span>
              </div>
            </li>
          }
        </ul>
        <div class="bell-foot">
          <button mat-button (click)="markAllRead()" [disabled]="marking()">Mark all read</button>
          <a mat-button routerLink="/dashboard/notifications/center">View all</a>
        </div>
      } @else {
        <p class="bell-empty">You're all caught up.</p>
        <div class="bell-foot">
          <a mat-button routerLink="/dashboard/notifications/center">Open Center</a>
        </div>
      }
    </div>
  `,
  styles: [`
    .bell-panel { width: 100%; min-width: 0; max-width: 100%; padding: 0.75em 0.9em; box-sizing: border-box; overflow-x: hidden; }
    .bell-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5em; margin-bottom: 0.5em; }
    .pill { font-size: 0.75em; font-weight: 700; color: var(--ms-error); background: color-mix(in srgb, var(--ms-error) 12%, transparent); border-radius: 999px; padding: 0.15em 0.6em; }
    .bell-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .bell-item { display: flex; gap: 0.6em; align-items: flex-start; padding: 0.55em 0; border-top: 1px solid var(--ms-line); }
    .bell-item:first-child { border-top: none; }
    .bell-item--urgent .bell-title { font-weight: 700; }
    .bell-body { display: flex; flex-direction: column; min-width: 0; }
    .bell-title { font-size: 0.9em; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .bell-tag { font-size: 0.75em; color: var(--ms-text-muted); }
    .bell-foot { display: flex; justify-content: space-between; margin-top: 0.5em; }
    .bell-foot button, .bell-foot a { min-height: 44px; }
    .bell-empty { color: var(--ms-text-muted); margin: 0.5em 0; }
  `],
})
export class NotificationBellComponent {
  protected readonly stream = inject(NotificationStreamService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly marking = signal(false);

  protected markAllRead(): void {
    if (this.marking()) return;
    this.marking.set(true);
    this.notifications
      .bulk('read-all')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.marking.set(false);
          this.stream.refresh();
        },
        error: (err: ApiError) => {
          this.marking.set(false);
          void err;
        },
      });
  }
}
