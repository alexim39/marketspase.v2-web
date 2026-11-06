import { ApiEnvelope } from '../auth/auth.models';

export type AccountState = 'member' | 'partner';
export type KycStatus = 'not_started' | 'pending' | 'verified' | 'rejected';
export type IdType = 'nin' | 'drivers_license' | 'passport' | 'voters_card';
export type ActivationOrderStatus = 'Paid' | 'Fulfilled' | 'Refunded' | 'Cancelled';

export interface OnboardingPartner {
  id: string;
  name: string;
  surname: string;
  username: string;
  email: string;
  phone: string;
  balance: number;
  accountState: AccountState;
  kycStatus: KycStatus;
  activatedAt: string | null;
  createdAt?: string | null;
  emailVerified: boolean;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
  } | null;
}

export interface StarterProduct {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  imageUrl: string;
}

export interface KycSubmission {
  status: Exclude<KycStatus, 'not_started'>;
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  country: string;
  idType: IdType;
  idLast4: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface ActivationQueue {
  status: 'queued' | 'allocated' | 'cancelled';
  enteredAt: string;
  allocatedAt: string | null;
  campaignId: string | null;
  placementParentId: string | null;
  cancelledAt: string | null;
  position: number | null;
}

export interface ActivationOrder {
  id: string;
  orderNumber: string;
  productName: string;
  sku: string;
  amount: number;
  currency: string;
  status: ActivationOrderStatus;
  shipping: {
    fullName: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    country: string;
    notes?: string;
  };
  paymentMethod: string;
  activatedAt: string;
  fulfilledAt: string | null;
  refundedAt: string | null;
  refundReason: string | null;
  createdAt: string;
}

export interface OnboardingStatus {
  partner: OnboardingPartner;
  activationOrder: ActivationOrder | null;
  kyc: KycSubmission | null;
  queue: ActivationQueue | null;
}

export interface KycInput {
  dateOfBirth?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  idType?: IdType;
  idNumber?: string;
}

export interface ShippingInput {
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  country: string;
  notes?: string;
}

export interface CreateActivationOrderInput {
  productId: string;
  shipping: ShippingInput;
  idempotencyKey: string;
}

export interface CreateActivationOrderResult {
  order: ActivationOrder;
  queue: ActivationQueue | null;
  partner?: OnboardingPartner;
  repeated: boolean;
}

export interface OnboardingStatusEnvelope extends ApiEnvelope<OnboardingStatus> {
  data: OnboardingStatus;
}

export interface StarterProductsEnvelope extends ApiEnvelope<StarterProduct[]> {
  data: StarterProduct[];
}

export interface KycEnvelope extends ApiEnvelope<KycSubmission> {
  data: KycSubmission;
}

export interface CreateActivationOrderEnvelope extends ApiEnvelope<CreateActivationOrderResult> {
  data: CreateActivationOrderResult;
}

export interface ActivationOrdersEnvelope extends ApiEnvelope<ActivationOrder[]> {
  data: ActivationOrder[];
}

export interface AdminActivationOrder extends ActivationOrder {
  partner: { id: string; name: string };
  fulfilledBy: string | null;
  refundedBy: string | null;
  adminNote: string | null;
}

export interface AdminKycSubmission extends KycSubmission {
  partner: {
    id: string;
    name: string;
    username?: string;
    email?: string;
    phone?: string;
  };
}

export interface PagedEnvelope<T> extends ApiEnvelope<T[]> {
  data: T[];
  meta: { page: number; limit: number; total: number; pages: number };
}

export type AdminActivationOrdersEnvelope = PagedEnvelope<AdminActivationOrder>;
export type AdminKycEnvelope = PagedEnvelope<AdminKycSubmission>;
