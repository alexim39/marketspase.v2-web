import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { ApiEnvelope } from '../../../core/auth/auth.models';

export type AdminProductStatus = 'active' | 'inactive' | 'archived';

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
  status?: AdminProductStatus;
  featured?: boolean;
  sku?: string;
  shortDesc?: string;
  gallery?: string[];
  benefits?: string[];
  howToUse?: string;
  deliveryNote?: string;
  sortOrder?: number;
}

export interface ProductForm {
  name: string;
  price: number | null;
  desc: string;
  img: string;
  category: string;
  cogs: number | null;
  shippingCost: number | null;
  partnerPrice: number | null;
  retailPrice: number | null;
  stock: number | null;
  commissionable: boolean;
  status: AdminProductStatus;
  sku: string;
  shortDesc: string;
  gallery: string;
  benefits: string;
  howToUse: string;
  deliveryNote: string;
  featured: boolean;
  sortOrder: number | null;
}

/** Product catalog admin → legacy `/products` admin endpoints (role-gated server-side). */
@Injectable({ providedIn: 'root' })
export class AdminProductsService {
  private readonly api = inject(ApiClient);

  list(): Observable<ApiEnvelope<AdminProduct[]>> {
    return this.api.get<ApiEnvelope<AdminProduct[]>>('products/admin/list');
  }

  create(form: ProductForm): Observable<ApiEnvelope<AdminProduct>> {
    return this.api.post<ApiEnvelope<AdminProduct>>('products', this.body(form));
  }

  update(id: string, form: ProductForm): Observable<ApiEnvelope<AdminProduct>> {
    return this.api.patch<ApiEnvelope<AdminProduct>>(`products/${id}`, this.body(form));
  }

  private body(form: ProductForm): Record<string, unknown> {
    const lines = (value: string) => String(value ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 8);

    return {
      name: form.name.trim(),
      price: Number(form.price),
      desc: form.desc.trim(),
      img: form.img.trim(),
      category: form.category.trim() || 'Essentials',
      cogs: form.cogs ?? 0,
      shippingCost: form.shippingCost ?? 0,
      partnerPrice: form.partnerPrice ?? 0,
      retailPrice: form.retailPrice ?? 0,
      stock: form.stock === null ? null : Number(form.stock),
      commissionable: form.commissionable === true,
      status: form.status,
      sku: form.sku.trim(),
      shortDesc: form.shortDesc.trim(),
      gallery: lines(form.gallery),
      benefits: lines(form.benefits),
      howToUse: form.howToUse.trim(),
      deliveryNote: form.deliveryNote.trim(),
      featured: form.featured === true,
      sortOrder: form.sortOrder === null ? 0 : Number(form.sortOrder),
    };
  }
}
