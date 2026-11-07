import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@marketspase/shared/core/http/api-client.service';
import { environment } from '../../environments/environment';
import {
  StoreDetailEnvelope,
  StoreListEnvelope,
  StoreOrderCreateEnvelope,
  StoreOrderEnvelope,
  StoreOrderVerifyEnvelope,
  StoreProductEnvelope,
} from './store.models';

@Injectable({ providedIn: 'root' })
export class StoreService {
  private readonly api = inject(ApiClient);

  listStores(
    query = '',
    params: { cursor?: string | null; limit?: number } = {},
  ): Observable<StoreListEnvelope> {
    const search = new URLSearchParams();
    const q = query.trim();
    if (q) search.set('q', q);
    if (params.cursor) search.set('cursor', params.cursor);
    if (params.limit) search.set('limit', String(params.limit));
    const suffix = search.toString() ? `?${search.toString()}` : '';
    return this.api.get<StoreListEnvelope>(`v1/stores${suffix}`);
  }

  getStore(slug: string): Observable<StoreDetailEnvelope> {
    return this.api.get<StoreDetailEnvelope>(`v1/stores/${encodeURIComponent(slug)}`);
  }

  getProduct(slug: string, productId: string): Observable<StoreProductEnvelope> {
    return this.api.get<StoreProductEnvelope>(
      `v1/stores/${encodeURIComponent(slug)}/products/${productId}`,
    );
  }

  createOrder(
    slug: string,
    body: {
      items: Array<{ storeProductId: string; quantity: number }>;
      customer: {
        name: string;
        email: string;
        phone: string;
        street: string;
        city: string;
        state: string;
        country?: string;
        note?: string;
      };
    },
  ): Observable<StoreOrderCreateEnvelope> {
    return this.api.post<StoreOrderCreateEnvelope>(
      `v1/stores/${encodeURIComponent(slug)}/orders`,
      body,
    );
  }

  getOrder(reference: string): Observable<StoreOrderEnvelope> {
    return this.api.get<StoreOrderEnvelope>(
      `v1/stores/orders/${encodeURIComponent(reference)}`,
    );
  }

  verifyOrder(reference: string): Observable<StoreOrderVerifyEnvelope> {
    return this.api.post<StoreOrderVerifyEnvelope>(
      `v1/stores/orders/${encodeURIComponent(reference)}/verify`,
      {},
    );
  }
}

export const storeAssetUrl = (value: string): string => {
  const url = String(value ?? '').trim();
  if (!url) return '';
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('/')) return url;
  return url;
};

export const storeProductImage = (image: string): string => {
  const value = String(image ?? '').trim();
  if (!value) return '';
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('/')) return value;
  const base = String(environment.productImageBaseUrl ?? '').replace(/\/+$/, '');
  if (/\.(png|jpe?g|webp|gif|avif)$/i.test(value)) return `${base}/${value}`;
  return `${base}/${value}.PNG`;
};

export const storeError = (error: unknown): string => {
  const value = error as { error?: { message?: unknown }; message?: unknown };
  const nested = value?.error?.message;
  if (typeof nested === 'string' && nested.trim()) return nested;
  if (typeof value?.message === 'string' && value.message.trim()) return value.message;
  return 'Something went wrong. Please try again.';
};
