import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { ApiEnvelope } from '../../../core/auth/auth.models';

export interface AdminPublicPage {
  id: string;
  username: string;
  name: string;
  email: string;
  headline: string;
  completeness: number;
  hasStory: boolean;
  hasTestimonial: boolean;
  opportunityCount: number;
  socials: number;
  publicPath: string;
  updatedAt: string | null;
}

export interface AdminPublicPageList {
  items: AdminPublicPage[];
  total: number;
}

export interface AdminPublicPageDetail {
  id: string;
  username: string;
  name: string;
  landing: Record<string, string | string[]>;
}

/** Admin public-pages desk → `/v1/admin/pages/*` (role-gated). */
@Injectable({ providedIn: 'root' })
export class AdminPagesService {
  private readonly api = inject(ApiClient);

  list(params: { q?: string; status?: string; limit?: number; skip?: number } = {}): Observable<ApiEnvelope<AdminPublicPageList>> {
    const query = new URLSearchParams({
      ...(params.q?.trim() ? { q: params.q.trim() } : {}),
      ...(params.status ? { status: params.status } : {}),
      limit: String(params.limit ?? 25),
      skip: String(params.skip ?? 0),
    });
    return this.api.get<ApiEnvelope<AdminPublicPageList>>(`v1/admin/pages?${query.toString()}`);
  }

  inspect(id: string): Observable<ApiEnvelope<AdminPublicPageDetail>> {
    return this.api.get<ApiEnvelope<AdminPublicPageDetail>>(`v1/admin/pages/${encodeURIComponent(id)}`);
  }

  reset(id: string, section: 'hero' | 'story' | 'opportunity' | 'proof' | 'contact' | 'all'): Observable<ApiEnvelope<{ id: string; section: string }>> {
    return this.api.patch(`v1/admin/pages/${encodeURIComponent(id)}/reset`, { section });
  }
}
