import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { SignupRequest, SignupResponse } from '../../../core/auth/auth.models';
import { userError } from '../../../core/http/api-error';
import { UiFeedbackService } from '../../../core/ui/ui-feedback.service';
import { minDigitsValidator } from '../../../_common/services/phone-number-checker';

/** Shared signup form, referral capture and submit flow. */
@Injectable()
export class SignUpFacade {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly ui = inject(UiFeedbackService);
  private readonly destroyRef = inject(DestroyRef);

  readonly hide = signal(true);
  readonly isSubmitting = signal(false);
  readonly campaignCode = signal<string | null>(null);
  readonly referralCode = signal<string | null>(null);
  readonly leadId = signal<string | null>(null);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    surname: ['', Validators.required],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+\s()-]{7,20}$/)]],
    email: ['', [Validators.email, Validators.required]],
    password: ['', [Validators.required, minDigitsValidator(8)]],
    tnc: [false, Validators.requiredTrue],
  });

  constructor() {
    const fromQuery = String(this.route.snapshot.queryParamMap.get('campaign') ?? '').trim();
    let fromStore = '';
    try { fromStore = localStorage.getItem('ms_campaign') ?? ''; } catch { /* private mode */ }
    const code = fromQuery || fromStore;
    if (code) {
      this.campaignCode.set(code);
      try { localStorage.setItem('ms_campaign', code); } catch { /* ignore */ }
    }

    const refQuery = String(this.route.snapshot.queryParamMap.get('ref') ?? '').trim();
    const ref = refQuery || readStorage('ms_ref');
    if (ref) {
      const clean = ref.replace(/^@/, '');
      this.referralCode.set(clean);
      try { localStorage.setItem('ms_ref', clean); } catch { /* ignore */ }
    }

    const leadQuery = String(this.route.snapshot.queryParamMap.get('lead') ?? '').trim();
    const lead = leadQuery || readStorage('ms_lead');
    if (/^[a-fA-F0-9]{24}$/.test(lead)) {
      this.leadId.set(lead);
      try { localStorage.setItem('ms_lead', lead); } catch { /* ignore */ }
    }
  }

  onSubmit(): void {
    if (this.isSubmitting()) return;
    this.markAllAsTouched();
    if (this.form.invalid) return;

    this.isSubmitting.set(true);
    const formValue = this.form.getRawValue();
    const formData = {
      ...formValue,
      ...(this.campaignCode() ? { campaign: this.campaignCode() } : {}),
      ...(this.referralCode() ? { ref: this.referralCode() } : {}),
      ...(this.leadId() ? { lead: this.leadId() } : {}),
    } as SignupRequest;

    this.auth.signup(formData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: SignupResponse) => {
          this.isSubmitting.set(false);
          try {
            localStorage.removeItem('ms_campaign');
            localStorage.removeItem('ms_ref');
            localStorage.removeItem('ms_lead');
          } catch { /* ignore */ }
          void this.ui.alert({
            title: 'Account created',
            message: res?.message ?? 'Check your email to verify your account.',
            tone: 'success',
            confirmText: 'Go to sign in',
          }).then(() => this.router.navigateByUrl('/partner/signin'));
        },
        error: (error: unknown) => {
          this.isSubmitting.set(false);
          this.ui.error(userError(error));
        },
      });
  }

  private markAllAsTouched(): void {
    Object.keys(this.form.controls).forEach((controlName) => {
      this.form.get(controlName)?.markAsTouched();
    });
  }
}

function readStorage(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
