import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { LeadPipelineService } from '../../lead-pipeline/lead-pipeline.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { CollectCodeComponent } from '../../../contacts/manage/details/collect-code.component';
import {
  nextStage,
  ProspectCommunication,
  ProspectDetail,
  ProspectStage,
  StageHistoryEntry,
  STAGE_META,
  STAGE_TONE,
} from '../../lead-pipeline/lead.models';
import { formatStuckDuration } from '../../stuck-duration';
import { ApiError } from '../../../../../core/http/api-error';

const COMM_TYPES = ['call', 'email', 'text', 'zoom', 'whatsapp', 'presentation'] as const;
const INTEREST_LEVELS = ['hot', 'warm', 'cold'] as const;
const COMM_OUTCOMES = ['Connected', 'No answer', 'Booked session', 'Follow-up set', 'Closed-lost'] as const;
type CommOutcome = (typeof COMM_OUTCOMES)[number];

const combineDateAndTime = (day: Date | null, clock: Date | null): string => {
  const d = day instanceof Date && !Number.isNaN(day.getTime()) ? new Date(day) : new Date();
  const t = clock instanceof Date && !Number.isNaN(clock.getTime()) ? clock : new Date();
  d.setHours(t.getHours(), t.getMinutes(), 0, 0);
  return d.toISOString();
};

/** Shared prospect detail state, timeline and outreach form. */
@Injectable()
export class ProspectDetailFacade {
  private readonly leads = inject(LeadPipelineService);
  private readonly auth = inject(AuthService);
  private readonly routes = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private started = false;

  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly logging = signal(false);
  readonly error = signal<string | null>(null);
  readonly logError = signal<string | null>(null);
  readonly lead = signal<ProspectDetail | null>(null);
  readonly confirming = signal(false);
  readonly convertedNotice = signal<{ name: string } | null>(null);
  readonly showLogForm = signal(false);
  readonly commTypes = [...COMM_TYPES];
  readonly interestLevels = [...INTEREST_LEVELS];
  readonly commOutcomes = [...COMM_OUTCOMES];

