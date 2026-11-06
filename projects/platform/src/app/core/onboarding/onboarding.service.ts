import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import {
  ActivationOrdersEnvelope,
  AdminActivationOrder,
  AdminActivationOrdersEnvelope,
  AdminKycEnvelope,
  AdminKycSubmission,
  CreateActivationOrderEnvelope,
  CreateActivationOrderInput,
  KycEnvelope,
  KycInput,
  OnboardingStatusEnvelope,
  StarterProductsEnvelope,
} from './onboarding.models';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly api = inject(ApiClient);

  status(): Observable<OnboardingStatusEnvelope> {
    return this.api.get<OnboardingStatusEnvelope>('v1/onboarding/status');
  }

  products(): Observable<StarterProductsEnvelope> {
    return this.api.get<StarterProductsEnvelope>('v1/onboarding/products');
  }

  submitKyc(input: KycInput): Observable<KycEnvelope> {
    return this.api.post<KycEnvelope>('v1/onboarding/kyc', input);
  }

  createOrder(input: CreateActivationOrderInput): Observable<CreateActivationOrderEnvelope> {
    return this.api.post<CreateActivationOrderEnvelope>('v1/onboarding/orders', input);
  }

  orders(): Observable<ActivationOrdersEnvelope> {
    return this.api.get<ActivationOrdersEnvelope>('v1/onboarding/orders');
  }

  adminOrders(params: { status?: string; page?: number; limit?: number } = {}): Observable<AdminActivationOrdersEnvelope> {
    const query = new URLSearchParams({
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 25),
      ...(params.status ? { status: params.status } : {}),
    });
    return this.api.get<AdminActivationOrdersEnvelope>(`v1/admin/onboarding/orders?${query.toString()}`);
  }

  fulfillOrder(orderId: string): Observable<{ data: AdminActivationOrder }> {
    return this.api.post<{ data: AdminActivationOrder }>(`v1/admin/onboarding/orders/${orderId}/fulfill`, {});
  }

  refundOrder(orderId: string, reason: string): Observable<{ data: AdminActivationOrder }> {
    return this.api.post<{ data: AdminActivationOrder }>(`v1/admin/onboarding/orders/${orderId}/refund`, { reason });
  }

  adminKyc(params: { status?: string; page?: number; limit?: number } = {}): Observable<AdminKycEnvelope> {
    const query = new URLSearchParams({
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 25),
      ...(params.status ? { status: params.status } : {}),
    });
    return this.api.get<AdminKycEnvelope>(`v1/admin/onboarding/kyc?${query.toString()}`);
  }

  verifyKyc(partnerId: string): Observable<{ data: AdminKycSubmission }> {
    return this.api.post<{ data: AdminKycSubmission }>(`v1/admin/onboarding/kyc/${partnerId}/verify`, {});
  }

  rejectKyc(partnerId: string, note: string): Observable<{ data: AdminKycSubmission }> {
    return this.api.post<{ data: AdminKycSubmission }>(`v1/admin/onboarding/kyc/${partnerId}/reject`, { note });
  }
}
