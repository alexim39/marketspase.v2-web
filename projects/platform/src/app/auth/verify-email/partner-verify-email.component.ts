import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../core/auth/auth.service';
import { ApiEnvelope } from '../../core/auth/auth.models';
import { toApiError } from '../../core/http/api-error';

type VerifyState = 'verifying' | 'success' | 'error';

@Component({
  selector: 'async-partner-verify-email',
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule, ReactiveFormsModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="verify-page">
      <div class="verify-card dp-card">
        <div class="brand-band">
          <img class="brand-logo" src="/logo/marketspase-logo-white.png" alt="MarketSpase" />
          <span>Digital Network Marketing Platform</span>
        </div>

        @if (state() === 'verifying') {
          <mat-progress-bar mode="indeterminate" class="verify-progress" aria-label="Verifying your email"></mat-progress-bar>
        }

        <div class="verify-body" [attr.aria-busy]="state() === 'verifying'" aria-live="polite">
          <a class="back" routerLink="/">← Back to home</a>

          @if (state() === 'verifying') {
            <div class="status-orb is-verifying" aria-hidden="true">
              <span class="orbit"></span>
              <mat-icon>mark_email_read</mat-icon>
            </div>
            <p class="eyebrow">Secure verification</p>
            <h1>Checking your verification link</h1>
            <p class="sub">
              We’re confirming your email address and activating your MarketSpase account.
              This usually takes only a moment.
            </p>
            <div class="steps" role="list">
              <div class="step done" role="listitem">
                <span class="step-icon"><mat-icon>check</mat-icon></span>
                <span>Secure link received</span>
              </div>
              <div class="step active" role="listitem">
                <span class="step-dot"></span>
                <span>Verifying your email</span>
              </div>
              <div class="step" role="listitem">
                <span class="step-dot"></span>
                <span>Account ready</span>
              </div>
            </div>
          }

          @if (state() === 'success') {
            <div class="status-orb is-success" aria-hidden="true">
              <mat-icon>verified</mat-icon>
            </div>
            <p class="eyebrow">Account activated</p>
            <h1>Email verified</h1>
            <p class="sub">
              Your email is confirmed and your MarketSpase account is active.
              Sign in to set up your workspace and start building your network.
            </p>
            <div class="status-badge">
              <mat-icon aria-hidden="true">check_circle</mat-icon>
              <span>Account status: Verified</span>
            </div>
            <div class="actions">
              <a mat-flat-button color="primary" routerLink="/partner/signin" class="primary-action">
                Continue to sign in <mat-icon aria-hidden="true">arrow_forward</mat-icon>
              </a>
              <a mat-stroked-button routerLink="/">Back to home</a>
            </div>
          }

          @if (state() === 'error') {
            <div class="status-orb is-error" aria-hidden="true">
              <mat-icon>link_off</mat-icon>
            </div>
            <p class="eyebrow">Verification issue</p>
            <h1>This link can’t be used</h1>
            <p class="sub">{{ message() }}</p>

            <div class="resend-card">
              <div class="resend-head">
                <span class="resend-icon"><mat-icon>mail_outline</mat-icon></span>
                <div>
                  <strong>Request a new link</strong>
                  <p>Enter the email you signed up with and we’ll send a fresh verification link.</p>
                </div>
              </div>
              <form [formGroup]="resendForm" (ngSubmit)="resend()">
                <mat-form-field appearance="outline">
                  <mat-label>Email address</mat-label>
                  <input matInput type="email" formControlName="email" autocomplete="email" placeholder="you@example.com" />
                  @if (email.invalid && email.touched) {
                    <mat-error>Enter a valid email address.</mat-error>
                  }
                </mat-form-field>
                <button mat-flat-button color="primary" type="submit" [disabled]="isResending()" [attr.aria-busy]="isResending()" class="resend-btn">
                  @if (isResending()) {
                    <span class="btn-spinner" aria-hidden="true"></span>
                    <span>Sending new link…</span>
                  } @else {
                    <span>Send new verification link</span>
                  }
                </button>
              </form>
              @if (resendNotice()) {
                <p class="notice success" role="status">{{ resendNotice() }}</p>
              }
              @if (resendError()) {
                <p class="notice error" role="alert">{{ resendError() }}</p>
              }
            </div>

            <div class="actions">
              <a mat-stroked-button routerLink="/partner/signin">Go to sign in</a>
              <a mat-button routerLink="/">Back to home</a>
            </div>
          }

          <div class="secure-note">
            <mat-icon aria-hidden="true">shield</mat-icon>
            <span>Single-use link · 24-hour expiry · Encrypted in transit</span>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .verify-page {
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3.5em 1em 5em;
      background:
        radial-gradient(900px 520px at 50% -10%, rgba(102, 126, 234, 0.18), transparent 65%),
        var(--ms-canvas);
    }
    .verify-card {
      width: min(580px, 100%);
      overflow: hidden;
      position: relative;
      border: 1px solid var(--ms-line);
      border-radius: 26px;
      box-shadow: 0 30px 80px rgba(20, 18, 43, 0.16);
    }
    .brand-band {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.55em;
      padding: 1.5em 1.5em 1.35em;
      background:
        radial-gradient(500px 220px at 50% 0%, rgba(129, 146, 238, 0.35), transparent 70%),
        linear-gradient(135deg, #14122b 0%, #2a1a4a 100%);
      color: #d7dcfb;
      text-align: center;
    }
    .brand-logo {
      display: block;
      height: 34px;
      width: auto;
      max-width: 220px;
      object-fit: contain;
    }
    .brand-band span {
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      opacity: 0.75;
    }
    .verify-progress {
      display: block;
      height: 3px;
      --mdc-linear-progress-track-height: 3px;
      --mdc-linear-progress-active-indicator-height: 3px;
      --mdc-linear-progress-active-indicator-color: var(--ms-primary);
      --mdc-linear-progress-track-color: transparent;
    }
    .verify-body {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1.4em 2.1em 1.7em;
      text-align: center;
    }
    .back {
      align-self: flex-start;
      text-decoration: none;
      color: var(--ms-primary-strong);
      font-weight: 700;
      font-size: 0.88em;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
    }
    .status-orb {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 76px;
      height: 76px;
      margin: 0.6em 0 0.9em;
      border-radius: 50%;
      color: #fff;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      box-shadow: 0 16px 38px rgba(102, 126, 234, 0.35);
    }
    .status-orb mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
    }
    .status-orb.is-success {
      background: linear-gradient(135deg, #10b981 0%, #047857 100%);
      box-shadow: 0 16px 38px rgba(16, 185, 129, 0.32);
      animation: orb-pop 0.45s ease-out both;
    }
    .status-orb.is-error {
      background: linear-gradient(135deg, #ef4444 0%, #991b1b 100%);
      box-shadow: 0 16px 38px rgba(239, 68, 68, 0.28);
    }
    .status-orb.is-verifying .orbit {
      position: absolute;
      inset: -7px;
      border-radius: 50%;
      border: 2px solid rgba(102, 126, 234, 0.25);
      border-top-color: var(--ms-primary);
      animation: orbit-spin 1.1s linear infinite;
    }
    .eyebrow {
      margin: 0;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--ms-primary-strong);
    }
    h1 {
      margin: 0.35em 0 0.3em;
      font-size: clamp(1.55rem, 4.5vw, 2rem);
      line-height: 1.2;
      color: var(--ms-text);
    }
    .sub {
      margin: 0 0 1.15em;
      max-width: 34em;
      color: var(--ms-text-muted);
      font-size: 0.97rem;
      line-height: 1.7;
    }
    .steps {
      width: 100%;
      max-width: 360px;
      display: flex;
      flex-direction: column;
      gap: 0.15em;
      margin: 0.3em 0 1.2em;
      text-align: left;
    }
    .step {
      display: flex;
      align-items: center;
      gap: 0.8em;
      padding: 0.55em 0.2em;
      color: var(--ms-text-muted);
      font-size: 0.9rem;
    }
    .step + .step {
      border-top: 1px dashed var(--ms-line);
    }
    .step.done { color: var(--ms-text); }
    .step.active { color: var(--ms-text); font-weight: 600; }
    .step-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: var(--ms-primary);
      color: #fff;
      flex: none;
    }
    .step-icon mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .step-dot {
      width: 10px;
      height: 10px;
      margin: 0 8px;
      border-radius: 50%;
      border: 2px solid var(--ms-line);
      background: var(--ms-surface);
      flex: none;
    }
    .step.active .step-dot {
      border-color: var(--ms-primary);
      background: var(--ms-primary);
      box-shadow: 0 0 0 5px rgba(102, 126, 234, 0.16);
      animation: dot-pulse 1.4s ease-in-out infinite;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.45em;
      margin: 0 0 1.15em;
      padding: 0.5em 0.85em;
      border-radius: 999px;
      background: var(--ms-success-soft);
      color: var(--ms-success);
      font-size: 0.82rem;
      font-weight: 700;
    }
    .status-badge mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.65em;
      margin-top: 0.25em;
    }
    .actions a { min-height: 48px; }
    .primary-action {
      display: inline-flex;
      align-items: center;
      gap: 0.4em;
    }
    .primary-action mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .resend-card {
      width: 100%;
      max-width: 420px;
      margin: 0.15em 0 1.1em;
      padding: 1.1em;
      border: 1px solid var(--ms-line);
      border-radius: 16px;
      background: color-mix(in srgb, var(--ms-primary) 6%, var(--ms-surface));
      text-align: left;
    }
    .resend-head {
      display: flex;
      align-items: flex-start;
      gap: 0.8em;
      margin-bottom: 0.8em;
    }
    .resend-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: var(--ms-primary-soft);
      color: var(--ms-primary-strong);
      flex: none;
    }
    .resend-icon mat-icon { font-size: 21px; width: 21px; height: 21px; }
    .resend-head strong { display: block; font-size: 0.95rem; color: var(--ms-text); }
    .resend-head p { margin: 0.2em 0 0; font-size: 0.84rem; line-height: 1.5; color: var(--ms-text-muted); }
    .resend-card form { display: flex; flex-direction: column; }
    .resend-btn { width: 100%; min-height: 46px; margin-top: 0.2em; display: inline-flex; align-items: center; justify-content: center; gap: 0.55em; }
    .notice { margin: 0.7em 0 0; font-size: 0.85rem; line-height: 1.5; }
    .notice.success { color: var(--ms-success); }
    .notice.error { color: var(--ms-error); }
    .secure-note {
      display: inline-flex;
      align-items: center;
      gap: 0.45em;
      margin-top: 1.4em;
      padding-top: 1em;
      border-top: 1px solid var(--ms-line);
      width: 100%;
      justify-content: center;
      color: var(--ms-text-muted);
      font-size: 0.75rem;
    }
    .secure-note mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--ms-primary-strong); }
    .btn-spinner {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid color-mix(in srgb, currentColor 28%, transparent);
      border-top-color: currentColor;
      animation: orbit-spin 0.7s linear infinite;
    }
    @keyframes orbit-spin { to { transform: rotate(360deg); } }
    @keyframes dot-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
    @keyframes orb-pop { from { transform: scale(0.86); opacity: 0.4; } to { transform: scale(1); opacity: 1; } }
    @media (max-width: 600px) {
      .verify-page { padding: 1.25em 0.75em 3em; }
      .verify-body { padding: 1.2em 1.1em 1.4em; }
      .brand-band { padding: 1.2em 1em 1.1em; }
      .actions { flex-direction: column; width: 100%; }
      .actions a { width: 100%; }
      .resend-card { padding: 0.9em; }
    }
    @media (prefers-reduced-motion: reduce) {
      .status-orb.is-success,
      .status-orb.is-verifying .orbit,
      .step.active .step-dot,
      .btn-spinner { animation: none; }
    }
  `],
})
export class PartnerVerifyEmailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<VerifyState>('verifying');
  protected readonly message = signal('');
  protected readonly isResending = signal(false);
  protected readonly resendNotice = signal<string | null>(null);
  protected readonly resendError = signal<string | null>(null);
  protected readonly resendForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected get email() {
    return this.resendForm.controls.email;
  }

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!token) {
      this.state.set('error');
      this.message.set('This verification link is incomplete. Request a new link below.');
      return;
    }
    this.authService.verifyEmail(token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.state.set('success');
        },
        error: (error) => {
          this.state.set('error');
          this.message.set(toApiError(error).message);
        },
      });
  }

  protected resend(): void {
    if (this.isResending()) return;
    this.resendForm.markAllAsTouched();
    if (this.resendForm.invalid) return;

    const email = this.resendForm.getRawValue().email.trim().toLowerCase();
    if (!email) return;

    this.isResending.set(true);
    this.resendNotice.set(null);
    this.resendError.set(null);
    this.authService.resendVerification(email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: ApiEnvelope) => {
          this.isResending.set(false);
          this.resendNotice.set(res.message ?? 'If that email needs verification, a new link is on its way.');
        },
        error: (error) => {
          this.isResending.set(false);
          this.resendError.set(toApiError(error).message);
        },
      });
  }
}