  readonly logForm = this.fb.nonNullable.group({
    type: ['call' as (typeof COMM_TYPES)[number], Validators.required],
    interestLevel: ['warm' as (typeof INTEREST_LEVELS)[number], Validators.required],
    outcome: ['Connected' as CommOutcome, Validators.required],
    date: [new Date() as Date | null, Validators.required],
    time: [new Date() as Date | null, Validators.required],
    duration: [0, [Validators.required, Validators.min(0)]],
    description: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(5000)]],
    followUpAction: [''],
    followUpDate: [null as Date | null],
  });

  readonly timeline = computed<Array<{ kind: 'comm'; comm: ProspectCommunication } | { kind: 'stage'; move: StageHistoryEntry }>>(() => {
    const lead = this.lead();
    const rows: Array<{ kind: 'comm'; comm: ProspectCommunication } | { kind: 'stage'; move: StageHistoryEntry }> = [
      ...((lead?.communications ?? []) as ProspectCommunication[]).map((comm) => ({ kind: 'comm' as const, comm })),
      ...((lead?.stageHistory ?? []) as StageHistoryEntry[]).map((move) => ({ kind: 'stage' as const, move })),
    ];
    const at = (r: (typeof rows)[number]): number =>
      new Date(r.kind === 'comm' ? (r.comm.date ?? 0) : (r.move.at ?? 0)).getTime();
    rows.sort((a, b) => at(b) - at(a));
    return rows;
  });

  readonly touchCount = computed(() => this.lead()?.communications?.length ?? 0);
  readonly chip = computed(() => {
    const stage = (this.lead()?.status?.stage ?? 'New') as ProspectStage;
    return STAGE_META[stage] ?? STAGE_META.New;
  });
  readonly stageTone = computed(() => {
    const stage = (this.lead()?.status?.stage ?? 'New') as ProspectStage;
    return STAGE_TONE[stage] ?? STAGE_TONE.New;
  });
  readonly next = computed(() => {
    const next = nextStage(this.lead()?.status?.stage);
    return next === 'Converted' ? null : next;
  });
  readonly isDownline = computed(() => {
    const owner = this.lead()?.partnerId;
    const me = this.auth.currentUser()?.id;
    return !!owner && !!me && String(owner) !== String(me);
  });
  readonly daysInStage = computed(() => {
    const s = this.lead()?.status;
    const raw = s?.stageEnteredAt ?? this.lead()?.updatedAt ?? this.lead()?.createdAt;
    if (!raw) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(raw).getTime()) / 86400000));
  });
  readonly stuckDuration = formatStuckDuration;

  ensureLoaded(): void {
    if (this.started) return;
    this.started = true;
    this.routes.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params.get('id');
        if (id) this.load(id);
      });
  }

  prospectId(): string {
    return this.routes.snapshot.paramMap.get('id') ?? '';
  }

  names(): string {
    const lead = this.lead();
    if (!lead) return 'Prospect';
    return this.leads.prospectName(lead);
  }

  initials(): string {
    const lead = this.lead();
    const parts = `${lead?.prospectName ?? ''} ${lead?.prospectSurname ?? ''}`.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'P';
    const first = parts[0][0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
    return `${first}${last}`.toUpperCase();
  }

  canConvert(): boolean {
    const stage = this.lead()?.status?.stage ?? 'New';
    return stage !== 'Converted' && stage !== 'Closed';
  }

  canClose(): boolean {
    const stage = this.lead()?.status?.stage ?? 'New';
    return stage !== 'Converted' && stage !== 'Closed';
  }

  isConverted(): boolean {
    return this.lead()?.status?.stage === 'Converted';
  }

  commIcon(type: string | undefined): string {
    switch (type) {
      case 'call': return 'call';
      case 'email': return 'email';
      case 'text': return 'sms';
      case 'zoom': return 'videocam';
      case 'whatsapp': return 'chat';
      default: return 'event_note';
    }
  }

  load(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.leads.getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.lead.set(res.data ?? null);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  reload(): void {
    const id = this.prospectId();
    if (id) this.load(id);
  }

  toggleLogForm(): void {
    this.showLogForm.set(!this.showLogForm());
    this.logError.set(null);
    if (this.showLogForm()) this.applyFollowUpValidators();
  }

  pickOutcome(o: CommOutcome): void {
    this.logForm.get('outcome')?.setValue(o);
    this.logForm.get('outcome')?.markAsTouched();
    this.applyFollowUpValidators();
  }

  outcomeClass(outcome: string | undefined): string {
    switch (outcome) {
      case 'Booked session':
      case 'Connected':
        return 'dp-status--ok';
      case 'Follow-up set':
        return 'dp-status--info';
      case 'Closed-lost':
        return 'dp-status--bad';
      default:
        return 'dp-status--warn';
    }
  }

  followUpOverdue(comm: { followUpDate?: string; status?: string }): boolean {
    if (!comm?.followUpDate || comm?.status === 'Closed') return false;
    const due = new Date(comm.followUpDate);
    if (Number.isNaN(due.getTime())) return false;
    const today = new Date();
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return due.getTime() < today.getTime();
  }

  authorLabel(comm: { createdBy?: string; createdByName?: string }, ownerId: unknown): string | null {
    const author = comm?.createdBy ? String(comm.createdBy) : '';
    if (!author) return null;
    const me = this.auth.currentUser()?.id ? String(this.auth.currentUser()?.id) : '';
    const name = comm?.createdByName ? String(comm.createdByName) : '';
    if (me && author === me) return 'You';
    if (ownerId && author === String(ownerId)) return name ? `Owner · ${name}` : 'Owner';
    return name ? `Support · ${name}` : 'Support';
  }

  authorClass(comm: { createdBy?: string }, ownerId: unknown): string {
    const author = comm?.createdBy ? String(comm.createdBy) : '';
    const me = this.auth.currentUser()?.id ? String(this.auth.currentUser()?.id) : '';
    if (me && author === me) return 'dp-status--info';
    if (ownerId && author === String(ownerId)) return 'dp-status--ok';
    return 'dp-status--warn';
  }

  stageAuthorLabel(move: StageHistoryEntry, ownerId: unknown): string | null {
    return this.authorLabel({ createdBy: move.by, createdByName: move.byName }, ownerId);
  }

  stageAuthorClass(move: StageHistoryEntry, ownerId: unknown): string {
    return this.authorClass({ createdBy: move.by }, ownerId);
  }

  advance(stage: ProspectStage): void {
    const id = this.prospectId();
    if (!id) return;
    this.acting.set(true);
    this.leads.advanceStage(id, stage, this.actor())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.acting.set(false);
          this.reload();
        },
        error: (err: ApiError) => {
          this.acting.set(false);
          this.error.set(err.message);
        },
      });
  }

  convert(): void {
    const id = this.prospectId();
    const lead = this.lead();
    if (!id) return;
    this.confirming.set(false);
    this.dialog.open(CollectCodeComponent, {
      data: {
        _id: (lead as { _id?: string } | null)?._id ?? id,
        prospectName: (lead as { prospectName?: string } | null)?.prospectName ?? '',
        prospectSurname: (lead as { prospectSurname?: string } | null)?.prospectSurname ?? '',
      },
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res: { converted?: boolean } | undefined) => {
        if (res?.converted) {
          this.convertedNotice.set({ name: this.names() });
          this.reload();
        }
      });
  }

  saveLog(): void {
    this.applyFollowUpValidators();
    if (this.logForm.invalid) return;
    const id = this.prospectId();
    if (!id) return;
    this.logging.set(true);
    this.logError.set(null);
    const v = this.logForm.getRawValue();
    const outcome = v.outcome as CommOutcome;
    const me = this.auth.currentUser();
    const authorName = [me?.name, me?.surname].filter(Boolean).join(' ') || String(me?.username ?? '');
    this.leads.logCommunication(id, {
      type: v.type,
      interestLevel: v.interestLevel,
      date: combineDateAndTime(v.date, v.time),
      duration: Number(v.duration),
      description: v.description.trim(),
      followUpAction: v.followUpAction.trim(),
      outcome,
      followUpDate: v.followUpDate instanceof Date && !Number.isNaN(v.followUpDate.getTime())
        ? v.followUpDate.toISOString().slice(0, 10)
        : undefined,
      status: outcome === 'Closed-lost' ? 'Closed' : 'Open',
      ...(me?.id ? { createdBy: String(me.id) } : {}),
      ...(authorName ? { createdByName: authorName } : {}),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.logging.set(false);
        this.showLogForm.set(false);
        this.logForm.patchValue({ date: new Date(), time: new Date(), duration: 0, description: '', followUpAction: '', outcome: 'Connected' as CommOutcome, followUpDate: null });
        this.reload();
      },
      error: (err: ApiError) => {
        this.logging.set(false);
        this.logError.set(err.message);
      },
    });
  }

  private applyFollowUpValidators(): void {
    const fud = this.logForm.get('followUpDate');
    if (this.logForm.get('outcome')?.value === 'Closed-lost') fud?.setValidators([]);
    else fud?.setValidators([Validators.required]);
    fud?.updateValueAndValidity({ emitEvent: false });
  }

  private actor(): { by?: string; byName?: string } {
    const me = this.auth.currentUser();
    const name = [me?.name, me?.surname].filter(Boolean).join(' ') || String(me?.username ?? '');
    return {
      ...(me?.id ? { by: String(me.id) } : {}),
      ...(name ? { byName: name } : {}),
    };
  }
}
