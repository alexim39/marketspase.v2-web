import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MobileAuthShellComponent } from '../../mobile-auth-shell/mobile-auth-shell.component';
import { ForgotPasswordFacade } from '../state/forgot-password.facade';

@Component({
  selector: 'async-partner-forgot-password-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule, MobileAuthShellComponent, ReactiveFormsModule, RouterModule],
  template: `
    <async-mobile-auth-shell
      eyebrow="MarketSpase · Partner Platform"
      title="Reset password"
      subtitle="Enter your account email — if it exists, a reset link is on its way. It expires in 60 minutes."
    >
      <form [formGroup]="vm.form" (ngSubmit)="vm.onSubmit()">
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

        <button mat-flat-button color="primary" type="submit" class="submit" [disabled]="vm.sending()">
          {{ vm.sending() ? 'Sending…' : 'Send reset link' }}
        </button>
      </form>

      <p authFooter class="footer-links">
        <a routerLink="../../partner/signin">Return to sign in</a>
        <span>·</span>
        <a routerLink="../../partner/signup">Create an account</a>
      </p>
    </async-mobile-auth-shell>
  `,
  styles: [`
    form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      text-align: left;
    }

    .submit {
      min-height: 48px;
      margin-top: 4px;
    }

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
export class PartnerForgotPasswordMobileComponent {
  protected readonly vm = inject(ForgotPasswordFacade);
}
