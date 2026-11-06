
import {Component, DestroyRef, inject, OnInit, ChangeDetectionStrategy} from '@angular/core';
import { PartnerInterface, PartnerService } from '../../../../_common/services/partner.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CellMeetingComponent } from './cell-meeting.component';


/**
 * @title cell meeting container
 */
@Component({
    selector: 'async-contacts-container',
    imports: [CellMeetingComponent],
    providers: [],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
  @if (partner) {
    <async-cell-meeting [partner]="partner"></async-cell-meeting>
  }
  `
})
export class CellMettingContainerComponent implements OnInit {

  partner!: PartnerInterface;
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private partnerService: PartnerService,
  ) { }

  ngOnInit() {

    // get current signed in user (shared subject — tracked)
    this.partnerService.getSharedPartnerData$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(

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
  }
}
