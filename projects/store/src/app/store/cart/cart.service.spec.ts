import { CartService } from './cart.service';

const store = { slug: 'ada', name: 'Ada Store', deliveryFee: 1500 };
const coffee = {
  storeProductId: 'listing-1',
  productId: 'product-1',
  name: 'Liven Coffee',
  image: 'liven-coffee.PNG',
  category: 'Wellness drinks',
  unitPrice: 18000,
  stock: 5,
};

describe('CartService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds items, counts quantities and totals delivery once', () => {
    const cart = new CartService();
    expect(cart.addItem(coffee, store).added).toBeTrue();
    expect(cart.addItem(coffee, store).added).toBeTrue();

    expect(cart.itemCount()).toBe(2);
    expect(cart.subtotal()).toBe(36000);
    expect(cart.deliveryFee()).toBe(1500);
    expect(cart.total()).toBe(37500);
  });

  it('keeps one store per cart', () => {
    const cart = new CartService();
    cart.addItem(coffee, store);
    const result = cart.addItem(
      { ...coffee, storeProductId: 'listing-2', name: 'Perfect White' },
      { slug: 'another', name: 'Another Store', deliveryFee: 0 },
    );

    expect(result.added).toBeFalse();
    if (!result.added) expect(result.reason).toBe('different-store');
    expect(cart.storeSlug()).toBe('ada');
    expect(cart.items().length).toBe(1);
  });

  it('never increments past available stock', () => {
    const cart = new CartService();
    const limited = { ...coffee, stock: 1 };
    expect(cart.addItem(limited, store).added).toBeTrue();
    const second = cart.addItem(limited, store);

    expect(second.added).toBeFalse();
    if (!second.added) expect(second.reason).toBe('limit');
    expect(cart.itemCount()).toBe(1);
  });

  it('clears the store when the last line is removed', () => {
    const cart = new CartService();
    cart.addItem(coffee, store);
    cart.remove(coffee.storeProductId);

    expect(cart.isEmpty()).toBeTrue();
    expect(cart.storeSlug()).toBe('');
    expect(cart.deliveryFee()).toBe(0);
  });
});
