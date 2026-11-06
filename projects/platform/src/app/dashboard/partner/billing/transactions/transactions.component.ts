import { AfterViewInit, Component, inject, Input, OnDestroy, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';  
import { MatInputModule } from '@angular/material/input';  
import { MatFormFieldModule } from '@angular/material/form-field';  
import { FormsModule } from '@angular/forms';  
import { MatButtonModule } from '@angular/material/button';  
import { MatIconModule } from '@angular/material/icon';  
import { MatTableDataSource, MatTableModule } from '@angular/material/table';  
import { CommonModule } from '@angular/common';  
import { TransactionInterface } from '../paystack.service';  
import { MatDialog } from '@angular/material/dialog';  
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';  
import {MatTabsModule} from '@angular/material/tabs';
import { PartnerInterface } from '../../../../_common/services/partner.service';

/**  
 * @title Billing  
 */  
@Component({
    selector: 'async-transactions',
    styleUrls: ['transactions.component.scss'],
    templateUrl: 'transactions.component.html',
    providers: [],
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
        MatTabsModule
    ]
})  
export class TransactionsComponent implements OnInit, AfterViewInit {  
  @Input() partner!: PartnerInterface;  
  @Input() transactions!: TransactionInterface;  
  readonly dialog = inject(MatDialog);  

  filterText: string = '';  
  displayedColumns: string[] = ['transactionId', 'dateOfPayment', 'amount', 'paymentMethod', 'paymentStatus', 'transactionType', 'action'];  
  dataSource = new MatTableDataSource<any>([]);  
  isEmptyRecord = false;  

  @ViewChild(MatPaginator) paginator!: MatPaginator;  

  constructor(
    
  ) {}  

  ngOnInit() {  

    if (this.transactions && this.transactions.data) {

      // Ensure that the data is an array and sort it  
      this.dataSource.data = this.transactions.data.sort((a, b) => {  
        return new Date(b.date).getTime() - new Date(a.date).getTime();  
      });  

      // Check if there are no records  
      this.isEmptyRecord = this.transactions.data.length === 0;  

    } else {  
      this.isEmptyRecord = true; // Set to true if no transactions are available  
    }  
  }  

  applyFilter() {  
    const filterValue = this.filterText.trim().toLowerCase();  
    this.dataSource.filter = filterValue;  
  }  

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
  }


  
}