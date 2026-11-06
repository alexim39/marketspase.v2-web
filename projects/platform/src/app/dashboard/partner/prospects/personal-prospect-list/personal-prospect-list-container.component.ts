
import {Component, OnDestroy, OnInit, ChangeDetectionStrategy} from '@angular/core';
import { PartnerInterface, PartnerService } from '../../../../_common/services/partner.service';
import { Subscription } from 'rxjs';
import { MyProspectListComponent } from './personal-prospect-list.component';
import { ProspectService, ProspectListInterface } from '../prospects.service';


/**
 * @title contacts container
 */
@Component({
    selector: 'async-my-prospect-list-container',
    imports: [MyProspectListComponent],
    providers: [ProspectService],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
  @if (partner && prospectList) {
    <async-my-prospect-list [partner]="partner" [prospectList]="prospectList"/>
  }
  `
})
export class MyProspectListContainerComponent implements OnInit, OnDestroy {

  partner!: PartnerInterface;
  subscriptions: Subscription[] = [];
  prospectList!: ProspectListInterface[];

  constructor(
    private partnerService: PartnerService,
    private prospectService: ProspectService,
  ) { }

  ngOnInit() {
      
    // get current signed in user
    this.subscriptions.push(
      this.partnerService.getSharedPartnerData$.subscribe({
        next:  (partnerObject) => {
          this.partner = partnerObject as PartnerInterface
          if (this.partner) {
            this.subscriptions.push(
              this.prospectService.getAllMyProspect(this.partner.username).subscribe({
                next: (response) => {
                  this.prospectList = response.data;
                },
                error: () => {
                  this.prospectList = [];
                }
              })
            )
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
