import {Component, OnDestroy, OnInit, ChangeDetectionStrategy} from '@angular/core';

import { PartnerInterface, PartnerService } from '../../../../../_common/services/partner.service';
import { Subscription } from 'rxjs';
import { CreateTeamComponent } from './create-team.component';

/**
 * @title Container
 */
@Component({
    selector: 'async-create-team-container',
    template: `
  @if (partner) {
    <async-create-team [partner]="partner"/>
  }
  `,
    providers: [],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [CreateTeamComponent]
})
export class CreateTeamContainerComponent implements OnInit, OnDestroy {

    
  partner!: PartnerInterface;
  subscriptions: Subscription[] = [];

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
}
