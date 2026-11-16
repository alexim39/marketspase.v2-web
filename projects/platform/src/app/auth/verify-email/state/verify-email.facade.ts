import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiEnvelope } from '../../../core/auth/auth.models';
import { toApiError } from '../../../core/http/api-error';

export type VerifyEmailState = 'verifying' | 'success' | 'error';

/** Shared email-verification state and resend flow. */
@Injectable()
export class VerifyEmailFacade {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<VerifyEmailState>('verifying');
  readonly message = signal('');
  readonly isResending = signal(false);
  readonly resendNotice = signal<string | null>(null);
  readonly resendError = signal<string | null>(null);
  readonly resendForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!token) {
      this.state.set('error');
      this.message.set('This verification link is incomplete. Request a new link below.');
      return;
    }
    this.auth.verifyEmail(token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.state.set('success'),
        error: (error: unknown) => {
          this.state.set('error');
          this.message.set(toApiError(error).message);
        },
      });
  }

  get email() {
    return this.resendForm.controls.email;
  }

  resend(): void {
    if (this.isResending()) return;
    this.resendForm.markAllAsTouched();
    if (this.resendForm.invalid) return;

    const email = this.resendForm.getRawValue().email.trim().toLowerCase();
    if (!email) return;

    this.isResending.set(true);
    this.resendNotice.set(null);
    this.resendError.set(null);
    this.auth.resendVerification(email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: ApiEnvelope) => {
          this.isResending.set(false);
          this.resendNotice.set(res.message ?? 'If that email needs verification, a new link is on its way.');
        },
        error: (error: unknown) => {
          this.isResending.set(false);
          this.resendError.set(toApiError(error).message);
        },
      });
  }
}
