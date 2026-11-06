import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FormGroup } from '@angular/forms';
import { ApiService } from '../../../_common/services/api.service';

export interface EmailInterface {
  message: string;
  data?: any
}
  

@Injectable()
export class EmailService {
  constructor(private apiService: ApiService) {}

  // own email batches, newest first — session-owned (no id plumbing).
  myEmails(): Observable<{ data: Array<Record<string, unknown>>; success: boolean }> {
    return this.apiService.get(`v1/outreach/email/mine`, undefined, undefined, true);
  }

  // send bulk email now — session-owned v1 route (validated, capped,
  // recorded, per-recipient outcomes). Replaces legacy emails/send-email.
  sendEmail(formObject: { to: Array<string>; subject: string; body: string }): Observable<EmailInterface> {
    return this.apiService.post<EmailInterface>(`v1/outreach/email`, formObject, undefined, true);
  }

  // schedule a bulk email for later (free channel, cancellable)
  scheduleBulkEmail(formObject: { to: Array<string>, subject: string, body: string, sendAt: string }): Observable<any> {
    return this.apiService.post<any>(`v1/outreach/email/schedule`, formObject, undefined, true);
  }

  // scheduled email outbox (upcoming + recent)
  listScheduledEmails(): Observable<any> {
    return this.apiService.get<any>(`v1/outreach/email/scheduled`, undefined, undefined, true);
  }

  // cancel own scheduled email
  cancelScheduledEmail(scheduleId: string): Observable<any> {
    return this.apiService.delete<any>(`v1/outreach/email/scheduled/${scheduleId}`, undefined, undefined, true);
  }

  // detele single email
  deleteSingleEmail(emailId: string): Observable<any> {
      return this.apiService.delete<any>(`emails/delete-single/${emailId}`, undefined, undefined, true);
  }
    
   
}