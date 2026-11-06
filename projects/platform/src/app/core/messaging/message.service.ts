import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import {
  AnnounceEnvelope, Contact, ContactsEnvelope, GroupAttachment, GroupBan, GroupBansEnvelope, GroupEnvelope, GroupMessageEnvelope,
  GroupMessagesEnvelope, GroupPhotoEnvelope, GroupReportsEnvelope, GroupRequestsEnvelope, GroupsEnvelope,
  MessageEnvelope, MessagesEnvelope, PeopleEnvelope, GroupInviteEnvelope,
  RouteEnvelope, SmsFallbackEnvelope, TeamAnnounceEnvelope, TeamGroupEnvelope, UnreadEnvelope,
} from './message.models';

/** Group chat payloads for create/update. */
export interface GroupPayload {
  name: string;
  description?: string;
  photo?: string;
  joinPolicy?: 'open' | 'approval';
}

/** Team communication → backend `/v1/messages/*`. Fully typed. */
@Injectable({ providedIn: 'root' })
export class MessageService {
  private readonly api = inject(ApiClient);

  sendDirect(to: string, body: string): Observable<MessageEnvelope> {
    return this.api.post<MessageEnvelope>('v1/messages', { to, body });
  }

  announce(title: string, body: string, scope: 'direct' | 'all'): Observable<AnnounceEnvelope> {
    return this.api.post<AnnounceEnvelope>('v1/messages/announcements', { title, body, scope });
  }

  announceToTeam(teamId: string, title: string, body: string): Observable<TeamAnnounceEnvelope> {
    return this.api.post<TeamAnnounceEnvelope>('v1/messages/team-announcements', { teamId, title, body });
  }

  inbox(limit = 50): Observable<MessagesEnvelope> {
    return this.api.get<MessagesEnvelope>(`v1/messages/inbox?limit=${limit}`);
  }

  sent(limit = 50): Observable<MessagesEnvelope> {
    return this.api.get<MessagesEnvelope>(`v1/messages/sent?limit=${limit}`);
  }

  markRead(messageId: string): Observable<MessageEnvelope> {
    return this.api.post<MessageEnvelope>(`v1/messages/${messageId}/read`, {});
  }

  thread(counterpartId: string, limit = 100, before?: string): Observable<MessagesEnvelope> {
    const params = before
      ? `?limit=${limit}&before=${encodeURIComponent(before)}`
      : `?limit=${limit}`;
    return this.api.get<MessagesEnvelope>(`v1/messages/thread/${counterpartId}${params}`);
  }

  unreadCount(): Observable<UnreadEnvelope> {
    return this.api.get<UnreadEnvelope>('v1/messages/unread-count');
  }

  contacts(): Observable<ContactsEnvelope> {
    return this.api.get<ContactsEnvelope>('v1/messages/contacts');
  }

  /** Live-chat routing intel: presence, masked number, per-page SMS rate. */
  routeInfo(counterpartId: string): Observable<RouteEnvelope> {
    return this.api.get<RouteEnvelope>(`v1/messages/route/${encodeURIComponent(counterpartId)}`);
  }

  /** Approved SMS fallback to an offline counterpart (wallet-charged server-side). */
  sendSmsFallback(to: string, body: string): Observable<SmsFallbackEnvelope> {
    return this.api.post<SmsFallbackEnvelope>('v1/messages/sms-fallback', { to, body });
  }

  /** Global people search for starting chats (safe fields only). */
  people(q: string): Observable<PeopleEnvelope> {
    return this.api.get<PeopleEnvelope>(`v1/messages/people?q=${encodeURIComponent(q)}`);
  }

  /* ---------- Group chat → `v1/messages/groups/*` ---------- */
  private readonly groupsBase = 'v1/messages/groups';

  myGroups(): Observable<GroupsEnvelope> {
    return this.api.get<GroupsEnvelope>(`${this.groupsBase}/mine`);
  }

