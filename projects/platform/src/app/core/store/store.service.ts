import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import {
  MyStoreEnvelope,
  StoreEarningsEnvelope,
  StoreCustomerLeadEnvelope,
  StoreCustomerLeadsEnvelope,
  StoreImageUploadEnvelope,
  StoreOrderEnvelope,
  StoreOrdersEnvelope,
  StoreProductEnvelope,
  StoreProductsEnvelope,
  StoreProfileEnvelope,
  StoreReceiptConfirmEnvelope,
  StoreReceiptsEnvelope,
  StoreReturnEnvelope,
  StoreReturnsEnvelope,
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

  /** Upload a store logo or banner; returns the hosted URL to save on the store. */
  uploadImage(file: File, kind: 'logo' | 'banner'): Observable<StoreImageUploadEnvelope> {
    const form = new FormData();
    form.append('kind', kind);
    form.append('image', file);
    return this.api.upload<StoreImageUploadEnvelope>('v1/stores/me/images', form);
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

  returns(status?: string): Observable<StoreReturnsEnvelope> {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.api.get<StoreReturnsEnvelope>(`v1/stores/me/returns${suffix}`);
  }

  updateReturn(
    returnId: string,
    action: 'approve' | 'reject' | 'receive',
    note = '',
  ): Observable<StoreReturnEnvelope> {
    return this.api.patch<StoreReturnEnvelope>(`v1/stores/me/returns/${returnId}`, { action, note });
  }

  customerLeads(query: { q?: string; status?: string; limit?: number; skip?: number } = {}): Observable<StoreCustomerLeadsEnvelope> {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.status) params.set('status', query.status);
    if (query.limit) params.set('limit', String(query.limit));
    if (query.skip) params.set('skip', String(query.skip));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.api.get<StoreCustomerLeadsEnvelope>(`v1/stores/me/customer-leads${suffix}`);
  }

  updateCustomerLead(id: string, body: Record<string, unknown>): Observable<StoreCustomerLeadEnvelope> {
    return this.api.patch<StoreCustomerLeadEnvelope>(`v1/stores/me/customer-leads/${id}`, body);
  }
}
