import {
  ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { OnboardingService } from '../../../../core/onboarding/onboarding.service';
import { ApiError, userError } from '../../../../core/http/api-error';
import {
  IdType,
  KycSubmission,
  OnboardingStatus,
} from '../../../../core/onboarding/onboarding.models';

/**
 * Account-level identity status. This lives under Settings because it is an
 * infrequent, compliance-style task, not a daily workspace.
 */
@Component({
  selector: 'async-verification',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatButtonModule, MatIconModule, PageSkeletonComponent, RouterModule],
  template: `
    <section class="verification-page">
      <div class="page-head">
        <div>
          <p class="eyebrow">Account</p>
          <h1>Verification &amp; KYC</h1>
          <p class="muted">Your identity status, age check and review notes. Full ID numbers are never shown.</p>
        </div>
        <a mat-stroked-button routerLink="/dashboard/settings/profiles">
          <mat-icon>arrow_back</mat-icon>
          Settings
        </a>
      </div>

      @if (loading()) {
        <async-page-skeleton layout="form" [rows]="6" label="your verification status" [showHeader]="false" />
      } @else {
        @if (error(); as err) {
          <div class="error" role="alert">
            <mat-icon>error_outline</mat-icon>
            <span>{{ err }}</span>
            <button mat-icon-button type="button" (click)="error.set(null)" aria-label="Dismiss error">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        }
        @if (notice(); as message) {
          <div class="notice" role="status">
            <mat-icon>check_circle</mat-icon>
            <span>{{ message }}</span>
            <button mat-icon-button type="button" (click)="notice.set(null)" aria-label="Dismiss message">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        }

        @if (status(); as s) {
          <div class="status-card"
            [class.verified]="kycStatus() === 'verified'"
            [class.pending]="kycStatus() === 'pending'"
            [class.rejected]="kycStatus() === 'rejected'">
            <div class="status-icon"><mat-icon>{{ statusIcon() }}</mat-icon></div>
            <div class="status-main">
              <p class="eyebrow">Current status</p>
              <h2>{{ statusLabel() }}</h2>
              <p class="muted">{{ statusCopy() }}</p>
              <div class="chips">
                @if (s.kyc?.submittedAt; as submittedAt) {
                  <span class="chip">Submitted {{ submittedAt | date: 'mediumDate' }}</span>
                }
                @if (s.kyc?.reviewedAt; as reviewedAt) {
                  <span class="chip">Reviewed {{ reviewedAt | date: 'mediumDate' }}</span>
                }
                @if (s.partner.activatedAt; as activatedAt) {
                  <span class="chip">Partner since {{ activatedAt | date: 'mediumDate' }}</span>
                }
              </div>
              @if (s.kyc?.reviewNote; as note) {
                <p class="review-note"><strong>Review note:</strong> {{ note }}</p>
              }
            </div>
          </div>

          <div class="grid">
            <article class="card">
              <h3>Identity details</h3>
              @if (s.kyc; as k) {
                <dl>
                  @if (k.dateOfBirth) {
                    <div>
                      <dt>Date of birth</dt>
                      <dd>
                        {{ k.dateOfBirth | date: 'mediumDate' }}
                        @if (age(k.dateOfBirth); as years) { <span class="muted">({{ years }} years)</span> }
                      </dd>
                    </div>
                  }
                  @if (k.idType) {
                    <div><dt>ID type</dt><dd>{{ idTypeLabel(k.idType) }}</dd></div>
                  }
                  @if (k.idLast4) {
                    <div><dt>ID number</dt><dd>•••• {{ k.idLast4 }}</dd></div>
                  }
                  @if (addressLine(k); as line) {
                    <div><dt>Address</dt><dd>{{ line }}</dd></div>
                  }
                </dl>
              } @else {
                <p class="muted">No identity details are recorded yet.</p>
              }
            </article>

            <article class="card">
              <h3>What this covers</h3>
              <ul class="check-list">
                <li><mat-icon>check_circle</mat-icon><span>Age 18+ check when a date of birth is provided.</span></li>
                <li><mat-icon>check_circle</mat-icon><span>Government ID reference, stored as a hash and shown only by its last 4 characters.</span></li>
                <li><mat-icon>check_circle</mat-icon><span>Address on file for activation and compliance.</span></li>
              </ul>
              @if (canResubmit()) {
                <button mat-flat-button color="primary" type="button" (click)="resubmit()" [disabled]="busy()">
                  {{ busy() ? 'Completing…' : 'Complete identity check' }}
                </button>
                <p class="muted small">The current identity step is recorded automatically. Document verification will be added when it is reintroduced.</p>
              }
              @if (s.partner.accountState === 'member') {
                <a mat-button routerLink="/dashboard/activate">Continue activation</a>
              }
              <a mat-button routerLink="/dashboard/settings/profiles">Back to profile settings</a>
            </article>
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .verification-page { max-width: 980px; margin: 0 auto; padding: 24px 0 48px; display: flex; flex-direction: column; gap: 18px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(1.7rem, 3vw, 2.4rem); line-height: 1.1; letter-spacing: -0.03em; }
    .page-head p { margin: 0; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
    .muted { color: var(--ms-text-muted); }
    .small { font-size: 0.82em; }
    .status-card { display: flex; gap: 16px; align-items: flex-start; padding: 18px 20px; border-radius: 14px; border: 1px solid var(--ms-line); background: var(--ms-surface); }
    .status-card .status-icon { width: 52px; height: 52px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--ms-canvas); }
    .status-card.verified { border-color: var(--ms-success); background: var(--ms-success-soft); }
    .status-card.pending { border-color: var(--ms-warning); background: var(--ms-warning-soft); }
    .status-card.rejected { border-color: var(--ms-error); background: var(--ms-canvas); }
    .status-main h2 { margin: 0.1em 0 0.25em; }
    .status-main p { margin: 0; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .chip { padding: 3px 9px; border-radius: 999px; border: 1px solid var(--ms-line); background: var(--ms-surface); font-size: 0.74em; font-weight: 700; }
    .review-note { margin-top: 10px; padding: 0.5em 0.7em; border-left: 3px solid var(--ms-error); background: var(--ms-surface); border-radius: 4px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; align-items: start; }
    .card { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 10px; }
    .card h3 { margin: 0; }
    dl { margin: 0; display: flex; flex-direction: column; gap: 8px; }
    dl div { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--ms-line); padding-bottom: 6px; }
    dl div:last-child { border-bottom: none; padding-bottom: 0; }
    dt { color: var(--ms-text-muted); font-weight: 600; }
    dd { margin: 0; text-align: right; }
    .check-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .check-list li { display: flex; gap: 8px; align-items: flex-start; font-size: 0.9em; line-height: 1.45; }
    .check-list mat-icon { color: var(--ms-success); flex: none; }
    .notice, .error { display: flex; gap: 8px; align-items: center; padding: 0.55em 0.75em; border-radius: 8px; }
    .notice { background: var(--ms-success-soft); color: var(--ms-success); }
    .error { background: var(--ms-canvas); color: var(--ms-error); }
    .notice span, .error span { flex: 1; }
    @media (max-width: 700px) {
      .page-head { flex-direction: column; }
    }
  `],
})
export class VerificationComponent implements OnInit {
  private readonly onboarding = inject(OnboardingService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly status = signal<OnboardingStatus | null>(null);

  protected readonly kycStatus = computed(() =>
    this.status()?.partner.kycStatus ?? this.status()?.kyc?.status ?? 'not_started');

  protected readonly canResubmit = computed(() =>
    this.kycStatus() === 'rejected' || this.kycStatus() === 'not_started');

  ngOnInit(): void {
    this.refresh();
  }

  protected statusLabel(): string {
    switch (this.kycStatus()) {
      case 'verified': return 'Identity verified';
      case 'pending': return 'Under review';
      case 'rejected': return 'Verification rejected';
      default: return 'Not started';
    }
  }

  protected statusCopy(): string {
    switch (this.kycStatus()) {
      case 'verified': return 'Your identity check is complete. Nothing else is needed right now.';
      case 'pending': return 'Your identity check is waiting for review.';
      case 'rejected': return 'Your identity check was rejected. Read the review note and resubmit.';
      default: return 'Complete the identity step to unlock activation and keep your account compliant.';
    }
  }

  protected statusIcon(): string {
    switch (this.kycStatus()) {
      case 'verified': return 'verified_user';
      case 'pending': return 'hourglass_top';
      case 'rejected': return 'gpp_bad';
      default: return 'badge';
    }
  }

  protected idTypeLabel(type?: IdType | string | null): string {
    switch (type) {
      case 'nin': return 'NIN';
      case 'drivers_license': return "Driver's licence";
      case 'passport': return 'Passport';
      case 'voters_card': return "Voter's card";
      default: return 'Government ID';
    }
  }

  protected age(dateOfBirth?: string | null): number | null {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) return null;
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    const month = now.getMonth() - dob.getMonth();
    if (month < 0 || (month === 0 && now.getDate() < dob.getDate())) years -= 1;
    return years >= 0 ? years : null;
  }

  protected addressLine(k: KycSubmission): string {
    return [k.address, k.city, k.state, k.country].filter(Boolean).join(', ');
  }

  protected resubmit(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.onboarding
      .submitKyc({})
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (res) => {
          this.status.update((current) => current ? {
            ...current,
            kyc: res.data,
            partner: { ...current.partner, kycStatus: res.data.status },
          } : current);
          this.notice.set('Identity check completed.');
        },
        error: (err: ApiError) => this.error.set(userError(err)),
      });
  }

  private refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    this.onboarding
      .status()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (res) => this.status.set(res.data ?? null),
        error: (err: ApiError) => this.error.set(userError(err)),
      });
  }
}
