import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TrainingService } from '../../../core/training/training.service';
import { ApiError } from '../../../core/http/api-error';

/**
 * @title Training analytics — who learned what, how fast.
 *
 * Completion rates per course, certification compliance, and leadership
 * pipeline health — all derived from live training + progression signals.
 * OnPush + signals, fail-soft.
 */
@Component({
  selector: 'async-training-analytics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/training">Academy</a> &gt;
        <span>Analytics</span>
      </div>
    </section>

    <section class="analytics-page">
      <div class="page-head">
        <div>
          <h2>Training Analytics</h2>
          <p class="subtitle">Completion, certification and pipeline — how learning turns into leadership.</p>
        </div>
        <a mat-button routerLink="/dashboard/training">Back to Academy</a>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (!loading() && !error()) {
        <div class="stat-grid">
          <mat-card>
            <mat-card-content>
              <mat-icon>school</mat-icon>
              <span class="stat-value">{{ avgCompletion() | number:'1.0-0' }}%</span>
              <span class="stat-label">Avg completion</span>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <mat-icon>workspace_premium</mat-icon>
              <span class="stat-value">{{ certCount() }}</span>
              <span class="stat-label">Certificates earned</span>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <mat-icon>groups</mat-icon>
              <span class="stat-value">{{ teamTotal() }}</span>
              <span class="stat-label">Downline members</span>
            </mat-card-content>
          </mat-card>
        </div>

        <div class="dp-card table-card">
          <h3>Per-course completion</h3>
          <table>
            <tr><th>Course</th><th>Progress</th><th>Status</th></tr>
            @for (c of courses(); track c.id) {
              <tr>
                <td>{{ c.title }}</td>
                <td><mat-progress-bar mode="determinate" [value]="c.percent" aria-label="Progress" /> {{ c.percent }}%</td>
                <td>
                  @if (c.certified) {
                    <span class="dp-status dp-status--ok">Certified</span>
                  } @else if (c.done > 0) {
                    <span class="dp-status dp-status--info">In progress</span>
                  } @else {
                    <span class="dp-status dp-status--warn">Not started</span>
                  }
                </td>
              </tr>
            }
          </table>
        </div>

        <div class="dp-card table-card">
          <h3>Downline training compliance</h3>
          @if (teamSummary(); as s) {
            <p class="muted">{{ s.fullyCertified }} fully certified · {{ s.inProgress }} in progress · {{ s.notStarted }} not started@if (teamCapped()) { · showing first {{ team().length }} of {{ teamTotal() }} }</p>
          } @else {
            <p class="muted">Your downline — who has finished IPO / QSG / SMO / Leadership.</p>
          }
          @if (team().length > 0) {
            <table>
              <tr><th>Member</th><th>Depth</th><th>Overall</th><th>Certs</th><th>IPO</th><th>QSG</th><th>SMO</th></tr>
              @for (m of team().slice(0, 50); track m.partnerId) {
                <tr class="member-row" (click)="toggleMember(m)" (keydown.enter)="toggleMember(m)" tabindex="0">
                  <td><button mat-button>{{ m.member?.name ?? m.partnerId.slice(-6) }}</button></td>
                  <td>L{{ m.depth ?? '–' }}</td>
                  <td><mat-progress-bar mode="determinate" [value]="m.overallPercent" aria-label="Progress" /> {{ m.overallPercent }}%</td>
                  <td>{{ m.certifiedCount }}</td>
                  <td>{{ coursePct(m, 'ipo') }}%</td>
                  <td>{{ coursePct(m, 'qsg') }}%</td>
                  <td>{{ coursePct(m, 'smo') }}%</td>
                </tr>
                @if (expandedId() === m.partnerId) {
                  <tr class="detail-row">
                    <td colspan="7">
                      @if (detailLoading() === m.partnerId) {
                        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
                      } @else if (details()[m.partnerId]; as d) {
                        <div class="member-detail">
                          @for (c of d.courses; track c.courseId) {
                            <div class="course-line">
                              <strong>{{ c.title }}</strong>
                              <span class="muted">{{ c.done }}/{{ c.total }} · {{ c.percent }}%@if (c.certified) { · Certified }</span>
                              <ul>
                                @for (l of c.lessons; track l.lessonId) {
                                  <li [class.done]="l.done">
                                    <mat-icon>{{ l.done ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                                    <span>{{ l.title }}</span>
                                    @if (l.hasVideo) { <span class="muted"> · video</span> }
                                  </li>
                                }
                              </ul>
                            </div>
                          }
                          <div class="nudge-row">
                            <button mat-flat-button color="primary" (click)="nudgeMember(m, $event)" [disabled]="nudging() === m.partnerId">
                              {{ nudging() === m.partnerId ? 'Sending…' : 'Nudge to keep learning' }}
                            </button>
                            @if (nudgeMsg()[m.partnerId]; as msg) {
                              <span class="muted">{{ msg }}</span>
                            }
                          </div>
                        </div>
                      }
                    </td>
                  </tr>
                }
              }
            </table>
          } @else if (!loading()) {
            <p class="muted">No downline members yet — your recruits will appear here with their course progress.</p>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .analytics-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .page-head a { min-height: 44px; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75em; }
    .stat-grid mat-card-content { display: flex; flex-direction: column; gap: 0.2em; }
    .stat-grid mat-icon { color: var(--ms-primary-strong); }
    .stat-value { font-size: 1.5em; font-weight: 700; }
    .stat-label { color: var(--ms-text-muted); font-size: 0.85em; }
    .table-card { padding: 1em; }
    .table-card h3 { margin: 0 0 0.5em; }
    .table-card table { width: 100%; border-collapse: collapse; }
    .table-card th { text-align: left; color: var(--ms-text-muted); font-size: 0.85em; padding: 0.4em 0.5em; }
    .table-card td { padding: 0.5em; border-top: 1px solid var(--ms-line); }
    .bar-list { display: flex; flex-direction: column; gap: 0.5em; margin-top: 0.5em; }
    .bar-row { display: grid; grid-template-columns: 160px 1fr 40px; gap: 0.6em; align-items: center; }
    @media only screen and (max-width: 600px) {
      .bar-row { grid-template-columns: 110px 1fr 44px; }
    }
    .bar-label { font-size: 0.85em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bar-track { height: 14px; background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--ms-primary); min-width: 2px; }
    .bar-num { text-align: right; font-weight: 600; font-size: 0.9em; }
    .member-row { cursor: pointer; }
    .member-row:hover td { background: var(--ms-canvas); }
    .member-row button { min-height: 44px; }
    .detail-row td { background: var(--ms-canvas); }
    .member-detail { display: flex; flex-direction: column; gap: 0.75em; padding: 0.5em 0; }
    .course-line ul { list-style: none; margin: 0.3em 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.2em; }
    .course-line li { display: flex; align-items: center; gap: 0.4em; font-size: 0.9em; }
    .course-line li mat-icon { font-size: 18px; height: 18px; width: 18px; color: var(--ms-text-muted); }
    .course-line li.done mat-icon { color: var(--ms-success); }
    .nudge-row { display: flex; align-items: center; gap: 0.75em; flex-wrap: wrap; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    html[data-theme='dark'] .error { color: #e89a9a; }
  `],
})
export class TrainingAnalyticsComponent implements OnInit {
  private readonly training = inject(TrainingService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly courses = signal<Array<{ id: string; title: string; percent: number; done: number; total: number; certified: boolean }>>([]);
  protected readonly certCount = signal(0);
  protected readonly team = signal<Array<{ partnerId: string; depth: number | null; member: { username: string; name: string } | null; courses: Array<{ courseId: string; percent: number }>; overallPercent: number; certifiedCount: number }>>([]);
  protected readonly teamSummary = signal<{ notStarted: number; inProgress: number; fullyCertified: number } | null>(null);
  protected readonly teamCapped = signal(false);
  protected readonly teamTotal = signal(0);
  protected readonly expandedId = signal<string | null>(null);
  protected readonly details = signal<Record<string, import('../../../core/training/training.models').TeamMemberDetail>>({});
  protected readonly detailLoading = signal<string | null>(null);
  protected readonly nudging = signal<string | null>(null);
  protected readonly nudgeMsg = signal<Record<string, string>>({});

  protected coursePct(m: { courses: Array<{ courseId: string; percent: number }> }, courseId: string): number {
    return m.courses.find((c) => c.courseId === courseId)?.percent ?? 0;
  }

  protected toggleMember(m: { partnerId: string }): void {
    const id = m.partnerId;
    if (this.expandedId() === id) {
      this.expandedId.set(null);
      return;
    }
    this.expandedId.set(id);
    if (!this.details()[id] && this.detailLoading() !== id) {
      this.detailLoading.set(id);
      this.training.teamMember(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            this.details.update((d) => ({ ...d, [id]: res.data }));
            this.detailLoading.set(null);
          },
          error: () => this.detailLoading.set(null),
        });
    }
  }

  protected nudgeMember(m: { partnerId: string }, event: Event): void {
    event.stopPropagation();
    const id = m.partnerId;
    if (this.nudging() === id) return;
    this.nudging.set(id);
    this.training.nudge(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.nudging.set(null);
          const d = res.data;
          this.nudgeMsg.update((mm) => ({
            ...mm,
            [id]: d.status === 'notified'
              ? `Nudge sent${d.deduped ? ' (already in inbox)' : ''} ✓`
              : `Skipped: ${d.reason === 'already-complete' ? 'already fully certified' : d.reason === 'already-sent-today' ? 'already nudged today' : (d.reason ?? 'not sent')}`,
          }));
        },
        error: (err: import('../../../core/http/api-error').ApiError) => {
          this.nudging.set(null);
          this.nudgeMsg.update((mm) => ({ ...mm, [id]: err.message ?? 'Failed to send' }));
        },
      });
  }

  protected readonly avgCompletion = computed(() => {
    const cs: Array<{ percent: number }> = this.courses() as unknown as Array<{ percent: number }>;
    if (cs.length === 0) return 0;
    return Math.round(cs.reduce((s: number, c) => s + c.percent, 0) / cs.length);
  });

  ngOnInit(): void { this.reload(); }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      courses: this.training.courses().pipe(catchError(() => of(null))),
      certs: this.training.certificates().pipe(catchError(() => of(null))),
      team: this.training.teamCompliance().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payload: { courses: unknown; certs: unknown; team: unknown }) => {
          const { courses, certs, team } = payload as {
            courses: { data?: Array<{ id: string; title: string; percent: number; done: number; total: number; certified: boolean }> } | null;
            certs: { data?: unknown[] } | null;
            team: { data?: { members?: never[]; total?: number; capped?: boolean; summary?: { notStarted: number; inProgress: number; fullyCertified: number } } } | null;
          };
          const cs = courses?.data ?? [];
          this.courses.set(cs as never);
          this.certCount.set((certs?.data ?? []).length);
          const t = team?.data;
          this.team.set(((t?.members ?? []) as never[]).slice(0, 200) as never);
          this.teamSummary.set((t?.summary ?? null) as never);
          this.teamCapped.set(!!t?.capped);
          this.teamTotal.set(Number(t?.total) || 0);
          this.loading.set(false);
        },
        error: (err: import('../../../core/http/api-error').ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }
}
