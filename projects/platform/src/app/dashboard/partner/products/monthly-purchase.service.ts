import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../_common/services/api.service';

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
    benefits?: string[];
    howToUse?: string;
    deliveryNote?: string;
    stock?: number | null;
    status?: 'active' | 'inactive' | 'archived';
    featured?: boolean;
    sortOrder?: number;
    cogs?: number;
    shippingCost?: number;
    partnerPrice?: number;
    retailPrice?: number;
    commissionable?: boolean;
    saleMode?: 'personal' | 'resale';
}
  
export interface ProductObjectInterface {

  message: string;
  data: Array<ProductInterface>;
  success?: boolean;
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
  getAllProducts(): Observable<ProductObjectInterface> {
    return this.apiService.get<ProductObjectInterface>(`products/getAll`, undefined, undefined, true);
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