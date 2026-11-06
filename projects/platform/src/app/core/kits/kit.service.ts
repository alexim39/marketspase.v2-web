import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { ApiEnvelope } from '../auth/auth.models';

export type KitArea = 'Opportunity' | 'Product' | 'Invite' | 'Team';

export interface KitSlide {
  title: string;
  body: string;
  imageUrl?: string;
  note?: string;
}

export interface Kit {
  id: string;
  title: string;
  description: string;
  area: KitArea;
  source: 'manual' | 'file';
  fileUrl: string;
  slides: KitSlide[];
  slideCount: number;
  durationMin: number;
  order: number;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface KitGroup {
  area: KitArea;
  items: Kit[];
}

export interface KitList {
  groups: KitGroup[];
  total: number;
}

export interface KitStatRow {
  presented: number;
  outcomes: Record<string, number>;
  booked: number;
  converted: number;
}

export interface KitStats {
  byKit: Record<string, KitStatRow>;
  total: number;
}

export interface KitStatsEnvelope extends ApiEnvelope<KitStats> {
  data: KitStats;
}

export interface KitListEnvelope extends ApiEnvelope<KitList> {
  data: KitList;
}

export interface KitPayload {
  title: string;
  description?: string;
  area?: KitArea;
  source?: 'manual' | 'file';
  slides?: KitSlide[];
  fileUrl?: string;
  durationMin?: number;
  order?: number;
  active?: boolean;
}

/** Opportunity decks → backend `/v1/kits`. Fully typed. */
@Injectable({ providedIn: 'root' })
export class KitService {
  private readonly api = inject(ApiClient);

  list(): Observable<KitListEnvelope> {
    return this.api.get<KitListEnvelope>('v1/kits');
  }

  get(id: string): Observable<ApiEnvelope<Kit>> {
    return this.api.get<ApiEnvelope<Kit>>(`v1/kits/${id}`);
  }

  /** My deck stats — presentations, outcomes, bookings, conversions. */
  myStats(): Observable<KitStatsEnvelope> {
    return this.api.get<KitStatsEnvelope>('v1/kits/stats/mine');
  }

  /** Admin desk. */
  adminStats(): Observable<KitStatsEnvelope> {
    return this.api.get<KitStatsEnvelope>('v1/admin/kits/stats');
  }

  /** Admin desk. */
  adminList(): Observable<{ data: { items: Kit[] } }> {
    return this.api.get('v1/admin/kits');
  }

  create(payload: KitPayload): Observable<unknown> {
    return this.api.post('v1/admin/kits', payload);
  }

  update(id: string, patch: Partial<KitPayload>): Observable<unknown> {
    return this.api.patch(`v1/admin/kits/${id}`, patch);
  }

  remove(id: string): Observable<unknown> {
    return this.api.delete(`v1/admin/kits/${id}`);
  }

  /** Deck PDF upload (admin) — memory straight to cloud storage. */
  uploadDeck(file: File): Observable<{ message: string; success: boolean; data: { fileUrl: string } }> {
    const form = new FormData();
    form.append('deck', file, file.name);
    return this.api.upload('v1/admin/kits/upload', form);
  }
}
