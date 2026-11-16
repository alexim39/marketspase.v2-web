import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth.service';
import { publicLeadPageUrl } from '../../../../../core/store/public-links';
import { ApiError, userError } from '../../../../../core/http/api-error';
import { LeadPipelineService } from '../lead-pipeline.service';
import {
  nextStage,
  ProspectLead,
  ProspectListEnvelope,
  ProspectStage,
  ReferralMember,
  STAGE_META,
  STAGE_ORDER,
  STAGE_TONE,
  StuckEntry,
  StuckEnvelope,
} from '../lead.models';
import { formatStuckDuration } from '../../stuck-duration';
import { CollectCodeComponent } from '../../../contacts/manage/details/collect-code.component';
import { RateLeadDialogComponent } from '../rate-lead-dialog.component';

/** Shared table pipeline state, filters and lead actions. */
@Injectable()
export class LeadPipelineFacade {
  private readonly leads = inject(LeadPipelineService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly rows = signal<ProspectLead[]>([]);
  readonly total = signal(0);
  readonly search = signal('');
  readonly stageFilter = signal<ProspectStage | null>(null);
  readonly stuckOnly = signal(false);
  readonly pageSize = signal(50);
  readonly pageIndex = signal(0);
  readonly stuckDays = signal<Record<string, StuckEntry>>({});
  readonly signupRows = signal<ReferralMember[]>([]);
  readonly actingId = signal<string | null>(null);
  readonly confirmId = signal<string | null>(null);
  readonly deleteConfirmId = signal<string | null>(null);
  readonly convertedNotice = signal<{ name: string; leadId: string } | null>(null);
  readonly serverStageCounts = signal<Record<string, number>>({});
  readonly displayedColumns = ['name', 'contact', 'stage', 'interest', 'action'];
  readonly stuckDuration = formatStuckDuration;
  private started = false;

  readonly stageCounts = computed(() => {
    const server = this.serverStageCounts();
    const useServer = Object.keys(server).length > 0;
    const counts = new Map<ProspectStage, number>();
    if (!useServer) {
      for (const lead of this.rows()) {
        const stage = (lead.status?.stage ?? 'New') as ProspectStage;
        counts.set(stage, (counts.get(stage) ?? 0) + 1);
      }
    }
    return [...STAGE_ORDER, 'Closed' as ProspectStage].map((stage) => ({
      stage,
      count: useServer ? (server[stage] ?? 0) : (counts.get(stage) ?? 0),
      meta: STAGE_META[stage],
    }));
  });

  readonly filtered = computed(() => this.rows());
  readonly stuckCount = computed(() => Object.keys(this.stuckDays()).length);

  ensureLoaded(): void {
    if (this.started) return;
    this.started = true;
    this.reload();
  }

  remove(lead: ProspectLead): void {
    this.actingId.set(lead.id);
    this.leads.removeProspect(lead.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleteConfirmId.set(null);
          this.actingId.set(null);
          this.reload();
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(userError(err));
        },
      });
  }

  reload(): void {
    const partnerId = this.auth.currentUser()?.id;
    if (!partnerId) {
      this.error.set('Session expired. Please sign in again.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.leads.referralMembers(partnerId, this.search().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.signupRows.set(res.data ?? []),
        error: () => this.signupRows.set([]),
      });
    const limit = this.pageSize();
    const skip = this.pageIndex() * limit;
    const q = this.search().trim() || undefined;
    const stage = this.stageFilter() ?? undefined;
    const stuck$ = this.leads.stuck(partnerId);

    if (this.stuckOnly()) {
      stuck$.pipe(
        switchMap((stuck) => {
          const ids = (stuck.data ?? []).map((s) => s.prospectId).slice(0, 500);
          if (ids.length === 0) return of({ stuck, leads: null as ProspectListEnvelope | null });
          return this.leads.listByPartner(partnerId, { limit, skip, q, stage, ids })
            .pipe(map((leads) => ({ stuck, leads })));
        }),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe({
        next: ({ stuck, leads }) => this.applyResult(leads, stuck),
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
      return;
    }

    forkJoin({
      leads: this.leads.listByPartner(partnerId, { limit, skip, q, stage }),
      stuck: stuck$,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ leads, stuck }) => this.applyResult(leads, stuck),
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  toggleStuckOnly(): void {
    if (this.stuckCount() === 0) return;
    this.stuckOnly.set(!this.stuckOnly());
    this.pageIndex.set(0);
    this.reload();
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.pageIndex.set(0);
    this.reload();
  }

  onPage(pageSize: number, pageIndex: number): void {
    this.pageSize.set(pageSize);
    this.pageIndex.set(pageIndex);
    this.reload();
  }

  toggleStageFilter(stage: ProspectStage): void {
    this.stageFilter.set(this.stageFilter() === stage ? null : stage);
    this.pageIndex.set(0);
    this.reload();
  }

  stuckOf(lead: ProspectLead): StuckEntry | null {
    return this.stuckDays()[lead.id] ?? null;
  }

  names(lead: ProspectLead): string { return this.leads.prospectName(lead); }

  chip(lead: ProspectLead): { label: string; color: string; text: string } {
    return STAGE_META[((lead.status?.stage ?? 'New') as ProspectStage)] ?? STAGE_META.New;
  }

  stageTone(lead: ProspectLead): string {
    return STAGE_TONE[((lead.status?.stage ?? 'New') as ProspectStage)] ?? STAGE_TONE.New;
  }

  stageLabel(lead: ProspectLead): string { return this.chip(lead).label; }
  interest(lead: ProspectLead): string { return this.leads.lastInterest(lead); }

  nextOf(lead: ProspectLead): ProspectStage | null {
    const next = nextStage(lead.status?.stage);
    return next === 'Converted' ? null : next;
  }

  canConvert(lead: ProspectLead): boolean {
    const stage = lead.status?.stage ?? 'New';
    return stage !== 'Converted' && stage !== 'Closed';
  }

  isConverted(lead: ProspectLead): boolean {
    return lead.status?.stage === 'Converted';
  }

  advance(lead: ProspectLead, stage: ProspectStage): void {
    this.actingId.set(lead.id);
    this.leads.advanceStage(lead.id, stage)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.reload();
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(userError(err));
        },
      });
  }

  convert(lead: ProspectLead): void {
    this.confirmId.set(null);
    this.dialog.open(CollectCodeComponent, { data: { ...lead, _id: lead.id } })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res: { converted?: boolean } | undefined) => {
        if (res?.converted) {
          this.convertedNotice.set({ name: this.names(lead), leadId: lead.id });
          this.reload();
          this.askRating(lead, 'converted');
        }
      });
  }

  referralLink(): string | null {
    const username = String(this.auth.currentUser()?.username ?? '').trim();
    if (!username || typeof location === 'undefined') return null;
    return `${location.origin}/join?ref=${encodeURIComponent(username)}`;
  }

  conversionLink(leadId: string): string | null {
    const base = this.referralLink();
    return base ? `${base}&lead=${encodeURIComponent(leadId)}` : null;
  }

  leadPageLink(): string | null {
    const username = String(this.auth.currentUser()?.username ?? '').trim();
    return username ? publicLeadPageUrl(username) : null;
  }

  copyLeadPageLink(): void {
    const url = this.leadPageLink();
    if (url) this.copyText(url, 'Personal lead page copied');
  }

  memberInitial(member: ReferralMember): string {
    return String(member.name || member.username || 'M').trim().charAt(0).toUpperCase();
  }

  copyReferralLink(): void {
    const url = this.referralLink();
    if (url) this.copyText(url, 'Referral link copied — new signups join your team');
  }

  copyConversionLink(leadId: string): void {
    const url = this.conversionLink(leadId);
    if (url) this.copyText(url, 'Signup link copied — this lead will join your team');
  }

  shareConversionOnWhatsApp(lead: ProspectLead): void {
    this.shareConversionLink(lead.id, this.names(lead));
  }

  shareConvertedOnWhatsApp(leadId: string, name: string): void {
    this.shareConversionLink(leadId, name);
  }

  askRating(lead: ProspectLead, context: 'converted' | 'released' | 'expired'): void {
    this.dialog.open(RateLeadDialogComponent, {
      data: { prospectId: lead.id, leadName: this.names(lead), context },
    });
  }

  private applyResult(leads: ProspectListEnvelope | null, stuck: StuckEnvelope): void {
    this.stuckDays.set(Object.fromEntries((stuck.data ?? []).map((s) => [s.prospectId, s])));
    this.rows.set(leads?.data ?? []);
    this.total.set(leads?.meta?.total ?? (leads?.data?.length ?? 0));
    this.serverStageCounts.set(leads?.meta?.stageCounts ?? {});
    this.loading.set(false);
  }

  private shareConversionLink(leadId: string, name: string): void {
    const url = this.conversionLink(leadId);
    if (!url) return;
    const text = `Hi ${name}, your MarketSpase account is ready. Use my link to join my team: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  private copyText(url: string, message: string): void {
    const done = () => this.snack.open(message, 'Close', { duration: 3000 });
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, done);
    else done();
  }
}
