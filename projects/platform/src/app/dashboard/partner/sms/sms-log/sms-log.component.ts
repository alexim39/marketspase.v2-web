import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, inject, Input, OnDestroy, OnInit, SimpleChanges, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { PartnerInterface } from '../../../../_common/services/partner.service';
import { MatIconModule } from '@angular/material/icon';
import { HelpDialogComponent } from '../../../../_common/help-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { Subscription } from 'rxjs';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterModule } from '@angular/router';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { TruncatePipe } from '../../../../_common/pipes/truncate.pipe';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { SMSDetailDialogComponent } from './sms-detail/sms-detail.component';

@Component({
selector: 'async-sms-log',
template: `

<section class="breadcrumb-wrapper">
  <div class="breadcrumb">
    <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (click)="scrollToTop()">Dashboard</a> &gt;
    <a>Tools</a> &gt;
    <a>SMS</a> &gt;
    <span>SMS inbox</span>
  </div>
</section>

<section class="async-background">
  <h2>SMS inbox <mat-icon (click)="showDescription()">help</mat-icon></h2>

  <section class="async-container">
    <div class="title">
      <div class="control">
        <div class="back" (click)="back()" title="Back">
          <mat-icon>arrow_back</mat-icon>
        </div>
        <a mat-list-item routerLink="../../sms/new" routerLinkActive="active" (click)="scrollToTop()" title="New SMS" mat-raised-button>
          <mat-icon>add</mat-icon>New SMS
        </a>
      </div>
      <h3>History</h3>
    </div>

    @if (!isEmptyRecord) {
      <div class="chip-row" role="status">
        <mat-chip highlighted>{{ dataSource.data.length }} batch{{ dataSource.data.length === 1 ? '' : 'es' }}</mat-chip>
        <mat-chip highlighted>{{ totalRecipients() }} recipients</mat-chip>
      </div>
      <div class="search">
        <mat-form-field appearance="outline">
          <mat-label>Filter by sms message</mat-label>
          <input matInput type="search" name="smsFilter" [(ngModel)]="filterText" (input)="filterSMS()" />
        </mat-form-field>
      </div>
      <div class="table">
        <table mat-table [dataSource]="dataSource" class="mat-elevation-z8">
          <ng-container matColumnDef="reference">
            <th mat-header-cell *matHeaderCellDef> Reference </th>
            <td mat-cell *matCellDef="let element"> {{ element.transaction?.reference ?? '—' }} </td>
          </ng-container>
          <ng-container matColumnDef="message">
            <th mat-header-cell *matHeaderCellDef> Message </th>
            <td mat-cell *matCellDef="let element"> {{ element.smsBody | truncate:50 }} </td>
          </ng-container>
          <ng-container matColumnDef="recipients">
            <th mat-header-cell *matHeaderCellDef> Recipients </th>
            <td mat-cell *matCellDef="let element"> {{ element.prospect | truncate:35 }} </td>
          </ng-container>
          <ng-container matColumnDef="cost">
            <th mat-header-cell *matHeaderCellDef> Cost </th>
            <td mat-cell *matCellDef="let element"> {{ element.transaction ? (element.transaction.amount | currency:'₦':'symbol':'1.2-2') : '—' }} </td>
          </ng-container>
          <ng-container matColumnDef="pages">
            <th mat-header-cell *matHeaderCellDef> Pages </th>
            <td mat-cell *matCellDef="let element"> {{ pages(element.smsBody) }} </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef> Status </th>
            <td mat-cell *matCellDef="let element">
              <span class="dp-status {{ statusTone(element.status) }}">{{ element.status }}</span>
              @if (deliverySummary(element); as d) {
                <div class="muted small">{{ d }}</div>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef> Date </th>
            <td mat-cell *matCellDef="let element"> {{ element.createdAt | date }} </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;" (click)="openSMSDetailDialog(row)"></tr>
        </table>
        <mat-paginator [pageSizeOptions]="[10, 20, 30, 60, 100]" showFirstLastButtons></mat-paginator>
      </div>
    }

    @if (isEmptyRecord) {
      <div class="empty-card">
        <mat-icon>sms</mat-icon>
        <p>No SMS sent yet — compose your first bulk message.</p>
        <a mat-button routerLink="../../sms/new">Send SMS</a>
      </div>
    }
  </section>
</section>



`,
styles: [`
  
.async-background {
    display: flex;
    flex-direction: column;
    gap: 1em;
    padding-bottom: 2em;
    .async-container {
        background: var(--ms-surface);
        border: 1px solid var(--ms-line);
        border-radius: var(--ms-radius-md);
        height: 100%;
        padding: 1em;
        .title {
            border-bottom: 1px solid var(--ms-line);
            padding: 0.5em 0.5em 1em;
            display: flex;
            flex-direction: column;  
            //align-items: center; /* Vertically center the items */  
            justify-content: flex-start; 
            .control {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 0.5em;
                .back {
                    cursor: pointer;
                }
                .back:hover {
                    cursor: pointer;
                    opacity: 0.5;
    
                }
            }

           
            h3 {
                margin: 1em 0 0; 
            }
        }

        .search {
            padding: 0.5em 0;
            text-align: center;
            mat-form-field {
                width: min(70%, 560px);

            }
        }       

        .no-campaign {
            text-align: center;
            color: var(--ms-primary-strong);
            font-weight: bold;
        }

        .chip-row { display: flex; gap: 0.4em; flex-wrap: wrap; margin-bottom: 0.6em; }
        .muted { color: var(--ms-text-muted); font-size: 0.85em; }
        .small { font-size: 0.8em; }
        .empty-card { display: flex; flex-direction: column; align-items: center; gap: 0.5em; text-align: center; background: var(--ms-canvas); border: 1px dashed var(--ms-line); border-radius: 14px; padding: 2.5em 1.5em; color: var(--ms-text-muted); }
        .empty-card mat-icon { font-size: 40px; height: 40px; width: 40px; opacity: 0.6; }
        .empty-card p { margin: 0; max-width: 34em; }
        .empty-card a { min-height: 44px; }
    }
}

.form-container {
    padding: 20px;
    background: var(--ms-surface);
    border: 1px solid var(--ms-line);
    border-radius: var(--ms-radius-md);
    .flex-form {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        .form-group {
            flex: 1 1 calc(50% - 20px); /* Adjusting for gap space */
            display: flex;
            flex-direction: column;
        }    
    }
}


tr:hover {
    background: var(--ms-primary-soft);
    cursor: pointer;
}

tr:active {
    background: var(--ms-line);
}

@media (max-width: 600px) {
    .form-group {
        flex: 1 1 100%;
    }
}

`],
changeDetection: ChangeDetectionStrategy.Eager,
imports: [CommonModule, MatIconModule, TruncatePipe, MatPaginatorModule, RouterModule, MatButtonToggleModule, MatTableModule, MatIconModule, MatFormFieldModule, MatProgressBarModule, MatChipsModule,
        MatButtonModule, FormsModule, MatInputModule, MatSelectModule, MatCheckboxModule, ReactiveFormsModule]
})
export class SMSLogComponent implements OnInit, OnDestroy, AfterViewInit  {
  @Input() partner!: PartnerInterface;
  readonly dialog = inject(MatDialog);
  @Input() smsObject!: any;

