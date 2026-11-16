import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { AdminSummaryEnvelope } from './summary.models';

@Injectable({ providedIn: 'root' })
export class AdminSummaryService {
  private readonly api = inject(ApiClient);

  get(domain: string, days: number): Observable<AdminSummaryEnvelope> {
    return this.api.get<AdminSummaryEnvelope>(
      `v1/admin/summaries/${encodeURIComponent(domain)}?days=${encodeURIComponent(String(days))}`,
    );
  }
}
