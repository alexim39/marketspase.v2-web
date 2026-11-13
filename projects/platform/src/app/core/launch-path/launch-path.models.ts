import { ApiEnvelope } from '../auth/auth.models';

export interface LaunchMilestone {
  key: string;
  title: string;
  detail: string;
  icon: string;
  link: string;
  action: string;
  done: boolean;
  current: boolean;
}

export interface LaunchPathState {
  name: string;
  rank: string;
  percent: number;
  completed: number;
  total: number;
  next: LaunchMilestone | null;
  milestones: LaunchMilestone[];
}

export type LaunchPathStateEnvelope = ApiEnvelope<LaunchPathState>;
