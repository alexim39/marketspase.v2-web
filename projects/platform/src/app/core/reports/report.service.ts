import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import {
  DownlineEnvelope, ReportEnvelope, ReportsEnvelope,
  RequestEnvelope, RequestsEnvelope, SubmitReportPayload,
} from './report.models';

/** Upline ↔ downline reporting → backend `/v1/reports/*`. Fully typed. */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly api = inject(ApiClient);

  submit(payload: SubmitReportPayload): Observable<ReportEnvelope> {
    return this.api.post<ReportEnvelope>('v1/reports', payload);
  }

  mine(): Observable<ReportsEnvelope> {
    return this.api.get<ReportsEnvelope>('v1/reports/mine');
  }

  request(downlineId: string, periodStart: string, periodEnd: string, note = ''): Observable<RequestEnvelope> {
    return this.api.post<RequestEnvelope>('v1/reports/requests', { downlineId, periodStart, periodEnd, note });
  }

  incoming(): Observable<RequestsEnvelope> {
    return this.api.get<RequestsEnvelope>('v1/reports/requests?box=incoming');
  }

  outgoing(): Observable<RequestsEnvelope> {
    return this.api.get<RequestsEnvelope>('v1/reports/requests?box=outgoing');
  }

  team(): Observable<ReportsEnvelope> {
    return this.api.get<ReportsEnvelope>('v1/reports/team');
  }

  downline(): Observable<DownlineEnvelope> {
    return this.api.get<DownlineEnvelope>('v1/reports/downline');
  }
}
