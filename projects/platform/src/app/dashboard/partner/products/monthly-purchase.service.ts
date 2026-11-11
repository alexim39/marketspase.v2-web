import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../_common/services/api.service';

export interface ProductMedia {
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  order?: number;
}

export interface ProductInterface {
    img: string;
    name: string;
    price: number;
    desc?: string;
    _id: string;
    quantity?: number;
    description?: string;
    sku?: string;
    category?: string;
    shortDesc?: string;
    gallery?: string[];
    media?: ProductMedia[];
    benefits?: string[];
    howToUse?: string;
    deliveryNote?: string;
    stock?: number | null;
    status?: 'draft' | 'active' | 'inactive' | 'archived';
    featured?: boolean;
    sortOrder?: number;
    cogs?: number;
    shippingCost?: number;
    partnerPrice?: number;
    retailPrice?: number;
    commissionable?: boolean;
    pricingMode?: 'resale' | 'direct' | 'both';
    resaleEnabled?: boolean;
    saleMode?: 'personal' | 'resale';
}
  
export interface ProductObjectInterface {
  message: string;
  data: Array<ProductInterface>;
  success?: boolean;
  meta?: {
    q?: string | null;
    count?: number;
    total?: number;
    limit?: number;
    skip?: number;
    hasMore?: boolean;
    next_action?: string | null;
  };
}

export interface ResaleProductInterface extends ProductInterface {
  partnerPrice: number;
  retailPrice: number;
  price: number;
}

export interface ResaleProductObjectInterface {
  message: string;
  data: Array<ResaleProductInterface>;
  success?: boolean;
}

export interface ProductItemObjectInterface {

  message: string;
  data: ProductInterface;
  success?: boolean;
}
  

@Injectable()
export class ProductService {
  constructor(private apiService: ApiService) {}

  // get all products
  getAllProducts(params: { limit?: number; skip?: number; q?: string } = {}): Observable<ProductObjectInterface> {
    const query = new URLSearchParams({
      limit: String(params.limit ?? 60),
      skip: String(params.skip ?? 0),
    });
    if (params.q?.trim()) query.set('q', params.q.trim());
    return this.apiService.get<ProductObjectInterface>(`products/getAll?${query.toString()}`, undefined, undefined, true);
  }

  // get one product for the full product page
  getProduct(id: string): Observable<ProductItemObjectInterface> {
    return this.apiService.get<ProductItemObjectInterface>(`products/${id}`, undefined, undefined, true);
  }

  // partner-only resale catalog with partner and suggested retail prices
  getResaleProducts(): Observable<ResaleProductObjectInterface> {
    return this.apiService.get<ResaleProductObjectInterface>(
      'products/resale/catalog',
      undefined,
      undefined,
      true,
    );
  }

  checkout(formObject: any): Observable<any> {
    return this.apiService.post<ProductInterface[]>(`products/cart`, formObject, undefined, true);
  }

   // get all products ordered by
   getAllOrderBy(partnerId: string): Observable<ProductObjectInterface> {
    return this.apiService.get<ProductObjectInterface>(`products/getAllOrderBy/${partnerId}`, undefined, undefined, true);
  }
   
}