import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnDestroy, OnInit, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormControl, FormGroup, FormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { ReactiveFormsModule } from '@angular/forms';
import { PartnerInterface, PartnerService } from '../../../../_common/services/partner.service';
import { environment } from '../../../../../environments/environment';
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

interface MeterItem {
  label: string;
  done: boolean;
  required: boolean;
}

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
  .identity-card { display: flex; gap: 1em; align-items: center; flex-wrap: wrap; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 12px; padding: 1em; margin-bottom: 1em; }
  .identity-avatar { width: 4.5em; height: 4.5em; border-radius: 50%; object-fit: cover; border: 2px solid var(--ms-primary); flex: none; }
  .identity-fallback { width: 4.5em; height: 4.5em; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.8em; font-weight: 800; color: var(--ms-ink-text); background: var(--ms-ink); flex: none; }
  .identity-main { flex: 1 1 12em; min-width: 0; }
  .identity-main h3 { margin: 0; }
  .identity-main p { margin: 0.15em 0 0; }
  .identity-main a { color: var(--ms-primary-strong); word-break: break-all; }
  .verification-line { display: flex; align-items: center; gap: 0.35em; flex-wrap: wrap; margin: 0.35em 0 0; }
  .verification-line mat-icon { font-size: 1.1em; width: 1.1em; height: 1.1em; }
  .verification-line a { min-height: 36px; }
  .meter { margin-top: 0.5em; }
  .meter-top { display: flex; justify-content: space-between; font-size: 0.85em; margin-bottom: 0.3em; }
  .meter-bar { height: 8px; border-radius: 999px; background: var(--ms-line); overflow: hidden; }
  .meter-fill { display: block; height: 100%; background: var(--ms-primary); transition: width 0.3s ease; }
  .missing { display: flex; flex-wrap: wrap; gap: 0.35em; margin-top: 0.5em; }
  .missing-tag { font-size: 0.78em; border: 1px solid var(--ms-primary); color: var(--ms-primary-strong); border-radius: 999px; padding: 0.15em 0.7em; }
  .photo-wrap { flex: 1 1 100%; }
  .section-badge { font-size: 0.72em; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; border-radius: 999px; padding: 0.2em 0.7em; margin-left: 0.6em; vertical-align: middle; }
  .section-badge--required { background: var(--ms-warning-soft); color: var(--ms-warning); }
  .section-badge--optional { background: var(--ms-surface); border: 1px solid var(--ms-line); color: var(--ms-text-muted); }
  html[data-theme="dark"] .section-badge--required { color: #fcd34d; }
  .address-section { margin: 0 auto; border: 1px solid var(--ms-line); padding: 1em; border-radius: 8px; }
  .address-note { margin: 0 0 0.25em; color: var(--ms-text-muted); font-size: 0.9em; line-height: 1.5; }
  .address-container { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 20px; flex-direction: row; justify-content: space-between; }
  .address-container mat-form-field { flex: 1 1 calc(50% - 20px); min-width: 200px; max-width: 100%; }
  @media (max-width: 600px) {
    .address-container { flex-direction: column; gap: 15px; }
    .address-container mat-form-field { flex: 1 1 100%; min-width: unset; }
  }
  .form-container { padding: 20px; background: var(--ms-surface); border: 1px solid var(--ms-line); box-shadow: none; border-radius: 8px; }
  .form-container .flex-form { display: flex; flex-wrap: wrap; gap: 20px; }
  .form-container .flex-form .form-group { flex: 1 1 calc(50% - 20px); display: flex; flex-direction: column; }
  .form-container .flex-form .form-ungroup { flex: 1 1 100%; display: flex; flex-direction: column; }
  @media (max-width: 600px) {
    .flex-form .form-group, .flex-form .form-ungroup { flex: 1 1 100%; }
  }
  .muted { color: var(--ms-text-muted); font-size: 0.85em; }
  .public-link button { vertical-align: middle; color: var(--ms-primary-strong); }
`],
providers: [provideNativeDateAdapter(), ProfileService],
changeDetection: ChangeDetectionStrategy.OnPush,
imports: [FormsModule, CommonModule, MatDatepickerModule, MatExpansionModule, MatProgressBarModule,
    ReactiveFormsModule, MatButtonToggleModule, MatFormFieldModule, MatSelectModule, MatTableModule, MatInputModule, MatIconModule, MatButtonModule, MatSnackBarModule, ProfilePictureUploadComponent, DeleteAccountComponent, RouterModule
]
})
export class ProfileMgrComponent implements OnInit, OnDestroy {
  readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly ui = inject(UiFeedbackService);
  @Input() partner!: PartnerInterface;

  protected readonly profile = signal<PartnerInterface | null>(null);

  profileMgrForm!: FormGroup;
  usernameForm!: FormGroup;
  passwordForm!: FormGroup;
  professionalForm!: FormGroup;
  hideCurrent = signal(true);
  hideNew = signal(true);

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
        hobby: new FormControl(this.partner.hobby, [Validators.required]),
        skill: new FormControl(this.partner.skill, [Validators.required]),
        id: new FormControl(this.partner._id),
      });
    }
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
    if (!username) return null;
    const base = (environment as { publicSiteUrl?: string }).publicSiteUrl ?? 'https://marketspase.com';
    return `${String(base).replace(/\/+$/, '')}/${username.toLowerCase()}`;
  }

  /** Copy the public page link — same flow as the landing-page editor. */
  protected copyPublicLink(): void {
    const url = this.publicPageUrl();
    if (!url) return;
    const done = () => this.snack.open('Public page link copied — share it anywhere', 'OK', { duration: 3000 });
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
        For example, in marketspase.com/business, "business" is a meaninful and easy to remember username.

        <p>Other examples of good unique link:
          <ul>
            <li>marketspase.com/join</li>
            <li>marketspase.com/connect</li>
            <li>marketspase.com/link</li>
            <li>marketspase.com/grow</li>
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
