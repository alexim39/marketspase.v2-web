import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { ApiEnvelope } from '../../../core/auth/auth.models';

export type TicketStatus = 'open' | 'in-progress' | 'resolved' | 'closed';

export interface AdminTicket {
  id: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  comment?: string;
  partnerId: string;
  reporter?: { id: string; username: string | null; name: string } | null;
  status: TicketStatus;
  assigneeId: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt?: string;
}

export interface TicketInboxEnvelope extends ApiEnvelope<{ items: AdminTicket[]; total: number; limit: number; skip: number }> {
  data: { items: AdminTicket[]; total: number; limit: number; skip: number };
}

/** Admin ticket inbox → `/v1/tickets` admin endpoints (role-gated server-side). */
@Injectable({ providedIn: 'root' })
export class AdminTicketsService {
  private readonly api = inject(ApiClient);

  inbox(params: { status?: string; q?: string; limit?: number; skip?: number } = {}): Observable<TicketInboxEnvelope> {
    const query = new URLSearchParams({
      ...(params.status ? { status: params.status } : {}),
      q: params.q ?? '',
      limit: String(params.limit ?? 25),
      skip: String(params.skip ?? 0),
    });
    return this.api.get<TicketInboxEnvelope>(`v1/tickets/inbox?${query.toString()}`);
  }

  decide(ticketId: string, patch: { status?: TicketStatus; assigneeId?: string; note?: string; reopen?: boolean }): Observable<ApiEnvelope<AdminTicket>> {
    return this.api.patch<ApiEnvelope<AdminTicket>>(`v1/tickets/${ticketId}`, patch);
  }
}
