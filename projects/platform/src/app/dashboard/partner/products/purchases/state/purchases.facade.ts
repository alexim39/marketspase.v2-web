import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PartnerInterface, PartnerService } from '../../../../../_common/services/partner.service';
import { userError } from '../../../../../core/http/api-error';
import { ProductService } from '../../monthly-purchase.service';
import { Order } from '../purchases.component';

/** Shared buyer order history for My orders. */
@Injectable()
export class PurchasesFacade {
  private readonly partnerService = inject(PartnerService);
  private readonly productService = inject(ProductService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly orders = signal<Order[]>([]);
  private partnerId = '';
  private started = false;

  ensureLoaded(): void {
    if (this.started) return;
    this.started = true;
    this.partnerService.getSharedPartnerData$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((partner) => {
        const value = partner as PartnerInterface | null;
        if (!value?._id) return;
        this.partnerId = value._id;
        this.load();
      });
  }

  load(): void {
    if (!this.partnerId) return;
    this.loading.set(true);
    this.error.set(null);
    this.productService.getAllOrderBy(this.partnerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.orders.set((response?.data ?? []) as unknown as Order[]);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }
}
