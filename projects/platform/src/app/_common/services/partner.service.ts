import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AuthUser } from '../../core/auth/auth.models';

export interface PartnerInterface {
  _id: string;
  //courses?: Array<CourseInterface> | Array<string> | any;
  status: boolean;
  name: string;
  surname: string;
  email: string;
  phone: string;
  accountState?: 'member' | 'partner';
  kycStatus?: 'not_started' | 'pending' | 'verified' | 'rejected';
  commissionRank?: 'Partner' | 'Builder' | 'Leader' | 'Ambassador';
  activatedAt?: string | null;
  mentorContactPreference?: 'in_app' | 'email' | 'whatsapp' | 'phone' | 'prefer_not_now';
  mentorContactConsentAt?: string | null;
  mentorContactPreferenceUpdatedAt?: string | null;
  password: string;
  username: string;
  bio?: string;
  address: Address;
  visits?: number;
  dobDatePicker?: Date;
  balance?: number;
  role: string;
  profileImage?: string;
  jobTitle?: string;
  educationBackground?: string;
  hobby?: string[] | string;
  skill?: string[] | string;
  whatsappGroupLink?: string;
  whatsappChatLink?: string;
  testimonial?: string;
  linkedinPage?: string;
  youtubePage?: string;
  instagramPage?: string;
  tiktokPage?: string;
  facebookPage?: string;
  twitterPage?: string;
  // Public one-pager (/:partnerUsername) content
  headline?: string;
  subHeadline?: string;
  heroBadge?: string;
  businessTagline?: string;
  aboutStory?: string;
  achievements?: string;
  inviteNote?: string;
  opportunityPoints?: string[];
  videoTestimonialUrl?: string;
  displayPhone?: string;
  displayEmail?: string;
  locationDisplay?: string;
  whatsappCtaText?: string;
  createdAt?: Date;
  settings?: {
    notification: {
      send: 'email' | 'sms' | 'both' | 'off';
      receive: 'email' | 'sms' | 'both' | 'off';
    };
  }
}

export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
}

export interface PartnerEnvelope {
  message: string;
  success: boolean;
  data: PartnerInterface;
}

/** Runtime shape is `toSafePartner`; the interface keeps legacy fields optional. */
const asPartner = (user: AuthUser): PartnerInterface => user as unknown as PartnerInterface;

@Injectable({
  // App-wide singleton (was dashboard-scoped): MatDialog content resolves
  // from the root injector, so dialogs never saw the shared subject.
  providedIn: 'root',
})
export class PartnerService {
  constructor(private auth: AuthService) {}

   /**
    * Current session partner. Reuses the AuthService session cache on boot and
    * falls back to one server-verified `/v1/auth/me` read when cold.
    * Pass `{ fresh: true }` when the caller needs a post-write refresh.
    */
   getPartner({ fresh = false }: { fresh?: boolean } = {}): Observable<PartnerEnvelope> {
    const current = this.auth.currentUser();
    if (!fresh && current) {
      return of({ data: asPartner(current), message: 'User authenticated', success: true });
    }
    return this.auth.me().pipe(map((res) => ({ ...res, data: asPartner(res.data) })));
  }

  private partnerSubject = new BehaviorSubject<any>(null); // Initial value can be anything

  getSharedPartnerData$ = this.partnerSubject.asObservable();

  updatePartnerService(data: PartnerInterface) {
    this.partnerSubject.next(data);
  }


}
