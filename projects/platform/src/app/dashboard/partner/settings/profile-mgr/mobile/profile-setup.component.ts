import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Input,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { HttpErrorResponse } from '@angular/common/http';
import { PartnerInterface, PartnerService } from '../../../../../_common/services/partner.service';
import { ProfileService } from '../../../profile/profile.service';
import { MentorHandoffService } from '../../../../../core/mentor-handoff/mentor-handoff.service';
import { MentorHandoffPreference } from '../../../../../core/mentor-handoff/mentor-handoff.models';
import { ProfilePhotoService } from '../../../../../core/settings/profile-photo.service';
import { UiFeedbackService } from '../../../../../core/ui/ui-feedback.service';
import { userError } from '../../../../../core/http/api-error';
import { publicLeadPageUrl } from '../../../../../core/store/public-links';
import { Countries, States } from '../../../../../_common/services/countries';
import { DeleteAccountComponent } from '../delete-account.component';
import { HelpDialogComponent } from '../../../../../_common/help-dialog.component';
import { MAX_PROFILE_TAGS, normalizeProfileTags } from '../profile-tags';

type SetupView = 'home' | 'personal' | 'profession' | 'mentor' | 'security';
type EditorView = Exclude<SetupView, 'home'>;
type SaveTarget = 'personal' | 'profession' | 'mentor' | 'username' | 'password';
type ChecklistTarget = EditorView | 'photo';

interface ChecklistItem {
  key: string;
  label: string;
  required: boolean;
  done: boolean;
  target: ChecklistTarget;
}

interface MentorOption {
  value: MentorHandoffPreference;
  icon: string;
  title: string;
  note: string;
}

const EDUCATION_OPTIONS = [
  'Basic Education Certificate (Primary School)',
  'WASSCE',
  'NECO',
  'GCE',
  'ND',
  'HND',
  'B.Sc., B.A., B.Eng.',
  'M.Sc., M.A., M.B.A.',
  'Ph.D.',
  'NCE',
  'None',
];

const MENTOR_OPTIONS: MentorOption[] = [
  { value: 'in_app', icon: 'chat_bubble', title: 'In-app chat', note: 'Keep every conversation inside MarketSpase.' },
  { value: 'email', icon: 'mail', title: 'Email', note: 'Share your email with your direct mentor.' },
  { value: 'whatsapp', icon: 'forum', title: 'WhatsApp', note: 'Let your mentor message your phone on WhatsApp.' },
  { value: 'phone', icon: 'call', title: 'Phone call', note: 'Allow a direct call during onboarding.' },
  { value: 'prefer_not_now', icon: 'do_not_disturb_on', title: 'Prefer not now', note: 'Pause all direct mentor outreach.' },
];

/**
 * @title My profile — native mobile setup.
 *
 * A two-level setup experience rather than a squeezed desktop page: a profile
 * overview with completion checklist and section list, and focused editors
 * with native controls and a fixed save dock. Desktop keeps its own layout.
 */
