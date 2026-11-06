
import {Component, OnDestroy, OnInit, ChangeDetectionStrategy} from '@angular/core';
import { PartnerInterface, PartnerService } from '../../../_common/services/partner.service';
import { Subscription } from 'rxjs';
import { EmailComponent } from './email.component';


/**
 * @title cell meeting container
 */
@Component({
    selector: 'async-email-container',
    imports: [EmailComponent],
    providers: [],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
  @if (partner) {
    <async-email [partner]="partner"/>
  }
  `
})
export class EmailContainerComponent implements OnInit, OnDestroy {

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