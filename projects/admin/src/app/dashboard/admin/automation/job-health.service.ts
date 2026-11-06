import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { ApiEnvelope } from '../../../core/auth/auth.models';

export interface JobHealthRow {
  job: string;
  expectedEveryMin: number;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastOk: boolean | null;
  lastError: string;
  runs: number;
  fails: number;
  lastSummary: unknown;
  stale: boolean;
  neverRan: boolean;
}

const JOB_LABELS: Record<string, string> = {
  'campaign-allocation': 'Lead allocation',
  'campaign-expiry': 'Flight expiry',
  'leadpool-sweep': 'Pool work-or-return',
};

/** Admin automation health — are the scheduled sweeps actually firing? */
@Injectable({ providedIn: 'root' })
export class JobHealthService {
  private readonly api = inject(ApiClient);

  health(): Observable<ApiEnvelope<JobHealthRow[]>> {
    return this.api.get<ApiEnvelope<JobHealthRow[]>>('v1/admin/jobs/health');
  }

  label(job: string): string {
    return JOB_LABELS[job] ?? job;
  }
}
