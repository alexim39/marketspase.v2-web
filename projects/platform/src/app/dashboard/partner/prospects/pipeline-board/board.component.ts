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
        <span>Pipeline Board</span>
      </div>
    </section>

    <section class="board-page">
      <div class="page-head">
        <div>
          <h2>Pipeline Board</h2>
          <p class="subtitle">Drag cards forward. Dropping on Converted enrolls.</p>
        </div>
        <div class="head-links">
          <a mat-button routerLink="../pipeline">Table view</a>
          <a mat-button routerLink="../personal-list">Contact list</a>
        </div>
      </div>

      @if (convertedNotice(); as converted) {
        <div class="code-banner" role="status">
          <mat-icon>celebration</mat-icon>
          <div>
            <strong>{{ converted.name }}</strong> is converted. Share their signup link so they join your team.
            @if (conversionLink(converted.leadId); as link) {
              <code class="conversion-link">{{ link }}</code>
            }
          </div>
          <button mat-stroked-button type="button" (click)="copyConversionLink(converted.leadId)">Copy link</button>
          <button mat-icon-button (click)="convertedNotice.set(null)" aria-label="Dismiss">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }

      @if (pendingConvert(); as pending) {
        <div class="confirm-banner" role="alertdialog" aria-label="Confirm conversion">
          <mat-icon>help</mat-icon>
          <div>Convert <strong>{{ names(pending) }}</strong> — they can then sign up through open registration.</div>
          <button mat-flat-button color="primary" (click)="confirmConvert()" [disabled]="actingId() !== null">Confirm</button>
          <button mat-button (click)="pendingConvert.set(null)">Cancel</button>
        </div>
      }

      <div class="toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Search cards</mat-label>
          <input matInput type="search" placeholder="Name, phone or email" (input)="search.set($any($event.target).value)" />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
      </div>

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (loading()) {
        <async-page-skeleton layout="board" [rows]="3" label="pipeline board" [showHeader]="false" />
      } @else {
      <div class="board">
        @for (col of columns(); track col.stage) {
          <div class="column">
            <div class="column-head" [style.background]="col.meta.color" [style.color]="col.meta.text">
              <strong>{{ col.meta.label }}</strong>
              <span>{{ col.cards.length }}</span>
            </div>
            <div
              class="card-list"
              [id]="columnId(col.stage)"
              cdkDropList
              [cdkDropListData]="col.cards"
              [cdkDropListConnectedTo]="columnIds()"
              (cdkDropListDropped)="drop($event, col.stage)"
            >
              @for (lead of col.cards; track lead.id) {
                <div class="card" cdkDrag [cdkDragData]="lead" [cdkDragDisabled]="actingId() !== null">
                  <a class="card-name" [routerLink]="['../detail', lead.id]">{{ names(lead) }}</a>
                  <span class="muted">{{ lead.prospectPhone }}</span>
                  <a class="card-work" [routerLink]="['/dashboard/insights/contact-analytics']" [queryParams]="{ id: lead.id }" title="Work {{ names(lead) }}">Work contact →</a>
                  @if (isConverted(lead)) {
                    @if (lead.convertedPartnerId) {
                      <span class="joined-badge"><mat-icon>verified</mat-icon> Joined your team</span>
                    } @else {
                      <button mat-button type="button" class="card-link" (click)="copyConversionLink(lead.id)">
                        Copy signup link
                      </button>
                    }
                  }
                  @if (stuckOf(lead); as stuck) {
                    <span class="stuck-badge" [title]="'No movement for ' + stuckDuration(stuck.daysInStage) + ' (threshold ' + stuck.limit + 'd)'">⚠ stuck {{ stuckDuration(stuck.daysInStage) }}</span>
                  }
                </div>
              } @empty {
                <p class="muted drop-hint">Drop here</p>
              }
            </div>
          </div>
        }
      </div>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .board-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); }
    .head-links { display: flex; gap: 0.25em; }
    .code-banner, .confirm-banner { display: flex; align-items: center; gap: 0.75em; border-radius: 8px; padding: 0.75em 1em; }
    .code-banner button, .confirm-banner button { min-height: 44px; }
    .code-banner { background: var(--ms-success-soft); border: 1px solid var(--ms-success); }
    .code-banner code { font-size: 1.2em; font-weight: 700; letter-spacing: 0.1em; background: var(--ms-surface); padding: 0.1em 0.5em; border-radius: 4px; }
    .code-banner .conversion-link { display: block; max-width: 100%; margin-top: 0.35em; overflow: hidden; font-size: 0.72em; font-weight: 500; letter-spacing: 0; text-overflow: ellipsis; white-space: nowrap; }
    .card-link { align-self: flex-start; min-height: 36px; font-size: 0.82em; }
    .joined-badge { display: inline-flex; align-items: center; gap: 0.2em; align-self: flex-start; padding: 0.1em 0.55em; border-radius: 999px; background: var(--ms-success-soft); color: var(--ms-success); font-size: 0.76em; font-weight: 700; }
    .joined-badge mat-icon { width: 15px; height: 15px; font-size: 15px; }
    .code-banner div, .confirm-banner div { flex: 1; }
    .confirm-banner { background: var(--ms-warning-soft); border: 1px solid var(--ms-warning); }
    .toolbar { display: flex; align-items: center; gap: 1em; flex-wrap: wrap; }
    .toolbar mat-form-field { flex: 1; min-width: 220px; }
    .loader { flex: 2; min-width: 120px; }
    .board { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 0.75em; padding-bottom: 0.5em; }
    .column { display: flex; flex-direction: column; min-height: 200px; min-width: 0; }
    .column-head { display: flex; justify-content: space-between; align-items: center; border-radius: 8px 8px 0 0; padding: 0.5em 0.75em; }
    .card-list { flex: 1; display: flex; flex-direction: column; gap: 0.5em; background: var(--ms-surface); border: 1px solid var(--ms-line); border-top: none; border-radius: 0 0 8px 8px; padding: 0.6em; min-height: 120px; }
    .card { background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: 8px; padding: 0.6em 0.7em; display: flex; flex-direction: column; gap: 0.2em; cursor: grab; min-width: 0; overflow-wrap: anywhere; }
    .card:active { cursor: grabbing; }
    .card-name { font-weight: 600; text-decoration: none; color: inherit; }
    .card-name:hover { color: var(--ms-primary-strong); }
    .card-work { font-size: 0.85em; text-decoration: none; color: var(--ms-primary-strong); align-self: flex-start; min-height: 44px; display: inline-flex; align-items: center; }
    .stuck-badge { color: var(--ms-error); font-size: 0.85em; font-weight: 600; }
    .drop-hint { text-align: center; margin: 0.5em 0; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .cdk-drag-preview { box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25); border-radius: 8px; }
    .cdk-drag-placeholder { opacity: 0.35; }
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
