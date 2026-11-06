import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { ApiEnvelope } from '../../../core/auth/auth.models';

export interface AdminPageLead {
  id: string;
  name: string;
  surname: string;
  phoneNumber: string;
  email: string;
  state: string;
  status: string;
  owner: string;
  source: string;
  createdAt: string | null;
  answers: Record<string, string | string[]>;
}

export interface AdminPageLeadList {
  items: AdminPageLead[];
  total: number;
  summary: { total: number; new7d: number };
}

export type AdminPageLeadListEnvelope = ApiEnvelope<AdminPageLeadList>;

/** Admin page-lead desk → session-owned `/v1/prospects/admin/page-leads/*` (role-gated). */
@Injectable({ providedIn: 'root' })
export class AdminPageLeadsService {
  private readonly api = inject(ApiClient);

  list(params: { q?: string; owner?: string; state?: string; status?: string; limit?: number; skip?: number } = {}): Observable<AdminPageLeadListEnvelope> {
    const query = new URLSearchParams({
      ...(params.q?.trim() ? { q: params.q.trim() } : {}),
      ...(params.owner?.trim() ? { owner: params.owner.trim() } : {}),
      ...(params.state?.trim() ? { state: params.state.trim() } : {}),
      ...(params.status ? { status: params.status } : {}),
      limit: String(params.limit ?? 25),
      skip: String(params.skip ?? 0),
    });
    return this.api.get<AdminPageLeadListEnvelope>(`v1/prospects/admin/page-leads?${query.toString()}`);
  }

  remove(id: string): Observable<ApiEnvelope<{ id: string }>> {
    return this.api.delete(`v1/prospects/admin/page-leads/${encodeURIComponent(id)}`);
  }

  reassign(id: string, owner: string): Observable<ApiEnvelope<{ id: string; owner: string }>> {
    return this.api.patch(`v1/prospects/admin/page-leads/${encodeURIComponent(id)}`, { owner });
  }
}
