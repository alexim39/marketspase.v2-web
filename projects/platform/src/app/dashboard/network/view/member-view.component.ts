import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { GoalService } from '../../../core/goals/goal.service';
import { AvatarComponent } from '../../../_common/avatar.component';
import { ViewAsService } from '../../../core/viewas/viewas.service';
import { LeadPipelineService } from '../../partner/prospects/lead-pipeline/lead-pipeline.service';
import { NetworkService } from '../tree/network.service';
import { ApiError } from '../../../core/http/api-error';

/**
 * @title Member view — read-only overview of one member.
 *
 * Entered only through ViewAsService (audited admin/upline entry).
 * Composes existing subject-scoped reads (360, overview, goals,
 * pipeline, stuck) — no new access rules, nothing writable here.
 * OnPush + signals, fully typed where shapes are stable.
 */
@Component({
  selector: 'async-member-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent, MatButtonModule,
    MatIconModule, MatProgressBarModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>Member view</span>
      </div>
    </section>

    <section class="view-page">
      <div class="page-head">
        <div>
          <h2>Member view</h2>
          <p class="subtitle">Read-only — nothing here can change the member's account.</p>
        </div>
        <button mat-button (click)="exit()">Exit view</button>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading member view" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (identity(); as who) {
        <div class="dp-card identity-card">
          <async-avatar [photo]="who.photo" [name]="who.name" size="md" />
          <div>
            <strong>{{ who.name }}</strong>
            <span class="muted">@{{ who.username }}</span>
          </div>
          <span class="spacer"></span>
          <span class="dp-status dp-status--warn">Read-only</span>
        </div>
      }

      <div class="card-grid">
        <div class="dp-card">
          <h3>Commission & goals</h3>
          <p>Commission rank: <strong>{{ commissionRank() }}</strong> · earns Levels 1–{{ commissionDepth() }}</p>
          @if (journeyLevel()) {
            <p class="muted">Journey stage: {{ journeyLevel() }}</p>
          }
          @if (goals().length > 0) {
            <ul class="plain-list">
              @for (g of goals(); track g.id) {
                <li>
                  <span>{{ g.title || g.kind }}</span>
                  <span class="muted">{{ g.progress.percent }}% · {{ g.progress.complete ? 'complete' : (g.progress.onTrack ? 'on track' : 'behind') }}</span>
                </li>
              }
            </ul>
          } @else if (!loading()) {
            <p class="empty">No active goals.</p>
          }
        </div>

        <div class="dp-card">
          <h3>Pipeline ({{ prospectTotal() }})</h3>
          @if (stageCounts().length > 0) {
            <ul class="plain-list">
              @for (s of stageCounts(); track s.stage) {
                <li><span>{{ s.stage }}</span><strong>{{ s.count }}</strong></li>
              }
            </ul>
          } @else if (!loading()) {
            <p class="empty">No prospects yet.</p>
          }
          @if (stuckCount() > 0) {
            <p class="warn" role="status">{{ stuckCount() }} stuck prospect{{ stuckCount() === 1 ? '' : 's' }} need attention.</p>
          }
        </div>
      </div>

      <div class="view-links">
        <a mat-button routerLink="/dashboard/network/tree">Open Network tree</a>
      </div>
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .view-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); }
    .identity-card { padding: 1em; display: flex; align-items: center; gap: 0.8em; }
    .identity-card .spacer { flex: 1; }
    .card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 0.75em; }
    .card-grid .dp-card { padding: 1em; }
    .card-grid h3 { margin: 0 0 0.5em; font-size: 1em; }
    .plain-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35em; }
    .plain-list li { display: flex; justify-content: space-between; gap: 0.6em; align-items: baseline; }
    .view-links { display: flex; gap: 0.5em; flex-wrap: wrap; }
    .view-links a { min-height: 44px; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .warn { color: var(--ms-warning); font-weight: 600; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .empty { color: var(--ms-text-muted); }
  `],
})
export class MemberViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly viewAs = inject(ViewAsService);
  private readonly network = inject(NetworkService);
  private readonly analytics = inject(AnalyticsService);
  private readonly goalsApi = inject(GoalService);
  private readonly pipeline = inject(LeadPipelineService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly identity = signal<{ name: string; username: string; photo: string | null } | null>(null);
  protected readonly commissionRank = signal('Partner');
  protected readonly commissionDepth = signal(1);
  protected readonly journeyLevel = signal<string | null>(null);
  protected readonly goals = signal<Array<{ id: string; title: string; kind: string; progress: { percent: number; complete: boolean; onTrack: boolean } }>>([]);
  protected readonly stageCounts = signal<Array<{ stage: string; count: number }>>([]);
  protected readonly prospectTotal = signal(0);
  protected readonly stuckCount = signal(0);

  private subjectId(): string {
    return String(this.route.snapshot.paramMap.get('id') ?? '').trim();
  }

  ngOnInit(): void {
    this.reload();
  }

  protected exit(): void {
    this.viewAs.exit();
  }

  protected reload(): void {
    const id = this.subjectId();
    if (!id) {
      this.error.set('No member selected.');
      this.loading.set(false);
      return;
    }
    // Entering directly by URL still passes the audited gate.
    if (!this.viewAs.viewingAs() || this.viewAs.viewingAs()?.id !== id) {
      this.viewAs.enter(id).subscribe({ error: () => {} });
    }
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      net360: this.network.member360(id).pipe(catchError(() => of(null))),
      overview: this.analytics.overview(30, id).pipe(catchError(() => of(null))),
      goals: this.goalsApi.byPartner(id).pipe(catchError(() => of(null))),
      prospects: this.pipeline.listByPartner(id, { limit: 200 }).pipe(catchError(() => of(null))),
      stuck: this.pipeline.stuck(id).pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const seen = this.viewAs.viewingAs();
          const netDoc = (res.net360 as { data?: unknown } | null)?.data as {
            name?: string; username?: string; profileImage?: string; level?: string;
            commissionRank?: string; commissionDepth?: number;
          } | undefined;
          const fallbackName = seen ? `${seen.name}` : 'Member';
          this.identity.set({
            name: netDoc?.name ?? fallbackName,
            username: netDoc?.username ?? seen?.username ?? '—',
            photo: netDoc?.profileImage ?? null,
          });
          const rank = netDoc?.commissionRank ?? 'Partner';
          const depthByRank: Record<string, number> = { Partner: 1, Builder: 2, Leader: 3, Ambassador: 5 };
          this.commissionRank.set(rank);
          this.commissionDepth.set(Number(
            netDoc?.commissionDepth ?? depthByRank[rank] ?? 1,
          ));
          this.journeyLevel.set(netDoc?.level ?? null);
          const goals = (res.goals as { data?: Array<{ id: string; title: string; kind: string; progress: { percent: number; complete: boolean; onTrack: boolean } }> } | null)?.data ?? [];
          this.goals.set(goals);
          const items = (res.prospects as { data?: Array<{ status?: { stage?: string } }>; meta?: { total?: number } } | null)?.data ?? [];
          this.prospectTotal.set((res.prospects as { meta?: { total?: number } } | null)?.meta?.total ?? items.length);
          const counts = new Map<string, number>();
          for (const lead of items) {
            const stage = lead.status?.stage ?? 'New';
            counts.set(stage, (counts.get(stage) ?? 0) + 1);
          }
          this.stageCounts.set([...counts.entries()].map(([stage, count]) => ({ stage, count })));
          this.stuckCount.set(((res.stuck as { data?: unknown[] } | null)?.data ?? []).length);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }
}
