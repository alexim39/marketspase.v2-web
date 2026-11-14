import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnDestroy, OnInit, ChangeDetectionStrategy, signal, WritableSignal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AbstractControl, FormControl, FormGroup, FormsModule, Validators } from '@angular/forms';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatTableModule } from '@angular/material/table';
import { ReactiveFormsModule } from '@angular/forms';
import { PartnerInterface, PartnerService } from '../../../../_common/services/partner.service';
import { publicLeadPageUrl } from '../../../../core/store/public-links';
import { Subscription } from 'rxjs';
import { MatExpansionModule } from '@angular/material/expansion';
import { ProfileService } from '../../profile/profile.service';
import { UiFeedbackService } from '../../../../core/ui/ui-feedback.service';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { ProfilePictureUploadComponent } from './profile-image.component';
import { DeleteAccountComponent } from './delete-account.component';
import { HelpDialogComponent } from '../../../../_common/help-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Countries, States } from '../../../../_common/services/countries';
import { HttpErrorResponse } from '@angular/common/http';
import { userError } from '../../../../core/http/api-error';
import { MentorHandoffService } from '../../../../core/mentor-handoff/mentor-handoff.service';
import { MentorHandoffPreference } from '../../../../core/mentor-handoff/mentor-handoff.models';

interface MeterItem {
  label: string;
  done: boolean;
  required: boolean;
}

const MAX_PROFILE_TAGS = 10;
const MAX_PROFILE_TAG_LENGTH = 40;

/** Accept legacy strings and arrays; trim, dedupe, cap for the API contract. */
const normalizeProfileTags = (value: unknown): string[] => {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const entry of raw) {
    for (const part of String(entry ?? '').split(',')) {
      const tag = part.replace(/\s+/g, ' ').trim().slice(0, MAX_PROFILE_TAG_LENGTH);
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
      if (tags.length >= MAX_PROFILE_TAGS) return tags;
    }
  }
  return tags;
};

/**
 * @title profile manager — completion-driven account page.
 *
 * Identity header (photo, completion meter, public page) plus three
 * purpose-grouped sections. Required vs optional is explicit everywhere
 * so a member arriving from the onboarding banner always knows the next
 * step. Save flows are unchanged (legacy profile endpoints).
 */
