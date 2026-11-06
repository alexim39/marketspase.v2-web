import { ApiEnvelope } from '../../core/auth/auth.models';

export type GoalKind = 'sales' | 'recruitment' | 'team_volume' | 'conversion';

export const GOAL_KIND_LABELS: Record<GoalKind, string> = {
  sales: 'Personal sales',
  recruitment: 'Recruitment',
  team_volume: 'Team volume',
  conversion: 'Conversions',
};

export interface GoalForecast {
  dailyRate: number;
  projected: number;
  willHit: boolean;
  etaDate: string | null;
  requiredDaily: number | null;
  shortfall: number;
}

export interface GoalProgress {
  current: number;
  percent: number;
  remaining: number;
  daysLeft: number;
  daysTotal: number;
  onTrack: boolean;
  complete: boolean;
  forecast: GoalForecast;
}

export interface Goal {
  id: string;
  partnerId: string;
  title: string;
  kind: GoalKind;
  target: number;
  startDate: string;
  endDate: string;
  status?: 'active' | 'closed';
  closedAt?: string | null;
  progress: GoalProgress;
}

export interface TrendBucket {
  label: string;
  total: number;
  orders: number;
}

export interface GoalsEnvelope extends ApiEnvelope<Goal[]> {
  data: Goal[];
}

export interface GoalEnvelope extends ApiEnvelope<Goal> {
  data: Goal;
}

export interface TrendsEnvelope extends ApiEnvelope<{ buckets: TrendBucket[] }> {
  data: { buckets: TrendBucket[] };
}

export interface CreateGoalPayload {
  title?: string;
  kind: GoalKind;
  target: number;
  startDate: string;
  endDate: string;
  status?: 'active' | 'closed';
}
