import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PartnerInterface, PartnerService } from '../../../../_common/services/partner.service';
import { Subscription } from 'rxjs';

import { ResourceDownloadComponent } from './resource-download.component';

/**
 * @title Monthly purchase container
 */
@Component({
    selector: 'async-resource-download-container',
    template: `
    @if (partner) {
      <async-resource-download [partner]="partner"/>
    }
    `,
    providers: [],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatIconModule, ResourceDownloadComponent]
})
export class ResourceDownloadContainerComponent implements OnInit, OnDestroy {

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