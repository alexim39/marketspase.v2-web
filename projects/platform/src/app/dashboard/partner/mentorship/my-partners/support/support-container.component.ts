import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MyPartnerSupportComponent } from './support.component';
import { Subscription } from 'rxjs';
import { PartnerInterface } from '../../../../../_common/services/partner.service';
import { MyPartnersService } from '../my-partners.service';

@Component({
    selector: 'async-my-partner-support-container',
    template: `
  @if (!isEmptyRecord) {
    @if (myPartner) {
      <async-my-partner-support
        [myPartner]="myPartner"
        [myPartnerPartners]="myPartnerPartners"
        />
    }
  }
  @if (isEmptyRecord) {
    <div class="container">
      <p class="no-content">This member could not be loaded — they may have been reassigned.</p>
      <button mat-flat-button (click)="back()"><mat-icon>arrow_back</mat-icon>Back to My partners</button>
    </div>
  }
  `,
    providers: [MyPartnersService],
    imports: [MyPartnerSupportComponent, MatButtonModule, MatIconModule],
    changeDetection: ChangeDetectionStrategy.Eager,
    styles: `
  .container {
    padding: 2em;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  .no-content {
    color: var(--ms-primary-strong);
    font-weight: bold;
    text-align: center;
  }
   
  `
})
export class MyPartnerSupportContainerComponent implements OnInit, OnDestroy {

  myPartner!: PartnerInterface;
  myPartnerId!: string | null;
  isEmptyRecord = false;
  subscriptions: Subscription[] = [];

  myPartnerPartners!: any; //Array<PartnerInterface>;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private myPartnersService: MyPartnersService
  ) { }

  back(): void {
    this.router.navigateByUrl('dashboard/mentorship/partners/my-partners');
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.myPartnerId = params.get('id');
      if (this.myPartnerId !== null) {
        // Fetch partner details using the ID
        this.subscriptions.push(
          this.myPartnersService.getPartnerById(this.myPartnerId, { maskContacts: true }).subscribe({
            next: (partner) => {
            this.myPartner = partner.data;

            // Get this partner's downlines/partner
            this.myPartnersService.getPartnersOf(partner.data._id, { maskContacts: true }).subscribe({
              next: (partnerPartners) => {
                this.myPartnerPartners = partnerPartners.data;
              }
            })
          }, 
          error: () => {
            this.isEmptyRecord = true;
          }
        })
        )
      }
    });
  }

  ngOnDestroy() {
    // unsubscribe list
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  /*  browserBackHistory () {
     window.history.back();  
   } */
}
