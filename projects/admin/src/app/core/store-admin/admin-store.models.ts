export interface AdminStoreSummary {
  id: string;
  slug: string;
  name: string;
  logo: string;
  banner: string;
  status: 'draft' | 'published' | 'suspended';
  deliveryFee: number;
  suspensionReason?: string;
  suspendedAt?: string | null;
  productCount: number;
  publishedCount: number;
  stockUnits: number;
  orderCount: number;
  paidOrders: number;
  partner?: {
    id: string;
    username: string;
    name: string;
    email: string;
    phone: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminStoreListing {
  id: string;
  productId: string;
  name: string;
  image: string;
  category: string;
  retailPrice: number;
  stock: number;
  soldCount: number;
  status: string;
}

export interface AdminStoreOrder {
  id: string;
  reference: string;
  orderNumber: string;
  store: { id: string; slug: string; name: string };
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
  refundedAt?: string | null;
  refundReference?: string;
  refundReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminStoreDetail {
  store: AdminStoreSummary;
  listings: AdminStoreListing[];
  orders: AdminStoreOrder[];
}

export interface AdminStoreListEnvelope {
  success: boolean;
  message?: string;
  data: AdminStoreSummary[];
  total?: number;
}

export interface AdminStoreDetailEnvelope {
  success: boolean;
  message?: string;
  data: AdminStoreDetail;
}

export interface AdminStoreOrdersEnvelope {
  success: boolean;
  message?: string;
  data: AdminStoreOrder[];
  total?: number;
}

export interface AdminStoreOrderEnvelope {
  success: boolean;
  message?: string;
  data: AdminStoreOrder;
}

export interface AdminSettlements {
  heldAmount: number;
  releasedAmount: number;
  serviceFees: number;
  paymentFees: number;
  heldOrders: number;
  releasedOrders: number;
  deliveredAwaitingRelease: number;
  currency: string;
  escrowHoldDays: number;
}

export interface AdminSettlementsEnvelope {
  success: boolean;
  message?: string;
  data: AdminSettlements;
}

export interface AdminStoreSettings {
  serviceFeePercent: number;
  escrowHoldDays: number;
  currency: string;
}

export interface AdminStoreSettingsEnvelope {
  success: boolean;
  message?: string;
  data: AdminStoreSettings;
}
