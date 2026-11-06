import { Component, inject, Input, ChangeDetectionStrategy } from '@angular/core';
import { PartnerInterface } from '../../../_common/services/partner.service';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { HelpDialogComponent } from '../../../_common/help-dialog.component';
import { MatIconModule } from '@angular/material/icon';
import {MatTabsModule} from '@angular/material/tabs';
import { EnterPhoneNumbersComponent } from './enter-phone-numbers/enter-phone-numbers.component';

import { Router, RouterModule } from '@angular/router';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import { ProspectPickerComponent } from './prospect-picker/prospect-picker.component';

@Component({
selector: 'async-sms',
imports: [MatButtonModule, MatIconModule, MatTabsModule, RouterModule, EnterPhoneNumbersComponent, MatButtonToggleModule, ProspectPickerComponent],
template: `

<section class="breadcrumb-wrapper">
  <div class="breadcrumb">
    <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (click)="scrollToTop()">Dashboard</a> &gt;
    <a>Tools</a> &gt;
    <a>SMS</a> &gt;
    <span>Send SMS</span>
  </div>
</section>

<section class="async-background ">
  <div class="page-head">
    <div>
      <h2>Send SMS <mat-icon (click)="showDescription()">help</mat-icon></h2>
      <p class="subtitle">Reach many prospects at once — charged per page, logged to timelines.</p>
    </div>
    <a mat-button routerLink="../../../tools/sms/messages" (click)="scrollToTop()" title="SMS inbox"><mat-icon>sms</mat-icon> SMS inbox</a>
  </div>

  <section class="async-container">

    <div class="title">
      <div class="control">
        <div class="back" (click)="back()" title="Back">
          <mat-icon>arrow_back</mat-icon>
        </div>
        <mat-button-toggle-group>
          <mat-button-toggle (click)="importContactPhoneNumbers()" title="Import Numbers from contact list"><mat-icon>cloud_download</mat-icon> Import Numbers from Contact</mat-button-toggle>
        </mat-button-toggle-group>
      </div>
      <h3>Compose</h3>

    </div>


    <div class="container">

      <mat-tab-group mat-stretch-tabs="false" mat-align-tabs="start" [selectedIndex]="tabIndex" (selectedIndexChange)="tabIndex = $event">
        <mat-tab label="Enter Phone Numbers">
          @if (partner) {
            <async-enter-phone-numbers [partner]="partner"/>
          }
        </mat-tab>
        <mat-tab label="Choose from Prospects">
          @if (partner) {
            <async-prospect-picker [partnerId]="partner._id" (applied)="tabIndex = 0"/>
          }
        </mat-tab>
      </mat-tab-group>

    </div>


  </section>

</section>

`,
changeDetection: ChangeDetectionStrategy.Eager,
styles: [`

.async-background {
    display: flex;
    flex-direction: column;
    gap: 1em;
    padding-bottom: 2em;
    .page-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1em;
        h2 {
            margin: 0;
            display: flex;
            align-items: center;
            gap: 0.4em;
            mat-icon {
                cursor: pointer;
            }
        }
        a[mat-button] {
            min-height: 44px;
        }
    }
    .subtitle {
        margin: 0.25em 0 0;
        color: var(--ms-text-muted);
        max-width: 44em;
    }
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

        mat-button-toggle-group {
            flex-wrap: wrap;
        }
    }
}

.container {
    margin-top: 1em;
    padding: 20px;
    background: var(--ms-surface);
    border: 1px solid var(--ms-line);
    border-radius: var(--ms-radius-md);
}


@media (max-width: 600px) {
    .form-group {
        flex: 1 1 100%;
    }
}

`]
})
export class smsComponent {

  @Input() partner!: PartnerInterface;
  readonly dialog = inject(MatDialog);
  tabIndex = 0;

  constructor(
    private router: Router,
  ) {}

    showDescription () {
      this.dialog.open(HelpDialogComponent, {
        data: {help: `
          Here, you can effortlessly send single or bulk SMS to your contact list and manage your SMS message.
        `},
      });
    }
  
    importContactPhoneNumbers() {
      this.router.navigate(['/dashboard/prospects/pipeline']);
    }

    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    back(): void {  
      if (window.history.length > 1) {  
          window.history.back();  
      } else {  
          // Redirect to a default route if there's no history  
          this.router.navigate(['/dashboard/tools/contacts/new']);
      }  
    }
      
}
