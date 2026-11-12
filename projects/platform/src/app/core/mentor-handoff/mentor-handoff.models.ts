export type MentorHandoffPreference =
  | 'in_app'
  | 'email'
  | 'whatsapp'
  | 'phone'
  | 'prefer_not_now';

export interface MentorHandoffContact {
  email?: string;
  phone?: string;
}

export interface MentorHandoffMember {
  id: string;
  name: string;
  username: string;
  accountState: 'member' | 'partner';
  activatedAt: string | null;
}

export interface MentorHandoffTask {
  id: string;
  partnerId: string;
  mentorId: string;
  source: 'referral' | 'allocation' | 'override';
  status: 'pending' | 'contacted' | 'closed';
  preference: MentorHandoffPreference;
  preferenceLabel: string;
  consentAt: string | null;
  joinedAt: string;
  memberActivatedAt: string | null;
  templateKey: string | null;
  sentAt: string | null;
  channels: { chat: boolean; email: boolean; sms: boolean };
  firstContactAt: string | null;
  lastContactAt: string | null;
  reminder24At: string | null;
  reminder48At: string | null;
  day7At: string | null;
  escalatedAt: string | null;
  note: string;
  member: MentorHandoffMember | null;
  contact: MentorHandoffContact;
  canContact: boolean;
}

export interface MentorHandoffTemplate {
  key: string;
  label: string;
  subject: string;
  body: string;
}

export interface MentorHandoffListEnvelope {
  data: MentorHandoffTask[];
  success: boolean;
}

export interface MentorHandoffTemplatesEnvelope {
  data: MentorHandoffTemplate[];
  success: boolean;
}

export interface MentorHandoffSendEnvelope {
  data: {
    handoff: MentorHandoffTask;
    templateKey: string;
    channels: { chat: boolean; email: boolean; sms: boolean };
  };
  success: boolean;
}
