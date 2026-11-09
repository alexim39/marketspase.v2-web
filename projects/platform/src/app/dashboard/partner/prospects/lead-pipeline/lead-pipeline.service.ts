import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../../core/http/api-client.service';
import { ConvertEnvelope, CreateContactPayload, ActivationBoardEnvelope, DownlinePhonesEnvelope, LogCommunicationPayload, ProspectDetailEnvelope, ProspectLead, ProspectListEnvelope, ProspectStage, ReferralMembersEnvelope, RemindersEnvelope, StuckEnvelope } from './lead.models';

/**
 * Lead pipeline data access — talks to backend `/v1/prospects` (crm slice).
 * Fully typed; no `any`, no manual URL joining.
 */
@Injectable({ providedIn: 'root' })
export class LeadPipelineService {
  private readonly api = inject(ApiClient);

  listByPartner(
    partnerId: string,
    opts: number | { limit?: number; skip?: number; q?: string; stage?: string; ids?: string[] } = {},
  ): Observable<ProspectListEnvelope> {
    const o = typeof opts === 'number' ? { limit: opts } : opts;
    const params = new URLSearchParams();
    if (o.limit != null) params.set('limit', String(o.limit));
    if (o.skip != null) params.set('skip', String(o.skip));
    if (o.q?.trim()) params.set('q', o.q.trim());
    if (o.stage) params.set('stage', o.stage);
    if (o.ids?.length) params.set('ids', o.ids.join(','));
    const qs = params.toString();
    return this.api.get<ProspectListEnvelope>(`v1/prospects/by-partner/${partnerId}${qs ? `?${qs}` : ''}`);
  }

  /** Referral signups who are still members (not activated). */
  referralMembers(partnerId: string, q = ''): Observable<ReferralMembersEnvelope> {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.api.get<ReferralMembersEnvelope>(`v1/prospects/referral-members/${partnerId}${suffix}`);
  }

  stuck(partnerId: string): Observable<StuckEnvelope> {
    return this.api.get<StuckEnvelope>(`v1/prospects/stuck/${partnerId}`);
  }

  /** Follow-up commitments due — session-owned, bucketed overdue/today/upcoming. */
  reminders(): Observable<RemindersEnvelope> {
    return this.api.get<RemindersEnvelope>('v1/prospects/reminders/mine');
  }

  advanceStage(prospectId: string, stage: ProspectStage, author?: { by?: string; byName?: string }): Observable<unknown> {
    return this.api.post(`v1/prospects/${prospectId}/status`, { stage, ...(author ?? {}) });
  }

  convert(prospectId: string, author?: { by?: string; byName?: string }): Observable<ConvertEnvelope> {
    return this.api.post<ConvertEnvelope>(`v1/prospects/${prospectId}/convert`, { ...(author ?? {}) });
  }

  getById(prospectId: string): Observable<ProspectDetailEnvelope> {
    return this.api.get<ProspectDetailEnvelope>(`v1/prospects/${prospectId}`);
  }

  logCommunication(prospectId: string, payload: LogCommunicationPayload): Observable<unknown> {
    return this.api.post(`v1/prospects/${prospectId}/communications`, payload);
  }

  createContact(payload: CreateContactPayload): Observable<unknown> {
    return this.api.post('v1/prospects', payload);
  }

  updateContact(prospectId: string, payload: Partial<CreateContactPayload>): Observable<unknown> {
    return this.api.put(`v1/prospects/${prospectId}`, payload);
  }

  removeProspect(prospectId: string): Observable<unknown> {
    return this.api.delete(`v1/prospects/${prospectId}`);
  }

  /** 1-5 star quality vote on a worked lead. */
  rateLead(prospectId: string, score: number, note = ''): Observable<{ message: string; success: boolean }> {
    return this.api.post(`v1/prospects/${prospectId}/rate`, { score, note });
  }

  activationBoard(): Observable<ActivationBoardEnvelope> {
    return this.api.get<ActivationBoardEnvelope>('v1/prospects/activation-board');
  }

  downlinePhones(): Observable<DownlinePhonesEnvelope> {
    return this.api.get<DownlinePhonesEnvelope>('v1/prospects/downline-phones');
  }

  prospectName(lead: ProspectLead): string {
    return `${lead.prospectName ?? ''} ${lead.prospectSurname ?? ''}`.trim() || 'Unnamed';
  }

  lastInterest(lead: ProspectLead): string {
    const comms = lead.communications ?? [];
    return comms.length > 0 ? (comms[comms.length - 1].interestLevel ?? '—') : '—';
  }
}
