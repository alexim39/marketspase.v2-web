import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { UiFeedbackService } from '../../../core/ui/ui-feedback.service';

/** Shared forgot-password form and request flow. */
@Injectable()
export class ForgotPasswordFacade {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly ui = inject(UiFeedbackService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sending = signal(false);
  readonly form = this.fb.group({
    email: ['', [Validators.email, Validators.required]],
  });

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.sending()) return;

    const email = String(this.form.get('email')?.value ?? '');
    this.sending.set(true);
    this.auth.requestPasswordReset(email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: { message?: string }) => {
          this.sending.set(false);
          void this.ui.alert({
            title: 'Check your email',
            message: res?.message ?? 'If an account exists for that email, a reset link is on its way. It expires in 60 minutes.',
            tone: 'success',
          });
          this.form.reset();
        },
        error: (error: { error?: { message?: string } }) => {
          this.sending.set(false);
          const serverMessage = error?.error?.message;
          this.ui.error(serverMessage ?? 'Could not send the reset link — check the email and try again.');
        },
      });
  }
}
