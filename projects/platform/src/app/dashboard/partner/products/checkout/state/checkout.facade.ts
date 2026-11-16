import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { PartnerInterface, PartnerService } from '../../../../../_common/services/partner.service';
import { userError } from '../../../../../core/http/api-error';
import { UiFeedbackService } from '../../../../../core/ui/ui-feedback.service';
import { GetProductService } from '../../get-product.service';
import { ProductInterface, ProductService } from '../../monthly-purchase.service';
import { productCategory, productImage, productPrice } from '../../product-display';

type ShippingForm = {
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  country: string;
  notes: string;
};

type OrderSuccess = { orderNumber: string; total: number };

const EMPTY_SHIPPING: ShippingForm = {
  fullName: '', phone: '', street: '', city: '', state: '', country: 'Nigeria', notes: '',
};

/** Shared cart checkout, delivery details and order placement. */
@Injectable()
export class CheckoutFacade {
  private readonly cartApi = inject(GetProductService);
  private readonly productsApi = inject(ProductService);
  private readonly partnerService = inject(PartnerService);
  private readonly ui = inject(UiFeedbackService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly cart = toSignal(this.cartApi.cart$, { initialValue: [] as ProductInterface[] });
  readonly partner = signal<PartnerInterface | null>(null);
  readonly shipping = signal<ShippingForm>({ ...EMPTY_SHIPPING });
  readonly placing = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<OrderSuccess | null>(null);
  private prefilled = false;

  readonly total = computed(() => this.cart().reduce((sum, item) => sum + productPrice(item) * (item.quantity ?? 1), 0));
  readonly itemCount = computed(() => this.cart().reduce((sum, item) => sum + (item.quantity ?? 1), 0));
  readonly balance = computed(() => Number(this.partner()?.balance ?? 0));
  readonly shortfall = computed(() => Math.max(this.total() - this.balance(), 0));
  readonly hasResale = computed(() => this.cart().some((item) => item.saleMode === 'resale'));
  readonly resaleMargin = computed(() => this.cart().reduce((sum, item) => {
    if (item.saleMode !== 'resale') return sum;
    const retail = Number(item.retailPrice) || 0;
    const paid = productPrice(item);
    return sum + Math.max(retail - paid, 0) * (item.quantity ?? 1);
  }, 0));
  readonly validShipping = computed(() => {
    const form = this.shipping();
    return Boolean(form.fullName.trim() && form.phone.trim() && form.street.trim() && form.city.trim() && form.state.trim());
  });
  readonly canPlaceOrder = computed(() => this.cart().length > 0 && !this.placing() && this.validShipping() && this.shortfall() === 0);

  constructor() {
    this.partnerService.getSharedPartnerData$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (value) this.partner.set(value as PartnerInterface);
      });

    this.partnerService.getPartner({ fresh: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response?.success && response?.data) this.usePartner(response.data as PartnerInterface);
        },
        error: () => { /* shared partner data remains the fallback */ },
      });
  }

  categoryOf(item: ProductInterface): string { return productCategory(item).label; }
  imageOf(item: ProductInterface): string { return productImage(item); }
  lineTotal(item: ProductInterface): number { return productPrice(item) * (item.quantity ?? 1); }

  setShipping(field: keyof ShippingForm, value: unknown): void {
    this.shipping.update((form) => ({ ...form, [field]: String(value ?? '') }));
    this.error.set(null);
  }

  increase(item: ProductInterface): void { this.cartApi.addToCart(item, 1); }
  decrease(item: ProductInterface): void {
    const quantity = item.quantity ?? 1;
    if (quantity <= 1) return;
    this.cartApi.updateCart(this.cart().map((entry) => (
      entry._id === item._id ? { ...entry, quantity: quantity - 1 } : entry
    )));
  }
  remove(item: ProductInterface): void { this.cartApi.removeFromCart(item); }
  clearCart(): void { this.cartApi.clearCart(); }
  back(): void { void this.router.navigate(['/dashboard/products']); }
  topUp(): void { void this.router.navigate(['/dashboard/wallet/deposit']); }

  placeOrder(): void {
    if (this.placing()) return;
    if (this.cart().length === 0) { this.ui.info('Your cart is empty.'); return; }
    if (!this.validShipping()) { this.ui.info('Complete your delivery details before paying.'); return; }
    if (this.shortfall() > 0) { this.ui.info('Top up your wallet to cover the order total.'); return; }

    this.placing.set(true);
    this.error.set(null);
    const paidTotal = this.total();

    this.productsApi.checkout({ products: this.cart(), shipping: this.shipping() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.placing.set(false);
          const payload = response as {
            message?: string;
            data?: { cartId?: string; orderNumber?: string; commissionPlan?: string };
          };
          const orderNumber = payload?.data?.orderNumber
            || (payload?.data?.cartId ? `PRD-${String(payload.data.cartId).slice(-6).toUpperCase()}` : '');
          this.cartApi.clearCart();
          this.success.set({ orderNumber, total: paidTotal });
          const current = this.partner();
          if (current) {
            const updated = { ...current, balance: Math.max(this.balance() - paidTotal, 0) };
            this.partner.set(updated);
            this.partnerService.updatePartnerService(updated);
          }
        },
        error: (err: HttpErrorResponse) => {
          this.placing.set(false);
          this.error.set(userError(err));
        },
      });
  }

  continueShopping(): void {
    this.success.set(null);
    void this.router.navigate(['/dashboard/products']);
  }

  hideBrokenImage(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    if (image) image.style.display = 'none';
  }

  private usePartner(partner: PartnerInterface): void {
    this.partner.set(partner);
    if (this.prefilled) return;
    const address = partner.address ?? ({} as PartnerInterface['address']);
    this.shipping.set({
      fullName: [partner.name, partner.surname].filter(Boolean).join(' ').trim(),
      phone: String(partner.phone ?? '').trim(),
      street: String(address?.street ?? '').trim(),
      city: String(address?.city ?? '').trim(),
      state: String(address?.state ?? '').trim(),
      country: String(address?.country ?? '').trim() || 'Nigeria',
      notes: '',
    });
    this.prefilled = true;
  }
}
