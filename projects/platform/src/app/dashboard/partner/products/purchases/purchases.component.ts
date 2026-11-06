import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterModule } from '@angular/router';
import { UiFeedbackService } from '../../../../core/ui/ui-feedback.service';
import { GetProductService } from '../get-product.service';
import { ProductInterface } from '../monthly-purchase.service';
import { productImage } from '../product-display';

type TabKey = 'all' | 'Pending' | 'Fulfilled' | 'Cancelled';

type OrderProduct = {
  _id: string;
  name?: string;
  price?: number;
  img?: string;
  category?: string;
  desc?: string;
};

type OrderItem = {
  product: OrderProduct | null;
  quantity: number;
  price?: number;
  saleMode?: 'personal' | 'resale';
  retailPrice?: number;
};

type OrderShipping = {
  fullName?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  notes?: string;
};

type Order = {
  _id: string;
  orderNumber?: string;
  orderStatus: string;
  saleMode?: 'personal' | 'resale' | 'mixed';
  totalCost: number;
  createdAt: string;
  decidedAt?: string | null;
  fulfilledAt?: string | null;
  cancelledAt?: string | null;
  shipping?: OrderShipping | null;
  products: OrderItem[];
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'all', label: 'All orders' },
  { key: 'Pending', label: 'Pending' },
  { key: 'Fulfilled', label: 'Fulfilled' },
  { key: 'Cancelled', label: 'Cancelled' },
];

/**
 * My orders — mobile-first order cards with status timelines, reorder and a
 * downloadable receipt. Reads the existing cart/order API.
 */
@Component({
  selector: 'async-purchases',
  templateUrl: 'purchases.component.html',
  styleUrls: ['purchases.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    RouterModule,
  ],
})
export class PurchasesComponent {
  private readonly cartApi = inject(GetProductService);
  private readonly ui = inject(UiFeedbackService);
  private readonly router = inject(Router);

  protected readonly orders = signal<Order[]>([]);
  protected readonly activeTab = signal<TabKey>('all');

