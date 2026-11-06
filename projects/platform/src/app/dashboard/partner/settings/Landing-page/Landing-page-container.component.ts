
import {Component, OnDestroy, OnInit, ChangeDetectionStrategy} from '@angular/core';
import { PartnerInterface, PartnerService } from '../../../../_common/services/partner.service';
import { Subscription } from 'rxjs';
import { LandingPageSettingComponent } from './Landing-page.component';


/**
 * @title Manage comapaing container
 */
@Component({
    selector: 'async-landing-page-setting-container',
    imports: [LandingPageSettingComponent],
    providers: [],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
  @if (partner) {
    <async-landing-page-setting [partner]="partner"/>
  }
  `
})
export class LandingPageSettingContainerComponent implements OnInit, OnDestroy {

  partner!: PartnerInterface;
  campaigns!: any;
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
        },
      })
    )
  }

  ngOnDestroy() {
    // unsubscribe list
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}