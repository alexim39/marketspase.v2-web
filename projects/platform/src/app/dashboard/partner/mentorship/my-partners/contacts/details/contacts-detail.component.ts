import { Component, DestroyRef, inject, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ContactsInterface, ContactsService, CONTACT_STATUSES, daysSince, isArchivedLabel, isConvertedLabel } from '../contacts.service';
import { UiFeedbackService } from '../../../../../../core/ui/ui-feedback.service';
import { MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PartnerInterface, PartnerService } from '../../../../../../_common/services/partner.service';
import { AuthService } from '../../../../../../core/auth/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SMSService } from '../../../../sms/sms.service';
import { userError } from '../../../../../../core/http/api-error';
import { ProspectListInterface } from '../../../../prospects/prospects.service';
import { ProspectResponseComponent } from './prospect-response.component';

interface TouchEntry {
  at: string;
  icon: string;
  title: string;
  detail?: string;
  by?: string;
}

/** Questionnaire fields the answers dialog renders — location/attribution excluded (see hasSurvey). */
const SURVEY_ANSWER_KEYS = [
  'ageRange', 'socialMedia', 'employedStatus', 'importanceOfPassiveIncome',
  'onlinePurchaseSchedule', 'primaryOnlineBusinessMotivation', 'comfortWithTech',
  'onlineBusinessTimeDedication', 'referral', 'referralCode',
];

/** @title Prospect details — the one-visit coaching cockpit. */
@Component({
    selector: 'async-my-partner-contacts-detail',
    templateUrl: 'contacts-detail.component.html',
    styleUrls: ['contacts-detail.component.scss'],
    providers: [ContactsService, SMSService],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        MatFormFieldModule,
        MatSelectModule,
        MatInputModule,
        MatDatepickerModule, MatNativeDateModule,
        MatIconModule, MatButtonModule,
        CommonModule, RouterModule, MatTooltipModule,
    ]
})
export class MyPartnerContactsDetailComponent implements OnInit {

  @Input() prospect!: ContactsInterface | null;
  @Input() myPartner!: PartnerInterface | null;
  /** Downline owner id (?from=) — Back returns to their contact list when present. */
  @Input() fromOwnerId: string | null = null;
  prospectData!: any;

  readonly statuses = CONTACT_STATUSES;
  /** Follow-ups live in the future — the picker won't offer past dates. */
  readonly minFollowUp: Date = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  selectedStatus = '';
  followUpDate: Date | null = null;
  remark = '';
  sms = '';
  emailBody = '';
  emailSubject = '';
  outreachTab: 'email' | 'sms' = 'email';
  savingStage = false;
  savingNote = false;
  sendingSms = false;
  sendingEmail = false;
  /** Touches logged this session (SMS/email just sent) — merged into the timeline. */
  private readonly sessionTouches: TouchEntry[] = [];

