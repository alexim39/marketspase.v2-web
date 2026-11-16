import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { StatePanelComponent } from '@marketspase/shared/ui/state-panel/state-panel.component';
import { SignInFacade } from '../state/signin.facade';

/**
 * @title Partner signin
 *
 * Modernized: OnPush + signals, block control flow, auto-cleanup via
 * `takeUntilDestroyed`, fully typed. Session is the backend httpOnly
 * cookie — nothing is written to `localStorage` (legacy stored the
 * response object there, i.e. the string `"[object Object]"`).
 */
@Component({
  selector: 'async-partner-signin-desktop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatProgressBarModule, ReactiveFormsModule, RouterModule, StatePanelComponent],
  template: `
    <div class="page">
      <div class="login-panel dp-card">
        @if (accessState(); as notice) {
          <async-state-panel
            [kind]="notice === 'expired' ? 'session' : 'permission'"
            [compact]="true"
            [title]="notice === 'expired' ? 'Your session expired' : 'This account needs a different role'"
            [message]="notice === 'expired'
              ? 'We saved the work on the page you were using.'
              : 'The account signed in does not have permission for the page you requested.'"
            [reason]="notice === 'expired'
              ? 'Your secure sign-in window ended.'
              : 'The page is protected by a role your account does not hold.'"
            [fix]="notice === 'expired'
              ? 'Sign in again and we will return you to the same page, with your saved work restored.'
              : 'Sign in with a permitted account to continue.'"
          >
            <button mat-stroked-button type="button" (click)="focusSignIn()">
              {{ notice === 'expired' ? 'Sign in again' : 'Use another account' }}
            </button>
          </async-state-panel>
        }
        @if (isSubmitting()) {
          <mat-progress-bar mode="indeterminate" class="auth-progress" aria-label="Signing you in"></mat-progress-bar>
        }
        <a class="back" routerLink="/" (click)="scrollTop()">← Back to home</a>
        <p class="eyebrow">MarketSpase · Welcome back</p>
        <h1>Welcome back</h1>
        <p class="sub">Sign in to check your plan, talk to Ora and keep your online business moving.</p>
        <form [formGroup]="signInForm" (ngSubmit)="onSubmit()">
          <mat-form-field appearance="outline">
            <mat-label>Email address</mat-label>
            <input matInput #emailInput type="email" formControlName="email" autocomplete="email" />
            @if (email?.hasError('email') && email?.touched) {
              <mat-error>Use a valid email, like ada@example.com.</mat-error>
            }
            @if (email?.hasError('required') && email?.touched) {
              <mat-error>Enter the email address you signed up with.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Enter your password</mat-label>
            <input matInput [type]="hide() ? 'password' : 'text'" formControlName="password" autocomplete="current-password" />
            @if (password?.hasError('required') && password?.touched) {
              <mat-error>Enter your password to continue.</mat-error>
            }
            <button mat-icon-button matSuffix type="button" (click)="hide.set(!hide())" [attr.aria-label]="hide() ? 'Show password' : 'Hide password'" [attr.aria-pressed]="hide()">
              <mat-icon>{{ hide() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
          </mat-form-field>

          @if (serverError()) {
            <p class="server-error" role="alert">{{ serverError() }}</p>
          }
          @if (info()) {
            <p class="info" role="status">{{ info() }}</p>
          }
          @if (needsVerification()) {
            <button mat-stroked-button type="button" class="resend" (click)="resendVerification()" [disabled]="isResending()" [attr.aria-busy]="isResending()">
              @if (isResending()) {
                <span class="btn-inline">
                  <span class="btn-spinner" aria-hidden="true"></span>
                  <span>Sending new link…</span>
                </span>
              } @else {
                <span class="btn-inline"><span>Resend verification email</span></span>
              }
            </button>
          }

          <button mat-flat-button color="primary" type="submit" [disabled]="isSubmitting()" [attr.aria-busy]="isSubmitting()">
            @if (isSubmitting()) {
              <span class="btn-inline">
                <span class="btn-spinner" aria-hidden="true"></span>
                <span>Signing you in…</span>
              </span>
            } @else {
              <span class="btn-inline"><span>Sign in</span></span>
            }
          </button>
          @if (isSubmitting()) {
            <p class="form-status" role="status" aria-live="polite">
              <span class="status-dot" aria-hidden="true"></span>
              Verifying your credentials…
            </p>
          }
        </form>

        <p class="alt">
          <a routerLink="../../partner/forgot-password" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Forgot password?</a>
        </p>

        <div class="line"></div>

        <p class="alt">
          Not a MarketSpase partner yet?
          <a routerLink="../../partner/signup" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Sign up</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .page {
      background: var(--ms-canvas);
      display: flex;
      justify-content: center;
      padding: 3em 1em 4em;
    }
    .login-panel {
      width: min(440px, 100%);
      padding: 2em 1.75em;
      display: flex;
      flex-direction: column;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .login-panel async-state-panel { text-align: left; margin-bottom: 1em; }
    .auth-progress {
      position: absolute;
      inset: 0 0 auto;
      height: 3px;
      --mdc-linear-progress-track-height: 3px;
      --mdc-linear-progress-active-indicator-height: 3px;
      --mdc-linear-progress-active-indicator-color: var(--ms-primary);
      --mdc-linear-progress-track-color: transparent;
    }
    .back {
      align-self: flex-start;
      text-decoration: none;
      color: var(--ms-primary-strong);
      font-weight: 700;
      font-size: 0.9em;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
    }
    .eyebrow {
      margin: 0.5em 0 0;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--ms-primary-strong);
    }
    h1 { margin: 0.3em 0 0.2em; font-size: 1.9rem; }
    .sub { margin: 0 0 1.25em; color: var(--ms-text-muted); font-size: 0.95rem; line-height: 1.6; }
    form { display: flex; flex-direction: column; gap: 0.25em; }
    form button[type="submit"] { min-height: 48px; margin-top: 0.5em; }
    .server-error { color: var(--ms-error); margin: 0.5em 0; }
    .info { color: var(--ms-success); margin: 0.5em 0; }
    .resend {
      margin: 0.25em 0 0.75em;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.55em;
    }
    form button[type="submit"] {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.6em;
    }
    .btn-inline { display: inline-flex; align-items: center; justify-content: center; gap: 0.6em; }
    .btn-spinner {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid color-mix(in srgb, currentColor 28%, transparent);
      border-top-color: currentColor;
      animation: auth-spin 0.7s linear infinite;
    }
    .form-status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5em;
      margin: 0.65em 0 0;
      color: var(--ms-text-muted);
      font-size: 0.85rem;
    }
    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--ms-primary);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--ms-primary) 18%, transparent);
      animation: status-pulse 1.4s ease-in-out infinite;
    }
    @keyframes auth-spin { to { transform: rotate(360deg); } }
    @keyframes status-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
    @media (prefers-reduced-motion: reduce) {
      .btn-spinner, .status-dot { animation: none; }
    }
    .alt { margin: 1.25em 0 0; }
    .alt a { text-decoration: none; color: var(--ms-primary-strong); font-weight: 700; min-height: 44px; display: inline-flex; align-items: center; }
    .line { border-top: 1px solid var(--ms-line); margin: 1.25em 0 0; }
  `],
})
export class PartnerSigninDesktopComponent {
  private readonly facade = inject(SignInFacade);

  protected readonly hide = this.facade.hide;
  protected readonly isSubmitting = this.facade.isSubmitting;
  protected readonly isResending = this.facade.isResending;
  protected readonly serverError = this.facade.serverError;
  protected readonly info = this.facade.info;
  protected readonly needsVerification = this.facade.needsVerification;
  protected readonly accessState = this.facade.accessState;
  protected readonly signInForm = this.facade.form;
  protected readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');

  protected get email() {
    return this.facade.email;
  }

  protected get password() {
    return this.facade.password;
  }

  protected scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected focusSignIn(): void {
    const input = this.emailInput()?.nativeElement;
    if (!input) return;
    input.focus({ preventScroll: true });
    input.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  protected onSubmit(): void {
    this.facade.onSubmit();
  }

  protected resendVerification(): void {
    this.facade.resendVerification();
  }
}
