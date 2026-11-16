import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { SigninRequest } from '../../../core/auth/auth.models';
import { ApiError } from '../../../core/http/api-error';
import { SessionRecoveryService } from '@marketspase/shared/core/ui/session-recovery.service';

/** Shared sign-in state, form and actions for the desktop and mobile views. */
@Injectable()
export class SignInFacade {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly recovery = inject(SessionRecoveryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly hide = signal(true);
  readonly isSubmitting = signal(false);
  readonly isResending = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly needsVerification = signal(false);
  readonly accessState = signal<'expired' | 'permission' | null>(
    this.route.snapshot.queryParamMap.get('reason') === 'expired'
      ? 'expired'
      : this.route.snapshot.queryParamMap.get('reason') === 'forbidden' ? 'permission' : null,
  );

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.email, Validators.required]],
    password: ['', Validators.required],
  });

  get email() {
    return this.form.get('email');
  }

  get password() {
    return this.form.get('password');
  }

  onSubmit(): void {
    if (this.isSubmitting()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.isSubmitting.set(true);
    this.serverError.set(null);
    this.info.set(null);
    this.needsVerification.set(false);

    const credentials = this.form.getRawValue() as SigninRequest;
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

  resendVerification(): void {
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

  private returnUrl(): string {
    const target = String(this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard');
    return target.startsWith('/') && !target.startsWith('//') ? target : '/dashboard';
  }
}
