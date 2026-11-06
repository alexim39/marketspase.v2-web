import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { UiDialogComponent, UiDialogData, UiDialogTone } from './ui-dialog.component';

export interface UiConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: UiDialogTone;
  icon?: string;
}

export interface UiAlertOptions {
  title: string;
  message: string;
  confirmText?: string;
  tone?: UiDialogTone;
  icon?: string;
}

/**
 * Shared feedback surface. Dialogs are for decisions and outcome messages;
 * snackbars are for background success/error notices that should not block.
 */
@Injectable({ providedIn: 'root' })
export class UiFeedbackService {
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  success(message: string): void {
    this.openSnack(message, 'success');
  }

  error(message: string): void {
    this.openSnack(message, 'error', 7000);
  }

  info(message: string): void {
    this.openSnack(message, 'info');
  }

  warning(message: string): void {
    this.openSnack(message, 'warning', 7000);
  }

  /** Returns true only when the user presses the confirm action. */
  async confirm(options: UiConfirmOptions): Promise<boolean> {
    return this.openDialog({
      ...options,
      icon: options.icon,
      cancelText: options.cancelText ?? 'Cancel',
      confirmText: options.confirmText ?? 'Confirm',
    });
  }

  /** Outcome message with one acknowledgement button. */
  async alert(options: UiAlertOptions): Promise<void> {
    await this.openDialog({
      ...options,
      icon: options.icon,
      cancelText: null,
      confirmText: options.confirmText ?? 'OK',
    });
  }

  private async openDialog(data: UiDialogData): Promise<boolean> {
    const ref = this.dialog.open<UiDialogComponent, UiDialogData, boolean>(UiDialogComponent, {
      data,
      width: '420px',
      maxWidth: '92vw',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      panelClass: 'ms-ui-dialog',
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  private openSnack(message: string, tone: UiDialogTone, duration = 5000): void {
    this.snack.open(message, 'Close', {
      duration,
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
      panelClass: ['ms-snack', `ms-snack--${tone}`],
    });
  }
}
