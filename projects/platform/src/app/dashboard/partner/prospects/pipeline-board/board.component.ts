import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApiError } from '../../../../core/http/api-error';
import { LeadPipelineService } from '../lead-pipeline/lead-pipeline.service';
import { CollectCodeComponent } from '../../contacts/manage/details/collect-code.component';
import { MatDialog } from '@angular/material/dialog';
import { ProspectLead, ProspectStage,
STAGE_META, STAGE_ORDER, StuckEntry } from '../lead-pipeline/lead.models';
import { formatStuckDuration } from '../stuck-duration';

/**
 * @title Pipeline board — drag-and-drop Kanban over the canonical stages.
 *
 * Drop a card to advance it; dropping on Converted asks for confirm then
 * records the business-issued enrollment code via dialog. Server stays
 * source of truth (reload after every move). OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-pipeline-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DragDropModule, MatButtonModule, MatChipsModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatSnackBarModule, PageSkeletonComponent, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Prospects</a> &gt;
        <span>Pipeline board</span>
      </div>
    </section>

    <section class="board-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Pipeline · Deal movement</p>
          <h1>Pipeline board</h1>
          <p class="subtitle">Drag cards forward as conversations progress. Dropping on Converted enrolls the prospect and creates their signup link.</p>
        </div>
        <div class="head-actions">
          <button mat-stroked-button type="button" (click)="reload()" [disabled]="loading()">
            <mat-icon>refresh</mat-icon>
            Refresh
          </button>
          <a mat-stroked-button routerLink="../pipeline"><mat-icon>table_rows</mat-icon> Table view</a>
          <a mat-stroked-button routerLink="../customer-leads"><mat-icon>groups</mat-icon> Customers</a>
        </div>
      </header>

      @if (convertedNotice(); as converted) {
        <div class="code-banner" role="status">
          <span class="banner-icon"><mat-icon>celebration</mat-icon></span>
          <div>
            <strong>{{ converted.name }}</strong> is converted. Share their signup link so they join your team.
            @if (conversionLink(converted.leadId); as link) {
              <code class="conversion-link">{{ link }}</code>
            }
          </div>
          <button mat-stroked-button type="button" (click)="copyConversionLink(converted.leadId)">Copy link</button>
          <button mat-icon-button (click)="convertedNotice.set(null)" aria-label="Dismiss"><mat-icon>close</mat-icon></button>
        </div>
      }

      @if (pendingConvert(); as pending) {
        <div class="confirm-banner" role="alertdialog" aria-label="Confirm conversion">
          <span class="banner-icon"><mat-icon>help</mat-icon></span>
          <div>Convert <strong>{{ names(pending) }}</strong> — they can then sign up through open registration.</div>
          <button mat-flat-button color="primary" type="button" (click)="confirmConvert()" [disabled]="actingId() !== null">Confirm</button>
          <button mat-button type="button" (click)="pendingConvert.set(null)">Cancel</button>
        </div>
      }

      <section class="summary-strip" aria-label="Pipeline summary">
        <div class="summary-card"><span class="summary-icon"><mat-icon>view_kanban</mat-icon></span><div><strong>{{ totalCards() }}</strong><span>Total prospects</span><small>Across every stage</small></div></div>
        <div class="summary-card"><span class="summary-icon summary-icon--info"><mat-icon>bolt</mat-icon></span><div><strong>{{ activeCount() }}</strong><span>Active conversations</span><small>Open pipeline</small></div></div>
        <div class="summary-card"><span class="summary-icon summary-icon--ok"><mat-icon>verified</mat-icon></span><div><strong>{{ convertedCount() }}</strong><span>Converted</span><small>Ready or already joined</small></div></div>
        <div class="summary-card" [class.summary-card--attention]="stuckCount() > 0"><span class="summary-icon summary-icon--bad"><mat-icon>hourglass_bottom</mat-icon></span><div><strong>{{ stuckCount() }}</strong><span>Stuck cards</span><small>Need a next step</small></div></div>
      </section>

      <div class="toolbar-card">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>Search cards</mat-label>
          <input matInput type="search" placeholder="Name, phone or email" (input)="search.set($any($event.target).value)" />
        </mat-form-field>
        <p class="board-hint"><mat-icon>drag_indicator</mat-icon> Drag a card to another column to move the deal.</p>
      </div>

      @if (error(); as err) {
        <div class="alert" role="alert"><mat-icon>error_outline</mat-icon><p>{{ err }}</p><button mat-stroked-button type="button" (click)="reload()">Retry</button></div>
      }

      @if (loading()) {
        <async-page-skeleton layout="board" [rows]="3" label="pipeline board" [showHeader]="false" />
      } @else {
        <div class="board">
          @for (col of columns(); track col.stage) {
            <section class="column column--{{ stageTone(col.stage) }}">
              <header class="column-head">
                <span class="stage-dot"></span>
                <strong>{{ col.meta.label }}</strong>
                <span class="column-count">{{ col.cards.length }}</span>
              </header>
              <div
                class="card-list"
                [id]="columnId(col.stage)"
                cdkDropList
                [cdkDropListData]="col.cards"
                [cdkDropListConnectedTo]="columnIds()"
                (cdkDropListDropped)="drop($event, col.stage)"
              >
                @for (lead of col.cards; track lead.id) {
                  <article class="lead-card" cdkDrag [cdkDragData]="lead" [cdkDragDisabled]="actingId() !== null">
                    <div class="card-top">
                      <span class="avatar" aria-hidden="true">{{ initials(lead) }}</span>
                      <div class="card-id">
                        <a class="card-name" [routerLink]="['../detail', lead.id]">{{ names(lead) }}</a>
                        <span class="muted">{{ lead.prospectPhone }}</span>
                        @if (lead.prospectEmail) { <span class="muted email">{{ lead.prospectEmail }}</span> }
                      </div>
                      <mat-icon class="drag-handle" aria-hidden="true">drag_indicator</mat-icon>
                    </div>

                    <div class="card-badges">
                      @if (stuckOf(lead); as stuck) {
                        <span class="stuck-badge" [title]="'No movement for ' + stuckDuration(stuck.daysInStage) + ' (threshold ' + stuck.limit + 'd)'">
                          <mat-icon>hourglass_bottom</mat-icon>
                          Stuck {{ stuckDuration(stuck.daysInStage) }}
                        </span>
                      }
                      @if (isConverted(lead)) {
                        @if (lead.convertedPartnerId) {
                          <span class="joined-badge"><mat-icon>verified</mat-icon> Joined your team</span>
                        } @else {
                          <span class="joined-badge joined-badge--pending"><mat-icon>link</mat-icon> Signup pending</span>
                        }
                      }
                    </div>

                    <div class="card-actions">
                      <a mat-button [routerLink]="['/dashboard/prospects/detail', lead.id]">Work contact</a>
                      @if (isConverted(lead) && !lead.convertedPartnerId) {
                        <button mat-button type="button" class="card-link" (click)="copyConversionLink(lead.id)">Copy signup link</button>
                      }
                    </div>
                  </article>
                } @empty {
                  <div class="drop-hint"><mat-icon>add</mat-icon><span>Drop a card here</span></div>
                }
              </div>
            </section>
          }
        </div>
      }
    </section>
`,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 16px; }
    .breadcrumb a { text-decoration: none; }
    .board-page { display: flex; flex-direction: column; gap: 24px; max-width: 1400px; margin: 0 auto; padding-bottom: 32px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 24px; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(2rem, 3vw, 2.5rem); letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .subtitle { margin: 0; max-width: 62em; color: var(--ms-text-muted); line-height: 1.6; }
    .head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .head-actions mat-icon { margin-right: 6px; }

    .code-banner, .confirm-banner { display: flex; align-items: center; gap: 12px; border-radius: var(--ms-radius-lg); padding: 12px 16px; flex-wrap: wrap; }
    .code-banner { background: var(--ms-success-soft); border: 1px solid var(--ms-success); }
    .confirm-banner { background: var(--ms-warning-soft); border: 1px solid var(--ms-warning); }
    .banner-icon { width: 36px; height: 36px; flex: none; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-surface); }
    .banner-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .code-banner > div, .confirm-banner > div { flex: 1; min-width: 220px; line-height: 1.5; }
    .conversion-link { display: block; max-width: 100%; margin-top: 4px; overflow: hidden; font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; background: var(--ms-surface); padding: 4px 8px; border-radius: var(--ms-radius-sm); }
    .code-banner button, .confirm-banner button { min-height: 40px; }

    .summary-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 8px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .summary-card { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-md); }
    .summary-card--attention { background: var(--ms-warning-soft); }
    .summary-icon { width: 40px; height: 40px; flex: none; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .summary-icon--info { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .summary-icon--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .summary-icon--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .summary-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .summary-card > div { display: flex; flex-direction: column; gap: 1px; }
    .summary-card strong { font-family: var(--ms-font-display); font-size: 1.5rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .summary-card span:last-of-type { color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; }
    .summary-card small { color: var(--ms-text-muted); font-size: 0.6875rem; }

    .toolbar-card { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .search-field { flex: 1; min-width: 240px; }
    .board-hint { display: inline-flex; align-items: center; gap: 6px; margin: 0; color: var(--ms-text-muted); font-size: 0.8125rem; }
    .board-hint mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .board { display: grid; grid-template-columns: repeat(6, minmax(240px, 1fr)); gap: 12px; overflow-x: auto; padding-bottom: 8px; align-items: start; }
    .column { display: flex; flex-direction: column; min-width: 240px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-canvas); overflow: hidden; }
    .column-head { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--ms-line); background: var(--ms-surface); }
    .column-head strong { font-size: 0.8125rem; font-weight: 600; }
    .stage-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ms-text-muted); flex: none; }
    .column--new .stage-dot { background: var(--ms-info); }
    .column--contacted .stage-dot { background: #3b82f6; }
    .column--interested .stage-dot { background: var(--ms-warning); }
    .column--negotiation .stage-dot { background: #8b5cf6; }
    .column--converted .stage-dot { background: var(--ms-success); }
    .column--closed .stage-dot { background: var(--ms-error); }
    .column-count { margin-left: auto; min-width: 24px; height: 24px; padding: 0 7px; border-radius: 999px; display: inline-grid; place-items: center; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .card-list { flex: 1; display: flex; flex-direction: column; gap: 10px; padding: 10px; min-height: 180px; }
    .lead-card { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); background: var(--ms-surface); box-shadow: var(--ms-shadow-sm); cursor: grab; }
    .lead-card:active { cursor: grabbing; }
    .card-top { display: flex; align-items: flex-start; gap: 10px; }
    .avatar { width: 34px; height: 34px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.75rem; font-weight: 700; }
    .card-id { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .card-name { color: inherit; text-decoration: none; font-size: 0.875rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .card-name:hover { color: var(--ms-primary-strong); }
    .muted { color: var(--ms-text-muted); font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .email { font-size: 0.6875rem; }
    .drag-handle { color: var(--ms-text-muted); font-size: 18px; width: 18px; height: 18px; flex: none; }
    .card-badges { display: flex; gap: 6px; flex-wrap: wrap; }
    .card-badges:empty { display: none; }
    .stuck-badge, .joined-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 999px; font-size: 0.6875rem; font-weight: 700; }
    .stuck-badge { background: var(--ms-error-soft); color: var(--ms-error); }
    .joined-badge { background: var(--ms-success-soft); color: var(--ms-success); }
    .joined-badge--pending { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .stuck-badge mat-icon, .joined-badge mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .card-actions { display: flex; gap: 4px; flex-wrap: wrap; border-top: 1px solid var(--ms-line); padding-top: 6px; margin-top: 2px; }
    .card-actions a, .card-actions button { min-height: 34px; font-size: 0.75rem; }
    .drop-hint { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 100px; border: 1px dashed var(--ms-line); border-radius: var(--ms-radius-md); color: var(--ms-text-muted); font-size: 0.75rem; }
    .drop-hint mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .alert { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { flex: 1; margin: 0; }
    .cdk-drag-preview { box-shadow: var(--ms-shadow-md); border-radius: var(--ms-radius-md); }
    .cdk-drag-placeholder { opacity: 0.35; }
    @media (max-width: 1100px) { .board { grid-template-columns: repeat(6, 220px); } .summary-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .summary-strip { grid-template-columns: minmax(0, 1fr); } .board { grid-template-columns: repeat(6, 86vw); } .head-actions { width: 100%; } .head-actions a, .head-actions button { flex: 1; justify-content: center; } }
`],
})
export class PipelineBoardComponent implements OnInit {
  private readonly leads = inject(LeadPipelineService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<ProspectLead[]>([]);
  protected readonly search = signal('');
  protected readonly stuckDays = signal<Record<string, StuckEntry>>({});
  protected readonly actingId = signal<string | null>(null);
  protected readonly pendingConvert = signal<ProspectLead | null>(null);
  protected readonly convertedNotice = signal<{ name: string; leadId: string } | null>(null);

  protected readonly boardStages: ProspectStage[] = [...STAGE_ORDER, 'Closed'];

  protected readonly columnIds = computed(() => this.boardStages.map((s) => this.columnId(s)));

  protected readonly columns = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.boardStages.map((stage) => ({
      stage,
      meta: STAGE_META[stage],
      cards: this.rows().filter((lead) => {
        if ((lead.status?.stage ?? 'New') !== stage) return false;
        if (!q) return true;
        const hay = `${lead.prospectName} ${lead.prospectSurname ?? ''} ${lead.prospectPhone} ${lead.prospectEmail ?? ''}`.toLowerCase();
        return hay.includes(q);
      }),
    }));
  });

  protected readonly totalCards = computed(() => this.rows().length);
  protected readonly activeCount = computed(() => this.rows().filter((lead) => {
    const stage = lead.status?.stage ?? 'New';
    return stage !== 'Converted' && stage !== 'Closed';
  }).length);
  protected readonly convertedCount = computed(() => this.rows().filter((lead) => lead.status?.stage === 'Converted').length);
  protected readonly stuckCount = computed(() => this.rows().filter((lead) => !!this.stuckDays()[lead.id]).length);

  ngOnInit(): void {
    this.reload();
  }

  protected columnId(stage: ProspectStage): string {
    return `col-${stage}`;
  }

  protected reload(): void {
    const partnerId = this.auth.currentUser()?.id;
    if (!partnerId) {
      this.error.set('Session expired. Please sign in again.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ leads: this.leads.listByPartner(partnerId), stuck: this.leads.stuck(partnerId) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ leads, stuck }) => {
          this.rows.set(leads.data ?? []);
          this.stuckDays.set(Object.fromEntries((stuck.data ?? []).map((s) => [s.prospectId, s])));
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected names(lead: ProspectLead): string {
    return this.leads.prospectName(lead);
  }

  protected initials(lead: ProspectLead): string {
    const parts = `${lead.prospectName ?? ''} ${lead.prospectSurname ?? ''}`.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'P';
    const first = parts[0][0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
    return `${first}${last}`.toUpperCase();
  }

  protected stageTone(stage: ProspectStage): string {
    switch (stage) {
      case 'Contacted': return 'contacted';
      case 'Interested': return 'interested';
      case 'In Negotiation': return 'negotiation';
      case 'Converted': return 'converted';
      case 'Closed': return 'closed';
      default: return 'new';
    }
  }

  protected stuckOf(lead: ProspectLead): StuckEntry | null {
    return this.stuckDays()[lead.id] ?? null;
  }

  protected readonly stuckDuration = formatStuckDuration;

  protected drop(event: CdkDragDrop<ProspectLead[]>, target: ProspectStage): void {
    if (event.previousContainer === event.container) return;
    const lead = event.item.data as ProspectLead;
    if (!lead || (lead.status?.stage ?? 'New') === target) return;
    if (target === 'Converted') {
      this.pendingConvert.set(lead);
      return;
    }
    this.advance(lead, target);
  }

  protected advance(lead: ProspectLead, stage: ProspectStage): void {
    this.actingId.set(lead.id);
    this.leads
      .advanceStage(lead.id, stage)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.reload();
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(err.message);
        },
      });
  }

  protected isConverted(lead: ProspectLead): boolean {
    return lead.status?.stage === 'Converted';
  }

  protected referralLink(): string | null {
    const username = String(this.auth.currentUser()?.username ?? '').trim();
    if (!username || typeof location === 'undefined') return null;
    return `${location.origin}/join?ref=${encodeURIComponent(username)}`;
  }

  protected conversionLink(leadId: string): string | null {
    const base = this.referralLink();
    return base ? `${base}&lead=${encodeURIComponent(leadId)}` : null;
  }

  protected copyConversionLink(leadId: string): void {
    const url = this.conversionLink(leadId);
    if (!url) return;
    const done = () => this.snack.open('Signup link copied — this lead will join your team', 'Close', { duration: 3000 });
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, done);
    else done();
  }

  protected confirmConvert(): void {
    const lead = this.pendingConvert();
    if (!lead) return;
    this.pendingConvert.set(null);
    this.dialog.open(CollectCodeComponent, {
      data: { ...lead, _id: lead.id },
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res: any) => {
        if (res?.converted) {
          this.convertedNotice.set({ name: this.names(lead), leadId: lead.id });
          this.reload();
        }
      });
  }
}
