import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { StatePanelComponent } from '@marketspase/shared/ui/state-panel/state-panel.component';
import { MobileAuthShellComponent } from '../../mobile-auth-shell/mobile-auth-shell.component';
import { SignInFacade } from '../state/signin.facade';

@Component({
  selector: 'async-partner-signin-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MobileAuthShellComponent,
    ReactiveFormsModule,
    RouterModule,
    StatePanelComponent,
  ],
  template: `
    <async-mobile-auth-shell
      eyebrow="MarketSpase · Welcome back"
      title="Welcome back"
      subtitle="Sign in to check your plan, talk to Ora and keep your online business moving."
    >
      @if (vm.accessState(); as notice) {
        <async-state-panel
          [kind]="notice === 'expired' ? 'session' : 'permission'"
          [compact]="true"
          [title]="notice === 'expired' ? 'Your session expired' : 'This account needs a different role'"
          [message]="notice === 'expired'
            ? 'We saved the work on the page you were using.'
            : 'The account signed in does not have permission for the page you requested.'"
          [reason]="notice === 'expired'
            ? 'Your secure sign-in window ended.'
            : 'The page is protected by a role your account does not hold.'"
          [fix]="notice === 'expired'
            ? 'Sign in again and we will return you to the same page, with your saved work restored.'
            : 'Sign in with a permitted account to continue.'"
        >
          <button mat-stroked-button type="button" (click)="focusSignIn()">
            {{ notice === 'expired' ? 'Sign in again' : 'Use another account' }}
          </button>
        </async-state-panel>
      }

      @if (vm.isSubmitting()) {
        <mat-progress-bar mode="indeterminate" class="auth-progress" aria-label="Signing you in" />
      }

      <form [formGroup]="vm.form" (ngSubmit)="vm.onSubmit()">
        <mat-form-field appearance="outline">
          <mat-label>Email address</mat-label>
          <input matInput #emailInput type="email" inputmode="email" formControlName="email" autocomplete="email" />
          @if (vm.email?.hasError('email') && vm.email?.touched) {
            <mat-error>Use a valid email, like ada@example.com.</mat-error>
          }
          @if (vm.email?.hasError('required') && vm.email?.touched) {
            <mat-error>Enter the email address you signed up with.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Enter your password</mat-label>
          <input matInput [type]="vm.hide() ? 'password' : 'text'" formControlName="password" autocomplete="current-password" />
          @if (vm.password?.hasError('required') && vm.password?.touched) {
            <mat-error>Enter your password to continue.</mat-error>
          }
          <button
            mat-icon-button
            matSuffix
            type="button"
            (click)="vm.hide.set(!vm.hide())"
            [attr.aria-label]="vm.hide() ? 'Show password' : 'Hide password'"
            [attr.aria-pressed]="vm.hide()"
          >
            <mat-icon>{{ vm.hide() ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
        </mat-form-field>

        @if (vm.serverError()) {
          <p class="server-error" role="alert">{{ vm.serverError() }}</p>
        }
        @if (vm.info()) {
          <p class="info" role="status">{{ vm.info() }}</p>
        }
        @if (vm.needsVerification()) {
          <button mat-stroked-button type="button" class="resend" (click)="vm.resendVerification()" [disabled]="vm.isResending()">
            {{ vm.isResending() ? 'Sending new link…' : 'Resend verification email' }}
          </button>
        }

        <button mat-flat-button color="primary" type="submit" class="submit" [disabled]="vm.isSubmitting()" [attr.aria-busy]="vm.isSubmitting()">
          {{ vm.isSubmitting() ? 'Signing you in…' : 'Sign in' }}
        </button>
      </form>

      <p authFooter class="footer-links">
        <a routerLink="../../partner/forgot-password">Forgot password?</a>
        <span>·</span>
        <a routerLink="../../partner/signup">Create an account</a>
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

    form {
      display: flex;
      flex-direction: column;
      gap: 2px;
      text-align: left;
    }

    .server-error { color: var(--ms-error); margin: 4px 0; font-size: 0.82rem; }
    .info { color: var(--ms-success); margin: 4px 0; font-size: 0.82rem; }
    .resend { margin: 2px 0 8px; }
    .submit { min-height: 48px; margin-top: 6px; }
    .footer-links {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin: 4px 0 0;
      color: var(--ms-text-muted);
      font-size: 0.8rem;
    }
    .footer-links a {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      color: var(--ms-primary-strong);
      font-weight: 650;
      text-decoration: none;
    }
  `],
})
export class PartnerSigninMobileComponent {
  protected readonly vm = inject(SignInFacade);
  protected readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');

  protected focusSignIn(): void {
    const input = this.emailInput()?.nativeElement;
    if (!input) return;
    input.focus({ preventScroll: true });
    input.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}
