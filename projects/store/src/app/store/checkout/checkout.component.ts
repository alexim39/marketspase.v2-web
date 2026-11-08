import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule } from '@angular/router';
import { EmptyStateComponent } from '@marketspase/shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '@marketspase/shared/ui/page-header/page-header.component';
import { FieldErrorComponent } from '@marketspase/shared/ui/field-error/field-error.component';
import { finalize } from 'rxjs';
import { CartService } from '../cart/cart.service';
import { storeError, storeProductImage, saveOrderToken, StoreService } from '../store.service';

@Component({
  selector: 'async-store-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [CurrencyPipe, EmptyStateComponent, FieldErrorComponent, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, PageHeaderComponent, RouterModule],
})
export class StoreCheckoutComponent {
  private readonly cartApi = inject(CartService);
  private readonly storesApi = inject(StoreService);

  protected readonly cart = this.cartApi;
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = {
    name: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    country: 'Nigeria',
    note: '',
    consentToContact: false,
  };

  protected imageUrl(image: string): string {
    return storeProductImage(image);
  }

  protected submit(form: NgForm): void {
    if (this.submitting() || this.cart.isEmpty()) return;
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const idempotencyKey = this.cart.ensureCheckoutKey();
    this.storesApi.createOrder(this.cart.storeSlug(), {
      items: this.cart.items().map((item) => ({
        storeProductId: item.storeProductId,
        quantity: item.quantity,
      })),
      customer: { ...this.form },
    }, idempotencyKey).pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: (response) => {
        saveOrderToken(response.data.order.reference, response.data.orderToken);
        window.location.assign(response.data.checkoutUrl);
      },
      error: (err: unknown) => {
        const status = Number((err as { status?: number })?.status ?? 0);
        const code = String((err as { code?: string })?.code ?? '');
        if (status === 400 || (status === 409 && code === 'IDEMPOTENCY_KEY_REUSED')) {
          this.cart.resetCheckoutKey();
        }
        this.error.set(storeError(err));
      },
    });
  }
}
