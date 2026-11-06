import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ProductInterface } from './monthly-purchase.service';

@Injectable({
  providedIn: 'root'
})
export class GetProductService {
 /*  private cart = new BehaviorSubject<ProductInterface[]>([]);
  cart$ = this.cart.asObservable();

  constructor() {}

  addToCart(product: ProductInterface): void {
    const currentCart = this.cart.value;
    currentCart.push(product);
    this.cart.next(currentCart); // Update the observable
  }

  getCart(): ProductInterface[] {
    return this.cart.value;
  }

  clearCart(): void {
    this.cart.next([]);
  } */

    private cartSubject = new BehaviorSubject<ProductInterface[]>([]);
  cart$ = this.cartSubject.asObservable();

  getCart(): ProductInterface[] {
    return this.cartSubject.value;
  }

  updateCart(cart: ProductInterface[]): void {
    this.cartSubject.next([...cart]);
  }

  private lineKey(item: ProductInterface): string {
    return `${item._id}:${item.saleMode ?? 'personal'}`;
  }

  addToCart(product: ProductInterface, quantity: number = 1): void {
    const cart = this.getCart();
    const amount = Math.max(Number(quantity) || 1, 1);
    const mode = product.saleMode ?? 'personal';
    const candidate = { ...product, saleMode: mode };
    const key = this.lineKey(candidate);
    const index = cart.findIndex((item) => this.lineKey(item) === key);

    if (index >= 0) {
      this.updateCart(cart.map((item, itemIndex) => (
        itemIndex === index
          ? { ...item, quantity: (item.quantity ?? 0) + amount }
          : item
      )));
    } else {
      this.updateCart([...cart, { ...candidate, quantity: amount }]);
    }
}


  removeFromCart(product: ProductInterface): void {
    const key = this.lineKey(product);
    this.updateCart(this.getCart().filter((item) => this.lineKey(item) !== key));
  }

  clearCart(): void {
    this.updateCart([]);
  }

}