@Component({
selector: 'async-profile-mgr',
templateUrl: 'profile-mgr.component.html',
styles: [`
  .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }

  .identity-hero { position: relative; overflow: hidden; display: flex; align-items: flex-start; gap: 24px; padding: 32px; margin-bottom: 24px; border-radius: var(--ms-radius-2xl); background: linear-gradient(125deg, #121024 0%, #24204b 58%, #3f4bb8 100%); color: #fff; box-shadow: var(--ms-shadow-md); }
  .hero-glow { position: absolute; width: 320px; height: 320px; right: 4%; top: -210px; border-radius: 50%; background: radial-gradient(circle, rgba(129, 140, 248, 0.48), transparent 68%); pointer-events: none; }
  .identity-photo, .identity-main { position: relative; z-index: 1; }
  .identity-photo { flex: none; }
  .identity-avatar, .identity-fallback { width: 88px; height: 88px; border-radius: 50%; object-fit: cover; border: 3px solid rgba(255, 255, 255, 0.24); }
  .identity-fallback { display: grid; place-items: center; background: rgba(255, 255, 255, 0.16); color: #fff; font-family: var(--ms-font-display); font-size: 2rem; font-weight: 700; }
  .identity-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
  .identity-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
  .identity-top .eyebrow { color: rgba(255, 255, 255, 0.62); }
  .identity-top h2 { margin: 4px 0; font-size: clamp(1.6rem, 3vw, 2.1rem); letter-spacing: -0.02em; }
  .identity-handle { margin: 0; color: rgba(255, 255, 255, 0.7); font-size: 0.875rem; overflow-wrap: anywhere; }
  .identity-badges { display: flex; gap: 8px; flex-wrap: wrap; }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.16); color: rgba(255, 255, 255, 0.88); font-size: 0.75rem; font-weight: 600; text-transform: capitalize; }
  .pill mat-icon { font-size: 16px; width: 16px; height: 16px; }
  .pill--ok { background: rgba(74, 222, 128, 0.16); border-color: rgba(74, 222, 128, 0.32); color: #bbf7d0; }
  .pill--warn { background: rgba(250, 204, 21, 0.16); border-color: rgba(250, 204, 21, 0.32); color: #fef08a; }
  .pill--bad { background: rgba(248, 113, 113, 0.16); border-color: rgba(248, 113, 113, 0.32); color: #fecaca; }
  .pill--neutral { color: rgba(255, 255, 255, 0.8); }

  .completion { display: flex; flex-direction: column; gap: 8px; padding: 16px; border-radius: var(--ms-radius-lg); background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.14); }
  .completion-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .completion-value { font-family: var(--ms-font-display); font-size: 1.5rem; font-weight: 700; font-variant-numeric: tabular-nums; }
  .completion-label { flex: 1; min-width: 200px; color: rgba(255, 255, 255, 0.76); font-size: 0.8125rem; }
  .completion-note { color: rgba(255, 255, 255, 0.6); font-size: 0.75rem; font-weight: 600; }
  .meter-bar { height: 6px; border-radius: 999px; background: rgba(255, 255, 255, 0.16); overflow: hidden; }
  .meter-fill { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #818cf8, #4ade80); transition: width 320ms ease; }
  .missing { display: flex; flex-wrap: wrap; gap: 6px; }
  .missing-tag { font-size: 0.6875rem; border: 1px solid rgba(255, 255, 255, 0.24); color: rgba(255, 255, 255, 0.82); border-radius: 999px; padding: 2px 10px; }

  .hero-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .hero-actions a, .hero-actions button { min-height: 40px; }
  .hero-actions mat-icon { margin-right: 6px; }
  .view-count { display: inline-flex; align-items: center; gap: 6px; color: rgba(255, 255, 255, 0.64); font-size: 0.8125rem; }
  .view-count mat-icon { font-size: 16px; width: 16px; height: 16px; }

  .profile-layout { display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.65fr); gap: 24px; align-items: start; }
  .profile-aside { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 96px; }
  .aside-card { padding: 16px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); display: flex; flex-direction: column; gap: 12px; }
  .aside-head h3 { margin: 0 0 2px; font-size: 0.9375rem; }
  .aside-head p { margin: 0; color: var(--ms-text-muted); font-size: 0.8125rem; line-height: 1.5; }
  .fact-list { display: flex; flex-direction: column; gap: 8px; margin: 0; }
  .fact-list div { display: flex; justify-content: space-between; gap: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--ms-line); }
  .fact-list div:last-child { padding-bottom: 0; border-bottom: 0; }
  .fact-list dt { color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; }
  .fact-list dd { margin: 0; font-size: 0.8125rem; text-align: right; overflow-wrap: anywhere; }
  .public-url { color: var(--ms-primary-strong); font-size: 0.8125rem; overflow-wrap: anywhere; }
  .aside-card button { min-height: 40px; }
  .aside-card button mat-icon { margin-right: 6px; }

  .profile-main mat-expansion-panel { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg) !important; box-shadow: none; }
  .profile-main mat-expansion-panel + mat-expansion-panel { margin-top: 12px; }
  .profile-main mat-expansion-panel.mat-expanded { border-color: var(--ms-primary); }
  .panel-icon { display: inline-grid; place-items: center; width: 32px; height: 32px; margin-right: 8px; border-radius: var(--ms-radius-md); background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
  .panel-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
  .panel-body { display: flex; flex-direction: column; gap: 16px; padding-top: 8px; }
  .flex-form { display: flex; flex-wrap: wrap; gap: 16px; }
  .form-group { flex: 1 1 calc(50% - 16px); min-width: 220px; display: flex; flex-direction: column; }
  .form-ungroup { flex: 1 1 100%; display: flex; flex-direction: column; }
  .form-group mat-form-field, .form-ungroup mat-form-field { width: 100%; }
  .tag-field { width: 100%; }
  .tag-field mat-chip-grid { width: 100%; }
  .tag-field input { min-width: 100px; }
  .form-actions { flex: 1 1 100%; display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid var(--ms-line); padding-top: 16px; }
  .form-actions button { min-height: 44px; }
  .divider { height: 1px; background: var(--ms-line); }

  .address-section { flex: 1 1 100%; padding: 16px; background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); }
  .address-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
  .address-head mat-icon { color: var(--ms-primary-strong); }
  .address-head h4 { margin: 0 0 2px; font-size: 0.9375rem; }
  .address-note { margin: 0; color: var(--ms-text-muted); font-size: 0.8125rem; line-height: 1.5; }
  .address-container { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; }

  .muted { color: var(--ms-text-muted); font-size: 0.8125rem; }
  .mentor-note { margin: 0; color: var(--ms-text-muted); font-size: 0.875rem; line-height: 1.6; }
  .mentor-options { display: grid; gap: 8px; }
  .mentor-options mat-radio-button { padding: 12px 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); }
  .mentor-options mat-radio-button.mat-mdc-radio-checked { border-color: var(--ms-primary); background: var(--ms-primary-soft); }
  .radio-copy { display: inline-flex; flex-direction: column; gap: 1px; margin-left: 4px; vertical-align: middle; }
  .radio-copy strong { font-size: 0.875rem; font-weight: 600; }
  .radio-copy small { color: var(--ms-text-muted); font-size: 0.75rem; }
  .public-link { margin: 0 0 4px; color: var(--ms-text-muted); overflow-wrap: anywhere; }
  .public-link a { color: var(--ms-primary-strong); }
  .section-badge { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; border-radius: 999px; padding: 2px 10px; margin-left: 8px; vertical-align: middle; }
  .section-badge--required { background: var(--ms-warning-soft); color: var(--ms-warning); }
  .section-badge--optional { background: var(--ms-canvas); border: 1px solid var(--ms-line); color: var(--ms-text-muted); }
  html[data-theme="dark"] .section-badge--required { color: #fcd34d; }

  @media (max-width: 1000px) {
    .profile-layout { grid-template-columns: minmax(0, 1fr); }
    .profile-aside { position: static; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .profile-aside .aside-card:first-child { grid-column: 1 / -1; }
  }
  @media (max-width: 720px) {
    .identity-hero { flex-direction: column; padding: 24px; gap: 16px; }
    .identity-photo { align-self: flex-start; }
    .identity-avatar, .identity-fallback { width: 72px; height: 72px; }
    .profile-aside { grid-template-columns: minmax(0, 1fr); }
    .profile-aside .aside-card:first-child { grid-column: auto; }
    .address-container { grid-template-columns: minmax(0, 1fr); }
    .form-group { flex: 1 1 100%; min-width: 0; }
    .form-actions { justify-content: stretch; }
    .form-actions button { flex: 1; }
    mat-panel-description { display: none; }
  }
`],
providers: [provideNativeDateAdapter(), ProfileService],
changeDetection: ChangeDetectionStrategy.OnPush,
imports: [FormsModule, CommonModule, MatDatepickerModule, MatExpansionModule, MatProgressBarModule,
    ReactiveFormsModule, MatButtonToggleModule, MatCheckboxModule, MatChipsModule, MatFormFieldModule, MatRadioModule, MatSelectModule, MatTableModule, MatInputModule, MatIconModule, MatButtonModule, MatSnackBarModule, ProfilePictureUploadComponent, DeleteAccountComponent, RouterModule
]
})
export class ProfileMgrComponent implements OnInit, OnDestroy {
  readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly ui = inject(UiFeedbackService);
  private readonly mentorHandoffs = inject(MentorHandoffService);
  @Input() partner!: PartnerInterface;

