export interface StorePublic {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  bio: string;
  logo: string;
  banner: string;
  whatsapp: string;
  phone: string;
  instagram: string;
  tiktok: string;
  facebook: string;
  x: string;
  youtube: string;
  deliveryNote: string;
  deliveryFee: number;
  returnPolicy: string;
  status: string;
  productCount: number;
  categories: string[];
}

export interface StoreProductPublic {
  id: string;
  productId: string;
  name: string;
  image: string;
  images: string[];
  category: string;
  shortDesc: string;
  description?: string;
  retailPrice: number;
  stock: number;
  soldCount: number;
  status: string;
}

export interface StoreDetail {
  store: StorePublic;
  products: StoreProductPublic[];
}

export interface StoreProductDetail {
  store: StorePublic;
  product: StoreProductPublic;
}

export interface StoreListEnvelope {
  success: boolean;
  data: StorePublic[];
  meta?: {
    count?: number;
    limit?: number;
    hasMore?: boolean;
    nextCursor?: string | null;
    next_action?: string | null;
  };
}

export interface StoreDetailEnvelope {
  success: boolean;
  data: StoreDetail;
}

export interface StoreProductEnvelope {
  success: boolean;
  data: StoreProductDetail;
}

export interface StoreOrderItem {
  storeProductId: string;
  productId: string;
  name: string;
  image: string;
  category: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface StoreOrder {
  id: string;
  reference: string;
  orderNumber: string;
  store: {
    id: string;
    slug: string;
    name: string;
  };
  customer: {
    name: string;
    email: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    country: string;
    note: string;
  };
  items: StoreOrderItem[];
  amounts: {
    merchandise: number;
    delivery: number;
    total: number;
    serviceFee: number;
    serviceFeePercent: number;
    paymentFee: number;
    partnerPending: number;
    currency: string;
  };
  payment: {
    provider: string;
    status: string;
    reference: string;
    authorizationUrl: string;
    paidAt: string | null;
    channel: string;
    currency: string;
    gatewayResponse: string;
  };
  status: string;
  stockReserved: boolean;
  stockReleased: boolean;
  expiresAt: string | null;
  paidAt: string | null;
  processingAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  refundReference: string;
  refundReason: string;
  settledAt: string | null;
  escrow: {
    status: string;
    releaseAt: string | null;
    releasedAt: string | null;
  };
  fulfilment: {
    courier: string;
    trackingNumber: string;
    trackingUrl: string;
    note: string;
  };
  events: Array<{ type: string; at: string; note: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface StoreOrderCreateEnvelope {
  success: boolean;
  message?: string;
  data: {
    order: StoreOrder;
    checkoutUrl: string;
  };
}

export interface StoreOrderEnvelope {
  success: boolean;
  message?: string;
  data: StoreOrder;
}

export interface StoreOrderVerifyEnvelope {
  success: boolean;
  message?: string;
  data: {
    order: StoreOrder;
    status: string;
    deduped?: boolean;
  };
}
