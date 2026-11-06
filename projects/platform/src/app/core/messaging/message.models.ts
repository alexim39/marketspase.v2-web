import { ApiEnvelope } from '../../core/auth/auth.models';

export type MessageKind = 'direct' | 'announcement' | 'broadcast' | 'team';

export interface DirectoryLabel {
  username: string;
  name: string;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  kind: MessageKind;
  title: string;
  body: string;
  teamId?: string | null;
  readAt: string | null;
  createdAt: string;
  sender?: DirectoryLabel | null;
  recipient?: DirectoryLabel | null;
}

export interface Contact {
  id: string;
  username: string;
  name: string;
  relation: 'upline' | 'downline';
  photo?: string | null;
}

export interface MessagesEnvelope extends ApiEnvelope<Message[]> {
  data: Message[];
}

export interface MessageEnvelope extends ApiEnvelope<Message> {
  data: Message;
}

export interface ContactsEnvelope extends ApiEnvelope<Contact[]> {
  data: Contact[];
}

export interface UnreadEnvelope extends ApiEnvelope<{ unread: number }> {
  data: { unread: number };
}

export interface AnnounceResult {
  inserted: number;
  scope: 'direct' | 'all';
}

export interface AnnounceEnvelope extends ApiEnvelope<AnnounceResult> {
  data: AnnounceResult;
}

export interface TeamAnnounceResult {
  inserted: number;
  teamId: string;
}

export interface TeamAnnounceEnvelope extends ApiEnvelope<TeamAnnounceResult> {
  data: TeamAnnounceResult;
}

export interface ChatRouteInfo {
  online: boolean;
  presence: 'online' | 'recent' | null;
  lastSeenAt: string | null;
  maskedPhone: string | null;
  smsUnitCost: number;
}

export interface RouteEnvelope extends ApiEnvelope<ChatRouteInfo> {
  data: ChatRouteInfo;
}

export interface SmsFallbackEnvelope extends ApiEnvelope<{ sent: number; total: number; cost: number }> {
  data: { sent: number; total: number; cost: number };
}

export interface PersonHit {
  id: string;
  username: string;
  name: string;
  photo: string | null;
}

export interface PeopleEnvelope extends ApiEnvelope<PersonHit[]> {
  data: PersonHit[];
}

/* ---------- Group chat (backend `/v1/messages/groups/*`) ---------- */

export type GroupRole = 'admin' | 'member';

export interface GroupSummary {
  id: string;
  name: string;
  description?: string | null;
  photo?: string | null;
  joinPolicy?: 'open' | 'approval';
  memberCount?: number;
  myRole?: GroupRole;
  muted?: boolean;
  unread?: number;
  lastMessage?: { body?: string; senderName?: string | null; createdAt?: string } | null;
  createdAt?: string;
}

export interface GroupHit {
  id: string;
  name: string;
  description?: string | null;
  photo?: string | null;
  joinPolicy?: 'open' | 'approval';
  memberCount?: number;
  createdAt?: string;
}

export interface GroupMember {
  id: string;
  username?: string | null;
  name: string;
  photo?: string | null;
  lastSeenAt?: string | null;
  role: GroupRole;
  muted?: boolean;
  joinedAt?: string;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  body: string;
  attachments?: GroupAttachment[];
  seenBy?: string[];
  editedAt?: string | null;
  createdAt: string;
  sender?: { name?: string; username?: string; photo?: string | null } | null;
  senderName?: string | null;
  clientId?: string;
  pending?: boolean;
  failed?: boolean;
}

export interface GroupAttachment {
  url: string;
  mime: string;
  size: number;
}

export interface GroupDetail {
  id: string;
  name: string;
  description?: string | null;
  photo?: string | null;
  joinPolicy?: 'open' | 'approval';
  createdBy?: string;
  members: GroupMember[];
  myRole: GroupRole;
  muted?: boolean;
  pendingRequests?: GroupJoinRequest[];
  pinnedMessage?: GroupMessage | null;
}

export interface GroupJoinRequest {
  id?: string;
  _id?: string;
  groupId: string;
  partnerId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
  requester?: { name?: string; username?: string; photo?: string | null } | null;
}

export interface GroupReport {
  id?: string;
  _id?: string;
  groupId: string;
  messageId: string;
  reporterId: string;
  reason?: string;
  status: string;
  createdAt?: string;
  message?: GroupMessage | null;
}

export interface GroupBan {
  partnerId: string;
  reason?: string;
  createdAt?: string | null;
  username?: string | null;
  name?: string;
  photo?: string | null;
}

export interface GroupBansEnvelope extends ApiEnvelope<GroupBan[]> {
  data: GroupBan[];
}

export interface GroupPhotoEnvelope extends ApiEnvelope<{ id: string; photo: string | null }> {
  data: { id: string; photo: string | null };
}

export interface TeamGroupResult {
  groupId: string;
  joined: boolean;
  pending: boolean;
  created: boolean;
  teamGone?: boolean;
}

export interface TeamGroupEnvelope extends ApiEnvelope<TeamGroupResult> {
  data: TeamGroupResult;
}

export interface GroupInvite {
  id: string;
  name: string;
  description?: string | null;
  photo?: string | null;
  joinPolicy?: 'open' | 'approval';
  memberCount?: number;
  createdAt?: string | null;
}

export interface GroupInviteEnvelope extends ApiEnvelope<GroupInvite> {
  data: GroupInvite;
}

export interface GroupsEnvelope extends ApiEnvelope<GroupSummary[]> {
  data: GroupSummary[];
}

export interface GroupEnvelope extends ApiEnvelope<GroupDetail> {
  data: GroupDetail;
}

export interface GroupMessagesEnvelope extends ApiEnvelope<GroupMessage[]> {
  data: GroupMessage[];
}

export interface GroupMessageEnvelope extends ApiEnvelope<GroupMessage> {
  data: GroupMessage;
}

export interface GroupRequestsEnvelope extends ApiEnvelope<GroupJoinRequest[]> {
  data: GroupJoinRequest[];
}

export interface GroupReportsEnvelope extends ApiEnvelope<GroupReport[]> {
  data: GroupReport[];
}