  searchGroups(q: string, limit = 10): Observable<GroupsEnvelope> {
    return this.api.get<GroupsEnvelope>(`${this.groupsBase}/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  }

  createGroup(input: GroupPayload): Observable<GroupEnvelope> {
    return this.api.post<GroupEnvelope>(this.groupsBase, input);
  }

  getGroup(groupId: string): Observable<GroupEnvelope> {
    return this.api.get<GroupEnvelope>(`${this.groupsBase}/${encodeURIComponent(groupId)}`);
  }

  updateGroup(groupId: string, patch: Partial<GroupPayload>): Observable<GroupEnvelope> {
    return this.api.patch<GroupEnvelope>(`${this.groupsBase}/${encodeURIComponent(groupId)}`, patch);
  }

  /** Group avatar upload (admins) — multipart `photo`, returns the updated photo URL. */
  uploadGroupPhoto(groupId: string, file: File): Observable<GroupPhotoEnvelope> {
    const form = new FormData();
    form.append('photo', file, file.name);
    return this.api.upload<GroupPhotoEnvelope>(`${this.groupsBase}/${encodeURIComponent(groupId)}/photo`, form);
  }

  /** Invite preview — directory-safe fields for rendering a shared-link join card. */
  groupInvite(groupId: string): Observable<GroupInviteEnvelope> {
    return this.api.get<GroupInviteEnvelope>(`${this.groupsBase}/invite/${encodeURIComponent(groupId)}`);
  }

  /** Team chat bridge — resolves (or creates on first visit) the group for a purpose team. */
  teamGroup(teamId: string): Observable<TeamGroupEnvelope> {
    return this.api.get<TeamGroupEnvelope>(`${this.groupsBase}/by-team/${encodeURIComponent(teamId)}`);
  }

  deleteGroup(groupId: string): Observable<{ data: { deleted: boolean } }> {
    return this.api.delete<{ data: { deleted: boolean } }>(`${this.groupsBase}/${encodeURIComponent(groupId)}`);
  }

  joinGroup(groupId: string): Observable<{ data: { joined: boolean; pending: boolean } }> {
    return this.api.post<{ data: { joined: boolean; pending: boolean } }>(`${this.groupsBase}/${encodeURIComponent(groupId)}/join`, {});
  }

  leaveGroup(groupId: string): Observable<{ data: { left: boolean; dissolved: boolean } }> {
    return this.api.post<{ data: { left: boolean; dissolved: boolean } }>(`${this.groupsBase}/${encodeURIComponent(groupId)}/leave`, {});
  }

  muteGroup(groupId: string, muted: boolean): Observable<unknown> {
    return this.api.post(`${this.groupsBase}/${encodeURIComponent(groupId)}/mute`, { muted });
  }

  addGroupMember(groupId: string, userId: string): Observable<unknown> {
    return this.api.post(`${this.groupsBase}/${encodeURIComponent(groupId)}/members`, { userId });
  }

  removeGroupMember(groupId: string, userId: string): Observable<unknown> {
    return this.api.delete(`${this.groupsBase}/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`);
  }

  setGroupAdmin(groupId: string, userId: string, isAdmin: boolean): Observable<unknown> {
    return this.api.post(`${this.groupsBase}/${encodeURIComponent(groupId)}/admins`, { userId, isAdmin });
  }

  banGroupMember(groupId: string, userId: string, reason = ''): Observable<unknown> {
    return this.api.post(`${this.groupsBase}/${encodeURIComponent(groupId)}/ban`, { userId, reason });
  }

  unbanGroupMember(groupId: string, userId: string): Observable<unknown> {
    return this.api.post(`${this.groupsBase}/${encodeURIComponent(groupId)}/unban`, { userId });
  }

  groupBans(groupId: string): Observable<GroupBansEnvelope> {
    return this.api.get<GroupBansEnvelope>(`${this.groupsBase}/${encodeURIComponent(groupId)}/bans`);
  }

  groupRequests(groupId: string): Observable<GroupRequestsEnvelope> {
    return this.api.get<GroupRequestsEnvelope>(`${this.groupsBase}/${encodeURIComponent(groupId)}/requests`);
  }

  decideJoinRequest(groupId: string, requestId: string, decision: 'approve' | 'reject'): Observable<unknown> {
    return this.api.post(`${this.groupsBase}/${encodeURIComponent(groupId)}/requests/${encodeURIComponent(requestId)}/decision`, { decision });
  }

  groupThread(groupId: string, limit = 100, before?: string): Observable<GroupMessagesEnvelope> {
    const params = before
      ? `?limit=${limit}&before=${encodeURIComponent(before)}`
      : `?limit=${limit}`;
    return this.api.get<GroupMessagesEnvelope>(`${this.groupsBase}/${encodeURIComponent(groupId)}/messages${params}`);
  }

  sendGroupMessage(groupId: string, body: string, attachments: GroupAttachment[] = []): Observable<GroupMessageEnvelope> {
    return this.api.post<GroupMessageEnvelope>(`${this.groupsBase}/${encodeURIComponent(groupId)}/messages`, { body, attachments });
  }

  editGroupMessage(groupId: string, messageId: string, body: string): Observable<GroupMessageEnvelope> {
    return this.api.patch<GroupMessageEnvelope>(
      `${this.groupsBase}/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}`, { body });
  }

  deleteGroupMessage(groupId: string, messageId: string): Observable<unknown> {
    return this.api.delete(`${this.groupsBase}/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}`);
  }

  markGroupRead(groupId: string): Observable<unknown> {
    return this.api.post(`${this.groupsBase}/${encodeURIComponent(groupId)}/read`, {});
  }

  pinGroupMessage(groupId: string, messageId: string | null): Observable<unknown> {
    return this.api.post(`${this.groupsBase}/${encodeURIComponent(groupId)}/pin`, { messageId });
  }

  reportGroupMessage(groupId: string, messageId: string, reason = ''): Observable<unknown> {
    return this.api.post(`${this.groupsBase}/${encodeURIComponent(groupId)}/report`, { messageId, reason });
  }

  groupReports(groupId: string): Observable<GroupReportsEnvelope> {
    return this.api.get<GroupReportsEnvelope>(`${this.groupsBase}/${encodeURIComponent(groupId)}/reports`);
  }

  decideGroupReport(groupId: string, reportId: string, decision: 'dismiss' | 'remove', banMember = false): Observable<unknown> {
    return this.api.post(
      `${this.groupsBase}/${encodeURIComponent(groupId)}/reports/${encodeURIComponent(reportId)}/decision`,
      { decision, banMember });
  }
}
