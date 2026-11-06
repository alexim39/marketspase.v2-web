
import {Component, OnDestroy, OnInit, ChangeDetectionStrategy} from '@angular/core';
import { PartnerInterface, PartnerService } from '../../../../_common/services/partner.service';
import { Subscription } from 'rxjs';
import { PreApproachDownloadComponent } from './pre-approach-download.component';


/**
 * @title Manage comapaing container
 */
@Component({
    selector: 'async-manage-campaign-container',
    imports: [PreApproachDownloadComponent],
    providers: [],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
  @if (partner) {
    <async-preapproach-download [partner]="partner"></async-preapproach-download>
  }
  `
})
export class PreapproachDownloadContainerComponent implements OnInit, OnDestroy {

  partner!: PartnerInterface;
  subscriptions: Subscription[] = [];

  constructor(
    private partnerService: PartnerService,
  ) { }

  ngOnInit() {
      
    // get current signed in user
    this.subscriptions.push(
      this.partnerService.getSharedPartnerData$.subscribe(
       
        partnerObject => {
          this.partner = partnerObject as PartnerInterface
          if (this.partner) {
           /*  this.campaignService.getCampaignCreatedBy(this.partner._id).subscribe((campaigns: CampaignInterface) => {
              this.campaigns = campaigns;
            }) */
          }
        },
        
        error => {
          console.log(error)
          // redirect to home page
        }
      )
    )
  }

  ngOnDestroy() {
    // unsubscribe list
    this.subscriptions.forEach(subscription => {
      subscription.unsubscribe();
    });
  }
}
