import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { ApiEnvelope } from '../../../core/auth/auth.models';

export type AdminProductStatus = 'draft' | 'active' | 'inactive' | 'archived';
export type PricingMode = 'resale' | 'direct' | 'both';
export type PricingStatus = 'healthy' | 'thin' | 'blocked' | 'incomplete';

export interface ProductMedia {
  _id?: string;
  id?: string;
  type: 'image' | 'video';
  url: string;
  publicId?: string | null;
  thumbnailUrl?: string;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  order?: number;
}

export interface ProductCostBreakdown {
  manufacturing: number;
  packaging: number;
  inboundFreight: number;
  duties: number;
  other: number;
  lastMileShipping: number;
  handling: number;
  acquisitionAllowance: number;
  paymentFeeRate: number;
  refundReserveRate: number;
  rankReserveRate: number;
  notes: string;
  landedCost?: number;
  totalCostPerUnit?: number;
}

export interface ProductPricing {
  mode: PricingMode;
  targetPlatformContributionPct: number;
  minPlatformContributionPct: number;
  minPlatformContributionAmount: number;
  targetPartnerMarginPct: number;
  minPartnerMarginPct: number;
  storeServiceFeePct: number;
  paymentFeeRate: number;
  refundReserveRate: number;
  rankReserveRate: number;
  commissionRate: number;
  sellingPrice: number;
  landedCost: number;
  totalCostPerUnit: number;
  paymentFee: number;
  commissionBase: number;
  commission: number;
  refundReserve: number;
  rankReserve: number;
  handling: number;
  mentorBonus: number;
  acquisitionAllowance: number;
  platformContribution: number;
  platformContributionPct: number;
  breakEvenPrice: number;
  minimumViablePrice: number;
  minimumRetailPrice: number;
  recommendedPartnerPrice: number;
  recommendedRetailPrice: number;
  partnerMargin: number;
  partnerMarginPct: number;
  partnerMarginPercent: number;
  storeServiceFee: number;
  status: PricingStatus;
  canPublish: boolean;
  reasons: string[];
  warnings: string[];
  computedAt?: string | Date;
}

export interface AdminProduct {
  _id?: string;
  id?: string;
  name?: string;
  price?: number;
  desc?: string;
  img?: string;
  category?: string;
  cogs?: number;
  shippingCost?: number;
  partnerPrice?: number;
  retailPrice?: number;
  stock?: number | null;
  commissionable?: boolean;
  pricingMode?: PricingMode;
  mentorBonus?: number;
  status?: AdminProductStatus;
  featured?: boolean;
  sku?: string;
  shortDesc?: string;
  gallery?: string[];
  media?: ProductMedia[];
  costBreakdown?: ProductCostBreakdown | null;
  pricing?: ProductPricing | null;
  publishedAt?: string | null;
  benefits?: string[];
  howToUse?: string;
  deliveryNote?: string;
  sortOrder?: number;
}

export interface ProductForm {
  name: string;
  sku: string;
  category: string;
  shortDesc: string;
  desc: string;
  benefits: string[];
  howToUse: string;
  deliveryNote: string;
  stock: number | null;
  featured: boolean;
  commissionable: boolean;
  pricingMode: PricingMode;
  mentorBonus: number | null;
  price: number | null;
  partnerPrice: number | null;
  retailPrice: number | null;
  costBreakdown: ProductCostBreakdown;
  media: ProductMedia[];
  targetPlatformContributionPct: number;
  targetPartnerMarginPct: number;
  sortOrder: number | null;
  status?: AdminProductStatus;
}

/** Product catalog admin → legacy `/products` admin endpoints (role-gated server-side). */
@Injectable({ providedIn: 'root' })
export class AdminProductsService {
  private readonly api = inject(ApiClient);

  list(): Observable<ApiEnvelope<AdminProduct[]>> {
    return this.api.get<ApiEnvelope<AdminProduct[]>>('products/admin/list');
  }

  create(form: ProductForm, publish = false): Observable<ApiEnvelope<AdminProduct>> {
    return this.api.post<ApiEnvelope<AdminProduct>>('products', this.body(form, publish));
  }

  update(id: string, form: ProductForm, publish = false): Observable<ApiEnvelope<AdminProduct>> {
    return this.api.patch<ApiEnvelope<AdminProduct>>(`products/${id}`, this.body(form, publish));
  }

  publish(id: string): Observable<ApiEnvelope<AdminProduct>> {
    return this.api.post<ApiEnvelope<AdminProduct>>(`products/${id}/publish`, {});
  }

  previewPricing(form: ProductForm): Observable<ApiEnvelope<ProductPricing>> {
    return this.api.post<ApiEnvelope<ProductPricing>>('products/pricing/preview', {
      pricingMode: form.pricingMode,
      price: form.price ?? 0,
      partnerPrice: form.partnerPrice ?? 0,
      retailPrice: form.retailPrice ?? 0,
      commissionable: form.commissionable,
      mentorBonus: form.mentorBonus ?? 0,
      costBreakdown: form.costBreakdown,
      targetPlatformContributionPct: form.targetPlatformContributionPct,
      targetPartnerMarginPct: form.targetPartnerMarginPct,
    });
  }

  uploadMedia(productId: string, file: File): Observable<ApiEnvelope<ProductMedia>> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.api.upload<ApiEnvelope<ProductMedia>>(`products/${productId}/media`, form);
  }

  removeMedia(productId: string, mediaId: string): Observable<ApiEnvelope<{ id: string }>> {
    return this.api.delete<ApiEnvelope<{ id: string }>>(`products/${productId}/media/${mediaId}`);
  }

  private body(form: ProductForm, publish: boolean): Record<string, unknown> {
    return {
      name: form.name.trim(),
      sku: form.sku.trim(),
      category: form.category.trim() || 'Essentials',
      shortDesc: form.shortDesc.trim(),
      desc: form.desc.trim(),
      benefits: form.benefits.map((line) => line.trim()).filter(Boolean).slice(0, 8),
      howToUse: form.howToUse.trim(),
      deliveryNote: form.deliveryNote.trim(),
      stock: form.stock === null ? null : Number(form.stock),
      featured: form.featured === true,
      commissionable: form.commissionable === true,
      pricingMode: form.pricingMode,
      mentorBonus: form.mentorBonus ?? 0,
      price: form.price === null ? 0 : Number(form.price),
      partnerPrice: form.partnerPrice === null ? 0 : Number(form.partnerPrice),
      retailPrice: form.retailPrice === null ? 0 : Number(form.retailPrice),
      costBreakdown: form.costBreakdown,
      media: form.media.map((item, index) => ({
        type: item.type,
        url: item.url,
        publicId: item.publicId ?? null,
        thumbnailUrl: item.thumbnailUrl ?? '',
        width: item.width ?? null,
        height: item.height ?? null,
        duration: item.duration ?? null,
        order: index,
      })),
      targetPlatformContributionPct: form.targetPlatformContributionPct,
      targetPartnerMarginPct: form.targetPartnerMarginPct,
      sortOrder: form.sortOrder === null || !Number.isFinite(Number(form.sortOrder)) ? 0 : Number(form.sortOrder),
      status: publish ? 'active' : (form.status ?? 'draft'),
      publish,
    };
  }
}
