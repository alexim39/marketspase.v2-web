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

@Injectable({ providedIn: 'root' })
export class MentorHandoffService {
  private readonly api = inject(ApiClient);

  list(status?: 'pending' | 'contacted' | 'closed'): Observable<MentorHandoffListEnvelope> {
    const query = status ? `?status=${status}` : '';
    return this.api.get<MentorHandoffListEnvelope>(`v1/mentor-handoffs${query}`);
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
