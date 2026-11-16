import { ApiEnvelope } from '../auth/auth.models';

export type SummaryFormat = 'number' | 'currency' | 'percent' | 'text';
export type SummaryTone = 'brand' | 'ok' | 'info' | 'warn' | 'danger' | 'neutral';

export interface SummaryKpi {
  key: string;
  label: string;
  value: number | string | null;
  format?: SummaryFormat;
  tone?: SummaryTone;
  detail?: string;
  link?: string;
}

export interface SummarySeries {
  name: string;
  color?: string;
  values: number[];
}

export interface SummaryTrend {
  key: string;
  title: string;
  type: 'line' | 'bar';
  labels: string[];
  series: SummarySeries[];
  format?: SummaryFormat;
}

export interface SummaryDistributionItem {
  label: string;
  value: number;
  color?: string;
}

export interface SummaryDistribution {
  key: string;
  title: string;
  type: 'bar' | 'donut';
  items: SummaryDistributionItem[];
  format?: SummaryFormat;
}

export interface SummaryAlert {
  tone: 'ok' | 'info' | 'warn' | 'danger';
  title: string;
  detail: string;
  link?: string;
}

export interface AdminSummary {
  domain: string;
  title: string;
  description: string;
  generatedAt: string;
  window: { days: number; from: string; to: string };
  kpis: SummaryKpi[];
  trends: SummaryTrend[];
  distributions: SummaryDistribution[];
  alerts: SummaryAlert[];
}

export interface AdminSummaryEnvelope extends ApiEnvelope<AdminSummary> {
  data: AdminSummary;
}
