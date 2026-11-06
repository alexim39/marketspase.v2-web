import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PartnerInterface, PartnerService } from '../../../../_common/services/partner.service';
import { userError } from '../../../../core/http/api-error';
import { ProductService } from '../monthly-purchase.service';
import { Order, PurchasesComponent } from './purchases.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';

/**
 * Loads the signed-in buyer's orders and leaves presentation to the card
 * component. Handles loading and retry so the page never goes blank.
 */
@Component({
  selector: 'async-purchases-container',
  template: `
    @if (loading()) {
      <async-page-skeleton layout="list" [rows]="4" label="your orders" [showHeader]="false" />
    } @else if (error(); as err) {
      <section class="load-error dp-card" role="alert">
        <mat-icon>cloud_off</mat-icon>
        <div>
          <h2>Could not load your orders</h2>
          <p>{{ err }}</p>
        </div>
        <button mat-flat-button color="primary" type="button" (click)="load()">Retry</button>
      </section>
    } @else {
      <async-purchases [cartObject]="orders()" />
    }
  `,
  styles: [`
    .load-error {
      display: flex;
      align-items: center;
      gap: 0.8em;
      flex-wrap: wrap;
      margin-top: 1em;
      padding: 1.1em 1.2em;
    }
    .load-error > mat-icon { color: var(--ms-primary-strong); }
    .load-error h2 { margin: 0 0 0.15em; font-size: 1em; }
    .load-error p { margin: 0; color: var(--ms-text-muted); font-size: 0.85em; line-height: 1.45; }
    .load-error button { margin-left: auto; min-height: 44px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ProductService],
  imports: [MatButtonModule, MatIconModule, PageSkeletonComponent, PurchasesComponent],
})
export class PurchaseContainerComponent implements OnInit {
  private readonly partnerService = inject(PartnerService);
  private readonly productService = inject(ProductService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly orders = signal<Order[]>([]);

  private partnerId = '';

  ngOnInit(): void {
    this.partnerService.getSharedPartnerData$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((partner) => {
        const value = partner as PartnerInterface | null;
        if (!value?._id) return;
        this.partnerId = value._id;
        this.load();
      });
  }

  protected load(): void {
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