@Component({
  selector: 'async-profile-setup-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DeleteAccountComponent, MatIconModule, ReactiveFormsModule, RouterModule],
  templateUrl: './profile-setup.component.html',
  styleUrls: ['./profile-setup.component.scss'],
  providers: [ProfileService],
})
export class MobileProfileSetupComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly partnerService = inject(PartnerService);
  private readonly mentorHandoffs = inject(MentorHandoffService);
  private readonly photos = inject(ProfilePhotoService);
  private readonly ui = inject(UiFeedbackService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly photoInput = viewChild<ElementRef<HTMLInputElement>>('photoInput');

  @Input() partner!: PartnerInterface;

  protected readonly profile = signal<PartnerInterface | null>(null);
  protected readonly view = signal<SetupView>('home');
  protected readonly saving = signal<SaveTarget | null>(null);
  protected readonly photoBusy = signal(false);
  protected readonly photoPreview = signal<string | null>(null);
  protected readonly hobbyTags = signal<string[]>([]);
  protected readonly skillTags = signal<string[]>([]);
  protected readonly hideCurrent = signal(true);
  protected readonly hideNew = signal(true);

  protected readonly maxProfileTags = MAX_PROFILE_TAGS;
  protected readonly mentorOptions = MENTOR_OPTIONS;
  protected readonly educationOptions = EDUCATION_OPTIONS;
  protected readonly countries = Countries;
  protected readonly states = States;
  protected readonly todayIso = new Date().toISOString().slice(0, 10);
  protected isNigeria = true;

  protected personalForm!: FormGroup;
  protected professionalForm!: FormGroup;
  protected mentorForm!: FormGroup;
  protected usernameForm!: FormGroup;
  protected passwordForm!: FormGroup;

  protected readonly sectionMeta: Record<EditorView, { eyebrow: string; title: string; lede: string }> = {
    personal: {
      eyebrow: 'Profile setup · Required',
      title: 'Personal details',
      lede: 'Your name, contact details and the address used for activation delivery.',
    },
    profession: {
      eyebrow: 'Profile setup · Optional',
      title: 'Profession',
      lede: 'Add context about your work, background and interests.',
    },
    mentor: {
      eyebrow: 'Profile setup · Optional',
      title: 'Mentor contact',
      lede: 'Choose how your direct mentor may reach you during onboarding.',
    },
    security: {
      eyebrow: 'Profile setup · Account',
      title: 'Account & security',
      lede: 'Your public username, shareable link and password.',
    },
  };

  protected readonly section = computed(() => {
    const current = this.view();
    return current === 'home' ? null : this.sectionMeta[current];
  });

  protected readonly completion = computed(() => {
    const p = this.profile();
    const filled = (value: unknown): boolean => String(value ?? '').trim().length > 0;
    const items: ChecklistItem[] = [
      { key: 'phone', label: 'Phone number', required: true, done: filled(p?.phone), target: 'personal' },
      { key: 'street', label: 'Street address', required: true, done: filled(p?.address?.street), target: 'personal' },
      { key: 'city', label: 'City', required: true, done: filled(p?.address?.city), target: 'personal' },
      { key: 'state', label: 'State of residence', required: true, done: filled(p?.address?.state), target: 'personal' },
      { key: 'photo', label: 'Profile photo', required: false, done: filled(p?.profileImage), target: 'photo' },
      { key: 'bio', label: 'Short bio', required: false, done: filled(p?.bio), target: 'personal' },
      { key: 'dob', label: 'Date of birth', required: false, done: filled(p?.dobDatePicker), target: 'personal' },
    ];
    const done = items.filter((item) => item.done).length;
    const missing = items.filter((item) => !item.done);
    const requiredMissing = missing.filter((item) => item.required);
    return {
      percent: Math.round((done / items.length) * 100),
      done,
      total: items.length,
      items,
      missing,
      requiredMissing,
      complete: requiredMissing.length === 0,
    };
  });

  ngOnInit(): void {
    this.profile.set(this.partner ?? null);
    this.photoPreview.set(this.partner?.profileImage ?? null);
    if (this.partner) this.buildForms(this.partner);
  }

  private buildForms(p: PartnerInterface): void {
    this.isNigeria = (p.address?.country ?? 'Nigeria') === 'Nigeria';
    const hobbies = normalizeProfileTags(p.hobby);
    const skills = normalizeProfileTags(p.skill);
    this.hobbyTags.set(hobbies);
    this.skillTags.set(skills);

    this.personalForm = new FormGroup({
      name: new FormControl(p.name ?? '', Validators.required),
      surname: new FormControl(p.surname ?? '', Validators.required),
      email: new FormControl(p.email ?? '', [Validators.required, Validators.email]),
      phone: new FormControl(p.phone ?? '', [Validators.required, Validators.pattern(/^[0-9+\s()-]{7,20}$/)]),
      dobDatePicker: new FormControl(this.toIsoDate(p.dobDatePicker)),
      bio: new FormControl(p.bio ?? ''),
      address: new FormGroup({
        street: new FormControl(p.address?.street ?? '', Validators.required),
        city: new FormControl(p.address?.city ?? '', Validators.required),
        state: new FormControl(p.address?.state ?? '', Validators.required),
        country: new FormControl(p.address?.country ?? 'Nigeria', Validators.required),
      }),
      id: new FormControl(p._id),
    });

    this.professionalForm = new FormGroup({
      jobTitle: new FormControl(p.jobTitle ?? '', Validators.required),
      educationBackground: new FormControl(p.educationBackground ?? '', Validators.required),
      hobby: new FormControl(hobbies, Validators.required),
      skill: new FormControl(skills, Validators.required),
      id: new FormControl(p._id),
    });

    this.mentorForm = new FormGroup({
      preference: new FormControl<MentorHandoffPreference>(p.mentorContactPreference ?? 'in_app'),
      consent: new FormControl(!!p.mentorContactConsentAt),
    });

    this.usernameForm = new FormGroup({
      username: new FormControl(p.username ?? '', Validators.required),
      id: new FormControl(p._id),
    });

    this.passwordForm = new FormGroup({
      currentPassword: new FormControl('', [Validators.required, Validators.minLength(8)]),
      newPassword: new FormControl('', [Validators.required, Validators.minLength(8)]),
      id: new FormControl(p._id),
    });
  }

  private toIsoDate(value: unknown): string {
    if (!value) return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }
    const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : '';
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

  protected shortUrl(url: string): string {
    return url.replace(/^https?:\/\//, '');
  }

  protected preferenceLabel(preference?: MentorHandoffPreference | null): string {
    switch (preference) {
      case 'in_app': return 'In-app mentor chat';
      case 'email': return 'Mentor via email';
      case 'whatsapp': return 'Mentor via WhatsApp';
      case 'phone': return 'Mentor phone call';
      case 'prefer_not_now': return 'Mentor outreach paused';
      default: return 'Choose how your mentor reaches you';
    }
  }

  protected personalComplete(): boolean {
    const p = this.profile();
    const filled = (value: unknown): boolean => String(value ?? '').trim().length > 0;
    return !!p
      && filled(p.name) && filled(p.surname) && filled(p.email) && filled(p.phone)
      && filled(p.address?.street) && filled(p.address?.city)
      && filled(p.address?.state) && filled(p.address?.country);
  }

  protected professionComplete(): boolean {
    const p = this.profile();
    return !!p
      && String(p.jobTitle ?? '').trim().length > 0
      && String(p.educationBackground ?? '').trim().length > 0
      && normalizeProfileTags(p.hobby).length > 0
      && normalizeProfileTags(p.skill).length > 0;
  }

  protected personalSummary(): string {
    if (this.personalComplete()) return 'Name, contact and delivery address saved';
    const missing = this.completion().items.filter((item) => item.required && !item.done).length;
    return `${missing} required ${missing === 1 ? 'detail' : 'details'} still needed`;
  }

  protected professionSummary(): string {
    return this.professionComplete()
      ? 'Background, hobbies and skills added'
      : 'Add your work, hobbies and skills';
  }

  protected mentorSummary(): string {
    return this.preferenceLabel(this.profile()?.mentorContactPreference);
  }

  protected securitySummary(): string {
    const username = this.profile()?.username;
    return username ? `@${username} · Password and public link` : 'Set your username and password';
  }

  protected bioLength(): number {
    return String(this.personalForm?.get('bio')?.value ?? '').length;
  }

  protected openView(view: EditorView): void {
    this.view.set(view);
    this.scrollTop();
  }

  protected goHome(): void {
    this.view.set('home');
    this.scrollTop();
  }

  protected openMissing(item: ChecklistItem): void {
    if (item.target === 'photo') {
      this.triggerPhoto();
      return;
    }
    this.openView(item.target);
  }

  protected openNext(): void {
    const completion = this.completion();
    const next = completion.requiredMissing[0]
      ?? completion.items.find((item) => !item.done && item.target !== 'photo')
      ?? completion.missing[0];
    if (!next) {
      this.openView('personal');
      return;
    }
    this.openMissing(next);
  }

  private scrollTop(): void {
    if (typeof window === 'undefined') return;
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
      document.querySelector<HTMLElement>('.setup-screen h1')?.focus({ preventScroll: true });
    }, 0);
  }

  protected showHelp(): void {
    this.openHelp(`<p>Complete your profile once — your photo, name and public page follow you into invitations, the community and team views.</p>
      <p>Required details unlock your full profile. Everything else is optional polish.</p>
      <p>Use the checklist on this page to jump straight to anything missing.</p>`);
  }

  protected showUsernameHelp(): void {
    this.openHelp(`<p>Your username is part of your unique public link, so make it meaningful and easy to remember.</p>
      <p>For example, in <strong>store.marketspase.com/lead/business</strong>, “business” is the username.</p>
      <p>Other strong examples: <strong>join</strong>, <strong>connect</strong>, <strong>link</strong> or <strong>grow</strong>.</p>`);
  }

  private openHelp(help: string): void {
    this.dialog.open(HelpDialogComponent, { data: { help } });
  }

  protected triggerPhoto(): void {
    this.photoInput()?.nativeElement.click();
  }

  protected onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file || this.photoBusy()) return;
    if (!file.type.startsWith('image/')) {
      this.ui.error('Choose a JPEG, PNG or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.ui.error('That image is over 5MB — choose a smaller one.');
      return;
    }

    const current = this.profile();
    const previous = current?.profileImage ?? null;
    this.photoBusy.set(true);
    const reader = new FileReader();
    reader.onload = () => this.photoPreview.set(String(reader.result));
    reader.readAsDataURL(file);

    this.photos.upload(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.photoBusy.set(false);
          const url = res.data?.url;
          if (!url) {
            this.photoPreview.set(previous);
            this.ui.error('Upload finished without a photo URL — try again.');
            return;
          }
          this.photoPreview.set(url);
          this.applyProfile({ profileImage: url });
          this.ui.success('Profile photo updated.');
        },
        error: (err: unknown) => {
          this.photoBusy.set(false);
          this.photoPreview.set(previous);
          this.ui.error(userError(err));
        },
      });
  }

  protected copyPublicLink(): void {
    const url = this.publicPageUrl();
    if (!url) return;
    if (!navigator.clipboard?.writeText) {
      this.ui.error('Copying is not available in this browser.');
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => this.ui.success('Public page link copied.'),
      () => this.ui.error('Could not copy the link.'),
    );
  }

  protected onCountryChange(country: string): void {
    this.isNigeria = country === 'Nigeria';
    const state = this.personalForm.get('address.state');
    state?.reset();
    state?.setValidators(this.isNigeria ? [Validators.required] : [Validators.required, Validators.minLength(2)]);
    state?.updateValueAndValidity();
  }

  protected requiresMentorConsent(): boolean {
    if (!this.mentorForm) return false;
    return ['email', 'whatsapp', 'phone'].includes(this.mentorForm.value.preference);
  }

  protected addTag(kind: 'hobby' | 'skill', input: HTMLInputElement, event?: Event): void {
    event?.preventDefault();
    if (!input.value.trim() || !this.professionalForm) return;
    const target = kind === 'hobby' ? this.hobbyTags : this.skillTags;
    const control = this.professionalForm.get(kind);
    const next = [...target()];
    for (const value of normalizeProfileTags(input.value)) {
      if (next.length >= MAX_PROFILE_TAGS) break;
      if (next.some((tag) => tag.toLowerCase() === value.toLowerCase())) continue;
      next.push(value);
    }
    target.set(next);
    control?.setValue(next);
    control?.markAsTouched();
    input.value = '';
  }

  protected removeTag(kind: 'hobby' | 'skill', tag: string): void {
    const target = kind === 'hobby' ? this.hobbyTags : this.skillTags;
    const control = this.professionalForm?.get(kind);
    const next = target().filter((item) => item !== tag);
    target.set(next);
    control?.setValue(next);
    control?.markAsTouched();
  }

  protected tagLimitReached(kind: 'hobby' | 'skill'): boolean {
    const list = kind === 'hobby' ? this.hobbyTags() : this.skillTags();
    return list.length >= MAX_PROFILE_TAGS;
  }

  protected showError(form: FormGroup, path: string): boolean {
    const control = form?.get(path);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  protected savePersonal(): void {
    if (!this.personalForm || this.saving()) return;
    if (this.personalForm.invalid) {
      this.personalForm.markAllAsTouched();
      this.ui.error('Check the highlighted fields before saving.');
      this.scrollToFirstError();
      return;
    }
    const value = this.personalForm.getRawValue();
    this.saving.set('personal');
    this.profileService.profileUpdate({
      ...value,
      dobDatePicker: value.dobDatePicker || null,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(null);
          this.applyProfile({
            name: String(value.name ?? ''),
            surname: String(value.surname ?? ''),
            email: String(value.email ?? ''),
            phone: String(value.phone ?? ''),
            bio: String(value.bio ?? ''),
            address: value.address,
            dobDatePicker: value.dobDatePicker || undefined,
          });
          this.ui.success('Personal details saved.');
          this.goHome();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(null);
          this.ui.error(userError(err));
        },
      });
  }

  protected saveProfession(): void {
    if (!this.professionalForm || this.saving()) return;
    if (this.professionalForm.invalid) {
      this.professionalForm.markAllAsTouched();
      this.ui.error('Add your job title, education and at least one hobby and skill.');
      this.scrollToFirstError();
      return;
    }
    const value = this.professionalForm.getRawValue();
    this.saving.set('profession');
    this.profileService.professionUpdate({
      ...value,
      hobby: this.hobbyTags(),
      skill: this.skillTags(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(null);
          this.applyProfile({
            jobTitle: String(value.jobTitle ?? ''),
            educationBackground: String(value.educationBackground ?? ''),
            hobby: this.hobbyTags(),
            skill: this.skillTags(),
          });
          this.ui.success('Profession details saved.');
          this.goHome();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(null);
          this.ui.error(userError(err));
        },
      });
  }

  protected saveMentor(): void {
    if (!this.mentorForm || this.saving()) return;
    const { preference, consent } = this.mentorForm.value as {
      preference: MentorHandoffPreference;
      consent: boolean;
    };
    const requiresConsent = ['email', 'whatsapp', 'phone'].includes(preference);
    if (requiresConsent && !consent) {
      this.ui.error('Agree to share your chosen contact channel with your mentor.');
      return;
    }
    this.saving.set('mentor');
    this.mentorHandoffs.updatePreference(preference, !!consent)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(null);
          this.applyProfile({
            mentorContactPreference: preference,
            mentorContactConsentAt: requiresConsent ? new Date().toISOString() : null,
          });
          this.ui.success('Mentor contact preference saved.');
          this.goHome();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(null);
          this.ui.error(userError(err));
        },
      });
  }

  protected saveUsername(): void {
    if (!this.usernameForm || this.saving()) return;
    if (this.usernameForm.invalid) {
      this.usernameForm.markAllAsTouched();
      this.ui.error('Enter a username before saving.');
      return;
    }
    const value = this.usernameForm.getRawValue();
    const username = String(value.username ?? '').trim();
    this.usernameForm.get('username')?.setValue(username);
    this.saving.set('username');
    this.profileService.usernameUpdate({ ...value, username })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(null);
          this.applyProfile({ username });
          this.ui.success('Username updated.');
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(null);
          this.ui.error(userError(err));
        },
      });
  }

  protected savePassword(): void {
    if (!this.passwordForm || this.saving()) return;
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.ui.error('Enter your current password and a new password of at least 8 characters.');
      return;
    }
    const value = this.passwordForm.getRawValue();
    this.saving.set('password');
    this.profileService.changePassword(value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(null);
          this.passwordForm.reset({ currentPassword: '', newPassword: '', id: this.profile()?._id });
          this.hideCurrent.set(true);
          this.hideNew.set(true);
          this.ui.success('Password changed.');
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(null);
          this.ui.error(userError(err));
        },
      });
  }

  private applyProfile(patch: Partial<PartnerInterface>): void {
    const current = this.profile();
    if (!current) return;
    const updated = { ...current, ...patch };
    this.profile.set(updated);
    this.partnerService.updatePartnerService(updated);
  }

  private scrollToFirstError(): void {
    if (typeof document === 'undefined') return;
    setTimeout(() => {
      const error = document.querySelector<HTMLElement>('.field-error');
      error?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }
}
