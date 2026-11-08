import { Component, OnDestroy, OnInit, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { userError } from '../../core/http/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { SignupRequest, SignupResponse } from '../../core/auth/auth.models';
import { UiFeedbackService } from '../../core/ui/ui-feedback.service';
import { minDigitsValidator } from '../../_common/services/phone-number-checker';

/**
 * @title Partner signup
 *
 * Open registration: no reservation code. New accounts are unverified and
 * receive a single-use verification link before sign-in is allowed.
 */
@Component({
    selector: 'async-partner-signup',
    imports: [MatButtonModule, MatCheckboxModule, MatProgressBarModule, ReactiveFormsModule, MatIconModule, MatFormFieldModule, MatInputModule, RouterModule],
    templateUrl: 'partner-signup.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    styleUrls: ["partner-signup.component.scss", "partner-signup.mobile.scss"],
    styles: [`
      .signup-panel { position: relative; overflow: hidden; }
      .terms-check { margin: 0.35em 0 0; align-self: flex-start; text-align: left; }
      .field-error { color: var(--ms-error); font-size: 0.85em; margin: 0.25em 0 0; }
      .referral-note {
        display: flex;
        align-items: flex-start;
        gap: 0.5em;
        margin: 0.75em 0 0;
        padding: 0.7em 0.85em;
        border: 1px solid color-mix(in srgb, var(--ms-success) 35%, transparent);
        border-radius: 10px;
        background: var(--ms-success-soft);
        color: var(--ms-text);
        font-size: 0.85rem;
        line-height: 1.45;
        text-align: left;
      }
      .referral-note mat-icon { flex: none; color: var(--ms-success); font-size: 20px; width: 20px; height: 20px; }
      .auth-progress {
        position: absolute;
        inset: 0 0 auto;
        height: 3px;
        --mdc-linear-progress-track-height: 3px;
        --mdc-linear-progress-active-indicator-height: 3px;
        --mdc-linear-progress-active-indicator-color: var(--ms-primary);
        --mdc-linear-progress-track-color: transparent;
      }
      .submit-btn { display: inline-flex; align-items: center; justify-content: center; }
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
    `]
})
export class PartnerSignupComponent implements OnInit, OnDestroy {
  protected readonly hide = signal(true);
  protected readonly isSubmitting = signal(false);
  /** Acquisition attribution captured from /join?campaign=... */
  protected readonly campaignCode = signal<string | null>(null);
  protected readonly referralCode = signal<string | null>(null);
  protected readonly leadId = signal<string | null>(null);

  protected signUpForm: FormGroup = new FormGroup({});
  protected subscriptions: Array<Subscription> = [];

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly partnerSignUpService = inject(AuthService);
  private readonly ui = inject(UiFeedbackService);

  ngOnInit(): void {
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

    this.signUpForm = this.fb.group({
      name: ['', Validators.required],
      surname: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9+\s()-]{7,20}$/)]],
      email: ['', [Validators.email, Validators.required]],
      password: ['', [Validators.required, minDigitsValidator(8)]],
      tnc: [false, Validators.requiredTrue],
    });
  }

  protected onSubmit(): void {
    if (this.isSubmitting()) return;
    this.markAllAsTouched();
    if (this.signUpForm.invalid) return;

    this.isSubmitting.set(true);
    const formValue = this.signUpForm.getRawValue();
    const formData = {
      ...formValue,
      ...(this.campaignCode() ? { campaign: this.campaignCode() } : {}),
      ...(this.referralCode() ? { ref: this.referralCode() } : {}),
      ...(this.leadId() ? { lead: this.leadId() } : {}),
    } as SignupRequest;
    this.subscriptions.push(
      this.partnerSignUpService.signup(formData).subscribe({
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
          }).then(() => this.router.navigateByUrl('partner/signin'));
        },
        error: (error: unknown) => {
          this.isSubmitting.set(false);
          this.ui.error(userError(error));
        }
      })
    );
  }

  private markAllAsTouched() {
    Object.keys(this.signUpForm.controls).forEach((controlName) => {
      this.signUpForm.get(controlName)?.markAsTouched();
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  protected scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function readStorage(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
