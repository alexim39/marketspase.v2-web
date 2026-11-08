import { UserRole } from '../auth/auth.models';
import { ApiEnvelope } from '../auth/auth.models';

export interface ManagedPartner {
  id: string;
  username: string;
  name: string;
  surname: string;
  email: string;
  phone?: string;
  profileImage?: string | null;
  role: UserRole;
  permissions?: string[];
  suspended?: boolean;
  suspendReason?: string | null;
  subscription?: { plan?: string; status?: string };
  createdAt?: string;
  lastLoginAt?: string | null;
  loginCount?: number;
  /** Presence heartbeat — null = offline / never seen with the app open. */
  lastSeenAt?: string | null;
}

export interface MemberLogin {
  lastLoginAt: string | null;
  daysSinceLogin: number | null;
  neverSeen: boolean;
  loginCount: number;
  lastIp: string | null;
  lastAgent: string | null;
  dormant30: boolean;
}

export interface Member360 {
  identity: {
    id: string;
    name: string;
    username: string | null;
    email: string | null;
    phone: string | null;
    state: string | null;
    role: UserRole;
    suspended: boolean;
    suspendReason: string | null;
    createdAt: string | null;
  };
  login: MemberLogin;
  money: {
    balance: number;
    in30d: number | null;
    txCount: number | null;
    recent: Array<{ amount: number; kind: string; method: string; status: string; at: string | null }>;
  };
  growth: { activeLeads: number | null; deposits: number | null };
  journey: { level: string | null; rankAt: string | null };
  upline: { id: string; name: string; username: string | null } | null;
  risks: Array<{ tone: string; label: string }>;
}

export interface PartnerDirectoryEnvelope extends ApiEnvelope<{ items: ManagedPartner[]; total: number; limit: number; skip: number }> {
  data: { items: ManagedPartner[]; total: number; limit: number; skip: number };
}

export interface AuditEntry {
  id: string;
  actorId: string;
  actorLabel: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string | null;
}

export interface PlatformStats {
  total: number;
  new7d: number;
  new30d: number;
  roles: { user: number; leader: number; admin: number };
  suspended: number;
  levels?: Record<string, number>;
  unranked?: number;
}

export interface PlatformStatsEnvelope extends ApiEnvelope<PlatformStats> {
  data: PlatformStats;
}

export interface AuditEnvelope extends ApiEnvelope<{ items: AuditEntry[]; total: number; limit: number; skip: number }> {
  data: { items: AuditEntry[]; total: number; limit: number; skip: number };
}