  protected readonly profile = signal<PartnerInterface | null>(null);
  protected readonly mentorBusy = signal(false);

  profileMgrForm!: FormGroup;
  usernameForm!: FormGroup;
  passwordForm!: FormGroup;
  professionalForm!: FormGroup;
  mentorForm!: FormGroup;
  hideCurrent = signal(true);
  hideNew = signal(true);
  protected readonly hobbyTags = signal<string[]>([]);
  protected readonly skillTags = signal<string[]>([]);
  protected readonly chipSeparatorKeys = [ENTER, COMMA];
  protected readonly maxProfileTags = MAX_PROFILE_TAGS;

  subscriptions: Array<Subscription> = [];

  minDate!: Date;

  countries: string[] = Countries;
  states: string[] = States;
  isNigeria = true; // Tracks whether the selected country is Nigeria

  constructor(
    private profileService: ProfileService,
    private partnerService: PartnerService,
  ) { }


  onHideCurrent(event: MouseEvent) {
    this.hideCurrent.set(!this.hideCurrent());
    event.stopPropagation();
  }

  onHideNew(event: MouseEvent) {
    this.hideNew.set(!this.hideNew());
    event.stopPropagation();
  }

  ngOnInit() {
    // Set the minimum date to today
    this.minDate = new Date();
    this.profile.set(this.partner ?? null);

    if (this.partner) {
      this.isNigeria = (this.partner?.address?.country ?? 'Nigeria') === 'Nigeria';
      const hobbies = normalizeProfileTags(this.partner.hobby);
      const skills = normalizeProfileTags(this.partner.skill);
      this.hobbyTags.set(hobbies);
      this.skillTags.set(skills);
      this.profileMgrForm = new FormGroup({
        name: new FormControl(this.partner.name, Validators.required),
        surname: new FormControl(this.partner.surname, Validators.required),
        address: new FormGroup({
          street: new FormControl(this.partner?.address?.street, Validators.required),
          city: new FormControl(this.partner?.address?.city, Validators.required),
          state: new FormControl(this.partner?.address?.state, Validators.required),
          country: new FormControl(this.partner?.address?.country, Validators.required),
        }),
        email: new FormControl(this.partner.email, [Validators.required, Validators.email]),
        phone: new FormControl(this.partner.phone, [Validators.required, Validators.pattern(/^[0-9+\s()-]{7,20}$/)]),
        dobDatePicker: new FormControl(this.partner.dobDatePicker),
        bio: new FormControl(this.partner.bio ?? ''),
        id: new FormControl(this.partner._id),
      });
      this.usernameForm = new FormGroup({
        username: new FormControl(this.partner.username, Validators.required),
        id: new FormControl(this.partner._id),
      });
      this.passwordForm = new FormGroup({
        currentPassword: new FormControl('', [Validators.required, Validators.minLength(8)]),
        newPassword: new FormControl('', [Validators.required, Validators.minLength(8)]),
        id: new FormControl(this.partner._id),
      });
      this.professionalForm = new FormGroup({
        jobTitle: new FormControl(this.partner.jobTitle, [Validators.required]),
        educationBackground: new FormControl(this.partner.educationBackground, [Validators.required]),
        hobby: new FormControl(hobbies, [Validators.required]),
        skill: new FormControl(skills, [Validators.required]),
        id: new FormControl(this.partner._id),
      });
      this.mentorForm = new FormGroup({
        preference: new FormControl<MentorHandoffPreference>(
          this.partner.mentorContactPreference ?? 'in_app',
        ),
        consent: new FormControl(!!this.partner.mentorContactConsentAt),
      });
    }
  }

