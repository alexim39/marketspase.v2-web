import { Injectable, computed, signal } from '@angular/core';

export interface StoreCartItem {
  storeProductId: string;
  productId: string;
  name: string;
  image: string;
  category: string;
  unitPrice: number;
  quantity: number;
  stock: number;
}

export interface StoreCart {
  storeSlug: string;
  storeName: string;
  deliveryFee: number;
  items: StoreCartItem[];
}

export type AddToCartResult =
  | { added: true; quantity: number }
  | { added: false; reason: 'different-store' | 'out-of-stock' | 'limit'; currentStore?: string; quantity?: number };

const STORAGE_KEY = 'ms_store_cart_v1';
const EMPTY_CART: StoreCart = { storeSlug: '', storeName: '', deliveryFee: 0, items: [] };

const readCart = (): StoreCart => {
  if (typeof localStorage === 'undefined') return { ...EMPTY_CART, items: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<StoreCart> | null;
    if (!parsed || !Array.isArray(parsed.items)) return { ...EMPTY_CART, items: [] };
    return {
      storeSlug: String(parsed.storeSlug ?? ''),
      storeName: String(parsed.storeName ?? ''),
      deliveryFee: Math.max(Number(parsed.deliveryFee) || 0, 0),
      items: parsed.items
        .filter((item): item is StoreCartItem => Boolean(item) && typeof item === 'object')
        .map((item) => ({
          storeProductId: String(item.storeProductId ?? ''),
          productId: String(item.productId ?? ''),
          name: String(item.name ?? ''),
          image: String(item.image ?? ''),
          category: String(item.category ?? 'Essentials'),
          unitPrice: Math.max(Number(item.unitPrice) || 0, 0),
          quantity: Math.max(Math.floor(Number(item.quantity) || 0), 1),
          stock: Math.max(Math.floor(Number(item.stock) || 0), 0),
        }))
        .filter((item) => item.storeProductId && item.quantity > 0),
    };
  } catch {
    return { ...EMPTY_CART, items: [] };
  }
};

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly state = signal<StoreCart>(readCart());

  readonly cart = this.state.asReadonly();
  readonly items = computed(() => this.state().items);
  readonly storeName = computed(() => this.state().storeName);
  readonly storeSlug = computed(() => this.state().storeSlug);
  readonly isEmpty = computed(() => this.state().items.length === 0);
  readonly itemCount = computed(() => (
    this.state().items.reduce((sum, item) => sum + item.quantity, 0)
  ));
  readonly subtotal = computed(() => (
    this.state().items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  ));
  readonly deliveryFee = computed(() => (this.isEmpty() ? 0 : this.state().deliveryFee));
  readonly total = computed(() => this.subtotal() + this.deliveryFee());

  addItem(
    item: Omit<StoreCartItem, 'quantity'>,
    store: { slug: string; name: string; deliveryFee: number },
    quantity = 1,
  ): AddToCartResult {
    const current = this.state();
    if (current.storeSlug && current.storeSlug !== store.slug) {
      return { added: false, reason: 'different-store', currentStore: current.storeName };
    }
    if (item.stock <= 0) return { added: false, reason: 'out-of-stock' };

    const existing = current.items.find((line) => line.storeProductId === item.storeProductId);
    const nextQuantity = (existing?.quantity ?? 0) + Math.max(Math.floor(quantity) || 1, 1);
    if (nextQuantity > item.stock) {
      return { added: false, reason: 'limit', quantity: item.stock };
    }

    const nextItems = existing
      ? current.items.map((line) => (
          line.storeProductId === item.storeProductId
            ? { ...line, quantity: nextQuantity, stock: item.stock, unitPrice: item.unitPrice }
            : line
        ))
      : [...current.items, { ...item, quantity: nextQuantity }];

    this.commit({
      storeSlug: store.slug,
      storeName: store.name,
      deliveryFee: Math.max(Number(store.deliveryFee) || 0, 0),
      items: nextItems,
    });
    return { added: true, quantity: nextQuantity };
  }

  setQuantity(storeProductId: string, quantity: number): void {
    const next = Math.floor(Number(quantity));
    if (!Number.isFinite(next)) return;
    if (next <= 0) {
      this.remove(storeProductId);
      return;
    }
    const current = this.state();
    const nextItems = current.items.map((item) => (
      item.storeProductId === storeProductId
        ? { ...item, quantity: Math.min(next, Math.max(item.stock, 1)) }
        : item
    ));
    this.commit({ ...current, items: nextItems });
  }

  increment(storeProductId: string): void {
    const item = this.state().items.find((line) => line.storeProductId === storeProductId);
    if (item) this.setQuantity(storeProductId, item.quantity + 1);
  }

  decrement(storeProductId: string): void {
    const item = this.state().items.find((line) => line.storeProductId === storeProductId);
    if (item) this.setQuantity(storeProductId, item.quantity - 1);
  }

  remove(storeProductId: string): void {
    const current = this.state();
    const nextItems = current.items.filter((item) => item.storeProductId !== storeProductId);
    this.commit(nextItems.length === 0 ? { ...EMPTY_CART, items: [] } : { ...current, items: nextItems });
  }

  clear(): void {
    this.commit({ ...EMPTY_CART, items: [] });
  }

  private commit(cart: StoreCart): void {
    this.state.set(cart);
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Storage can be unavailable in private mode. The in-memory cart still works.
    }
  }
}
