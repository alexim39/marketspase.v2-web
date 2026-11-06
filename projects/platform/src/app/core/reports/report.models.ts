import { ApiEnvelope } from '../../core/auth/auth.models';

export interface PeriodReport {
  id: string;
  partnerId: string;
  uplineId: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  highlights: string;
  blockers: string;
  plans: string;
  requestId: string | null;
  createdAt: string;
  author?: { username: string; name: string; profileImage?: string | null } | null;
}

export interface ReportRequest {
  id: string;
  requesterId: string;
  downlineId: string;
  periodStart: string;
  periodEnd: string;
  note: string;
  status: 'open' | 'fulfilled';
  createdAt: string;
  requester?: { username: string; name: string } | null;
  downline?: { username: string; name: string } | null;
}

export interface DownlineOption {
  id: string;
  username: string;
  name: string;
}

export interface ReportsEnvelope extends ApiEnvelope<PeriodReport[]> {
  data: PeriodReport[];
}

export interface ReportEnvelope extends ApiEnvelope<PeriodReport> {
  data: PeriodReport;
}

export interface RequestsEnvelope extends ApiEnvelope<ReportRequest[]> {
  data: ReportRequest[];
}

export interface RequestEnvelope extends ApiEnvelope<ReportRequest> {
  data: ReportRequest;
}

export interface DownlineEnvelope extends ApiEnvelope<DownlineOption[]> {
  data: DownlineOption[];
}

export interface SubmitReportPayload {
  title: string;
  periodStart: string;
  periodEnd: string;
  highlights: string;
  blockers?: string;
  plans?: string;
  requestId?: string;
}
