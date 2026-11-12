import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import {
  MentorHandoffListEnvelope,
  MentorHandoffPreference,
  MentorHandoffSendEnvelope,
  MentorHandoffTask,
  MentorHandoffTemplatesEnvelope,
} from './mentor-handoff.models';

export interface MentorHandoffListQuery {
  status?: 'pending' | 'contacted' | 'closed';
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class MentorHandoffService {
  private readonly api = inject(ApiClient);

  list(query: MentorHandoffListQuery = {}): Observable<MentorHandoffListEnvelope> {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.api.get<MentorHandoffListEnvelope>(`v1/mentor-handoffs${suffix}`);
  }

  templates(): Observable<MentorHandoffTemplatesEnvelope> {
    return this.api.get<MentorHandoffTemplatesEnvelope>('v1/mentor-handoffs/templates');
  }

  send(handoffId: string, templateKey: string): Observable<MentorHandoffSendEnvelope> {
    return this.api.post<MentorHandoffSendEnvelope>(`v1/mentor-handoffs/${handoffId}/send`, { templateKey });
  }

  markContacted(handoffId: string, note = ''): Observable<{ data: MentorHandoffTask; success: boolean }> {
    return this.api.post<{ data: MentorHandoffTask; success: boolean }>(
      `v1/mentor-handoffs/${handoffId}/contacted`,
      { note },
    );
  }

  updatePreference(preference: MentorHandoffPreference, consent: boolean): Observable<unknown> {
    return this.api.patch('v1/mentor-handoffs/preference', { preference, consent });
  }
}