  readonly dialog = inject(MatDialog);
  private readonly ui = inject(UiFeedbackService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

  constructor(
    private router: Router,
    private location: Location,
    private route: ActivatedRoute,
    private contactsService: ContactsService,
    private partnerService: PartnerService,
    private snackBar: MatSnackBar,
    private smsService: SMSService,
  ) {}

  partner: PartnerInterface | null = null;

  back(): void {
    const from = String(this.fromOwnerId ?? '').trim();
    if (from) {
      this.router.navigate(['/dashboard/mentorship/partners/my-partners/contacts', from]).catch(() => undefined);
    } else if (this.myPartner?._id) {
      this.goToMyPartner();
    } else {
      this.location.back();
    }
  }

  goToMyPartner(): void {
    if (this.myPartner?._id) this.router.navigate(['/dashboard/mentorship/partners/my-partners/detail', this.myPartner._id]);
  }

  fullName(): string {
    return `${this.prospectData?.prospectName ?? ''} ${this.prospectData?.prospectSurname ?? ''}`.trim() || 'Prospect';
  }

  initials(): string {
    const n = this.fullName().split(/\s+/).filter(Boolean);
    if (!n.length || this.fullName() === 'Prospect') return '?';
    return (n[0][0] + (n.length > 1 ? n[n.length - 1][0] : '')).toUpperCase();
  }

  statusLabel(): string {
    const s: unknown = this.prospectData?.status;
    if (s && typeof s === 'object') {
      const o = s as { name?: unknown; stage?: unknown };
      const v = o.name ?? o.stage;
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    if (typeof s === 'string' && s.trim()) return s.trim();
    return 'New Prospect';
  }

  statusTone(): string {
    const label = this.statusLabel().toLowerCase();
    if (/partner|converted|member/.test(label)) return 'dp-status--ok';
    if (/closing|booked|interested|promised/.test(label)) return 'dp-status--warn';
    if (/nurturing|engaged|contacted|follow|sent|awaiting|thinking/.test(label)) return 'dp-status--info';
    if (/not interested|disqualified|inactive|archiv|lost|closed/.test(label)) return 'dp-status--bad';
    return 'dp-status--neutral';
  }

  /** Owner-only gate: prospect.partnerId vs session user. Upline sees support mode. */
  isOwner(): boolean {
    const owner = (this.prospectData as { partnerId?: unknown } | undefined)?.partnerId;
    const me = this.auth.currentUser()?.id;
    return !!owner && !!me && String(owner) === String(me);
  }

  /**
   * PII gate (same fail-closed rule as the dossier + contact list): the
   * owner always sees their own prospect; anyone else needs a direct
   * upline link or admin. Display-only — session-owned sends stay allowed.
   */
  canViewContact(): boolean {
    if (this.isOwner()) return true;
    const me = this.partner?._id ? String(this.partner._id) : '';
    const mine = this.myPartner?._id ? String(this.myPartner._id) : '';
    if (!me || !mine) return false;
    if (String(this.partner?.role ?? '').toLowerCase() === 'admin') return true;
    const raw = (this.myPartner as unknown as { partnerOf?: unknown })?.partnerOf;
    const upline = raw != null && typeof raw === 'object'
      ? String((raw as { _id?: unknown })._id ?? '')
      : String(raw ?? '');
    return !!upline && upline === me;
  }

  phoneDisplay(): string {
    if (!this.canViewContact() || this.prospectData?.phoneHiddenReason === 'not-direct') return 'Hidden';
    if (this.prospectData?.phoneHiddenReason === 'no-consent') return 'No consent';
    return this.prospectData?.prospectPhone || '—';
  }

  emailDisplay(): string {
    if (!this.canViewContact() || this.prospectData?.emailHiddenReason === 'not-direct') return 'Hidden';
    if (this.prospectData?.emailHiddenReason === 'no-consent') return 'No consent';
    return this.prospectData?.prospectEmail || '—';
  }

  isAdmin(): boolean {
    return String(this.partner?.role ?? '').toLowerCase() === 'admin';
  }

  /** Stage moves, notes and deletes need owner or admin (mirrors the API guards). */
  canManage(): boolean {
    return this.isOwner() || this.isAdmin();
  }

  /** Days since last touch — drives the stale nudge. */
  daysStale(): number {
    return daysSince(this.prospectData?.updatedAt ?? this.prospectData?.createdAt);
  }

  showNudge(): boolean {
    if (this.daysStale() < 7) return false;
    const label = this.statusLabel().toLowerCase();
    return !isConvertedLabel(label) && !isArchivedLabel(label);
  }

  /** Survey exists AND has at least one substantive answer — hides button for manual contacts. */
  hasSurvey(): boolean {
    const s = this.prospectData?.survey as Record<string, unknown> | undefined;
    if (!s || typeof s !== 'object') return false;
    // Only real questionnaire answers count: country/state carry schema
    // defaults and referral attribution, so a bare { country: 'Nigeria' }
    // (present on contacts that never took the survey) must not qualify.
    return SURVEY_ANSWER_KEYS.some((key) => {
      const v = s[key];
      if (Array.isArray(v)) return v.length > 0;
      return String(v ?? '').trim() !== '';
    });
  }

  /** Stage moves + logged touches + this session's sends, newest first. */
  timeline(): TouchEntry[] {
    const out: TouchEntry[] = [];
    const doc = (this.prospectData ?? {}) as {
      stageHistory?: Array<{ from?: unknown; to?: unknown; at?: unknown; by?: unknown; byName?: unknown }>;
      communications?: Array<{
        date?: unknown; createdAt?: unknown; type?: unknown; description?: unknown;
        outcome?: unknown; followUpAction?: unknown; followUpDate?: unknown;
        createdBy?: unknown; createdByName?: unknown;
      }>;
    };
    for (const h of doc.stageHistory ?? []) {
      out.push({
        at: String(h.at ?? ''),
        icon: 'swap_horiz',
        title: `${String(h.from ?? '—')} → ${String(h.to ?? '—')}`,
        by: h.byName != null && String(h.byName).trim() ? String(h.byName) : (h.by != null ? String(h.by) : undefined),
      });
    }
    for (const c of doc.communications ?? []) {
      const type = String(c.type ?? '').toLowerCase();
      const detail = [
        c.outcome ? `Outcome: ${String(c.outcome)}` : '',
        c.followUpDate ? `Callback: ${String(c.followUpDate).slice(0, 10)}` : '',
      ].filter(Boolean).join(' · ');
      out.push({
        at: String(c.date ?? c.createdAt ?? ''),
        icon: type === 'call' ? 'call' : type === 'email' ? 'mail' : type === 'zoom' ? 'videocam' : type === 'whatsapp' ? 'chat' : type === 'text' ? 'sms' : 'forum',
        title: String(c.description ?? type ?? 'Touch'),
        ...(detail ? { detail } : {}),
        by: c.createdByName != null && String(c.createdByName).trim() ? String(c.createdByName) : (c.createdBy != null ? String(c.createdBy) : undefined),
      });
    }
    out.push(...this.sessionTouches);
    const time = (v: string): number => {
      const t = new Date(v).getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    return out.sort((a, b) => time(b.at) - time(a.at));
  }

  ngOnInit(): void {
    if (this.prospect?.data) {
      this.prospectData = this.prospect.data;
    }

    // get current signed in user
    this.partnerService.getSharedPartnerData$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (partnerObject) => {
          this.partner = partnerObject as PartnerInterface;
        },
      });
  }

  updateProspectStatus(): void {
    const name = this.selectedStatus.trim();
    if (!name) {
      this.snackBar.open('Select a stage before updating.', 'Close', { duration: 3500 });
      return;
    }
    // Object shape — the endpoint replaces the status subdoc from { name,
    // note?, ... }; a bare string would destructure to undefined and persist
    // nothing (only updatedAt would move).
    const status: { name: string; expectedDecisionDate?: string | Date } = { name };
    if (this.followUpDate) status.expectedDecisionDate = this.followUpDate;
    const obj = { prospectId: this.prospectData._id, status };
    this.savingStage = true;
    this.contactsService.updateProspectStatus(obj)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const prev = (this.prospectData?.status && typeof this.prospectData.status === 'object')
            ? this.prospectData.status as Record<string, unknown> : {};
          this.prospectData = {
            ...this.prospectData,
            status: { ...prev, name, updatedAt: new Date().toISOString() },
          };
          this.sessionTouches.unshift({
            at: new Date().toISOString(), icon: 'swap_horiz',
            title: `Moved to ${name}`, by: 'you',
          });
          this.selectedStatus = '';
          this.followUpDate = null;
          this.savingStage = false;
          this.snackBar.open(`Stage updated to ${name}.`, 'Close', { duration: 3500 });
        },
        error: (error: unknown) => {
          this.savingStage = false;
          this.snackBar.open(userError(error) || 'Stage update failed — try again.', 'Close', { duration: 4000 });
        },
      });
  }

  updateProspectRemark(): void {
    const text = this.remark.trim();
    if (!text) {
      this.snackBar.open('Write a coaching note before saving.', 'Close', { duration: 3500 });
      return;
    }
    const obj = { remark: text, prospectId: this.prospectData._id };
    this.savingNote = true;
    this.contactsService.updateProspectRemark(obj)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.prospectData = { ...this.prospectData, notes: text };
          this.sessionTouches.unshift({
            at: new Date().toISOString(), icon: 'note',
            title: text.length > 80 ? `${text.slice(0, 80)}…` : text, by: 'you',
          });
          this.remark = '';
          this.savingNote = false;
          this.snackBar.open('Coaching note saved.', 'Close', { duration: 3500 });
        },
        error: (error: unknown) => {
          this.savingNote = false;
          this.snackBar.open(userError(error) || 'Note save failed — try again.', 'Close', { duration: 4000 });
        },
      });
  }

  /** Null-safe capitalized name part — prospect records often lack a surname. */
  private capName(value: unknown): string {
    const s = String(value ?? '').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  deleteProspect(): void {
    if (!this.canManage()) {
      this.snackBar.open('Only the prospect owner can delete — ask your downline to remove it.', 'Close', { duration: 4000 });
      return;
    }


    void this.ui.confirm({
      title: 'Delete prospect?',
      message: `Delete ${this.capName(this.prospectData.prospectSurname)} ${this.capName(this.prospectData.prospectName)}? This cannot be undone.`,
      tone: 'error',
      confirmText: 'Delete',
    }).then((confirmed) => {
      if (!confirmed) return;
      this.contactsService.deleteProspect(this.prospectData._id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.snackBar.open(
              `Deleted ${this.capName(this.prospectData.prospectSurname)} ${this.capName(this.prospectData.prospectName)}.`,
              'Close', { duration: 4000 });
            // The legacy manage-contacts route is retired — land back on
            // the owner's rebuilt contact list (dossier as fallback).
            const from = String(this.fromOwnerId ?? '').trim();
            if (from) {
              this.router.navigate(['/dashboard/mentorship/partners/my-partners/contacts', from]).catch(() => undefined);
            } else if (this.myPartner?._id) {
              this.goToMyPartner();
            } else {
              this.back();
            }
          },
          error: (error: unknown) => {
            this.snackBar.open(userError(error) || 'Delete failed — try again.', 'Close', { duration: 4000 });
          },
        });
    });
  }

  /** Open the deck library primed for this prospect (outcome logs with support attribution). */
  previewPresent(): void {
    const prospectId = String(this.prospectData?._id ?? '').trim();
    if (!prospectId) return;
    const owner = String(
      (this.prospectData as { partnerId?: unknown })?.partnerId
        ?? this.myPartner?._id ?? '',
    ).trim();
    this.router.navigate(['/dashboard/prospects/kits'], {
      queryParams: {
        for: prospectId,
        forName: this.fullName(),
        ...(owner ? { owner } : {}),
      },
    }).catch(() => undefined);
  }

  copyLink(): void {
    const link = `https://marketspase.com/lead/${String(this.partner?.username ?? '').toLowerCase()}`;
    navigator.clipboard.writeText(link).then(() => {
      this.snackBar.open('Link copied to clipboard!', 'Close', {
        duration: 2000,
      });
    }).catch(() => {
      this.snackBar.open('Could not copy — long-press the link instead.', 'Close', {
        duration: 4000,
      });
    });
  }

  // Session-owned single send (v1/outreach/sms): charge + gateway +
  // record server-side. Retires the legacy charge-then-browser-gateway
  // chain (leaked gateway secret, client-forged records).
  sendSMS(): void {
    const body = String(this.sms ?? '').trim();
    if (!body) {
      this.snackBar.open('Write a message first.', 'Close', { duration: 3500 });
      return;
    }
    if (!this.prospectData?.prospectPhone) {
      this.snackBar.open('No consented phone number for this contact.', 'Close', { duration: 4000 });
      return;
    }
    this.sendingSms = true;
    this.smsService.sendBulkSMS({ to: [this.prospectData.prospectPhone], body })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.sms = '';
          this.sendingSms = false;
          this.sessionTouches.unshift({
            at: new Date().toISOString(), icon: 'sms',
            title: `SMS sent (${body.length} chars)`, by: 'you',
          });
          this.snackBar.open(res?.message ?? 'SMS sent successfully', 'Close', { duration: 4000 });
        },
        error: (error: unknown) => {
          this.sendingSms = false;
          this.snackBar.open(userError(error) || 'SMS failed — try again.', 'Close', { duration: 4000 });
        },
      });
  }

  sendEmail(): void {
    const emailObject = {
      partner: this.partner,
      prospect: this.prospectData,
      emailBody: this.emailBody,
      emailSubject: this.emailSubject
    };
    if (!String(this.emailSubject ?? '').trim() || !String(this.emailBody ?? '').trim()) {
      this.snackBar.open('Subject and body are both required.', 'Close', { duration: 3500 });
      return;
    }
    if (!this.prospectData?.prospectEmail) {
      this.snackBar.open('No consented email address for this contact.', 'Close', { duration: 4000 });
      return;
    }
    this.sendingEmail = true;
    this.contactsService.sendProspectEmail(emailObject)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const subject = String(this.emailSubject).trim();
          this.emailBody = '';
          this.emailSubject = '';
          this.sendingEmail = false;
          this.sessionTouches.unshift({
            at: new Date().toISOString(), icon: 'mail',
            title: `Email sent — ${subject.length > 60 ? `${subject.slice(0, 60)}…` : subject}`, by: 'you',
          });
          this.snackBar.open('Email sent successfully', 'Close', { duration: 4000 });
        },
        error: (error: unknown) => {
          this.sendingEmail = false;
          this.snackBar.open(userError(error) || 'Email failed — try again.', 'Close', { duration: 4000 });
        },
      });
  }

  editProspectDetail(): void {
    if (!this.canManage()) {
      this.snackBar.open('Only the prospect owner can edit contact details. Ask your downline to update it.', 'Close', { duration: 4000 });
      return;
    }
    this.router.navigate(['/dashboard/prospects/edit', this.prospectData._id]);
  }

  bookProspectSession(): void {
    this.router.navigate(['/dashboard/prospects/booking', this.prospectData._id]);
  }

  ViewResponse(prospect: ProspectListInterface): void {
    if (!this.hasSurvey()) return;
    this.dialog.open(ProspectResponseComponent, {
      data: prospect
    });
  }
}
