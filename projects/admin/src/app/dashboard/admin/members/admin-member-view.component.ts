import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AdminService } from '../../../core/admin/admin.service';
import { Member360 } from '../../../core/admin/admin.models';
import { ApiError, userError } from '../../../core/http/api-error';
import { AdminWalletCreditDialogComponent } from './wallet-credit.dialog';

@Component({
  selector: 'async-admin-member-view',
  templateUrl: './admin-member-view.component.html',
  styleUrls: ['./admin-member-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, MatButtonModule, MatIconModule, MatProgressBarModule, RouterModule],
})
export class AdminMemberViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly admin = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly profile = signal<Member360 | null>(null);
  private memberId = '';

  ngOnInit(): void {
    this.memberId = String(this.route.snapshot.paramMap.get('id') ?? '').trim();
    if (!this.memberId) {
      this.error.set('Member not found');
      this.loading.set(false);
      return;
    }
    this.load();
  }

  protected creditWallet(): void {
    const profile = this.profile();
    if (!profile) return;
    this.dialog.open<AdminWalletCreditDialogComponent, { id: string; name: string; balance: number }, boolean>(
      AdminWalletCreditDialogComponent,
      {
        data: {
          id: profile.identity.id,
          name: profile.identity.name,
          balance: profile.money.balance,
        },
        width: '520px',
        autoFocus: 'dialog',
        restoreFocus: true,
      },
    ).afterClosed().subscribe((credited) => {
      if (credited) this.load();
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.admin.member360(this.memberId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.profile.set(response.data ?? null);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  protected loginAge(profile: Member360): string {
    if (profile.login.neverSeen || profile.login.daysSinceLogin === null) return 'never';
    if (profile.login.daysSinceLogin <= 0) return 'today';
    if (profile.login.daysSinceLogin === 1) return 'yesterday';
    if (profile.login.daysSinceLogin < 30) return `${profile.login.daysSinceLogin}d ago`;
    return `${Math.floor(profile.login.daysSinceLogin / 30)}mo ago`;
  }
}
