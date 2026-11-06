import { inject, Injectable } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { ApiClient } from '../http/api-client.service';

export type ExportKind = 'team' | 'pipeline' | 'commissions' | 'reports-mine' | 'reports-team' | 'community';
export type ExportFormat = 'csv' | 'xlsx';

const ENDPOINTS: Record<ExportKind, string> = {
  team: 'v1/exports/team',
  pipeline: 'v1/exports/pipeline',
  commissions: 'v1/exports/commissions',
  'reports-mine': 'v1/exports/reports?scope=mine',
  'reports-team': 'v1/exports/reports?scope=team',
  community: 'v1/exports/community',
};

const triggerSave = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

/** CSV + XLSX downloads → backend `/v1/exports/*`. Cookie session preserved. */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly api = inject(ApiClient);

  download(kind: ExportKind, format: ExportFormat = 'csv'): Observable<void> {
    const [path, query] = ENDPOINTS[kind].split('?');
    const endpoint = `${path}.${format}${query ? `?${query}` : ''}`;
    const filename = `${kind}-${new Date().toISOString().slice(0, 10)}.${format}`;
    return this.api.download(endpoint).pipe(
      tap((blob) => triggerSave(blob, filename)),
      map(() => undefined),
    );
  }
}
