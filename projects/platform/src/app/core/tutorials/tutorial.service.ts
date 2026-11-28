import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { ApiEnvelope } from '../auth/auth.models';

export type TutorialArea = 'Start' | 'Prospects' | 'Sessions' | 'Wallet' | 'Team' | 'Grow';

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  area: TutorialArea;
  order: number;
  /** Unique partner views recorded through the app. */
  viewCount: number;
  active: boolean;
}

export interface TutorialGroup {
  area: TutorialArea;
  items: Tutorial[];
}

export interface TutorialList {
  groups: TutorialGroup[];
  total: number;
}

export interface TutorialListEnvelope extends ApiEnvelope<TutorialList> {
  data: TutorialList;
}

export interface TutorialViewEnvelope extends ApiEnvelope<{ viewCount: number; counted: boolean }> {
  data: { viewCount: number; counted: boolean };
}

/** Compact audience language shared by desktop and mobile. */
export function tutorialViewsLabel(count: number | null | undefined): string {
  const value = Math.max(0, Math.floor(Number(count ?? 0) || 0));
  if (value === 0) return 'No views';
  if (value === 1) return '1 view';
  if (value < 1000) return `${value} views`;
  const compact = (scaled: number): number =>
    Number(scaled.toFixed(scaled < 10 ? 1 : 0));
  const thousands = compact(value / 1000);
  if (thousands < 1000) return `${thousands}K views`;
  return `${compact(value / 1_000_000)}M views`;
}

/** Platform how-to library → backend `/v1/tutorials`. Fully typed. */
@Injectable({ providedIn: 'root' })
export class TutorialService {
  private readonly api = inject(ApiClient);

  list(): Observable<TutorialListEnvelope> {
    return this.api.get<TutorialListEnvelope>('v1/tutorials');
  }

  /** Record a play. The server counts one unique view per partner. */
  recordView(id: string): Observable<TutorialViewEnvelope> {
    return this.api.post<TutorialViewEnvelope>(`v1/tutorials/${encodeURIComponent(id)}/view`, {});
  }

  /** Admin desk. */
  adminList(): Observable<{ data: { items: Tutorial[] } }> {
    return this.api.get('v1/admin/tutorials');
  }

  create(payload: { url: string; title: string; description?: string; area?: TutorialArea; order?: number }): Observable<unknown> {
    return this.api.post('v1/admin/tutorials', payload);
  }

  update(id: string, patch: Partial<{ url: string; title: string; description: string; area: TutorialArea; order: number; active: boolean }>): Observable<unknown> {
    return this.api.patch(`v1/admin/tutorials/${id}`, patch);
  }

  remove(id: string): Observable<unknown> {
    return this.api.delete(`v1/admin/tutorials/${id}`);
  }
}
