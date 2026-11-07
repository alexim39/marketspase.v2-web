import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { SigninRequest } from '../../core/auth/auth.models';
import { ApiError } from '../../core/http/api-error';
import { SessionRecoveryService } from '@marketspase/shared/core/ui/session-recovery.service';
import { StatePanelComponent } from '@marketspase/shared/ui/state-panel/state-panel.component';

/**
 * @title Partner signin
 *
 * Modernized: OnPush + signals, block control flow, auto-cleanup via
 * `takeUntilDestroyed`, fully typed. Session is the backend httpOnly
 * cookie — nothing is written to `localStorage` (legacy stored the
 * response object there, i.e. the string `"[object Object]"`).
 */
@Component({
  selector: 'async-partner-signin',
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
              : 'Sign in with a permitted account, or return to the dashboard.'"
          >
            <a mat-stroked-button routerLink="/">Go to dashboard</a>
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
            <input matInput type="email" formControlName="email" autocomplete="email" />
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
export class PartnerSigninComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly recovery = inject(SessionRecoveryService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly hide = signal(true);
  protected readonly isSubmitting = signal(false);
  protected readonly isResending = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly info = signal<string | null>(null);
  protected readonly needsVerification = signal(false);
  protected readonly accessState = signal<'expired' | 'permission' | null>(
    this.route.snapshot.queryParamMap.get('reason') === 'expired'
      ? 'expired'
      : this.route.snapshot.queryParamMap.get('reason') === 'forbidden' ? 'permission' : null,
  );

  protected readonly signInForm = this.fb.nonNullable.group({
    email: ['', [Validators.email, Validators.required]],
    password: ['', Validators.required],
  });

  protected get email() {
    return this.signInForm.get('email');
  }

  protected get password() {
    return this.signInForm.get('password');
  }

  protected scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected onSubmit(): void {
    if (this.isSubmitting()) return;
    this.signInForm.markAllAsTouched();
    if (this.signInForm.invalid) return;

    this.isSubmitting.set(true);
    this.serverError.set(null);
    this.info.set(null);
    this.needsVerification.set(false);

    const credentials = this.signInForm.getRawValue() as SigninRequest;
    this.authService
      .signin(credentials)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const target = this.returnUrl();
          this.recovery.clearNotice();
          void this.router.navigateByUrl(target).then(() => this.recovery.restorePending());
        },
        error: (error: ApiError) => {
          this.isSubmitting.set(false);
          this.serverError.set(error.message);
          if (error.code === 'EMAIL_NOT_VERIFIED') this.needsVerification.set(true);
        },
      });
  }

  private returnUrl(): string {
    const target = String(this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard');
    return target.startsWith('/') && !target.startsWith('//') ? target : '/dashboard';
  }

  protected resendVerification(): void {
    if (this.isResending()) return;
    const emailControl = this.email;
    if (!emailControl || emailControl.invalid) {
      emailControl?.markAsTouched();
      return;
    }
    const email = String(emailControl.value ?? '').trim();
    if (!email) return;

    this.isResending.set(true);
    this.serverError.set(null);
    this.info.set(null);
    this.authService
      .resendVerification(email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.isResending.set(false);
          this.info.set(res.message ?? 'If that email needs verification, a new link has been sent.');
        },
        error: (error: ApiError) => {
          this.isResending.set(false);
          this.serverError.set(error.message);
        },
      });
  }
}
