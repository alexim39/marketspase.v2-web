import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ErrorStateComponent } from '@marketspase/shared/ui/error-state/error-state.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { StoreOrder } from '../store.models';
import { storeError, StoreService } from '../store.service';

@Component({
  selector: 'async-store-checkout-result',
  templateUrl: './checkout-result.component.html',
  styleUrls: ['./checkout-result.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [CurrencyPipe, DatePipe, ErrorStateComponent, MatIconModule, PageSkeletonComponent, RouterModule],
})
export class StoreCheckoutResultComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly storesApi = inject(StoreService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly checking = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly order = signal<StoreOrder | null>(null);
  protected readonly status = signal('pending');
  protected reference = '';

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.reference = String(params.get('reference') ?? params.get('trxref') ?? '').trim();
    if (!this.reference) {
      this.loading.set(false);
      this.error.set('We could not find a payment reference. If you paid, contact support with your receipt.');
      return;
    }
    this.verify();
  }

  protected verify(): void {
    if (!this.reference || this.checking()) return;
    this.checking.set(true);
    this.loading.set(true);
    this.error.set(null);
    this.storesApi.verifyOrder(this.reference)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.order.set(response.data.order);
          this.status.set(response.data.status);
          this.checking.set(false);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(storeError(err));
          this.checking.set(false);
          this.loading.set(false);
        },
      });
  }

  protected get paid(): boolean {
    return this.status() === 'paid' || this.order()?.payment.status === 'paid';
  }

  protected get refunded(): boolean {
    return this.order()?.status === 'refunded' || this.order()?.payment.status === 'refunded';
  }
}
