import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MobileAuthShellComponent } from '../../mobile-auth-shell/mobile-auth-shell.component';
import { ResetPasswordFacade } from '../state/reset-password.facade';

@Component({
  selector: 'async-partner-reset-password-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MobileAuthShellComponent,
    ReactiveFormsModule,
    RouterModule,
  ],
  template: `
    <async-mobile-auth-shell
      eyebrow="MarketSpase · Partner Platform"
      title="Set a new password"
      [subtitle]="vm.token() ? 'Choose a password of at least 8 characters.' : 'This link is missing its reset token. Tokens expire after 60 minutes and can only be used once.'"
    >
      @if (!vm.token()) {
        <p class="missing">
          <a mat-flat-button color="primary" routerLink="../forgot-password">Request a fresh reset link</a>
        </p>
      } @else {
        <form [formGroup]="vm.form" (ngSubmit)="vm.onSubmit()">
          <mat-form-field appearance="outline">
            <mat-label>New password</mat-label>
            <input matInput [type]="vm.hide() ? 'password' : 'text'" formControlName="password" autocomplete="new-password" />
            <button
              mat-icon-button
              matSuffix
              type="button"
              (click)="vm.hide.set(!vm.hide())"
              [attr.aria-label]="vm.hide() ? 'Show password' : 'Hide password'"
            >
              <mat-icon>{{ vm.hide() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            @if (vm.form.get('password')?.hasError('required') && vm.form.get('password')?.touched) {
              <mat-error>Password is required</mat-error>
            }
            @if (vm.form.get('password')?.hasError('minlength') && vm.form.get('password')?.touched) {
              <mat-error>At least 8 characters</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Confirm password</mat-label>
            <input matInput [type]="vm.hide() ? 'password' : 'text'" formControlName="confirm" autocomplete="new-password" />
            @if (vm.form.hasError('mismatch') && vm.form.get('confirm')?.touched) {
              <mat-error>Passwords do not match</mat-error>
            }
          </mat-form-field>

          @if (vm.submitting()) {
            <mat-progress-bar mode="indeterminate" class="progress" aria-label="Saving password" />
          }

          <button mat-flat-button color="primary" type="submit" class="submit" [disabled]="vm.form.invalid || vm.submitting()">
            {{ vm.submitting() ? 'Saving…' : 'Set password' }}
          </button>
        </form>
      }

      <p authFooter class="footer-links">
        <a routerLink="../signin">Return to sign in</a>
      </p>
    </async-mobile-auth-shell>
  `,
  styles: [`
    form {
      display: flex;
      flex-direction: column;
      gap: 2px;
      text-align: left;
    }

    .progress {
      height: 3px;
      margin: 4px 0 8px;
      --mdc-linear-progress-track-height: 3px;
      --mdc-linear-progress-active-indicator-height: 3px;
      --mdc-linear-progress-active-indicator-color: var(--ms-primary);
      --mdc-linear-progress-track-color: transparent;
    }

    .submit {
      min-height: 48px;
      margin-top: 4px;
    }

    .missing {
      margin: 8px 0;
    }

    .missing a {
      min-height: 48px;
      width: 100%;
    }

    .footer-links {
      display: flex;
      justify-content: center;
      margin: 4px 0 0;
    }

    .footer-links a {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      color: var(--ms-primary-strong);
      font-size: 0.8rem;
      font-weight: 650;
      text-decoration: none;
    }
  `],
})
export class PartnerResetPasswordMobileComponent {
  protected readonly vm = inject(ResetPasswordFacade);
}
