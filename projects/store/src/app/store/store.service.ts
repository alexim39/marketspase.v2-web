import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { ApiClient } from '@marketspase/shared/core/http/api-client.service';
import { environment } from '../../environments/environment';
import {
  StoreDetailEnvelope,
  StoreListEnvelope,
  StoreOrderCreateEnvelope,
  StoreOrderEnvelope,
  StoreOrderVerifyEnvelope,
  StoreProductEnvelope,
  StoreReturnEnvelope,
  PublicLeadPageEnvelope,
  PublicLeadSubmitEnvelope,
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

  resolveStore(handle: string): Observable<{ success: boolean; data: { slug: string; canonical: boolean } }> {
    return this.api.get<{ success: boolean; data: { slug: string; canonical: boolean } }>(
      `v1/stores/resolve/${encodeURIComponent(handle)}`,
    );
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
    idempotencyKey: string,
  ): Observable<StoreOrderCreateEnvelope> {
    return this.api.post<StoreOrderCreateEnvelope>(
      `v1/stores/${encodeURIComponent(slug)}/orders`,
      body,
      new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    );
  }

  getOrder(reference: string, token: string): Observable<StoreOrderEnvelope> {
    const params = new HttpParams().set('token', token);
    return this.api.get<StoreOrderEnvelope>(
      `v1/stores/orders/${encodeURIComponent(reference)}`,
      params,
    );
  }

  verifyOrder(reference: string, token: string): Observable<StoreOrderVerifyEnvelope> {
    const params = new HttpParams().set('token', token);
    return this.api.post<StoreOrderVerifyEnvelope>(
      `v1/stores/orders/${encodeURIComponent(reference)}/verify`,
      {},
      new HttpHeaders({ 'x-order-token': token }),
    );
  }

  markOrderReceived(reference: string, token: string): Observable<StoreOrderEnvelope> {
    return this.api.post<StoreOrderEnvelope>(
      `v1/stores/orders/${encodeURIComponent(reference)}/received`,
      {},
      new HttpHeaders({ 'x-order-token': token }),
    );
  }

  requestReturn(
    reference: string,
    token: string,
    body: { reason: string; note?: string },
  ): Observable<StoreReturnEnvelope> {
    return this.api.post<StoreReturnEnvelope>(
      `v1/stores/orders/${encodeURIComponent(reference)}/returns`,
      body,
      new HttpHeaders({ 'x-order-token': token }),
    );
  }

  publicLeadPage(username: string): Observable<PublicLeadPageEnvelope> {
    return this.api.get<PublicLeadPageEnvelope>(
      `v1/public/pages/${encodeURIComponent(username)}`,
    );
  }

  submitPublicLead(
    username: string,
    body: {
      name: string;
      surname?: string;
      phone: string;
      email?: string;
      state?: string;
      message?: string;
    },
  ): Observable<PublicLeadSubmitEnvelope> {
    return this.api.post<PublicLeadSubmitEnvelope>(
      `v1/public/pages/${encodeURIComponent(username)}/leads`,
      body,
    );
  }
}

const ORDER_TOKEN_KEY = 'ms_order_tokens_v1';

const readOrderTokens = (): Record<string, string> => {
  if (typeof localStorage === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(ORDER_TOKEN_KEY) ?? '{}') as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed ?? {}).filter(([, value]) => typeof value === 'string' && value),
    ) as Record<string, string>;
  } catch {
    return {};
  }
};

export const saveOrderToken = (reference: string, token: string): void => {
  if (!reference || !token || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ORDER_TOKEN_KEY, JSON.stringify({ ...readOrderTokens(), [reference]: token }));
  } catch { /* private mode */ }
};

export const getOrderToken = (reference: string): string => {
  if (!reference) return '';
  return readOrderTokens()[reference] ?? '';
};

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
