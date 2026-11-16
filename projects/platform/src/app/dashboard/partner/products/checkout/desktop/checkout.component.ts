import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { CheckoutFacade } from '../state/checkout.facade';

@Component({
  selector: 'async-checkout-desktop',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    RouterModule,
  ],
})
export class CheckoutDesktopComponent {
  private readonly facade = inject(CheckoutFacade);

  protected readonly cart = this.facade.cart;
  protected readonly partner = this.facade.partner;
  protected readonly shipping = this.facade.shipping;
  protected readonly placing = this.facade.placing;
  protected readonly error = this.facade.error;
  protected readonly success = this.facade.success;
  protected readonly total = this.facade.total;
  protected readonly itemCount = this.facade.itemCount;
  protected readonly balance = this.facade.balance;
  protected readonly shortfall = this.facade.shortfall;
  protected readonly hasResale = this.facade.hasResale;
  protected readonly resaleMargin = this.facade.resaleMargin;
  protected readonly validShipping = this.facade.validShipping;
  protected readonly canPlaceOrder = this.facade.canPlaceOrder;

  protected categoryOf(item: Parameters<CheckoutFacade['categoryOf']>[0]): string { return this.facade.categoryOf(item); }
  protected imageOf(item: Parameters<CheckoutFacade['imageOf']>[0]): string { return this.facade.imageOf(item); }
  protected lineTotal(item: Parameters<CheckoutFacade['lineTotal']>[0]): number { return this.facade.lineTotal(item); }
  protected setShipping(field: Parameters<CheckoutFacade['setShipping']>[0], value: unknown): void { this.facade.setShipping(field, value); }
  protected increase(item: Parameters<CheckoutFacade['increase']>[0]): void { this.facade.increase(item); }
  protected decrease(item: Parameters<CheckoutFacade['decrease']>[0]): void { this.facade.decrease(item); }
  protected remove(item: Parameters<CheckoutFacade['remove']>[0]): void { this.facade.remove(item); }
  protected clearCart(): void { this.facade.clearCart(); }
  protected back(): void { this.facade.back(); }
  protected topUp(): void { this.facade.topUp(); }
  protected placeOrder(): void { this.facade.placeOrder(); }
  protected continueShopping(): void { this.facade.continueShopping(); }
  protected hideBrokenImage(event: Event): void { this.facade.hideBrokenImage(event); }
}
