import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { ApiEnvelope } from '../auth/auth.models';

export interface SearchHit {
  id?: string;
  username?: string;
  name?: string;
  title?: string;
  stage?: string;
  kind?: string;
  tagline?: string;
}

export interface SearchResults {
  q: string;
  members: SearchHit[];
  prospects: SearchHit[];
  courses: SearchHit[];
  posts: SearchHit[];
}

export interface SearchEnvelope extends ApiEnvelope<SearchResults> {
  data: SearchResults;
}

/** Global cross-entity search → backend `/v1/search`. Fully typed. */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly api = inject(ApiClient);

  query(q: string): Observable<SearchEnvelope> {
    return this.api.get<SearchEnvelope>(`v1/search?q=${encodeURIComponent(q.trim())}`);
  }
}
