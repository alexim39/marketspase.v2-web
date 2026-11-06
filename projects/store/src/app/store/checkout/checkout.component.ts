import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { CartService } from '../cart/cart.service';
import { storeError, storeProductImage, StoreService } from '../store.service';

@Component({
  selector: 'async-store-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [CurrencyPipe, FormsModule, RouterModule],
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
    this.storesApi.createOrder(this.cart.storeSlug(), {
      items: this.cart.items().map((item) => ({
        storeProductId: item.storeProductId,
        quantity: item.quantity,
      })),
      customer: { ...this.form },
    }).pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: (response) => {
        this.cart.clear();
        window.location.assign(response.data.checkoutUrl);
      },
      error: (err: unknown) => {
        this.error.set(storeError(err));
      },
    });
  }
}
