import { Component, DestroyRef, inject, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { ContactsInterface, ContactsService } from '../../contacts.service';
import { userError } from '../../../../../core/http/api-error';
import { UiFeedbackService } from '../../../../../core/ui/ui-feedback.service';
import { MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PartnerInterface, PartnerService } from '../../../../../_common/services/partner.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProspectListInterface } from '../../../prospects/prospects.service';
import { ProspectService } from '../../../prospects/prospects.service';
import { CollectCodeComponent } from '../details/collect-code.component';
import { ProspectResponseComponent } from '../../../mentorship/my-partners/contacts/details/prospect-response.component';
import { SMSService } from '../../../sms/sms.service';

/** @title Prospect details */
@Component({
    selector: 'async-manage-contacts-analytics',
    templateUrl: 'manage-contacts-analytics.component.html',
    styleUrls: ['manage-contacts-analytics.component.scss'],
    imports: [
        MatCheckboxModule,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule, MatButtonModule,
        MatDividerModule, MatListModule, CommonModule, RouterModule, PageSkeletonComponent
    ],
    changeDetection: ChangeDetectionStrategy.Eager,
    providers: [ContactsService, SMSService, ProspectService]
})
export class ManageContactsAnalyticsComponent implements OnInit {

  @Input() prospect!: ContactsInterface;
  prospectData!: any;
  duration!: null | number;
  loadingContact = false;
  loadError: string | null = null;
  sessions: any[] = [];
  loadingSessions = false;

  sms: string;
  emailBody: string;
  emailSubject: string;
  readonly dialog = inject(MatDialog);
  private readonly ui = inject(UiFeedbackService);
  private readonly destroyRef = inject(DestroyRef);
  partner!: PartnerInterface;


  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private contactsService: ContactsService,
    private smsService: SMSService,
    private partnerService: PartnerService,
    private snackBar: MatSnackBar,
    private prospectsService: ProspectService
  ) {
    this.sms = ``; // Default value or nothing 
    this.emailBody = ''; // Default value or nothing 
    this.emailSubject = ''; // Default value or nothing 
  }


  back(): void {
    this.router.navigateByUrl('/dashboard/prospects/pipeline');
  }

  /** Fetch the contact for direct navigation (?id=); input path skips this. */
  loadContact(id: string): void {
    this.loadingContact = true;
    this.loadError = null;
    this.contactsService.getProspectById(id).subscribe({
      next: (res: any) => {
        this.prospectData = res?.data ?? res ?? null;
        if (!this.prospectData?._id) {
          this.prospectData = null;
          this.loadError = 'Contact not found.';
        } else {
          this.loadSessions();
        }
        this.loadingContact = false;
      },
      error: () => {
        this.prospectData = null;
        this.loadError = 'Could not load this contact.';
        this.loadingContact = false;
      },
    });
  }

  /** Sessions booked for this contact's number (matched from own bookings). */
  loadSessions(): void {
    const phone = this.normalizePhone(this.prospectData?.prospectPhone);
    if (!phone || !this.partner?._id) {
      this.sessions = [];
      return;
    }
    this.loadingSessions = true;
    this.prospectsService.getSessionBookingsFor(this.partner._id).subscribe({
      next: (res: any) => {
        const rows: any[] = res?.data ?? (Array.isArray(res) ? res : []);
        this.sessions = rows.filter((b) => this.normalizePhone(b?.phone) === phone);
        this.loadingSessions = false;
      },
      error: () => {
        this.sessions = [];
        this.loadingSessions = false;
      },
    });
  }

  /** Last-10-digits comparison — tolerates 080… vs +234… formats. */
  normalizePhone(phone: any): string {
    const digits = String(phone ?? '').replace(/\D/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
  }


  ngOnInit(): void {
    if (this.prospect) {
      this.prospectData = this.prospect;
      this.loadSessions();
    } else {
      // Routed directly (no @Input) — deep link via ?id=.
      this.route.queryParamMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((params) => {
          const id = params.get('id');
          if (id && !this.prospectData) this.loadContact(id);
        });
    }

    // get current signed in user (shared subject — tracked)
    this.partnerService.getSharedPartnerData$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(
        partnerObject => {
          this.partner = partnerObject as PartnerInterface
          // Partner can arrive after the contact — (re)load sessions then.
          if (this.prospectData?._id) this.loadSessions();
        },
        error => {
          console.log(error)
          // redirect to home page
        }
      )

  }

  deleteProspect() {
    const capitalizeFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
    const name = `${capitalizeFirstLetter(this.prospectData.prospectSurname)} ${capitalizeFirstLetter(this.prospectData.prospectName)}`;

    void this.ui.confirm({
      title: 'Delete prospect?',
      message: `Delete ${name}? This cannot be undone.`,
      tone: 'error',
      confirmText: 'Delete',
    }).then((confirmed) => {
      if (!confirmed) return;
      this.contactsService.deleteProspect(this.prospectData._id).subscribe({
        next: () => {
          void this.ui.alert({
            title: 'Prospect deleted',
            message: `${name} has been removed from your pipeline.`,
            tone: 'success',
          }).then(() => {
            // Legacy manage-contacts list is retired — the pipeline is the own-list home.
            this.router.navigateByUrl('dashboard/prospects/pipeline');
          });
        },
        error: (error: any) => this.ui.error(userError(error)),
      });
    });
  }

  promoteProspectToPartner() {
    const capitalizeFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
    const name = `${capitalizeFirstLetter(this.prospectData.prospectSurname)} ${capitalizeFirstLetter(this.prospectData.prospectName)}`;

    void this.ui.confirm({
      title: 'Promote prospect?',
      message: `Mark ${name} as your partner? This cannot be undone.`,
      tone: 'warning',
      confirmText: 'Promote',
    }).then((confirmed) => {
      if (!confirmed) return;
      this.dialog.open(CollectCodeComponent, {
        data: this.prospectData,
      }).afterClosed().subscribe((res: any) => {
        // Reflect the conversion locally so the page updates
        // without a manual reload; server remains source of truth.
        if (res?.converted && this.prospectData?._id) {
          this.loadContact(this.prospectData._id);
        }
      });
    });
  }

  copyLink() {
    const link = `https://marketspase.com/${this.partner.username}`;
    navigator.clipboard.writeText(link).then(() => {
      this.snackBar.open('Link copied to clipboard!', 'Close', {
        duration: 2000,
      });
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }

  // Session-owned single send (v1/outreach/sms): charge + gateway +
  // record server-side. Retires the legacy charge-then-browser-gateway
  // chain (leaked gateway secret, client-forged records).
  sendSMS() {
    const body = String(this.sms ?? '').trim();
    if (!body) {
      this.ui.info('Write a message first.');
      return;
    }
    this.smsService.sendBulkSMS({ to: [this.prospectData.prospectPhone], body }).subscribe({
      next: (res: any) => {
        this.sms = '';
        const failed = res?.data?.failed?.length;
        const message = res?.message ?? 'SMS sent successfully.';
        failed ? this.ui.warning(message) : this.ui.success(message);
      },
      error: (error: any) => this.ui.error(userError(error)),
    });
  }

  sendEmail() {
    const emailObject = {
      partner: this.partner,
      prospect: this.prospectData,
      emailBody: this.emailBody,
      emailSubject: this.emailSubject
    }
    this.contactsService.sendProspectEmail(emailObject).subscribe({
      next: () => this.ui.success('Email sent successfully.'),
      error: (error) => this.ui.error(userError(error)),
    });
  }

  editProspectDetail() {
    this.router.navigate(['/dashboard/prospects/edit', this.prospectData._id]);
  }

  bookProspectSession() {
    this.router.navigate(['/dashboard/prospects/booking', this.prospectData._id]);
  }

  /** Displayed pipeline stage (legacy free-text on this record). */
  currentStage(): string {
    const s = this.prospectData?.status;
    const name = typeof s === 'string' ? s : (s?.name ?? s?.stage ?? '');
    return name || 'New';
  }

  /** dp-status tone for the current stage. */
  stageTone(): string {
    const s = this.currentStage().toLowerCase();
    if (/partner|member|converted/.test(s)) return 'dp-status dp-status--ok';
    if (/closing|booked|promised|interested/.test(s)) return 'dp-status dp-status--warn';
    if (/nurturing|engaged|contacted|follow|sent|awaiting|thinking/.test(s)) return 'dp-status dp-status--info';
    if (/not interested|disqualified|inactive|archiv|lost|closed/.test(s)) return 'dp-status dp-status--bad';
    return 'dp-status dp-status--neutral';
  }

  /** Merged stage moves + logged touches, newest first. */
  timeline(): Array<{ at: any; label: string; detail: string }> {
    const items: Array<{ at: any; label: string; detail: string }> = [];
    for (const h of this.prospectData?.stageHistory ?? []) {
      items.push({
        at: h?.at ?? null,
        label: `Stage: ${h?.from ?? '—'} → ${h?.to ?? '—'}`,
        detail: h?.byName ? `by ${h.byName}` : '',
      });
    }
    for (const c of this.prospectData?.communications ?? []) {
      items.push({
        at: c?.date ?? null,
        label: `${c?.type ?? 'touch'} — ${c?.description ?? ''}`,
        detail: [c?.interestLevel, c?.outcome].filter(Boolean).join(' Â· '),
      });
    }
    return items.sort((a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime());
  }

  /**
   * Survey answer fields that prove a response was actually given.
   * `country` is deliberately excluded: the survey schema defaults it
   * to 'Nigeria', so a snapshot of `{ socialMedia: [], country: 'Nigeria' }`
   * carries zero answers yet is truthy — exactly the empty-record case.
   */
  private static readonly SURVEY_ANSWER_FIELDS = [
    'ageRange', 'referral', 'referralCode', 'socialMedia',
    'onlinePurchaseSchedule', 'primaryOnlineBusinessMotivation',
    'importanceOfPassiveIncome', 'employedStatus', 'comfortWithTech',
    'onlineBusinessTimeDedication', 'state',
  ];

  /**
   * True only when the embedded survey snapshot holds at least one
   * answer. An empty-but-truthy `{}` (manual/imported contacts) hides
   * the button instead of opening an all-"No record found" dialog.
   */
  hasSurveyResponse(): boolean {
    const s = this.prospectData?.survey;
    if (!s || typeof s !== 'object') return false;
    return ManageContactsAnalyticsComponent.SURVEY_ANSWER_FIELDS.some((f) => {
      const v = (s as Record<string, unknown>)[f];
      if (v === null || v === undefined) return false;
      if (typeof v === 'string') return v.trim().length > 0;
      if (Array.isArray(v)) return v.length > 0;
      return true;
    });
  }

  ViewResponse(prospect: ProspectListInterface) {
    this.dialog.open(ProspectResponseComponent, {
      data: prospect
    });
  }


}
