import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import {
  MyStoreEnvelope,
  StoreEarningsEnvelope,
  StoreOrderEnvelope,
  StoreOrdersEnvelope,
  StoreProductEnvelope,
  StoreProductsEnvelope,
  StoreProfileEnvelope,
  StoreReceiptConfirmEnvelope,
  StoreReceiptsEnvelope,
} from './store.models';

/** Partner storefront management — authenticated platform endpoints. */
@Injectable({ providedIn: 'root' })
export class StoreService {
  private readonly api = inject(ApiClient);

  myStore(): Observable<MyStoreEnvelope> {
    return this.api.get<MyStoreEnvelope>('v1/stores/me');
  }

  updateStore(body: Record<string, unknown>): Observable<StoreProfileEnvelope> {
    return this.api.patch<StoreProfileEnvelope>('v1/stores/me', body);
  }

  myProducts(): Observable<StoreProductsEnvelope> {
    return this.api.get<StoreProductsEnvelope>('v1/stores/me/products');
  }

  updateProduct(id: string, body: Record<string, unknown>): Observable<StoreProductEnvelope> {
    return this.api.patch<StoreProductEnvelope>(`v1/stores/me/products/${id}`, body);
  }

  receipts(): Observable<StoreReceiptsEnvelope> {
    return this.api.get<StoreReceiptsEnvelope>('v1/stores/me/receipts');
  }

  confirmReceipt(orderId: string): Observable<StoreReceiptConfirmEnvelope> {
    return this.api.post<StoreReceiptConfirmEnvelope>(`v1/stores/me/receipts/${orderId}/confirm`, {});
  }

  orders(status?: string): Observable<StoreOrdersEnvelope> {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.api.get<StoreOrdersEnvelope>(`v1/stores/me/orders${suffix}`);
  }

  earnings(): Observable<StoreEarningsEnvelope> {
    return this.api.get<StoreEarningsEnvelope>('v1/stores/me/earnings');
  }

  updateOrder(orderId: string, body: Record<string, unknown>): Observable<StoreOrderEnvelope> {
    return this.api.patch<StoreOrderEnvelope>(`v1/stores/me/orders/${orderId}`, body);
  }
}
