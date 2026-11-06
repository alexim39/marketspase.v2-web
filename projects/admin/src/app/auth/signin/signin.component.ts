import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { BrandLogoComponent } from '@marketspase/shared/ui/brand-logo/brand-logo.component';
import { FieldErrorComponent } from '@marketspase/shared/ui/field-error/field-error.component';
import { StatePanelComponent } from '@marketspase/shared/ui/state-panel/state-panel.component';
import { SessionRecoveryService } from '@marketspase/shared/core/ui/session-recovery.service';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError, userError } from '../../core/http/api-error';

@Component({
  selector: 'async-admin-signin',
  templateUrl: './signin.component.html',
  styleUrls: ['./signin.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    RouterModule,
    BrandLogoComponent,
    FieldErrorComponent,
    StatePanelComponent,
  ],
})
export class AdminSigninComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly accessState = signal<'expired' | 'permission' | null>(null);
  private readonly recovery = inject(SessionRecoveryService);
  protected readonly platformUrl = environment.platformUrl;
  protected email = '';
  protected password = '';
  protected showPassword = false;

  ngOnInit(): void {
    const reason = this.route.snapshot.queryParamMap.get('reason');
    if (reason === 'forbidden') this.accessState.set('permission');
    if (reason === 'expired') this.accessState.set('expired');
    this.auth.resolve().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((ok) => {
      if (!ok) return;
      if (this.auth.isAdmin()) {
        void this.router.navigateByUrl(this.returnUrl());
        return;
      }
      this.auth.signOut().subscribe({ next: () => undefined, error: () => undefined });
      this.accessState.set('permission');
    });
  }

  protected submit(): void {
    if (this.loading() || !this.email.trim() || !this.password) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.signin({ email: this.email.trim(), password: this.password })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          if (this.auth.isAdmin()) {
            const target = this.returnUrl();
            this.recovery.clearNotice();
            void this.router.navigateByUrl(target).then(() => this.recovery.restorePending());
            return;
          }
          this.auth.signOut().subscribe({ next: () => undefined, error: () => undefined });
          this.accessState.set('permission');
        },
        error: (err: ApiError) => this.error.set(userError(err)),
      });
  }

  private returnUrl(): string {
    const target = String(this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard');
    return target.startsWith('/') && !target.startsWith('//') ? target : '/dashboard';
  }
}
