import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import {
  AdminSettlementsEnvelope,
  AdminStoreDetailEnvelope,
  AdminStoreListEnvelope,
  AdminStoreOrderEnvelope,
  AdminStoreOrdersEnvelope,
  AdminStoreReturnEnvelope,
  AdminStoreReturnsEnvelope,
  AdminStoreSettingsEnvelope,
  AdminStoreSummary,
} from './admin-store.models';

@Injectable({ providedIn: 'root' })
export class AdminStoreService {
  private readonly api = inject(ApiClient);

  stores(params: { q?: string; status?: string; limit?: number } = {}): Observable<AdminStoreListEnvelope> {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.status) query.set('status', params.status);
    query.set('limit', String(params.limit ?? 100));
    return this.api.get<AdminStoreListEnvelope>(`v1/admin/stores?${query.toString()}`);
  }

  store(id: string): Observable<AdminStoreDetailEnvelope> {
    return this.api.get<AdminStoreDetailEnvelope>(`v1/admin/stores/${id}`);
  }

  setStatus(id: string, status: AdminStoreSummary['status'], reason = ''): Observable<{ success: boolean; message?: string; data: AdminStoreSummary }> {
    return this.api.patch<{ success: boolean; message?: string; data: AdminStoreSummary }>(
      `v1/admin/stores/${id}/status`,
      { status, reason },
    );
  }

  orders(params: { status?: string; q?: string; storeId?: string; partnerId?: string; limit?: number } = {}): Observable<AdminStoreOrdersEnvelope> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.q) query.set('q', params.q);
    if (params.storeId) query.set('storeId', params.storeId);
    if (params.partnerId) query.set('partnerId', params.partnerId);
    query.set('limit', String(params.limit ?? 100));
    return this.api.get<AdminStoreOrdersEnvelope>(`v1/admin/store-orders?${query.toString()}`);
  }

  order(id: string): Observable<AdminStoreOrderEnvelope> {
    return this.api.get<AdminStoreOrderEnvelope>(`v1/admin/store-orders/${id}`);
  }

  releaseEscrow(id: string): Observable<AdminStoreOrderEnvelope> {
    return this.api.post<AdminStoreOrderEnvelope>(`v1/admin/store-orders/${id}/release-escrow`, {});
  }

  refundOrder(id: string, reason: string): Observable<AdminStoreOrderEnvelope> {
    return this.api.post<AdminStoreOrderEnvelope>(`v1/admin/store-orders/${id}/refund`, { reason });
  }

  settlements(): Observable<AdminSettlementsEnvelope> {
    return this.api.get<AdminSettlementsEnvelope>('v1/admin/store-settlements');
  }

  returns(status?: string): Observable<AdminStoreReturnsEnvelope> {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.api.get<AdminStoreReturnsEnvelope>(`v1/admin/store-returns${suffix}`);
  }

  refundReturn(returnId: string, reason: string, adminNote = ''): Observable<AdminStoreReturnEnvelope> {
    return this.api.post<AdminStoreReturnEnvelope>(`v1/admin/store-returns/${returnId}/refund`, {
      reason,
      adminNote,
    });
  }

  settings(): Observable<AdminStoreSettingsEnvelope> {
    return this.api.get<AdminStoreSettingsEnvelope>('v1/admin/settings/store');
  }

  updateSettings(body: {
    serviceFeePercent: number;
    escrowHoldDays: number;
    autoDeliverDays?: number;
    returnWindowDays?: number;
  }): Observable<AdminStoreSettingsEnvelope> {
    return this.api.put<AdminStoreSettingsEnvelope>('v1/admin/settings/store', body);
  }
}
