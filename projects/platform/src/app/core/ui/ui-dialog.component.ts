import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export type UiDialogTone = 'primary' | 'success' | 'error' | 'warning' | 'info';

export interface UiDialogData {
  title: string;
  message: string;
  tone?: UiDialogTone;
  icon?: string;
  confirmText?: string;
  cancelText?: string | null;
}

/**
 * One first-party dialog for confirmations and outcomes. Replaces SweetAlert
 * so every message uses the same Material surface, type and focus behavior.
 */
@Component({
  selector: 'async-ui-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <div class="ui-dialog" [class]="'ui-dialog ui-dialog--' + tone()">
      <div class="ui-dialog__icon" aria-hidden="true">
        <mat-icon>{{ icon() }}</mat-icon>
      </div>
      <h2 mat-dialog-title>{{ data.title }}</h2>
      <mat-dialog-content>
        <p>{{ data.message }}</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        @if (data.cancelText !== null) {
          <button mat-button type="button" (click)="close(false)">
            {{ data.cancelText || 'Cancel' }}
          </button>
        }
        <button
          mat-flat-button
          type="button"
          [color]="tone() === 'error' ? 'warn' : 'primary'"
          [class.ui-dialog__danger]="tone() === 'error'"
          (click)="close(true)"
        >
          {{ data.confirmText || 'OK' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .ui-dialog { padding: 1.35em 1.5em 0.85em; }
    .ui-dialog__icon {
      width: 48px;
      height: 48px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      margin-bottom: 0.9em;
      background: var(--ms-primary-soft);
      color: var(--ms-primary-strong);
    }
    .ui-dialog__icon mat-icon { font-size: 27px; width: 27px; height: 27px; }
    .ui-dialog--success .ui-dialog__icon { background: var(--ms-success-soft); color: var(--ms-success); }
    .ui-dialog--error .ui-dialog__icon { background: var(--ms-error-soft); color: var(--ms-error); }
    .ui-dialog--warning .ui-dialog__icon { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .ui-dialog--info .ui-dialog__icon { background: var(--ms-info-soft); color: var(--ms-info); }
    h2 { margin: 0 0 0.35em; font-size: 1.18rem; line-height: 1.3; }
    p { margin: 0; color: var(--ms-text-muted); line-height: 1.55; white-space: pre-line; }
    mat-dialog-actions { padding: 1.1em 0 0; gap: 0.4em; }
    mat-dialog-content { padding: 0; max-height: 55vh; }
    .ui-dialog__danger {
      --mdc-filled-button-container-color: var(--ms-error);
      --mdc-filled-button-label-text-color: #fff;
      background-color: var(--ms-error) !important;
      color: #fff !important;
    }
    .ui-dialog__danger:hover { filter: brightness(1.08); }
  `],
})
export class UiDialogComponent {
  readonly data = inject<UiDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<UiDialogComponent, boolean>>(MatDialogRef);

  protected tone(): UiDialogTone {
    return this.data.tone ?? 'primary';
  }

  protected icon(): string {
    if (this.data.icon) return this.data.icon;
    switch (this.tone()) {
      case 'success': return 'check_circle';
      case 'error': return 'error';
      case 'warning': return 'warning_amber';
      case 'info': return 'info';
      default: return 'help_outline';
    }
  }

  protected close(value: boolean): void {
    this.ref.close(value);
  }
}
