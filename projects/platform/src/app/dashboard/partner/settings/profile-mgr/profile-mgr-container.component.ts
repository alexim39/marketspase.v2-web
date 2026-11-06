import {Component, inject, OnDestroy, OnInit, ChangeDetectionStrategy} from '@angular/core';

import { PartnerInterface, PartnerService } from '../../../../_common/services/partner.service';
import { Subscription } from 'rxjs';
import { ProfileMgrComponent } from './profile-mgr.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
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
  <div class="page-head">
    <div>
      <h2>My account <mat-icon class="help" (click)="showDescription()">help</mat-icon></h2>
      <p class="subtitle">Your identity across MarketSpase — complete it once, benefit everywhere.</p>
    </div>
  </div>

  @if (partner) {
    <async-profile-mgr [partner]="partner" />
  }
</section>

`,
providers: [],
imports: [ProfileMgrComponent, MatIconModule, MatButtonModule],
changeDetection: ChangeDetectionStrategy.Eager,
styles: [`
  .account-page { margin: 0 auto; max-width: 960px; padding: 0 0 2em; }
  .page-head h2 { margin: 0; display: flex; align-items: center; gap: 0.4em; }
  .help { cursor: pointer; font-size: 20px; height: 20px; width: 20px; color: var(--ms-text-muted); }
  .subtitle { margin: 0.25em 0 1em; color: var(--ms-text-muted); }
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
