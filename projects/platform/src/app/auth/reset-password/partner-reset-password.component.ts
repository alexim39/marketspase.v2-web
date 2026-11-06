import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error';
import { UiFeedbackService } from '../../core/ui/ui-feedback.service';

/**
 * @title Set a new password — consumes the emailed reset token.
 *
 * Token arrives as ?token= (v1 reset flow, 60-minute expiry, single-use).
 * No token → guidance back to forgot-password instead of a dead form.
 * Token-blind dark shells (no fixed-light panels), 44px targets, OnPush.
 */
@Component({
  selector: 'async-partner-reset-password',
  providers: [],
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="page">
      <div class="login-panel dp-card">
        <a class="back" routerLink="/" (click)="scrollTop()">← Back to home</a>
        <p class="eyebrow">MarketSpase · Partner Platform</p>
        <h1>Set a new password</h1>

        @if (!token()) {
          <p class="sub">This link is missing its reset token. Tokens expire after 60 minutes and can only be used once.</p>
          <p class="alt">
            <a routerLink="../forgot-password">Request a fresh reset link</a>
          </p>
        } @else {
          <p class="sub">Choose a password of at least 8 characters.</p>
          <form [formGroup]="form" (submit)="onSubmit()">
            <mat-form-field appearance="outline">
              <mat-label>New password</mat-label>
              <input matInput [type]="hide() ? 'password' : 'text'" formControlName="password" autocomplete="new-password" />
              <button mat-icon-button matSuffix type="button" (click)="hide.set(!hide())" [attr.aria-label]="hide() ? 'Show password' : 'Hide password'">
                <mat-icon>{{ hide() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (form.get('password')?.hasError('required') && form.get('password')?.touched) {
                <mat-error>Password is required</mat-error>
              }
              @if (form.get('password')?.hasError('minlength') && form.get('password')?.touched) {
                <mat-error>At least 8 characters</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Confirm password</mat-label>
              <input matInput [type]="hide() ? 'password' : 'text'" formControlName="confirm" autocomplete="new-password" />
              @if (form.hasError('mismatch') && form.get('confirm')?.touched) {
                <mat-error>Passwords do not match</mat-error>
              }
            </mat-form-field>

            @if (submitting()) {
              <mat-progress-bar mode="indeterminate" class="progress-bar" aria-label="Loading" />
            }

            <button mat-flat-button color="primary" [disabled]="form.invalid || submitting()">
              {{ submitting() ? 'Saving…' : 'Set password' }}
            </button>
          </form>
        }

        <p class="alt">
          <a routerLink="../signin" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">Return to login?</a>
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
      .login-panel {
        display: flex;
        flex-direction: column;
        text-align: center;
        width: min(440px, 100%);
        padding: 2em 1.75em;
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
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--ms-primary-strong);
          margin: 0.5em 0 0;
        }
        h1 { margin: 0.3em 0 0.2em; font-size: 1.9rem; }
        .sub { margin: 0 0 1.25em; color: var(--ms-text-muted); font-size: 0.95rem; line-height: 1.6; }
        form {
          display: flex;
          flex-direction: column;
          gap: 0.25em;
          text-align: left;
          .progress-bar {
            margin-bottom: 1em;
          }
          button[type="submit"], button:not([mat-icon-button]) { min-height: 48px; margin-top: 0.5em; }
        }
        .alt {
          margin: 1.25em 0 0;
          a {
            text-decoration: none;
            color: var(--ms-primary-strong);
            font-weight: 700;
            min-height: 44px;
            display: inline-flex;
            align-items: center;
          }
        }
      }
    }
  `],
})
export class PartnerResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly routes = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly ui = inject(UiFeedbackService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly hide = signal(true);
  protected readonly submitting = signal(false);
  protected readonly token = signal<string | null>(null);

  protected readonly form = this.fb.group(
    {
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
      confirm: ['', [Validators.required]],
    },
    {
      validators: (group) =>
        group.get('password')?.value === group.get('confirm')?.value ? null : { mismatch: true },
    },
  );

  ngOnInit(): void {
    this.routes.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.token.set(params.get('token')));
  }

  protected scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected onSubmit(): void {
    this.form.markAllAsTouched();
    const token = this.token();
    if (this.form.invalid || !token || this.submitting()) return;
    this.submitting.set(true);
    this.authService
      .confirmResetPassword({ token, newPassword: String(this.form.get('password')?.value ?? '') })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          this.submitting.set(false);
          void this.ui.alert({
            title: 'Password updated',
            message: res?.message ?? 'Sign in with your new password.',
            tone: 'success',
            confirmText: 'Sign in now',
          }).then(() => {
            void this.router.navigateByUrl('partner/signin');
          });
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          void this.ui.alert({
            title: 'Reset link problem',
            message: err?.message ?? 'This link is invalid or expired — request a fresh one.',
            tone: 'error',
          });
        },
      });
  }
}
