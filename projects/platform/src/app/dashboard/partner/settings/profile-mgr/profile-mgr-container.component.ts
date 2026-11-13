import {Component, inject, OnDestroy, OnInit, ChangeDetectionStrategy} from '@angular/core';

import { PartnerInterface, PartnerService } from '../../../../_common/services/partner.service';
import { Subscription } from 'rxjs';
import { ProfileMgrComponent } from './profile-mgr.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { HelpDialogComponent } from '../../../../_common/help-dialog.component';

/**
 * @title My account — profile completion home.
 *
 * Single purpose now: the member's identity, completion meter and editable
 * sections. Notification preferences live only at
 * `/dashboard/notifications/preferences` (linked from here, never duplicated).
 */
@Component({
selector: 'async-profile-mgr-container',
template: `

<section class="account-page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Account · Profile</p>
      <h1>My account <button mat-icon-button class="help" type="button" (click)="showDescription()" aria-label="About your profile"><mat-icon>help</mat-icon></button></h1>
      <p class="subtitle">Your identity across MarketSpase — complete it once and it follows you into invitations, the community and every team view.</p>
    </div>
    <a mat-stroked-button routerLink="/dashboard/notifications/preferences">
      <mat-icon>notifications</mat-icon>
      Notification preferences
    </a>
  </header>

  @if (partner) {
    <async-profile-mgr [partner]="partner" />
  }
</section>

`,
providers: [],
imports: [ProfileMgrComponent, MatIconModule, MatButtonModule, RouterModule],
changeDetection: ChangeDetectionStrategy.Eager,
styles: [`
  .account-page { margin: 0 auto; max-width: 1200px; padding: 0 0 32px; }
  .page-head { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 24px; margin-bottom: 24px; }
  .page-head h1 { margin: 4px 0 8px; font-size: clamp(2rem, 3vw, 2.5rem); letter-spacing: -0.03em; display: flex; align-items: center; gap: 4px; }
  .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .help { color: var(--ms-text-muted); }
  .help mat-icon { font-size: 20px; width: 20px; height: 20px; }
  .subtitle { margin: 0; max-width: 62em; color: var(--ms-text-muted); line-height: 1.6; }
  .page-head > a mat-icon { margin-right: 6px; }
`]
})
export class ProfileMrgContainerComponent implements OnInit, OnDestroy {

  partner!: PartnerInterface;
  subscriptions: Subscription[] = [];
  readonly dialog = inject(MatDialog);

  constructor(
    private partnerService: PartnerService,
  ) { }

  ngOnInit() {
    // get current signed in user
    this.subscriptions.push(
      this.partnerService.getSharedPartnerData$.subscribe({

        next: (partner: PartnerInterface) => {
          this.partner = partner;
        }

      })
    )
  }

  ngOnDestroy() {
    // unsubscribe list
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

   showDescription () {
      this.dialog.open(HelpDialogComponent, {
        data: {help: 'Complete your profile once — your photo, name and public page follow you into invitations, the community and team views.'},
      });
    }
}