  @Input() set cartObject(value: Order[] | undefined | null) {
    const rows = Array.isArray(value) ? value : [];
    this.orders.set(
      [...rows].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()),
    );
  }

  protected readonly tabs = computed(() => TABS.map((tab) => ({
    ...tab,
    count: tab.key === 'all'
      ? this.orders().length
      : this.orders().filter((order) => order.orderStatus === tab.key).length,
  })));

  protected readonly visibleOrders = computed(() => {
    const tab = this.activeTab();
    return tab === 'all'
      ? this.orders()
      : this.orders().filter((order) => order.orderStatus === tab);
  });

  protected setTab(key: TabKey): void {
    this.activeTab.set(key);
  }

  protected orderNumber(order: Order): string {
    return order.orderNumber
      || `PRD-${String(order._id ?? '').slice(-6).toUpperCase()}`;
  }

  protected statusTone(status: string): string {
    switch (String(status ?? '').toLowerCase()) {
      case 'fulfilled': return 'dp-status--ok';
      case 'pending': return 'dp-status--warn';
      case 'cancelled': return 'dp-status--bad';
      case 'voided': return 'dp-status--bad';
      default: return 'dp-status--info';
    }
  }

  protected itemCount(order: Order): number {
    return (order.products ?? []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }

  protected itemName(item: OrderItem): string {
    return item.product?.name || 'Product no longer available';
  }

  protected itemImage(item: OrderItem): string {
    const product = item.product;
    if (!product) return '';
    return productImage(product as ProductInterface);
  }

  protected itemUnitPrice(item: OrderItem): number {
    const price = Number(item.price ?? item.product?.price ?? 0);
    return Number.isFinite(price) ? price : 0;
  }

  protected itemTotal(item: OrderItem): number {
    return this.itemUnitPrice(item) * (Number(item.quantity) || 0);
  }

  protected orderTotal(order: Order): number {
    const total = Number(order.totalCost);
    return Number.isFinite(total) ? total : 0;
  }

  protected isResaleOrder(order: Order): boolean {
    return order.saleMode === 'resale'
      || order.saleMode === 'mixed'
      || (order.products ?? []).some((item) => item.saleMode === 'resale');
  }

  protected resaleMargin(order: Order): number {
    return (order.products ?? []).reduce((sum, item) => {
      if (item.saleMode !== 'resale') return sum;
      const retail = Number(item.retailPrice) || 0;
      return sum + Math.max(retail - this.itemUnitPrice(item), 0) * (Number(item.quantity) || 0);
    }, 0);
  }

  protected shippingLine(order: Order): string {
    const shipping = order.shipping;
    if (!shipping) return '';
    return [shipping.street, shipping.city, shipping.state, shipping.country]
      .filter(Boolean)
      .join(', ');
  }

  protected timeline(order: Order): Array<{ label: string; at: string | null; done: boolean; bad?: boolean }> {
    const placed = order.createdAt ?? null;
    const decided = order.fulfilledAt ?? order.cancelledAt ?? order.decidedAt ?? null;

    if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Voided') {
      return [
        { label: 'Order placed', at: placed, done: true },
        { label: 'Cancelled and refunded', at: decided, done: true, bad: true },
      ];
    }
    if (order.orderStatus === 'Fulfilled') {
      return [
        { label: 'Order placed', at: placed, done: true },
        { label: 'Fulfilled', at: decided, done: true },
      ];
    }
    return [
      { label: 'Order placed', at: placed, done: true },
      { label: 'Processing', at: null, done: false },
    ];
  }

  protected reorder(order: Order): void {
    let added = 0;

    for (const item of order.products ?? []) {
      const product = item.product;
      if (!product?._id) continue;
      this.cartApi.addToCart(
        {
          _id: product._id,
          name: product.name ?? 'Product',
          img: product.img ?? '',
          price: this.itemUnitPrice(item),
          category: product.category,
          desc: product.desc,
        },
        Math.max(Number(item.quantity) || 1, 1),
      );
      added += 1;
    }

    if (added === 0) {
      this.ui.info('These products are no longer available. Browse the shop for alternatives.');
      return;
    }

    this.ui.success(`${added} ${added === 1 ? 'product' : 'products'} added to your cart.`);
    void this.router.navigate(['/dashboard/checkout']);
  }

  protected downloadReceipt(order: Order): void {
    const rows = (order.products ?? []).map((item) => `
      <tr>
        <td>${this.escape(this.itemName(item))}</td>
        <td>${Number(item.quantity) || 0}</td>
        <td>${this.money(this.itemUnitPrice(item))}</td>
        <td>${this.money(this.itemTotal(item))}</td>
      </tr>`).join('');

    const shipping = order.shipping
      ? `
        <p>
          <strong>Deliver to</strong><br>
          ${this.escape(order.shipping.fullName || '')}<br>
          ${this.escape(this.shippingLine(order))}<br>
          ${this.escape(order.shipping.phone || '')}
        </p>`
      : '';

    const resale = this.isResaleOrder(order)
      ? `
        <div class="box">
          <strong>Resale purchase</strong>
          <p class="muted">Your margin at suggested retail: ${this.money(this.resaleMargin(order))}. This margin is yours when you sell; MarketSpase does not charge it.</p>
        </div>`
      : '';

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Receipt ${this.escape(this.orderNumber(order))}</title>
<style>
  body { font-family: Arial, sans-serif; color: #111426; margin: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #676c7e; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin: 18px 0; }
  th, td { text-align: left; border-bottom: 1px solid #e6e8f1; padding: 8px 6px; font-size: 13px; }
  th:last-child, td:last-child { text-align: right; }
  .total { font-size: 16px; font-weight: bold; text-align: right; }
  .box { border: 1px solid #e6e8f1; border-radius: 10px; padding: 12px 14px; margin: 14px 0; }
</style>
</head>
<body>
  <h1>MarketSpase receipt</h1>
  <p class="muted">Order ${this.escape(this.orderNumber(order))} &middot; ${this.escape(String(order.createdAt ?? '').slice(0, 10))} &middot; ${this.escape(order.orderStatus)}</p>
  <table>
    <thead><tr><th>Product</th><th>Qty</th><th>Unit</th><th>Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="total">Total: ${this.money(this.orderTotal(order))}</p>
  ${resale}
  <div class="box">${shipping || '<p class="muted">Delivery address not recorded on this order.</p>'}</div>
  <p class="muted">Paid from the MarketSpase wallet. Keep this receipt for your records.</p>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `marketspase-${this.orderNumber(order)}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  protected hideBrokenImage(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    if (image) image.style.display = 'none';
  }

  private money(value: number): string {
    return `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private escape(value: string): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
