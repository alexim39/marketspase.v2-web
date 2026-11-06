import { Component, inject, Input, OnChanges, OnDestroy, SimpleChanges, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { PartnerInterface, PartnerService } from '../../../../_common/services/partner.service';
import { HelpDialogComponent } from '../../../../_common/help-dialog.component';
import { LandingPageService } from './landing-page.service';
import { environment } from '../../../../../environments/environment';
import { userError } from '../../../../core/http/api-error';

/**
 * @title Public page editor — everything that renders on /:partnerUsername.
 *
 * Single form → single PUT /partners/landing-page. Sections map 1:1 to the
 * public one-pager: hero, mentor story, opportunity, proof, contact/social,
 * share. Legacy per-field tabs retired; their data is preserved.
 */
@Component({
  selector: 'async-landing-page-setting',
  template: `
  <section class="breadcrumb-wrapper">
    <div class="breadcrumb">
      <a routerLink="/dashboard">Dashboard</a> &gt;
      <a>Me &amp; Settings</a> &gt;
      <span>My public page</span>
    </div>
  </section>

  <section class="lp-page">
    <div class="page-head">
      <div>
        <h2>My public page <mat-icon class="help" (click)="showDescription()">help</mat-icon></h2>
        <p class="subtitle">What you save here is what friends &amp; family see on your professional one-page website. Share it to grow your business.</p>
      </div>
      @if (publicUrl()) {
        <div class="share-box dp-card">
          <mat-icon>link</mat-icon>
          <span class="url">{{ publicUrl() }}</span>
          <button mat-button (click)="copyLink()">Copy link</button>
          <a mat-flat-button color="primary" [href]="publicUrl()" target="_blank" rel="noopener">Preview</a>
        </div>
      }
    </div>

    @if (saving()) { <mat-progress-bar mode="indeterminate" aria-label="Loading" /> }

    <form [formGroup]="form" (ngSubmit)="onSave()" class="grid">
      <!-- Identity / Hero -->
      <div class="dp-card card">
        <h3>1 · Hero — first impression</h3>
        <p class="muted">Badge, headline and sub-headline sit over the dark premium hero. Keep it short and inviting.</p>
        <mat-form-field appearance="outline">
          <mat-label>Small badge (e.g. MarketSpase Partner)</mat-label>
          <input matInput formControlName="heroBadge" maxlength="80" placeholder="MarketSpase Partner" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Headline</mat-label>
          <input matInput formControlName="headline" maxlength="140" placeholder="Build income with a mentor you trust" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Sub-headline</mat-label>
          <textarea matInput rows="2" formControlName="subHeadline" maxlength="300" placeholder="I help everyday people start a flexible online business with mentorship, training and health products."></textarea>
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Your title (e.g. Entrepreneur &amp; Mentor)</mat-label>
            <input matInput formControlName="jobTitle" maxlength="80" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Business tagline</mat-label>
            <input matInput formControlName="businessTagline" maxlength="140" placeholder="Mentoring families to financial freedom" />
          </mat-form-field>
        </div>
      </div>

      <!-- Story -->
      <div class="dp-card card">
        <h3>2 · Your story — why trust you</h3>
        <p class="muted">Shown in “Meet your mentor”. Write like you speak to a friend.</p>
        <mat-form-field appearance="outline">
          <mat-label>Short bio (1–2 lines)</mat-label>
          <textarea matInput rows="2" formControlName="bio" maxlength="500"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>My story (3–6 sentences)</mat-label>
          <textarea matInput rows="5" formControlName="aboutStory" maxlength="2000" placeholder="Where you started, what changed, how you help others now…"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Achievements / milestones (optional)</mat-label>
          <textarea matInput rows="2" formControlName="achievements" maxlength="1000" placeholder="e.g. 50+ mentees guided, Lagos & Abuja meetups"></textarea>
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Location to display (e.g. Lagos, Nigeria)</mat-label>
            <input matInput formControlName="locationDisplay" maxlength="120" />
          </mat-form-field>
        </div>
      </div>

      <!-- Opportunity -->
      <div class="dp-card card">
        <h3>3 · Opportunity — what they get</h3>
        <p class="muted">One benefit per line (max 8). Rendered as checkmarks next to the 4 MarketSpase pillars.</p>
        <mat-form-field appearance="outline">
          <mat-label>What joining with you gives them (one per line)</mat-label>
          <textarea matInput rows="5" formControlName="opportunityPointsText" placeholder="Personal mentorship on WhatsApp&#10;Weekly online business showcase&#10;Health & wellness products people reorder"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Personal invite note (shown before Join button)</mat-label>
          <textarea matInput rows="2" formControlName="inviteNote" maxlength="1000" placeholder="Mention my name on the form so I can personally welcome you."></textarea>
        </mat-form-field>
      </div>

      <!-- Proof -->
      <div class="dp-card card">
        <h3>4 · Proof — testimonial &amp; video</h3>
        <mat-form-field appearance="outline">
          <mat-label>Written testimonial (your own words)</mat-label>
          <textarea matInput rows="4" formControlName="testimonial" placeholder="How MarketSpase changed your life…"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Video testimonial URL (YouTube, optional)</mat-label>
          <input matInput formControlName="videoTestimonialUrl" placeholder="https://youtube.com/…" />
        </mat-form-field>
      </div>

      <!-- Contact & social -->
      <div class="dp-card card">
        <h3>5 · Contact &amp; social — where they reach you</h3>
        <p class="muted">Public contact details. Leave blank to hide. WhatsApp group powers the Join / community buttons.</p>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>WhatsApp group link</mat-label>
            <input matInput formControlName="whatsappGroupLink" placeholder="https://chat.whatsapp.com/…" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>WhatsApp chat link</mat-label>
            <input matInput formControlName="whatsappChatLink" placeholder="https://wa.me/…" />
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>WhatsApp button text</mat-label>
          <input matInput formControlName="whatsappCtaText" maxlength="140" placeholder="Chat with me on WhatsApp" />
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Phone to display (optional)</mat-label>
            <input matInput formControlName="displayPhone" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Email to display (optional)</mat-label>
            <input matInput formControlName="displayEmail" />
          </mat-form-field>
        </div>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Facebook</mat-label>
            <input matInput formControlName="facebookPage" placeholder="https://facebook.com/…" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Instagram</mat-label>
            <input matInput formControlName="instagramPage" placeholder="https://instagram.com/…" />
          </mat-form-field>
        </div>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>TikTok</mat-label>
            <input matInput formControlName="tiktokPage" placeholder="https://tiktok.com/@…" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>X (Twitter)</mat-label>
            <input matInput formControlName="twitterPage" placeholder="https://x.com/…" />
          </mat-form-field>
        </div>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>LinkedIn</mat-label>
            <input matInput formControlName="linkedinPage" placeholder="https://linkedin.com/in/…" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>YouTube</mat-label>
            <input matInput formControlName="youtubePage" placeholder="https://youtube.com/…" />
          </mat-form-field>
        </div>
      </div>

      <div class="actions">
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">Save my public page</button>
        <span class="muted">Saves everything above at once.</span>
      </div>
    </form>
  </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .lp-page { display: flex; flex-direction: column; gap: 1.25em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1em; flex-wrap: wrap; }
    .page-head h2 { margin: 0; display: flex; align-items: center; gap: 0.4em; }
    .help { cursor: pointer; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 46em; }
    .share-box { display: flex; align-items: center; gap: 0.6em; padding: 0.6em 0.8em; flex-wrap: wrap; }
    .share-box .url { font-weight: 700; color: var(--ms-primary-strong); word-break: break-all; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(340px, 100%), 1fr)); gap: 1em; align-items: start; }
    .card { padding: 1.1em; display: flex; flex-direction: column; gap: 0.7em; }
    .card h3 { margin: 0; }
    .muted { color: var(--ms-text-muted); font-size: 0.9em; margin: 0; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7em; }
    @media (max-width: 600px) { .row { grid-template-columns: 1fr; } }
    .actions { display: flex; align-items: center; gap: 0.8em; flex-wrap: wrap; }
    .error { color: var(--ms-error); }
    mat-form-field { width: 100%; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, MatInputModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatSnackBarModule, MatProgressBarModule],
  providers: [LandingPageService],
})
export class LandingPageSettingComponent implements OnChanges, OnDestroy {
  @Input() partner!: PartnerInterface;
  private readonly fb = inject(FormBuilder);
  private readonly landing = inject(LandingPageService);
  private readonly partners = inject(PartnerService);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private subs: Subscription[] = [];

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      heroBadge: [''],
      headline: ['', Validators.maxLength(140)],
      subHeadline: ['', Validators.maxLength(300)],
      jobTitle: [''],
      businessTagline: [''],
      bio: [''],
      aboutStory: ['', Validators.maxLength(2000)],
      achievements: [''],
      locationDisplay: [''],
      opportunityPointsText: [''],
      inviteNote: [''],
      testimonial: [''],
      videoTestimonialUrl: [''],
      whatsappGroupLink: [''],
      whatsappChatLink: [''],
      whatsappCtaText: [''],
      displayPhone: [''],
      displayEmail: [''],
      facebookPage: [''],
      instagramPage: [''],
      tiktokPage: [''],
      twitterPage: [''],
      linkedinPage: [''],
      youtubePage: [''],
    });
    this.patchFromPartner();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['partner']) this.patchFromPartner();
  }

  protected publicUrl(): string | null {
    const u = this.partner?.username;
    if (!u) return null;
    // Prod share domain is marketspase.com (public site), not
    // marketspase.com (partner dashboard). Dev keeps localhost:4201.
    const base = (environment as { publicSiteUrl?: string }).publicSiteUrl ?? 'https://marketspase.com';
    return `${String(base).replace(/\/+$/, '')}/${u}`;
  }

  protected copyLink(): void {
    const url = this.publicUrl();
    if (!url) return;
    const done = () => this.snack.open('Public page link copied — share it anywhere', 'OK', { duration: 3000 });
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, done);
    else done();
  }

  private patchFromPartner(): void {
    const p: any = this.partner ?? {};
    if (!this.form) return;
    this.form.patchValue({
      heroBadge: p.heroBadge ?? '',
      headline: p.headline ?? '',
      subHeadline: p.subHeadline ?? '',
      jobTitle: p.jobTitle ?? '',
      businessTagline: p.businessTagline ?? '',
      bio: p.bio ?? '',
      aboutStory: p.aboutStory ?? '',
      achievements: p.achievements ?? '',
      locationDisplay: p.locationDisplay ?? '',
      opportunityPointsText: Array.isArray(p.opportunityPoints) ? p.opportunityPoints.join('\n') : '',
      inviteNote: p.inviteNote ?? '',
      testimonial: p.testimonial ?? '',
      videoTestimonialUrl: p.videoTestimonialUrl ?? '',
      whatsappGroupLink: p.whatsappGroupLink ?? '',
      whatsappChatLink: p.whatsappChatLink ?? '',
      whatsappCtaText: p.whatsappCtaText ?? '',
      displayPhone: p.displayPhone ?? p.phone ?? '',
      displayEmail: p.displayEmail ?? '',
      facebookPage: p.facebookPage ?? '',
      instagramPage: p.instagramPage ?? '',
      tiktokPage: p.tiktokPage ?? '',
      twitterPage: p.twitterPage ?? '',
      linkedinPage: p.linkedinPage ?? '',
      youtubePage: p.youtubePage ?? '',
    }, { emitEvent: false });
  }

  protected onSave(): void {
    if (this.form.invalid || this.saving() || !this.partner?._id) return;
    const v = this.form.getRawValue();
    const payload: Record<string, unknown> = {
      partnerId: this.partner._id,
      heroBadge: v.heroBadge,
      headline: v.headline,
      subHeadline: v.subHeadline,
      jobTitle: v.jobTitle,
      businessTagline: v.businessTagline,
      bio: v.bio,
      aboutStory: v.aboutStory,
      achievements: v.achievements,
      locationDisplay: v.locationDisplay,
      opportunityPoints: String(v.opportunityPointsText ?? '').split(/\r?\n/),
      inviteNote: v.inviteNote,
      testimonial: v.testimonial,
      videoTestimonialUrl: v.videoTestimonialUrl,
      whatsappGroupLink: v.whatsappGroupLink,
      whatsappChatLink: v.whatsappChatLink,
      whatsappCtaText: v.whatsappCtaText,
      displayPhone: v.displayPhone,
      displayEmail: v.displayEmail,
      facebookPage: v.facebookPage,
      instagramPage: v.instagramPage,
      tiktokPage: v.tiktokPage,
      twitterPage: v.twitterPage,
      linkedinPage: v.linkedinPage,
      youtubePage: v.youtubePage,
    };
    this.saving.set(true);
    this.error.set(null);
    this.subs.push(
      this.landing.updateLandingPage(payload).subscribe({
        next: (res: any) => {
          this.saving.set(false);
          const updated = res?.data ?? { ...this.partner, ...payload };
          try { this.partners.updatePartnerService({ ...this.partner, ...updated }); } catch { /* preview only */ }
          this.snack.open('Your public page is live — preview or copy the link', 'OK', { duration: 3500 });
        },
        error: (err: any) => {
          this.saving.set(false);
          this.error.set(userError(err));
        },
      })
    );
  }

  showDescription(): void {
    this.dialog.open(HelpDialogComponent, {
      data: { help: 'Everything here renders on your public page (/:your-username). Fill hero + story + opportunity + proof, save once, then copy your link and share it. Leads submit Get Started and land in Prospects → My Page Leads.' },
    });
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
