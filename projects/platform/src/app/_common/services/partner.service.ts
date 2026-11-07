import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ApiService } from './api.service';

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
  hobby?: string;
  skill?: string;
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

@Injectable({
  // App-wide singleton (was dashboard-scoped): MatDialog content resolves
  // from the root injector, so dialogs never saw the shared subject.
  providedIn: 'root',
})
export class PartnerService {
  constructor(private apiService: ApiService) {}
  
   /**
    * Current session partner (server-verified via the v1 session cookie).
    * @returns An Observable that emits `{ data, message, success }`.
    */
   getPartner(): Observable<any> {
    return this.apiService.get<PartnerInterface>('v1/auth/me', undefined, undefined, true);
  }

  private partnerSubject = new BehaviorSubject<any>(null); // Initial value can be anything

  getSharedPartnerData$ = this.partnerSubject.asObservable();

  updatePartnerService(data: PartnerInterface) {
    this.partnerSubject.next(data);
  }


}
