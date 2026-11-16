import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { SignUpFacade } from '../state/signup.facade';

/**
 * @title Partner signup
 *
 * Open registration: no reservation code. New accounts are unverified and
 * receive a single-use verification link before sign-in is allowed.
 */
@Component({
    selector: 'async-partner-signup-desktop',
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
export class PartnerSignupDesktopComponent {
  private readonly facade = inject(SignUpFacade);

  protected readonly hide = this.facade.hide;
  protected readonly isSubmitting = this.facade.isSubmitting;
  protected readonly campaignCode = this.facade.campaignCode;
  protected readonly referralCode = this.facade.referralCode;
  protected readonly leadId = this.facade.leadId;
  protected readonly signUpForm = this.facade.form;

  protected onSubmit(): void {
    this.facade.onSubmit();
  }

  protected scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
