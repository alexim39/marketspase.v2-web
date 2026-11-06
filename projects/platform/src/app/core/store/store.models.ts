export type StoreStatus = 'draft' | 'published' | 'suspended';
export type StoreListingStatus = 'draft' | 'published' | 'paused';

export interface StoreProfile {
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
  status: StoreStatus;
  autoPublish: boolean;
  productCount?: number;
  categories?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface StoreProduct {
  id: string;
  productId: string;
  name: string;
  image: string;
  images: string[];
  category: string;
  shortDesc: string;
  retailPrice: number;
  stock: number;
  soldCount: number;
  status: StoreListingStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface StoreCounts {
  published: number;
  draft: number;
  paused: number;
  pendingReceipts: number;
}

export interface StoreReceiptItem {
  productId: string;
  name: string;
  image: string;
  quantity: number;
  partnerPrice: number;
  suggestedRetail: number;
}

export interface StoreReceipt {
  id: string;
  orderNumber: string;
  orderStatus: string;
  totalCost: number;
  createdAt: string;
  receivedAt: string | null;
  items: StoreReceiptItem[];
}

export interface MyStoreEnvelope {
  success: boolean;
  message?: string;
  data: {
    store: StoreProfile;
    counts: StoreCounts;
  };
}

export interface StoreProductsEnvelope {
  success: boolean;
  message?: string;
  data: StoreProduct[];
}

export interface StoreReceiptsEnvelope {
  success: boolean;
  message?: string;
  data: StoreReceipt[];
}

export interface StoreProfileEnvelope {
  success: boolean;
  message?: string;
  data: StoreProfile;
}

export interface StoreProductEnvelope {
  success: boolean;
  message?: string;
  data: StoreProduct;
}

export interface StoreReceiptConfirmEnvelope {
  success: boolean;
  message?: string;
  data: {
    orderNumber: string;
    credited: number;
    listings: StoreProduct[];
  };
}

export interface StoreOrderSummary {
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
  items: Array<{
    storeProductId: string;
    productId: string;
    name: string;
    image: string;
    category: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
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
    paidAt: string | null;
    channel: string;
    currency: string;
    gatewayResponse: string;
  };
  status: string;
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
  paidAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreOrdersEnvelope {
  success: boolean;
  message?: string;
  data: StoreOrderSummary[];
}

export interface StoreOrderEnvelope {
  success: boolean;
  message?: string;
  data: StoreOrderSummary;
}

export interface StoreEarnings {
  pending: number;
  released: number;
  paidOrders: number;
  pendingOrders: number;
  awaitingDelivery: number;
  counts: Record<string, number>;
  escrowHoldDays: number;
  currency: string;
}

export interface StoreEarningsEnvelope {
  success: boolean;
  message?: string;
  data: StoreEarnings;
}
