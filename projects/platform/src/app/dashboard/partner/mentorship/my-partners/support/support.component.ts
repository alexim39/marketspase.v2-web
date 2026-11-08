import { ChangeDetectionStrategy, Component, DestroyRef, inject, Input, OnChanges, OnInit, signal, SimpleChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, LowerCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { catchError, forkJoin, of } from 'rxjs';
import { PartnerInterface, PartnerService } from '../../../../../_common/services/partner.service';
import { AvatarComponent } from '../../../../../_common/avatar.component';
import { LeadPipelineService } from '../../../prospects/lead-pipeline/lead-pipeline.service';
import { ActivationBoardItem, StuckEntry } from '../../../prospects/lead-pipeline/lead.models';
import { ProgressionService } from '../../../../../core/progression/progression.service';
import { Journey, TRAINING_TRACK } from '../../../../../core/progression/progression.models';
import { GoalService } from '../../../../../core/goals/goal.service';
import { Goal } from '../../../../../core/goals/goal.models';
import { CoachingService, CoachingNote } from '../../../../../core/coaching/coaching.service';
import { ViewAsService } from '../../../../../core/viewas/viewas.service';
import { environment } from '../../../../../../environments/environment';
import { PartnerBusinessKpiComponent } from './partner-business-kpi.component';
import { ApiError, userError } from '../../../../../core/http/api-error';

/**
 * @title Member support — coaching dossier for one direct partner.
 *
 * Answers an upline's only real questions: where is this member, what is
 * stuck, what do I do next? Readiness, journey, goals, attention flags and
 * coaching notes compose in one fail-soft load; contact details stay gated
 * to self/upline/admin. OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-my-partner-support',
  templateUrl: 'support.component.html',
  styleUrls: ['support.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent, DatePipe, FormsModule, LowerCasePipe, MatButtonModule, MatChipsModule,
    MatIconModule, MatInputModule, PageSkeletonComponent, RouterModule,
    PartnerBusinessKpiComponent,
  ],
})
export class MyPartnerSupportComponent implements OnInit, OnChanges {
  @Input() myPartner!: PartnerInterface;
  @Input() myPartnerPartners!: PartnerInterface[];

  private readonly router = inject(Router);
  private readonly partnerService = inject(PartnerService);
  private readonly leads = inject(LeadPipelineService);
  private readonly progress = inject(ProgressionService);
  private readonly goalsApi = inject(GoalService);
  private readonly coaching = inject(CoachingService);
  protected readonly viewAs = inject(ViewAsService);
  private readonly destroyRef = inject(DestroyRef);

  protected partner: PartnerInterface | null = null;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly supportInfo = signal<ActivationBoardItem | null>(null);
  protected readonly journey = signal<Journey | null>(null);
  protected readonly trainingTrack = TRAINING_TRACK;
  protected readonly goals = signal<Goal[]>([]);
  protected readonly stuck = signal<StuckEntry[]>([]);
  protected readonly notes = signal<CoachingNote[]>([]);
  protected readonly showNotesInfo = signal(false);
  protected readonly noteDraft = signal('');
  protected readonly savingNote = signal(false);
  protected readonly showKpi = signal(false);

  ngOnInit(): void {
    this.partnerService.getSharedPartnerData$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (partnerObject) => {
        this.partner = partnerObject as PartnerInterface;
      },
    });
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['myPartner'] && !changes['myPartner'].firstChange) this.load();
  }

  protected memberId(): string {
    return String((this.myPartner as { _id?: unknown } | null)?._id ?? '');
  }

  protected trainingDone(key: string): boolean {
    const stamp = (this.journey()?.milestones?.[key] ?? {}) as { done?: boolean };
    return stamp.done === true;
  }

  protected displayName(): string {
    const p = this.myPartner;
    if (!p) return 'Member';
    return `${p.name ?? ''} ${p.surname ?? ''}`.trim() || p.username || 'Member';
  }

  /**
   * Contact details (phone/email) are visible only to the partner
   * themselves, their direct upline, or an admin. Everyone else sees
   * the public profile (name, link, progress). Fail-closed: unknown
   * linkage hides the details.
   */
  canViewContact(): boolean {
    const me = this.partner?._id ? String(this.partner._id) : '';
    const mine = this.myPartner?._id ? String(this.myPartner._id) : '';
    if (!me || !mine) return false;
    if (me === mine) return true;
    if (String(this.partner?.role ?? '').toLowerCase() === 'admin') return true;
    const raw = (this.myPartner as unknown as { partnerOf?: unknown })?.partnerOf;
    const upline = raw != null && typeof raw === 'object'
      ? String((raw as { _id?: unknown })._id ?? '')
      : String(raw ?? '');
    return !!upline && upline === me;
  }

  protected publicLink(): string {
    const base = (environment as { publicSiteUrl?: string }).publicSiteUrl ?? 'https://marketspase.com';
    const handle = String(
      (this.myPartner as unknown as { storeSlug?: string })?.storeSlug
      ?? this.myPartner?.username
      ?? '',
    ).toLowerCase();
    return `${String(base).replace(/\/+$/, '')}/${handle}`;
  }

  protected back(): void {
    this.router.navigateByUrl('dashboard/mentorship/partners/my-partners');
  }

  protected scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected viewContactList(): void {
    this.router.navigate(['/dashboard/mentorship/partners/my-partners/contacts', this.memberId()]);
  }

  /** Open a private one-to-one conversation with this partner. */
  protected chat(): void {
    const id = this.memberId();
    if (!id) return;
    this.router.navigate(['/dashboard/messages'], {
      queryParams: { chat: id, chatName: this.displayName() },
    });
  }

  /** A note is authored either by the member themselves or by an upline coach. */
  protected isMemberNote(note: CoachingNote): boolean {
    return String(note.authorId ?? note.coachId ?? '') === this.memberId();
  }

  protected authorName(note: CoachingNote): string {
    return this.isMemberNote(note) ? this.displayName() : 'You (coach)';
  }

  protected saveNote(): void {    const body = this.noteDraft().trim();
    const id = this.memberId();
    if (!body || !id || this.savingNote()) return;
    this.savingNote.set(true);
    this.coaching
      .addNote(id, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.notes.set(res.data ?? []);
          this.noteDraft.set('');
          this.savingNote.set(false);
        },
        error: (err: ApiError) => {
          this.savingNote.set(false);
          this.error.set(userError(err));
        },
      });
  }

  private load(): void {
    const id = this.memberId();
    if (!id) {
      this.loading.set(false);
      this.error.set('Member not found.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    // Every slice fails soft — the dossier renders whatever resolved.
    forkJoin({
      board: this.leads.activationBoard().pipe(catchError(() => of(null))),
      journey: this.progress.byMember(id).pipe(catchError(() => of(null))),
      goals: this.goalsApi.byPartner(id).pipe(catchError(() => of(null))),
      stuck: this.leads.stuck(id).pipe(catchError(() => of(null))),
      notes: this.coaching.notes(id).pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const items = res.board?.data?.items ?? [];
          this.supportInfo.set(items.find((i) => String(i.partnerId) === id) ?? null);
          this.journey.set(res.journey?.data ?? null);
          this.goals.set(res.goals?.data ?? []);
          this.stuck.set(res.stuck?.data ?? []);
          this.notes.set(res.notes?.data ?? []);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }
}
