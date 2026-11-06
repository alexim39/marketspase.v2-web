import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { ApiEnvelope } from '../auth/auth.models';

export interface ViewedMember {
  id: string;
  username: string | null;
  name: string;
}

export interface ViewAsData {
  member: ViewedMember;
  relation: 'admin' | 'upline';
}

export interface ViewAsEnvelope extends ApiEnvelope<ViewAsData> {
  data: ViewAsData;
}

/**
 * Read-only member view session — audited server-side at entry.
 * Deliberately session-only (never persisted): a refresh exits view
 * mode, which is the safe default for a sensitive mode.
 */
@Injectable({ providedIn: 'root' })
export class ViewAsService {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);

  readonly viewingAs = signal<ViewedMember | null>(null);
  readonly relation = signal<ViewAsData['relation'] | null>(null);
  readonly entering = signal(false);
  readonly error = signal<string | null>(null);

  enter(partnerId: string): Observable<ViewAsEnvelope> {
    this.entering.set(true);
    this.error.set(null);
    return this.api.post<ViewAsEnvelope>('v1/network/view-as', { partnerId }).pipe(
      tap({
        next: (res) => {
          this.entering.set(false);
          this.viewingAs.set(res.data?.member ?? null);
          this.relation.set(res.data?.relation ?? null);
        },
        error: (err: { message?: string }) => {
          this.entering.set(false);
          this.error.set(err?.message ?? 'Could not open member view.');
        },
      }),
    );
  }

  /** Open the full read-only view, entering first if needed. */
  open(partnerId: string): void {
    const current = this.viewingAs();
    if (current && current.id === partnerId) {
      void this.router.navigate(['/dashboard/network/view', partnerId]);
      return;
    }
    this.enter(partnerId).subscribe({
      next: () => {
        void this.router.navigate(['/dashboard/network/view', partnerId]);
      },
      error: () => {},
    });
  }

  exit(): void {
    this.viewingAs.set(null);
    this.relation.set(null);
    this.error.set(null);
    void this.router.navigate(['/dashboard']);
  }
}