  protected requiresMentorConsent(): boolean {
    return ['email', 'whatsapp', 'phone'].includes(this.mentorForm.value.preference);
  }

  protected onMentorPreferenceSubmit(): void {
    if (!this.mentorForm || this.mentorBusy()) return;
    const { preference, consent } = this.mentorForm.value as {
      preference: MentorHandoffPreference;
      consent: boolean;
    };
    if (this.requiresMentorConsent() && !consent) {
      this.ui.error('Agree to share your chosen contact channel with your mentor.');
      return;
    }
    this.mentorBusy.set(true);
    this.subscriptions.push(
      this.mentorHandoffs.updatePreference(preference, !!consent).subscribe({
        next: () => {
          this.mentorBusy.set(false);
          this.refreshShared({
            mentorContactPreference: preference,
            mentorContactConsentAt: this.requiresMentorConsent() ? new Date().toISOString() : null,
          });
          this.ui.success('Mentor contact preference saved.');
        },
        error: (error: HttpErrorResponse) => {
          this.mentorBusy.set(false);
          this.ui.error(userError(error));
        },
      }),
    );
  }

  protected get hobbyControl(): FormControl<string[]> {
    return this.professionalForm.get('hobby') as FormControl<string[]>;
  }

  protected get skillControl(): FormControl<string[]> {
    return this.professionalForm.get('skill') as FormControl<string[]>;
  }

