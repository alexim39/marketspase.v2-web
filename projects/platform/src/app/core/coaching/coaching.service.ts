import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { ApiEnvelope } from '../auth/auth.models';

export interface MyCoach {
  coach: { id: string; name: string; username: string; profileImage?: string | null } | null;
  journey: { levelLabel: string; nextLabel: string | null; percent: number } | null;
  nextAction: string | null;
  missing: Array<{ key: string; label: string; action: string }>;
}

export interface CoachingNote {
  id: string; memberId: string; coachId: string; authorId?: string; body: string; createdAt: string;
}

export interface CoachingInboxNote extends CoachingNote {
  memberName: string;
  memberUsername: string | null;
  authorName: string;
  authorRole: 'member' | 'coach';
}

export interface CoachingInbox {
  notes: CoachingInboxNote[];
  total: number;
  teamSize: number;
  capped: boolean;
}

export type MyCoachEnvelope = ApiEnvelope<MyCoach>;
export type NotesEnvelope = ApiEnvelope<CoachingNote[]>;
export type InboxEnvelope = ApiEnvelope<CoachingInbox>;

/** My Coach & Mentorship → backend `/v1/coaching/*`. Fully typed. */
@Injectable({ providedIn: 'root' })
export class CoachingService {
  private readonly api = inject(ApiClient);

  mine(): Observable<MyCoachEnvelope> {
    return this.api.get<MyCoachEnvelope>('v1/coaching/mine');
  }

  notes(memberId?: string): Observable<NotesEnvelope> {
    const q = memberId ? `?memberId=${encodeURIComponent(memberId)}` : '';
    return this.api.get<NotesEnvelope>(`v1/coaching/notes${q}`);
  }

  /** Recent coaching notes from everyone in your downline (coach inbox). */
  inbox(limit = 50): Observable<InboxEnvelope> {
    return this.api.get<InboxEnvelope>(`v1/coaching/inbox?limit=${limit}`);
  }

  addNote(memberId: string, body: string): Observable<NotesEnvelope> {
    return this.api.post<NotesEnvelope>('v1/coaching/notes', { memberId, body });
  }
}