  subscriptions: Array<Subscription> = [];
  filteredData: Array<any> = []; // To hold filtered data
  isEmptyRecord = false;
  filterText: string = '';
  displayedColumns: string[] = ['reference', 'message', 'recipients', 'cost', 'pages', 'status', 'date'];
  dataSource = new MatTableDataSource<any>(); // Use MatTableDataSource for pagination and filtering

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  
  constructor(
    private router: Router,
  ) { }

  ngOnInit(): void {
   /*  if (this.smsObject.data) {
      const sortedData = this.smsObject.data.sort((a: any, b: any) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      this.dataSource.data = sortedData;

      if (sortedData.length === 0) {
        this.isEmptyRecord = true;
      }
    } */
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['smsObject'] && this.smsObject) {
      this.dataSource.data = this.smsObject.sort((a: any, b: any) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      this.isEmptyRecord = this.smsObject.length === 0;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  ngAfterViewInit(): void {
    // Link MatPaginator to MatTableDataSource
    this.dataSource.paginator = this.paginator;
  }

  pages(characters: string): number {
    const messageLength = characters.length || 0;
    return Math.ceil(messageLength / 160);
  }

  statusTone(status: string): string {
    switch (String(status ?? '').toLowerCase()) {
      case 'success': return 'dp-status--ok';
      case 'failed': return 'dp-status--bad';
      default: return 'dp-status--warn';
    }
  }

  totalRecipients(): number {
    return this.dataSource.data.reduce((n: number, row: any) => {
      const list = row?.prospect;
      return n + (Array.isArray(list) ? list.length : 0);
    }, 0);
  }

  /** Provider delivery rollup (x delivered Â· y failed) once reports land. */
  deliverySummary(row: any): string | null {
    const delivery = row?.delivery;
    if (!delivery || typeof delivery !== 'object') return null;
    const states = Object.values(delivery).map((s) => String(s));
    if (states.length === 0) return null;
    const delivered = states.filter((s) => s === 'delivered').length;
    const failed = states.filter((s) => s === 'failed').length;
    const pending = states.length - delivered - failed;
    const bits = [`${delivered}/${states.length} delivered`];
    if (failed > 0) bits.push(`${failed} failed`);
    if (pending > 0) bits.push(`${pending} pending`);
    return bits.join(' Â· ');
  }

  filterSMS(): void {
    const searchText = this.filterText.toLowerCase().trim();
    this.dataSource.filter = searchText;

    // Update the empty record flag
    this.isEmptyRecord = this.dataSource.filteredData.length === 0;
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showDescription() {
    this.dialog.open(HelpDialogComponent, {
      data: {
        help: `View and manage your SMS to potential prospect`,
      },
    });
  }

  openSMSDetailDialog(smsRecord: any) {
    this.dialog.open(SMSDetailDialogComponent, {
      data: smsRecord
    });
  }

   back(): void {  
      if (window.history.length > 1) {  
          window.history.back();  
      } else {  
          // Redirect to a default route if there's no history  
          this.router.navigate(['/dashboard/tools/sms/new']);
      }  
    }
}
