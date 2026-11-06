import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import {
  OraAnalyticsEnvelope,
  OraChatEnvelope,
  OraContextEnvelope,
  OraConversationEnvelope,
  OraConversationsEnvelope,
} from './ora.models';

/** Ora AI assistant → backend `/v1/ora/*`. Fully typed. */
@Injectable({ providedIn: 'root' })
export class OraService {
  private readonly api = inject(ApiClient);

  context(): Observable<OraContextEnvelope> {
    return this.api.get<OraContextEnvelope>('v1/ora/context');
  }

  chat(message: string, conversationId?: string): Observable<OraChatEnvelope> {
    return this.api.post<OraChatEnvelope>('v1/ora/chat', {
      message,
      ...(conversationId ? { conversationId } : {}),
    });
  }

  conversations(limit = 20, q = ''): Observable<OraConversationsEnvelope> {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (q.trim()) qs.set('q', q.trim());
    return this.api.get<OraConversationsEnvelope>(`v1/ora/conversations?${qs.toString()}`);
  }

  conversation(id: string): Observable<OraConversationEnvelope> {
    return this.api.get<OraConversationEnvelope>(`v1/ora/conversations/${id}`);
  }

  pinConversation(id: string, pinned: boolean): Observable<unknown> {
    return this.api.put(`v1/ora/conversations/${id}/pin`, { pinned });
  }

  deleteConversation(id: string): Observable<unknown> {
    return this.api.delete(`v1/ora/conversations/${id}`);
  }

  analytics(days = 30): Observable<OraAnalyticsEnvelope> {
    return this.api.get<OraAnalyticsEnvelope>(`v1/ora/analytics?days=${days}`);
  }
}
