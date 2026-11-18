import { AfterViewInit, Component, inject, Input, OnDestroy, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';  
import { MatInputModule } from '@angular/material/input';  
import { MatFormFieldModule } from '@angular/material/form-field';  
import { FormsModule } from '@angular/forms';  
import { MatButtonModule } from '@angular/material/button';  
import { MatIconModule } from '@angular/material/icon';  
import { MatTableDataSource, MatTableModule } from '@angular/material/table';  
import { CommonModule } from '@angular/common';  
import { RouterModule } from '@angular/router';
import { PaystackService, TransactionInterface, WithdrawalResult } from './paystack.service';  
import { PartnerInterface } from '../../../_common/services/partner.service';  
import { MatDialog } from '@angular/material/dialog';  
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';  
import { BillingWithdrawComponent } from './billing-withdraw.component';
import {MatTabsModule} from '@angular/material/tabs';
import { TransactionsComponent } from './transactions/transactions.component';

/**  
 * @title Billing  
 */  
@Component({
    selector: 'async-billing',
    styleUrls: ['billing.component.scss', 'billing.mobile.scss'],
    templateUrl: 'billing.component.html',
    providers: [PaystackService],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        CommonModule,
        MatPaginatorModule,
        MatFormFieldModule,
        MatTableModule,
        MatInputModule,
        MatIconModule,
        MatButtonModule,
        MatTabsModule,
        RouterModule,
        TransactionsComponent
    ]
})  
export class BillingComponent implements OnInit, AfterViewInit {  
  @Input() partner!: PartnerInterface;  
  @Input() transactions!: TransactionInterface;  
  readonly dialog = inject(MatDialog);  

  currentBalance!: number | undefined; // Initial withdrawable balance
  bonusBalance = 0;
  filterText: string = '';  
  displayedColumns: string[] = ['transactionId', 'dateOfPayment', 'amount', 'paymentMethod', 'paymentStatus', 'transactionType', 'action'];  
  dataSource = new MatTableDataSource<any>([]);  
  isEmptyRecord = false;  

  @ViewChild(MatPaginator) paginator!: MatPaginator;  

  constructor(private paystackService: PaystackService) {}  

  ngOnInit() {  
    this.bonusBalance = Math.max(0, Number(this.partner?.bonusBalance ?? 0));
    this.currentBalance = this.partner
      ? Math.max(0, Number(this.partner.withdrawableBalance
        ?? (Number(this.partner.balance ?? 0) - this.bonusBalance)))
      : 0;

   /*  if (this.transactions && this.transactions.data) {

      // Ensure that the data is an array and sort it  
      this.dataSource.data = this.transactions.data.sort((a, b) => {  
        return new Date(b.date).getTime() - new Date(a.date).getTime();  
      });  

      // Check if there are no records  
      this.isEmptyRecord = this.transactions.data.length === 0;  

    } else {  
      this.isEmptyRecord = true; // Set to true if no transactions are available  
    }   */
  }  

 /*  applyFilter() {  
    const filterValue = this.filterText.trim().toLowerCase();  
    this.dataSource.filter = filterValue;  
  }  */ 

  ngAfterViewInit() {
    //this.dataSource.paginator = this.paginator;
  }

  withdrawFund(): void {
    const dialogRef = this.dialog.open<BillingWithdrawComponent, PartnerInterface, WithdrawalResult>(BillingWithdrawComponent, {
      data: this.partner,
      width: '600px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;
      if (typeof result.withdrawableBalance === 'number') {
        this.currentBalance = result.withdrawableBalance;
      } else if (typeof result.balance === 'number') {
        this.currentBalance = Math.max(0, result.balance - this.bonusBalance);
      }
      if (typeof result.balance === 'number' && this.partner) {
        this.partner.balance = result.balance;
        this.partner.withdrawableBalance = this.currentBalance;
      }
      if (typeof result.bonusBalance === 'number') this.bonusBalance = result.bonusBalance;
    });
  }

  reloadBalance() {  
    location.reload();  
  }  
}