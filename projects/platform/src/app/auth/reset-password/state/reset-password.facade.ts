import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { UiFeedbackService } from '../../../core/ui/ui-feedback.service';

/** Shared reset-password form, token and submit flow. */
@Injectable()
export class ResetPasswordFacade {
  private readonly fb = inject(FormBuilder);
  private readonly routes = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly ui = inject(UiFeedbackService);
  private readonly destroyRef = inject(DestroyRef);

  readonly hide = signal(true);
  readonly submitting = signal(false);
  readonly token = signal<string | null>(null);

  readonly form = this.fb.group(
    {
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
      confirm: ['', [Validators.required]],
    },
    {
      validators: (group) =>
        group.get('password')?.value === group.get('confirm')?.value ? null : { mismatch: true },
    },
  );

  constructor() {
    this.routes.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.token.set(params.get('token')));
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    const token = this.token();
    if (this.form.invalid || !token || this.submitting()) return;
    this.submitting.set(true);
    this.auth
      .confirmResetPassword({ token, newPassword: String(this.form.get('password')?.value ?? '') })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: { message?: string }) => {
          this.submitting.set(false);
          void this.ui.alert({
            title: 'Password updated',
            message: res?.message ?? 'Sign in with your new password.',
            tone: 'success',
            confirmText: 'Sign in now',
          }).then(() => {
            void this.router.navigateByUrl('/partner/signin');
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