  protected addHobby(event: MatChipInputEvent): void {
    this.addProfileTag(event, this.hobbyTags, this.hobbyControl);
  }

  protected removeHobby(tag: string): void {
    this.removeProfileTag(tag, this.hobbyTags, this.hobbyControl);
  }

  protected addSkill(event: MatChipInputEvent): void {
    this.addProfileTag(event, this.skillTags, this.skillControl);
  }

  protected removeSkill(tag: string): void {
    this.removeProfileTag(tag, this.skillTags, this.skillControl);
  }

  private addProfileTag(event: MatChipInputEvent, target: WritableSignal<string[]>, control: AbstractControl | null): void {
    const values = normalizeProfileTags(event.value);
    event.chipInput?.clear();
    if (values.length === 0) return;
    const next = [...target()];
    for (const value of values) {
      if (next.length >= MAX_PROFILE_TAGS) break;
      if (next.some((tag) => tag.toLowerCase() === value.toLowerCase())) continue;
      next.push(value);
    }
    target.set(next);
    control?.setValue(next);
    control?.markAsTouched();
  }

  private removeProfileTag(tag: string, target: WritableSignal<string[]>, control: AbstractControl | null): void {
    const next = target().filter((item) => item !== tag);
    target.set(next);
    control?.setValue(next);
    control?.markAsTouched();
  }

  /** Completion meter — required gates onboarding, recommended polishes it. */
  protected meter(): { percent: number; missing: string[]; complete: boolean } {
    const p = this.profile();
    const filled = (v: unknown): boolean => String(v ?? '').trim().length > 0;
    const items: MeterItem[] = [
      { label: 'Phone number', done: filled(p?.phone), required: true },
      { label: 'Street', done: filled(p?.address?.street), required: true },
      { label: 'City', done: filled(p?.address?.city), required: true },
      { label: 'State', done: filled(p?.address?.state), required: true },
      { label: 'Profile photo', done: filled(p?.profileImage), required: false },
      { label: 'Short bio', done: filled(p?.bio), required: false },
      { label: 'Date of birth', done: filled(p?.dobDatePicker), required: false },
    ];
    const done = items.filter((i) => i.done).length;
    const missingRequired = items.filter((i) => i.required && !i.done).map((i) => i.label);
    const missingRecommended = items.filter((i) => !i.required && !i.done).map((i) => i.label);
    return {
      percent: Math.round((done / items.length) * 100),
      missing: [...missingRequired, ...missingRecommended],
      complete: missingRequired.length === 0,
    };
  }

  protected initial(): string {
    const p = this.profile();
    const name = `${p?.name ?? ''} ${p?.surname ?? ''}`.trim();
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  protected kycLabel(status?: string): string {
    switch (status) {
      case 'verified': return 'Verified';
      case 'pending': return 'Under review';
      case 'rejected': return 'Rejected';
      default: return 'Not started';
    }
  }

  protected publicPageUrl(): string | null {
    const username = String(this.profile()?.username ?? '').trim();
    return username ? publicLeadPageUrl(username.toLowerCase()) : null;
  }

  /** Copy the public page link — same flow as the landing-page editor. */
  protected copyPublicLink(): void {
    const url = this.publicPageUrl();
    if (!url) return;
    const done = () => this.snack.open('Personal lead page link copied - share it anywhere', 'OK', { duration: 3000 });
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, done);
    else done();
  }

