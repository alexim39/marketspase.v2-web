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

export interface StoreReturn {
  id: string;
  status: 'requested' | 'approved' | 'rejected' | 'received' | 'refunded' | 'cancelled';
  reason: string;
  note: string;
  adminNote: string;
  requestedAt: string | null;
  decidedAt: string | null;
  receivedAt: string | null;
  refundedAt: string | null;
  refundReference: string;
  orderId: string;
  reference: string;
  orderNumber: string;
  customerEmail: string;
  items: Array<{ storeProductId: string; name: string; quantity: number }>;
}

export interface StoreReturnsEnvelope {
  success: boolean;
  data: StoreReturn[];
}

export interface StoreReturnEnvelope {
  success: boolean;
  message?: string;
  data: StoreReturn;
}

export interface StoreEarningsEnvelope {
  success: boolean;
  message?: string;
  data: StoreEarnings;
}

export interface StoreImageUploadEnvelope {
  success: boolean;
  message?: string;
  data: { url: string; kind: 'logo' | 'banner' };
}

export interface StoreCustomerLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  country: string;
  note: string;
  consentToContact: boolean;
  status: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Closed';
  partnerNotes: string;
  tags: string[];
  checkoutCount: number;
  paidOrders: number;
  refundedOrders: number;
  totalSpent: number;
  firstSeenAt: string | null;
  lastCheckoutAt: string | null;
  lastPaidAt: string | null;
}

export interface StoreCustomerLeadsEnvelope {
  success: boolean;
  message?: string;
  data: StoreCustomerLead[];
  meta: {
    total: number;
    limit: number;
    skip: number;
    summary: {
      totalLeads: number;
      repeatCustomers: number;
      paidOrders: number;
      revenue: number;
      newThisMonth: number;
    };
    statusCounts: Record<string, number>;
  };
}

export interface StoreCustomerLeadEnvelope {
  success: boolean;
  message?: string;
  data: StoreCustomerLead;
}
