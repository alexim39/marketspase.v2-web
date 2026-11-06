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
  ],
})
export class AdminSigninComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly platformUrl = environment.platformUrl;
  protected email = '';
  protected password = '';
  protected showPassword = false;

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('reason') === 'forbidden') {
      this.error.set('This account does not have admin access.');
    }
    this.auth.resolve().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((ok) => {
      if (!ok) return;
      if (this.auth.isAdmin()) {
        void this.router.navigateByUrl(this.returnUrl());
        return;
      }
      this.auth.signOut().subscribe({ next: () => undefined, error: () => undefined });
      this.error.set('This account does not have admin access.');
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
            void this.router.navigateByUrl(this.returnUrl());
            return;
          }
          this.auth.signOut().subscribe({ next: () => undefined, error: () => undefined });
          this.error.set('This account does not have admin access.');
        },
        error: (err: ApiError) => this.error.set(userError(err)),
      });
  }

  private returnUrl(): string {
    const target = String(this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard');
    return target.startsWith('/') && !target.startsWith('//') ? target : '/dashboard';
  }
}
