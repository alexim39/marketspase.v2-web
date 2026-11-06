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
      'Complete onboarding and KYC',
      'Complete IPO, QSG and SMO training',
      'Small minimum retail/customer activity',
    ],
  },
  {
    rank: 'Builder',
    label: 'Builder',
    tagline: 'Build',
    commission: 'Levels 1–2 commission',
    criteria: [
      'Remain active and qualified',
      '3 active retail customers',
      '2 qualified frontline partners',
      'Minimum team volume',
      'Builder training',
    ],
  },
  {
    rank: 'Leader',
    label: 'Leader',
    tagline: 'Lead',
    commission: 'Levels 1–3 commission',
    criteria: [
      '5 active retail customers',
      'Minimum team volume',
      '2 qualified Builders in separate frontline teams',
      'Customer satisfaction / refund metrics',
      'Leadership training',
    ],
  },
  {
    rank: 'Ambassador',
    label: 'Ambassador',
    tagline: 'Influence',
    commission: 'Levels 1–5 commission',
    criteria: [
      'Maintain Leader qualification',
      'Strong organisation volume',
      '3 qualified Leaders in separate frontline organisations',
      'Strong customer/service metrics',
      'No serious compliance violations',
      'Advanced leadership training',
    ],
  },
];

export const appRankIndex = (rank?: string | null): number => {
  const index = APP_RANKS.findIndex((r) => r.rank === rank);
  return index >= 0 ? index : 0;
};

/** The three training keys recorded automatically from course certificates. */
export const TRAINING_TRACK: Array<{ key: 'ipo' | 'qsg' | 'smo'; label: string; courseId: string }> = [
  { key: 'ipo', label: 'IPO', courseId: 'ipo' },
  { key: 'qsg', label: 'QSG', courseId: 'qsg' },
  { key: 'smo', label: 'SMO', courseId: 'smo' },
];


