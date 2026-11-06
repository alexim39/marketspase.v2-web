
import {Component, DestroyRef, inject, OnInit, ChangeDetectionStrategy} from '@angular/core';
import { PartnerInterface, PartnerService } from '../../../_common/services/partner.service';
import { filter, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BillingComponent } from './billing.component';
import { PaystackService, TransactionInterface } from './paystack.service';


/**
 * @title Manage comapaing container
 */
@Component({
    selector: 'async-billing-container',
    imports: [BillingComponent],
    providers: [],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
  @if (partner && transactions) {
    <async-billing [partner]="partner"  [transactions]="transactions"></async-billing>
  }
  `
})
export class BillingContainerComponent implements OnInit {

  partner!: PartnerInterface;
  transactions!: TransactionInterface;
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private partnerService: PartnerService,
    private paystackService: PaystackService
  ) { }

  ngOnInit() {
      
    // get current signed in user, then their transactions — one stream.
    this.partnerService.getSharedPartnerData$.pipe(
      takeUntilDestroyed(this.destroyRef),
      filter((partner): partner is PartnerInterface => !!partner),
      tap(partner => { this.partner = partner; }),
      switchMap(partner => this.paystackService.getTransactions(partner._id))
    ).subscribe({
      next: (transactions: TransactionInterface) => {
        this.transactions = transactions;
      },
      error: error => {
        console.log(error)
        // redirect to home page
      },
    })
  }
}
