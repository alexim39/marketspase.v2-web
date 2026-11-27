import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ApiError } from '../../../../../core/http/api-error';
import { LeadPipelineService } from '../../lead-pipeline/lead-pipeline.service';
import { CollectCodeComponent } from '../../../contacts/manage/details/collect-code.component';
import { ProspectLead, ProspectStage, STAGE_META, STAGE_ORDER, StuckEntry } from '../../lead-pipeline/lead.models';
import { formatStuckDuration } from '../../stuck-duration';

/** Shared Kanban board state and drag/convert actions. */
@Injectable()
export class PipelineBoardFacade {
  private readonly leads = inject(LeadPipelineService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly rows = signal<ProspectLead[]>([]);
  readonly search = signal('');
  readonly stuckDays = signal<Record<string, StuckEntry>>({});
  readonly actingId = signal<string | null>(null);
  readonly pendingConvert = signal<ProspectLead | null>(null);
  readonly convertedNotice = signal<{ name: string; leadId: string } | null>(null);
  readonly boardStages: ProspectStage[] = [...STAGE_ORDER, 'Closed'];
  readonly stuckDuration = formatStuckDuration;
  private started = false;

  readonly columnIds = computed(() => this.boardStages.map((s) => this.columnId(s)));
  readonly columns = computed(() => {
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

  readonly totalCards = computed(() => this.rows().length);
  readonly activeCount = computed(() => this.rows().filter((lead) => {
    const stage = lead.status?.stage ?? 'New';
    return stage !== 'Converted' && stage !== 'Closed';
  }).length);
  readonly convertedCount = computed(() => this.rows().filter((lead) => lead.status?.stage === 'Converted').length);
  readonly stuckCount = computed(() => this.rows().filter((lead) => !!this.stuckDays()[lead.id]).length);

  ensureLoaded(): void {
    if (this.started) return;
    this.started = true;
    this.reload();
  }

  columnId(stage: ProspectStage): string { return `col-${stage}`; }

  reload(): void {
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

  names(lead: ProspectLead): string { return this.leads.prospectName(lead); }

  initials(lead: ProspectLead): string {
    const parts = `${lead.prospectName ?? ''} ${lead.prospectSurname ?? ''}`.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'P';
    const first = parts[0][0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
    return `${first}${last}`.toUpperCase();
  }

  stageTone(stage: ProspectStage): string {
    switch (stage) {
      case 'Contacted': return 'contacted';
      case 'Interested': return 'interested';
      case 'In Negotiation': return 'negotiation';
      case 'Converted': return 'converted';
      case 'Closed': return 'closed';
      default: return 'new';
    }
  }

  stuckOf(lead: ProspectLead): StuckEntry | null { return this.stuckDays()[lead.id] ?? null; }

  drop(event: CdkDragDrop<ProspectLead[]>, target: ProspectStage): void {
    if (event.previousContainer === event.container) return;
    const lead = event.item.data as ProspectLead;
    if (!lead || (lead.status?.stage ?? 'New') === target) return;
    if (target === 'Converted') {
      this.pendingConvert.set(lead);
      return;
    }
    this.advance(lead, target);
  }

  advance(lead: ProspectLead, stage: ProspectStage): void {
    this.actingId.set(lead.id);
    this.leads.advanceStage(lead.id, stage)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.snack.open(`${this.names(lead)} moved to ${STAGE_META[stage].label}`, 'Close', { duration: 2600 });
          this.reload();
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(err.message);
        },
      });
  }

  isConverted(lead: ProspectLead): boolean { return lead.status?.stage === 'Converted'; }

  referralLink(): string | null {
    const username = String(this.auth.currentUser()?.username ?? '').trim();
    if (!username || typeof location === 'undefined') return null;
    return `${location.origin}/join?ref=${encodeURIComponent(username)}`;
  }

  conversionLink(leadId: string): string | null {
    const base = this.referralLink();
    return base ? `${base}&lead=${encodeURIComponent(leadId)}` : null;
  }

  copyConversionLink(leadId: string): void {
    const url = this.conversionLink(leadId);
    if (!url) return;
    const done = () => this.snack.open('Signup link copied — this lead will join your team', 'Close', { duration: 3000 });
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, done);
    else done();
  }

  confirmConvert(): void {
    const lead = this.pendingConvert();
    if (!lead) return;
    this.pendingConvert.set(null);
    this.dialog.open(CollectCodeComponent, { data: { ...lead, _id: lead.id } })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res: { converted?: boolean } | undefined) => {
        if (res?.converted) {
          this.convertedNotice.set({ name: this.names(lead), leadId: lead.id });
          this.reload();
        }
      });
  }
}
