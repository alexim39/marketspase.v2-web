import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { AnalyticsService } from '../../../../core/analytics/analytics.service';
import { DashboardOverview } from '../../../../core/analytics/analytics.models';
import { LeadPipelineService } from '../../prospects/lead-pipeline/lead-pipeline.service';
import { ActivationBoard, ActivationBoardItem } from '../../prospects/lead-pipeline/lead.models';
import { ApiError, userError } from '../../../../core/http/api-error';

/** Shared team hub data, coaching priority queue and health summary. */
@Injectable()
export class TeamHubFacade {
  private readonly analytics = inject(AnalyticsService);
  private readonly leads = inject(LeadPipelineService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly overview = signal<DashboardOverview | null>(null);
  readonly activation = signal<ActivationBoard | null>(null);
  readonly team = computed(() => this.overview()?.team ?? null);
  readonly priorityItems = computed<Array<ActivationBoardItem & { toneLabel: string }>>(() => {
    const items = this.activation()?.items ?? [];
    const rank = (tone: ActivationBoardItem['nextTone']) => tone === 'bad' ? 0 : tone === 'warn' ? 1 : tone === 'info' ? 2 : 3;
    return [...items]
      .sort((a, b) => rank(a.nextTone) - rank(b.nextTone))
      .slice(0, 6)
      .map((item) => ({
        ...item,
        toneLabel: item.nextTone === 'bad' ? 'Action' : item.nextTone === 'warn' ? 'Training' : 'On track',
      }));
  });
  private started = false;

  ensureLoaded(): void {
    if (this.started) return;
    this.started = true;
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      overview: this.analytics.overview(30).pipe(catchError(() => of(null))),
      activation: this.leads.activationBoard().pipe(catchError(() => of(null))),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: ({ overview, activation }) => {
        this.overview.set(overview?.data ?? null);
        this.activation.set(activation?.data ?? null);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  initials(name: string | undefined): string {
    return String(name ?? '').split(/\s+/).filter(Boolean).slice(0, 2)
      .map((part) => part[0]?.toUpperCase()).join('') || 'T';
  }
}