  protected onPhotoUploaded(url: string): void {
    const current = this.profile();
    if (!current) return;
    const updated = { ...current, profileImage: url };
    this.profile.set(updated);
    this.partnerService.updatePartnerService(updated);
  }

  private refreshShared(patch: Partial<PartnerInterface>): void {
    const current = this.profile();
    if (!current) return;
    const updated = { ...current, ...patch };
    this.profile.set(updated);
    this.partnerService.updatePartnerService(updated);
  }

  onProfileSubmit() {
    const profileObject = this.profileMgrForm.value;


    this.subscriptions.push(
      this.profileService.profileUpdate(profileObject).subscribe( {

        next: (response) => {
          this.refreshShared({
            name: profileObject.name,
            surname: profileObject.surname,
            email: profileObject.email,
            phone: profileObject.phone,
            bio: profileObject.bio,
            dobDatePicker: profileObject.dobDatePicker,
            address: profileObject.address,
          });
          this.ui.success(response.message || 'Profile updated. Your public page and team view now show the latest details.');
        },
        error: (error: HttpErrorResponse) => {
          this.ui.error(userError(error));
        }
      })
    )
  }

  onProfessionalSubmit() {
    const professionalForm = this.professionalForm.value;


    this.subscriptions.push(
      this.profileService.professionUpdate(professionalForm).subscribe( {

        next: (response) => {
          this.refreshShared({
            jobTitle: professionalForm.jobTitle,
            educationBackground: professionalForm.educationBackground,
            hobby: professionalForm.hobby,
            skill: professionalForm.skill,
          });
          this.ui.success(response.message || 'Profile updated. Your public page and team view now show the latest details.');
        },
        error: (error: HttpErrorResponse) => {
          this.ui.error(userError(error));
        }
      })
    )
  }

  onUsernameSubmit() {
    const usernameObject = this.usernameForm.value;


    this.subscriptions.push(
      this.profileService.usernameUpdate(usernameObject).subscribe( {

        next: (response) => {
          this.refreshShared({ username: usernameObject.username });
          this.ui.success(response.message || 'Profile updated. Your public page and team view now show the latest details.');
        },
        error: (error: HttpErrorResponse) => {
          this.ui.error(userError(error));
        }
      })
    )
  }

  onPasswordSubmit() {
    const passwordObject = this.passwordForm.value;


    this.subscriptions.push(
      this.profileService.changePassword(passwordObject).subscribe( {

        next: (response) => {
          this.ui.success(response.message || 'Profile updated. Your public page and team view now show the latest details.');
        },
        error: (error: HttpErrorResponse) => {
          this.ui.error(userError(error));
        }
      })
    )
  }

  showDescription () {
    this.dialog.open(HelpDialogComponent, {
      data: {help: `
        Make sure your username, which is part of your unique link, is meaningful and easy to remember.
        For example, in store.marketspase.com/lead/business, "business" is a meaninful and easy to remember username.

        <p>Other examples of good unique link:
          <ul>
            <li>store.marketspase.com/lead/join</li>
            <li>store.marketspase.com/lead/connect</li>
            <li>store.marketspase.com/lead/link</li>
            <li>store.marketspase.com/lead/grow</li>
          </ul>
        </p>

        <p>
          Such links can enhance and boost engagement when link is shared
        </p>
      `},
    });
  }

  ngOnDestroy() {
    // unsubscribe list
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  onCountryChange(selectedCountry: string): void {
    this.isNigeria = selectedCountry === 'Nigeria';

    // Reset the state field when the country changes
    this.profileMgrForm.get('address.state')?.reset();

    // Update validation for the state field
    if (this.isNigeria) {
      this.profileMgrForm.get('address.state')?.setValidators([Validators.required]);
    } else {
      this.profileMgrForm.get('address.state')?.setValidators([Validators.required, Validators.minLength(2)]);
    }
    this.profileMgrForm.get('address.state')?.updateValueAndValidity();
  }

}
