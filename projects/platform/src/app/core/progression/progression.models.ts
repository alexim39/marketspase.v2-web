import { ApiEnvelope } from '../../core/auth/auth.models';

export interface MissingRequirement {
  key: string;
  label: string;
  action: string;
}

export interface Promotion {
  from: string;
  to: string;
}

export interface JourneyForecast {
  remaining: number;
  pacePer30d: number | null;
  weeksOut: number | null;
  etaDate: string | null;
  stalled: boolean;
  basis: string;
  label: string;
}

export interface Journey {
  level: string;
  levelLabel: string;
  next: string | null;
  nextLabel: string | null;
  percent: number;
  completed: string[];
  missing: MissingRequirement[];
  remainingActions: string[];
  milestones: Record<string, unknown>;
  signals: { recruits: number; activeDownline: number; maintenanceOk: boolean };
  promoted: Promotion | null;
  forecast?: JourneyForecast | null;
}

export interface JourneyEnvelope extends ApiEnvelope<Journey> {
  data: Journey;
}



export interface MilestonesEnvelope extends ApiEnvelope<{ milestones: Record<string, unknown> }> {
  data: { milestones: Record<string, unknown> };
}

/** The four-rank model the current app is built around. */
export type AppRank = 'Partner' | 'Builder' | 'Leader' | 'Ambassador';

export interface AppRankDefinition {
  rank: AppRank;
  label: string;
  tagline: string;
  commission: string;
  criteria: string[];
}

export const APP_RANKS: AppRankDefinition[] = [
  {
    rank: 'Partner',
    label: 'Partner',
    tagline: 'Start / foundation',
    commission: 'Level 1 commission',
    criteria: [
      'Complete signup and KYC',
      'Activate your account',
      'Start IPO and QSG',
    ],
  },
  {
    rank: 'Builder',
    label: 'Builder',
    tagline: 'Build',
    commission: 'Levels 1–2 commission',
    criteria: [
      'Complete IPO',
      'Complete QSG',
      'Connect 1 personal recruit',
    ],
  },
  {
    rank: 'Leader',
    label: 'Leader',
    tagline: 'Lead',
    commission: 'Levels 1–3 commission',
    criteria: [
      'Complete SMO',
      'Connect 3 personal recruits',
      'Grow 5 active team members',
    ],
  },
  {
    rank: 'Ambassador',
    label: 'Ambassador',
    tagline: 'Influence',
    commission: 'Levels 1–5 commission',
    criteria: [
      'Complete Leadership Development',
      'Connect 5 personal recruits',
      'Raise 3 downline Leaders',
    ],
  },
];

export const appRankIndex = (rank?: string | null): number => {
  const index = APP_RANKS.findIndex((r) => r.rank === rank);
  return index >= 0 ? index : 0;
};

/** The four training keys recorded automatically from course certificates. */
export const TRAINING_TRACK: Array<{ key: 'ipo' | 'qsg' | 'smo' | 'leadership'; label: string; courseId: string }> = [
  { key: 'ipo', label: 'IPO', courseId: 'ipo' },
  { key: 'qsg', label: 'QSG', courseId: 'qsg' },
  { key: 'smo', label: 'SMO', courseId: 'smo' },
  { key: 'leadership', label: 'Leadership', courseId: 'leadership' },
];


