import { ApiEnvelope } from '../../../../core/auth/auth.models';

/** Canonical pipeline — mirrors backend `PROSPECT_STAGES`. */
export type ProspectStage = 'New' | 'Contacted' | 'Interested' | 'In Negotiation' | 'Converted' | 'Closed';

export const STAGE_ORDER: ProspectStage[] = ['New', 'Contacted', 'Interested', 'In Negotiation', 'Converted'];

export const STAGE_META: Record<ProspectStage, { label: string; color: string; text: string }> = {
  New: { label: 'New', color: '#e0e0e0', text: '#424242' },
  Contacted: { label: 'Contacted', color: '#bbdefb', text: '#0d47a1' },
  Interested: { label: 'Interested', color: '#ffecb3', text: '#7a5c00' },
  'In Negotiation': { label: 'In Negotiation', color: '#e1bee7', text: '#4a148c' },
  Converted: { label: 'Converted', color: '#c8e6c9', text: '#1b5e20' },
  Closed: { label: 'Closed', color: '#ffcdd2', text: '#b71c1c' },
};

/**
 * Dark-safe pill tones for stage chips (plain spans — MDC chip labels
 * ignore host inline colors in dark mode, hiding the text).
 */
export const STAGE_TONE: Record<ProspectStage, string> = {
  New: 'dp-status--neutral',
  Contacted: 'dp-status--info',
  Interested: 'dp-status--warn',
  'In Negotiation': 'dp-status--purple',
  Converted: 'dp-status--ok',
  Closed: 'dp-status--bad',
};

export interface ProspectLead {
  id: string;
  prospectName: string;
  prospectSurname?: string;
  prospectPhone: string;
  prospectEmail?: string;
  prospectSource: string;
  partnerId: string;
  relationship?: string;
  priority?: string;
  bestTimeToCall?: string;
  consentToContact?: boolean;
  notes?: string;
  stageHistory?: StageHistoryEntry[];
  status?: { name?: string; stage?: ProspectStage; note?: string; status?: string; stageEnteredAt?: string };
  communications?: Array<{ interestLevel?: string; date?: string }>;
  createdAt?: string;
  updatedAt?: string;
  /** Historical page-lead origin. */
  surverId?: string | null;
}

export interface ProspectListEnvelope extends ApiEnvelope<ProspectLead[]> {
  data: ProspectLead[];
  meta?: { total: number; limit: number; skip: number; stageCounts?: Record<string, number> };
}

export type RelationshipTag = 'Family' | 'Friend' | 'Colleague' | 'Church' | 'Neighbour' | 'Referral' | 'Other';
export type ContactPriority = 'high' | 'normal';

export const RELATIONSHIP_TAGS: RelationshipTag[] = ['Family', 'Friend', 'Colleague', 'Church', 'Neighbour', 'Referral', 'Other'];

export interface CreateContactPayload {
  prospectName: string;
  prospectSurname?: string;
  prospectPhone: string;
  prospectEmail?: string;
  prospectSource: string;
  relationship?: RelationshipTag;
  priority?: ContactPriority;
  bestTimeToCall?: string;
  consentToContact?: boolean;
  notes?: string;
}

export interface ConvertEnvelope extends ApiEnvelope<{ code: string; prospect: ProspectLead }> {
  data: { code: string; prospect: ProspectLead };
}

/** Stage-move audit entry — mirrors backend `stageHistory` (who moved the prospect). */
export interface StageHistoryEntry {
  id?: string;
  _id?: string;
  from?: string | null;
  to?: string;
  at?: string;
  by?: string;
  byName?: string;
}

/** Full communication entry — mirrors backend `createCommunicationEntity`. */
export interface ProspectCommunication {
  id?: string;
  _id?: string;
  type: 'call' | 'email' | 'text' | 'zoom' | 'whatsapp' | 'presentation';
  interestLevel?: string;
  date?: string;
  duration?: number;
  description?: string;
  followUpAction?: string;
  outcome?: 'Connected' | 'No answer' | 'Booked session' | 'Follow-up set' | 'Closed-lost' | string;
  followUpDate?: string;
  createdBy?: string;
  createdByName?: string;
  topicsDiscussed?: string[];
  status?: string;
}

export interface ProspectDetail extends Omit<ProspectLead, 'communications'> {
  communications?: ProspectCommunication[];
}

export interface ProspectDetailEnvelope extends ApiEnvelope<ProspectDetail> {
  data: ProspectDetail;
}

export interface LogCommunicationPayload {
  type: 'call' | 'email' | 'text' | 'zoom' | 'whatsapp' | 'presentation';
  interestLevel: 'hot' | 'warm' | 'cold';
  date?: string;
  duration?: number;
  description: string;
  followUpAction?: string;
  outcome?: 'Connected' | 'No answer' | 'Booked session' | 'Follow-up set' | 'Closed-lost';
  followUpDate?: string;
  createdBy?: string;
  createdByName?: string;
  topicsDiscussed?: string[];
  documentsShared?: string[];
  status?: 'Open' | 'Closed';
}

/** Stuck-in-pipeline entry — mirrors backend `stuckAnalysis`. */
export interface StuckEntry {  prospectId: string;
  name: string;
  stage: ProspectStage;
  daysInStage: number;
  limit: number;
  overBy: number;
}

export interface StuckEnvelope extends ApiEnvelope<StuckEntry[]> {
  data: StuckEntry[];
}

/** Follow-up commitment — mirrors backend `bucketFollowUps`. */
export interface ReminderEntry {
  prospectId: string;
  name: string;
  followUpDate: string;
  daysOverdue: number;
}

export interface RemindersData {
  overdue: ReminderEntry[];
  today: ReminderEntry[];
  upcoming: ReminderEntry[];
  total: number;
}

export interface RemindersEnvelope extends ApiEnvelope<RemindersData> {
  data: RemindersData;
}

/** Next forward step in the pipeline, or null at terminal stages. */
export function nextStage(stage: ProspectStage | undefined): ProspectStage | null {  const current = stage ?? 'New';
  if (current === 'Converted' || current === 'Closed') return null;
  const idx = STAGE_ORDER.indexOf(current as ProspectStage);
  return idx < 0 ? 'Contacted' : (STAGE_ORDER[idx + 1] ?? null);
}
