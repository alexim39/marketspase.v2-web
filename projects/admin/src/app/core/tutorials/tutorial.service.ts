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

/** Platform how-to library → backend `/v1/tutorials`. Fully typed. */
@Injectable({ providedIn: 'root' })
export class TutorialService {
  private readonly api = inject(ApiClient);

  list(): Observable<TutorialListEnvelope> {
    return this.api.get<TutorialListEnvelope>('v1/tutorials');
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
