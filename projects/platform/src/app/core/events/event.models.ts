import { ApiEnvelope } from '../../core/auth/auth.models';

export type AudienceScope = 'global' | 'team' | 'leadership' | 'members';
export type RsvpStatus = 'going' | 'interested' | 'declined';

export interface RsvpCounts {
  going: number;
  interested: number;
  declined: number;
  total: number;
}

export interface CommunityEvent {
  id: string;
  authorId: string;
  title: string;
  body: string;
  startsAt: string;
  endsAt: string | null;
  location: string;
  scope: AudienceScope;
  teamId?: string | null;
  featured?: boolean;
  featuredUntil?: string | null;
  createdAt: string;
  author: { username: string; name: string; profileImage?: string | null } | null;
  rsvps: RsvpCounts;
  myRsvp: RsvpStatus | null;
  commentCount?: number;
}

export interface EventComment {
  id: string;
  eventId: string;
  authorId: string;
  body: string;
  parentId: string | null;
  createdAt: string;
  author: { username: string; name: string; profileImage?: string | null } | null;
}

export interface EventCommentsEnvelope extends ApiEnvelope<EventComment[]> {
  data: EventComment[];
}

export interface EventCommentEnvelope extends ApiEnvelope<EventComment> {
  data: EventComment;
}

export interface EventsEnvelope extends ApiEnvelope<{ items: CommunityEvent[]; viewerLevel?: string | null; total?: number }> {
  data: { items: CommunityEvent[]; viewerLevel?: string | null; total?: number };
}

export interface EventEnvelope extends ApiEnvelope<CommunityEvent> {
  data: CommunityEvent;
}

export interface RsvpEnvelope extends ApiEnvelope<{ rsvp: unknown; counts: RsvpCounts }> {
  data: { rsvp: unknown; counts: RsvpCounts };
}

export interface EventAttendee {
  partnerId: string;
  status: 'going' | 'interested';
  attended: boolean | null;
  name: string;
  username: string | null;
  phone: string | null;
  email: string | null;
}

export interface AttendeesEnvelope extends ApiEnvelope<{
  event: { id: string; title: string; startsAt: string };
  attendees: EventAttendee[];
  total: number;
}> {
  data: {
    event: { id: string; title: string; startsAt: string };
    attendees: EventAttendee[];
    total: number;
  };
}

export interface CreateEventPayload {
  title: string;
  body: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  scope: AudienceScope;
  teamId?: string;
}
