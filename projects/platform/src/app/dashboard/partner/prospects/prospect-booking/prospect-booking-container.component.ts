
import {Component, OnDestroy, OnInit, ChangeDetectionStrategy} from '@angular/core';
import { PartnerInterface, PartnerService } from '../../../../_common/services/partner.service';
import { Subscription } from 'rxjs';
import { ProspectBookingComponent } from './prospect-booking.component';
import { ProspectService, ProspectListInterface } from '../prospects.service';


/**
 * @title prospect booking container
 */
@Component({
    selector: 'async-prospect-booking-container',
    imports: [ProspectBookingComponent],
    providers: [ProspectService],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
  @if (partner && prospectList) {
    <async-prospect-booking [partner]="partner" [prospectList]="prospectList"/>
  }
  `
})
export class ProspectBookingContainerComponent implements OnInit, OnDestroy {

  partner!: PartnerInterface;
  subscriptions: Subscription[] = [];
  prospectList!: ProspectListInterface[];

  constructor(
    private partnerService: PartnerService,
    private prospectListService: ProspectService,
  ) { }

  ngOnInit() {
      
    // get current signed in user
    this.subscriptions.push(
      this.partnerService.getSharedPartnerData$.subscribe({
        next: (partnerObject: PartnerInterface) => {
          this.partner = partnerObject;
          if (this.partner) {
            this.prospectListService.getSessionBookingsFor(this.partner._id).subscribe({
              next: (response) => {
                this.prospectList = response.data;
              },
            })
          }
      
        }
      })
    )
  }

  ngOnDestroy() {
    // unsubscribe list
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
