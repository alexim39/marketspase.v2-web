import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminService } from '../../../core/admin/admin.service';
import { ManagedPartner } from '../../../core/admin/admin.models';
import { LeadPipelineService } from '../../partner/prospects/lead-pipeline/lead-pipeline.service';
import { ProspectLead, ProspectStage, STAGE_ORDER, STAGE_TONE } from '../../partner/prospects/lead-pipeline/lead.models';
import { AvatarComponent } from '../../../_common/avatar.component';
import { ApiError } from '../../../core/http/api-error';

/**
 * @title Partner pipeline — admin read of any member's prospects.
 *
 * Member picker (directory search) + read-only pipeline: stage cards,
 * search, stuck flags. No stage moves, converts or deletes — those stay
 * with the owner/upline per policy. Data rides existing endpoints
 * (`v1/admin/partners`, `v1/prospects/by-partner/:id`,
 * `v1/prospects/stuck/:id`). OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-admin-partner-pipeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent, DatePipe, FormsModule, MatButtonModule, MatIconModule,
    MatInputModule, MatProgressBarModule, MatTableModule, MatTooltipModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>Admin</span> &gt;
        <span>Partner pipeline</span>
      </div>
    </section>

    <section class="queue-page">
      <div class="page-head">
        <div>
          <h2>Partner pipeline</h2>
          <p class="subtitle">Inspect any member's prospects — read-only. Stage moves and converts stay with the owner and upline.</p>
        </div>
      </div>

      <div class="dp-card picker-card">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Find a member</mat-label>
          <input matInput [(ngModel)]="query" (ngModelChange)="searchMembers()" placeholder="Name, phone or username" />
        </mat-form-field>
        @if (searching()) {
          <mat-progress-bar mode="indeterminate" aria-label="Loading" />
        }
        @if (candidates().length > 0) {
          <ul class="pick-list">
            @for (m of candidates(); track m.id) {
              <li>
                <button mat-button (click)="select(m)" [class.picked]="subject()?.id === m.id">
                  <async-avatar [photo]="m.profileImage" [name]="memberName(m)" size="xs" />
                  {{ memberName(m) }} <span class="muted">@{{ m.username }}</span>
                </button>
              </li>
            }
          </ul>
        } @else if (searched() && !searching()) {
          <p class="empty">No members match — try another search.</p>
        }
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

      @if (subject(); as s) {
        <div class="subject-bar">
          <async-avatar [photo]="s.profileImage" [name]="memberName(s)" size="sm" />
          <div>
            <strong>{{ memberName(s) }}</strong>
            <span class="muted">@{{ s.username }}</span>
          </div>
          <span class="spacer"></span>
          <span class="dp-status dp-status--info">{{ leads().length }} prospects</span>
          @if (stuckCount() > 0) {
            <span class="dp-status dp-status--bad">{{ stuckCount() }} stuck</span>
          }
          <button mat-button (click)="openMember(s.id)">Open member 360</button>
        </div>

        <div class="stage-cards" role="group" aria-label="Pipeline stages">
          @for (entry of stageCounts(); track entry.stage) {
            <button
              type="button"
              class="stage-card"
              [class.active]="stageFilter() === entry.stage"
              [attr.aria-pressed]="stageFilter() === entry.stage"
              (click)="toggleStage(entry.stage)"
            >
              <span class="count">{{ entry.count }}</span>
              <span class="label">{{ entry.stage }}</span>
            </button>
          }
          @if (stageFilter()) {
            <button mat-button (click)="stageFilter.set(null)">Clear</button>
          }
        </div>

        @if (filtered().length > 0) {
          <div class="table-wrap">
            <table mat-table [dataSource]="filtered()" class="mat-elevation-z2">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Prospect</th>
                <td mat-cell *matCellDef="let lead">{{ names(lead) }}</td>
              </ng-container>
              <ng-container matColumnDef="phone">
                <th mat-header-cell *matHeaderCellDef>Phone</th>
                <td mat-cell *matCellDef="let lead">{{ lead.prospectPhone || '—' }}</td>
              </ng-container>
              <ng-container matColumnDef="stage">
                <th mat-header-cell *matHeaderCellDef>Stage</th>
                <td mat-cell *matCellDef="let lead">
                  <span class="dp-status {{ toneOf(lead) }}">{{ stageOf(lead) }}</span>
                  @if (stuckDays(lead); as days) {
                    <span class="stuck" [title]="'No movement for ' + days + ' days'">stuck {{ days }}d</span>
                  }
                </td>
              </ng-container>
              <ng-container matColumnDef="updated">
                <th mat-header-cell *matHeaderCellDef>Touched</th>
                <td mat-cell *matCellDef="let lead">{{ lead.updatedAt | date:'mediumDate' }}</td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          </div>
        } @else if (!loading() && !error()) {
          <p class="empty">This member has no prospects @if (stageFilter()) { in {{ stageFilter() }} } — nothing to inspect.</p>
        }
      } @else if (!loading()) {
        <p class="empty">Search above and pick a member to inspect their pipeline.</p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .queue-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 52em; }
    .picker-card { padding: 1em; display: flex; flex-direction: column; gap: 0.6em; }
    .pick-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .pick-list button { min-height: 44px; justify-content: flex-start; }
    .pick-list button.picked { background: var(--ms-primary-soft); font-weight: 700; }
    .subject-bar { display: flex; align-items: center; gap: 0.7em; flex-wrap: wrap; }
    .subject-bar .spacer { flex: 1; }
    .stage-cards { display: flex; gap: 0.5em; flex-wrap: wrap; align-items: stretch; }
    .stage-card {
      border: 1px solid var(--ms-line);
      background: var(--ms-surface);
      border-radius: 10px;
      padding: 0.6em 0.9em;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.1em;
      cursor: pointer;
      color: inherit;
      font: inherit;
      min-height: 44px;
    }
    .stage-card .count { font-size: 1.3em; font-weight: 800; }
    .stage-card .label { font-size: 0.82em; color: var(--ms-text-muted); }
    .stage-card.active { border-color: var(--ms-primary); background: var(--ms-primary-soft); }
    .table-wrap { overflow-x: auto; border-radius: 8px; }
    table { width: 100%; }
    .stuck { color: var(--ms-error); font-size: 0.82em; font-weight: 600; margin-left: 0.5em; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .empty { color: var(--ms-text-muted); }
  `],
})
export class AdminPartnerPipelineComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly pipeline = inject(LeadPipelineService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly query = signal('');
  protected readonly searching = signal(false);
  protected readonly searched = signal(false);
  protected readonly candidates = signal<ManagedPartner[]>([]);
  protected readonly subject = signal<ManagedPartner | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<ProspectLead[]>([]);
  protected readonly stuckIds = signal<Record<string, number>>({});
  protected readonly stageFilter = signal<ProspectStage | null>(null);

  protected readonly displayedColumns = ['name', 'phone', 'stage', 'updated'];

  protected readonly leads = computed(() => this.items());
  protected readonly stuckCount = computed(() => Object.keys(this.stuckIds()).length);

  protected readonly stageCounts = computed(() => {
    const counts = new Map<ProspectStage, number>();
    for (const s of STAGE_ORDER) counts.set(s, 0);
    for (const lead of this.items()) {
      const stage = (lead.status?.stage ?? 'New') as ProspectStage;
      counts.set(stage, (counts.get(stage) ?? 0) + 1);
    }
    return STAGE_ORDER.map((stage) => ({ stage, count: counts.get(stage) ?? 0 }));
  });

  protected readonly filtered = computed(() => {
    const stage = this.stageFilter();
    if (!stage) return this.items();
    return this.items().filter((l) => (l.status?.stage ?? 'New') === stage);
  });

  ngOnInit(): void {}

  protected memberName(m: ManagedPartner): string {
    return `${m.name ?? ''} ${m.surname ?? ''}`.trim() || m.username;
  }

  protected openMember(id: string): void {
    void this.router.navigate(['/members', id]);
  }

  protected searchMembers(): void {
    const q = this.query().trim();
    if (q.length < 2) {
      this.candidates.set([]);
      this.searched.set(false);
      return;
    }
    this.searching.set(true);
    this.admin
      .directory({ q, limit: 8 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.candidates.set(res.data?.items ?? []);
          this.searched.set(true);
          this.searching.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.searching.set(false);
        },
      });
  }

  protected select(m: ManagedPartner): void {
    this.subject.set(m);
    this.stageFilter.set(null);
    this.reload();
  }

  protected toggleStage(stage: ProspectStage): void {
    this.stageFilter.set(this.stageFilter() === stage ? null : stage);
  }

  protected names(lead: ProspectLead): string {
    return `${lead.prospectName ?? ''} ${lead.prospectSurname ?? ''}`.trim() || 'Unnamed';
  }

  protected stageOf(lead: ProspectLead): string {
    return lead.status?.stage ?? 'New';
  }

  protected toneOf(lead: ProspectLead): string {
    return STAGE_TONE[(lead.status?.stage ?? 'New') as ProspectStage] ?? 'dp-status--neutral';
  }

  protected stuckDays(lead: ProspectLead): number | null {
    return this.stuckIds()[lead.id] ?? null;
  }

  protected reload(): void {
    const subject = this.subject();
    if (!subject) return;
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      list: this.pipeline.listByPartner(subject.id, { limit: 200 }),
      stuck: this.pipeline.stuck(subject.id),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ list, stuck }) => {
          this.items.set(list.data ?? []);
          const map: Record<string, number> = {};
          for (const entry of stuck.data ?? []) map[entry.prospectId] = entry.daysInStage;
          this.stuckIds.set(map);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }
}
