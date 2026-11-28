import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PartnerInterface, PartnerService } from '../../../../../_common/services/partner.service';
import { MobileProfileSetupComponent } from './profile-setup.component';

/**
 * Mobile entry point for the profile route. Owns the shared-partner
 * subscription and renders the native setup flow once identity is ready.
 */
@Component({
  selector: 'async-profile-mgr-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MobileProfileSetupComponent],
  template: `
    @if (partner(); as p) {
      <async-profile-setup-mobile [partner]="p" />
    } @else {
      <div class="profile-loading" aria-label="Loading profile">
        <span class="loading-orb" aria-hidden="true"></span>
        <p>Loading your profile…</p>
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .profile-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 28vh 20px;
      color: var(--ms-text-muted);
      font-size: 0.76rem;
    }
    .loading-orb {
      width: 28px;
      height: 28px;
      border: 2px solid var(--ms-line);
      border-top-color: var(--ms-primary);
      border-radius: 50%;
      animation: profile-spin 0.8s linear infinite;
    }
    p { margin: 0; }
    @keyframes profile-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .loading-orb { animation: none; }
    }
  `],
})
export class ProfileMrgContainerMobileComponent {
  private readonly partnerService = inject(PartnerService);
  protected readonly partner = signal<PartnerInterface | null>(null);

  constructor() {
    this.partnerService.getSharedPartnerData$
      .pipe(takeUntilDestroyed())
      .subscribe((partner) => this.partner.set(partner ?? null));
  }
}
