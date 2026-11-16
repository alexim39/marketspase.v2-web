import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MobileAuthShellComponent } from '../../mobile-auth-shell/mobile-auth-shell.component';
import { SignUpFacade } from '../state/signup.facade';

@Component({
  selector: 'async-partner-signup-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MobileAuthShellComponent,
    ReactiveFormsModule,
    RouterModule,
  ],
  template: `
    <async-mobile-auth-shell
      eyebrow="MarketSpase · Start your online business"
      title="Create your free business account"
      subtitle="We’ll email you a verification link, then Ora will meet you with your first plan."
    >
      @if (vm.isSubmitting()) {
        <mat-progress-bar mode="indeterminate" class="auth-progress" aria-label="Creating your account" />
      }

      @if (vm.referralCode() || vm.leadId()) {
        <p class="referral-note" role="status">
          <mat-icon aria-hidden="true">handshake</mat-icon>
          <span>
            @if (vm.referralCode()) {
              You’re joining through <strong>&#64;{{ vm.referralCode() }}</strong>. Your sponsor will be your mentor and team upline.
            } @else {
              Your application is linked to a partner. Your sponsor will be your mentor and team upline.
            }
          </span>
        </p>
      }

      <form [formGroup]="vm.form" (ngSubmit)="vm.onSubmit()">
        <mat-form-field appearance="outline">
          <mat-label>First name</mat-label>
          <input matInput formControlName="name" autocomplete="given-name" />
          @if (vm.form.get('name')?.hasError('required') && vm.form.get('name')?.touched) {
            <mat-error>First name is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Surname</mat-label>
          <input matInput formControlName="surname" autocomplete="family-name" />
          @if (vm.form.get('surname')?.hasError('required') && vm.form.get('surname')?.touched) {
            <mat-error>Surname is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Phone number</mat-label>
          <input matInput type="tel" inputmode="tel" formControlName="phone" autocomplete="tel" placeholder="08080 XXX XXX" />
          @if (vm.form.get('phone')?.hasError('required') && vm.form.get('phone')?.touched) {
            <mat-error>Phone number is required</mat-error>
          }
          @if (vm.form.get('phone')?.hasError('pattern') && vm.form.get('phone')?.touched) {
            <mat-error>Enter a valid phone number</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Email address</mat-label>
          <input matInput type="email" inputmode="email" formControlName="email" autocomplete="email" />
          @if (vm.form.get('email')?.hasError('email') && vm.form.get('email')?.touched) {
            <mat-error>Email is invalid</mat-error>
          }
          @if (vm.form.get('email')?.hasError('required') && vm.form.get('email')?.touched) {
            <mat-error>Email is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Enter your password</mat-label>
          <input matInput [type]="vm.hide() ? 'password' : 'text'" formControlName="password" autocomplete="new-password" />
          <button
            mat-icon-button
            matSuffix
            type="button"
            (click)="vm.hide.set(!vm.hide())"
            [attr.aria-label]="'Toggle password visibility'"
            [attr.aria-pressed]="vm.hide()"
          >
            <mat-icon>{{ vm.hide() ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          @if (vm.form.get('password')?.hasError('required') && vm.form.get('password')?.touched) {
            <mat-error>Password is required</mat-error>
          }
          @if (vm.form.get('password')?.errors?.['minDigits'] && vm.form.get('password')?.touched) {
            <mat-error>Password must have at least 8 characters</mat-error>
          }
        </mat-form-field>

        <mat-checkbox formControlName="tnc" class="terms-check">
          I agree to the Terms of Service and Privacy Policy
        </mat-checkbox>
        @if (vm.form.get('tnc')?.invalid && vm.form.get('tnc')?.touched) {
          <p class="field-error" role="alert">You must accept the terms to create an account.</p>
        }

        <button mat-flat-button color="primary" type="submit" class="submit" [disabled]="vm.isSubmitting()" [attr.aria-busy]="vm.isSubmitting()">
          {{ vm.isSubmitting() ? 'Creating your account…' : 'Create my business account' }}
        </button>
      </form>

      <p authFooter class="footer-links">
        Already have an account? <a routerLink="../../partner/signin">Sign in</a>
      </p>
      <p authFooter class="legal">
        By creating an account, you agree to our
        <a href="https://marketspase.com/legal/terms" target="_blank" rel="noopener">Terms</a>
        and
        <a href="https://marketspase.com/legal/privacy" target="_blank" rel="noopener">Privacy Policy</a>.
      </p>
    </async-mobile-auth-shell>
  `,
  styles: [`
    .auth-progress {
      margin: 0 -18px 14px;
      width: calc(100% + 36px);
      height: 3px;
      --mdc-linear-progress-track-height: 3px;
      --mdc-linear-progress-active-indicator-height: 3px;
      --mdc-linear-progress-active-indicator-color: var(--ms-primary);
      --mdc-linear-progress-track-color: transparent;
    }

    .referral-note {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0 0 12px;
      padding: 10px;
      border: 1px solid color-mix(in srgb, var(--ms-success) 35%, transparent);
      border-radius: var(--ms-radius-md);
      background: var(--ms-success-soft);
      color: var(--ms-text);
      font-size: 0.78rem;
      line-height: 1.45;
      text-align: left;
    }

    .referral-note mat-icon {
      flex: none;
      color: var(--ms-success);
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 2px;
      text-align: left;
    }

    .terms-check {
      margin: 4px 0;
    }

    .field-error {
      margin: 0 0 8px;
      color: var(--ms-error);
      font-size: 0.78rem;
    }

    .submit {
      min-height: 48px;
      margin-top: 4px;
    }

    .footer-links,
    .legal {
      margin: 4px 0 0;
      color: var(--ms-text-muted);
      font-size: 0.78rem;
      line-height: 1.5;
      text-align: center;
    }

    .footer-links a,
    .legal a {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      color: var(--ms-primary-strong);
      font-weight: 650;
      text-decoration: none;
    }
  `],
})
export class PartnerSignupMobileComponent {
  protected readonly vm = inject(SignUpFacade);
}
