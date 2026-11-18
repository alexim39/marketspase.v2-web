import { inject, Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import {
  SmsCampaignDetailEnvelope,
  SmsCampaignEnvelope,
  SmsHistoryEnvelope,
  SmsQuoteEnvelope,
  SmsRecipientKind,
  SmsRecipientsEnvelope,
  SmsSuggestEnvelope,
  SmsSuppressionsEnvelope,
  SmsTemplatesEnvelope,
  SmsTemplate,
} from './sms.models';

/** Partner SMS Center - `/v1/sms/*`. */
@Injectable({ providedIn: 'root' })
export class SmsService {
  private readonly api = inject(ApiClient);

  recipients(
    type: 'prospects' | 'partners' | 'customer_leads',
    q = '',
    options: { limit?: number; skip?: number; id?: string } = {},
  ): Observable<SmsRecipientsEnvelope> {
    let params = new HttpParams().set('type', type);
    if (q.trim()) params = params.set('q', q.trim());
    if (options.limit) params = params.set('limit', String(options.limit));
    if (options.skip) params = params.set('skip', String(options.skip));
    if (options.id) params = params.set('id', options.id);
    return this.api.get<SmsRecipientsEnvelope>('v1/sms/recipients', params);
  }

  suggest(type: SmsRecipientKind, id: string): Observable<SmsSuggestEnvelope> {
    return this.api.post<SmsSuggestEnvelope>('v1/sms/suggest', { type, id });
  }

  quote(recipients: Array<{ type: SmsRecipientKind; id: string }>, body: string): Observable<SmsQuoteEnvelope> {
    return this.api.post<SmsQuoteEnvelope>('v1/sms/quote', { recipients, body });
  }

  send(payload: {
    idempotencyKey: string;
    recipients: Array<{ type: SmsRecipientKind; id: string }>;
    body: string;
    scheduledAt?: string | null;
  }): Observable<SmsCampaignEnvelope> {
    return this.api.post<SmsCampaignEnvelope>('v1/sms/send', payload);
  }

  history(params: { limit?: number; skip?: number; status?: string } = {}): Observable<SmsHistoryEnvelope> {
    let http = new HttpParams();
    if (params.limit) http = http.set('limit', String(params.limit));
    if (params.skip) http = http.set('skip', String(params.skip));
    if (params.status) http = http.set('status', params.status);
    return this.api.get<SmsHistoryEnvelope>('v1/sms/campaigns', http);
  }

  campaign(id: string): Observable<SmsCampaignDetailEnvelope> {
    return this.api.get<SmsCampaignDetailEnvelope>(`v1/sms/campaigns/${id}`);
  }

  cancel(id: string): Observable<SmsCampaignEnvelope> {
    return this.api.post<SmsCampaignEnvelope>(`v1/sms/campaigns/${id}/cancel`, {});
  }

  retry(id: string): Observable<SmsCampaignEnvelope> {
    return this.api.post<SmsCampaignEnvelope>(`v1/sms/campaigns/${id}/retry`, {});
  }

  templates(): Observable<SmsTemplatesEnvelope> {
    return this.api.get<SmsTemplatesEnvelope>('v1/sms/templates');
  }

  createTemplate(name: string, body: string): Observable<{ data: SmsTemplate }> {
    return this.api.post<{ data: SmsTemplate }>('v1/sms/templates', { name, body });
  }

  updateTemplate(id: string, name: string, body: string): Observable<{ data: SmsTemplate }> {
    return this.api.patch<{ data: SmsTemplate }>(`v1/sms/templates/${id}`, { name, body });
  }

  deleteTemplate(id: string): Observable<{ data: { deleted: boolean } }> {
    return this.api.delete<{ data: { deleted: boolean } }>(`v1/sms/templates/${id}`);
  }

  suppressions(): Observable<SmsSuppressionsEnvelope> {
    return this.api.get<SmsSuppressionsEnvelope>('v1/sms/suppressions');
  }

  addSuppression(phone: string, reason = 'Manual opt-out'): Observable<{ data: unknown }> {
    return this.api.post<{ data: unknown }>('v1/sms/suppressions', { phone, reason });
  }

  removeSuppression(id: string): Observable<{ data: { deleted: boolean } }> {
    return this.api.delete<{ data: { deleted: boolean } }>(`v1/sms/suppressions/${id}`);
  }
}
