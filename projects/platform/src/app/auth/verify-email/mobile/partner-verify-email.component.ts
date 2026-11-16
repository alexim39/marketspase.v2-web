import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MobileAuthShellComponent } from '../../mobile-auth-shell/mobile-auth-shell.component';
import { VerifyEmailFacade } from '../state/verify-email.facade';

@Component({
  selector: 'async-partner-verify-email-mobile',
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
      [eyebrow]="vm.state() === 'verifying' ? 'Secure verification' : vm.state() === 'success' ? 'Account activated' : 'Verification issue'"
      [title]="vm.state() === 'verifying' ? 'Checking your link' : vm.state() === 'success' ? 'Email verified' : 'This link can’t be used'"
      [subtitle]="vm.state() === 'verifying'
        ? 'We’re confirming your email address and activating your MarketSpase account. This usually takes only a moment.'
        : vm.state() === 'success'
          ? 'Your email is confirmed and your MarketSpase account is active. Sign in to set up your workspace.'
          : vm.message()"
    >
      @if (vm.state() === 'verifying') {
        <mat-progress-bar mode="indeterminate" class="auth-progress" aria-label="Verifying your email" />
        <div class="status-orb" aria-hidden="true"><mat-icon>mark_email_read</mat-icon></div>
        <div class="steps" role="list">
          <div class="step is-done" role="listitem"><mat-icon aria-hidden="true">check</mat-icon><span>Secure link received</span></div>
          <div class="step is-active" role="listitem"><span class="step-dot" aria-hidden="true"></span><span>Verifying your email</span></div>
          <div class="step" role="listitem"><span class="step-dot" aria-hidden="true"></span><span>Account ready</span></div>
        </div>
      }

      @if (vm.state() === 'success') {
        <div class="status-orb is-success" aria-hidden="true"><mat-icon>verified</mat-icon></div>
        <div class="status-badge"><mat-icon aria-hidden="true">check_circle</mat-icon><span>Account status: Verified</span></div>
        <div class="actions">
          <a mat-flat-button color="primary" routerLink="/partner/signin">Continue to sign in</a>
          <a mat-stroked-button routerLink="/">Back to home</a>
        </div>
      }

      @if (vm.state() === 'error') {
        <div class="status-orb is-error" aria-hidden="true"><mat-icon>link_off</mat-icon></div>
        <div class="resend-card">
          <div class="resend-head">
            <span class="resend-icon"><mat-icon>mail_outline</mat-icon></span>
            <div>
              <strong>Request a new link</strong>
              <p>Enter the email you signed up with and we’ll send a fresh link.</p>
            </div>
          </div>
          <form [formGroup]="vm.resendForm" (ngSubmit)="vm.resend()">
            <mat-form-field appearance="outline">
              <mat-label>Email address</mat-label>
              <input matInput type="email" inputmode="email" formControlName="email" autocomplete="email" placeholder="you@example.com" />
              @if (vm.email.invalid && vm.email.touched) {
                <mat-error>Enter a valid email address.</mat-error>
              }
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit" class="resend-btn" [disabled]="vm.isResending()">
              {{ vm.isResending() ? 'Sending new link…' : 'Send new verification link' }}
            </button>
          </form>
          @if (vm.resendNotice()) {
            <p class="notice success" role="status">{{ vm.resendNotice() }}</p>
          }
          @if (vm.resendError()) {
            <p class="notice error" role="alert">{{ vm.resendError() }}</p>
          }
        </div>
        <div class="actions">
          <a mat-stroked-button routerLink="/partner/signin">Go to sign in</a>
          <a mat-button routerLink="/">Back to home</a>
        </div>
      }
    </async-mobile-auth-shell>
  `,
  styles: [`
    .auth-progress {
      margin: 0 -18px 14px;
      width: calc(100% + 36px);
      height: 3px;
      --mdc-linear-progress-track-height: 3px;
      --mdc-linear-progress-active-indicator-height: 3px;
      --mdc-linear-progress-active-indicator-color: var(--ms-primary);
      --mdc-linear-progress-track-color: transparent;
    }

    .status-orb {
      display: inline-grid;
      width: 70px;
      height: 70px;
      place-items: center;
      align-self: center;
      margin: 6px auto 12px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: #fff;
      box-shadow: var(--ms-shadow-glow);
    }

    .status-orb.is-success {
      background: linear-gradient(135deg, #10b981, #047857);
    }

    .status-orb.is-error {
      background: linear-gradient(135deg, #ef4444, #991b1b);
    }

    .status-orb mat-icon {
      width: 34px;
      height: 34px;
      font-size: 34px;
    }

    .steps {
      display: flex;
      flex-direction: column;
      margin: 0 0 8px;
      text-align: left;
    }

    .step {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 38px;
      border-top: 1px dashed var(--ms-line);
      color: var(--ms-text-muted);
      font-size: 0.8rem;
    }

    .step:first-child {
      border-top: 0;
    }

    .step.is-done,
    .step.is-active {
      color: var(--ms-text);
    }

    .step.is-done mat-icon {
      color: var(--ms-success);
    }

    .step mat-icon {
      width: 17px;
      height: 17px;
      font-size: 17px;
    }

    .step-dot {
      width: 9px;
      height: 9px;
      margin: 0 4px;
      border: 2px solid var(--ms-line);
      border-radius: 50%;
    }

    .step.is-active .step-dot {
      border-color: var(--ms-primary);
      background: var(--ms-primary);
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      margin: 0 auto 12px;
      padding: 7px 12px;
      border-radius: var(--ms-radius-pill);
      background: var(--ms-success-soft);
      color: var(--ms-success);
      font-size: 0.78rem;
      font-weight: 700;
    }

    .status-badge mat-icon {
      width: 17px;
      height: 17px;
      font-size: 17px;
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .actions a {
      min-height: 48px;
      width: 100%;
    }

    .resend-card {
      margin: 4px 0 12px;
      padding: 12px;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-lg);
      background: color-mix(in srgb, var(--ms-primary) 6%, var(--ms-surface));
      text-align: left;
    }

    .resend-head {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 10px;
    }

    .resend-icon {
      display: inline-grid;
      width: 36px;
      height: 36px;
      flex: none;
      place-items: center;
      border-radius: var(--ms-radius-md);
      background: var(--ms-primary-soft);
      color: var(--ms-primary-strong);
    }

    .resend-head strong {
      display: block;
      font-size: 0.86rem;
    }

    .resend-head p {
      margin: 2px 0 0;
      color: var(--ms-text-muted);
      font-size: 0.76rem;
      line-height: 1.45;
    }

    .resend-card form {
      display: flex;
      flex-direction: column;
    }

    .resend-btn {
      min-height: 46px;
    }

    .notice {
      margin: 8px 0 0;
      font-size: 0.78rem;
    }

    .notice.success { color: var(--ms-success); }
    .notice.error { color: var(--ms-error); }
  `],
})
export class PartnerVerifyEmailMobileComponent {
  protected readonly vm = inject(VerifyEmailFacade);
}
