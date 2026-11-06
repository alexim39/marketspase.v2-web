import { Component, inject, Input, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { PartnerInterface } from '../../../_common/services/partner.service';
import { EmailService } from './email.service';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { HelpDialogComponent } from '../../../_common/help-dialog.component';
import { MatIconModule } from '@angular/material/icon';
import {MatTabsModule} from '@angular/material/tabs';
import { EnterEmailComponent } from './enter-email/enter-email.component';

import { Router, RouterModule } from '@angular/router';
import {MatButtonToggleModule} from '@angular/material/button-toggle';


@Component({
selector: 'async-email',
imports: [MatButtonModule, MatIconModule, RouterModule, MatTabsModule, EnterEmailComponent, MatButtonToggleModule],
providers: [EmailService],
template: `

<section class="breadcrumb-wrapper">
  <div class="breadcrumb">
    <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (click)="scrollToTop()">Dashboard</a> &gt;
    <a>Tools</a> &gt;
    <a>Email</a> &gt;
    <span>Send Email</span>
  </div>
</section>

<section class="async-background ">
  <div class="page-head">
    <div>
      <h2>Send Email <mat-icon (click)="showDescription()">help</mat-icon></h2>
      <p class="subtitle">One message to many inboxes — free, logged, trackable.</p>
    </div>
    <a mat-button routerLink="../../../tools/email/logs" (click)="scrollToTop()" title="Email inbox"><mat-icon>mail</mat-icon> Email inbox</a>
  </div>

  <section class="async-container">

    <div class="title">
      <div class="control">
        <div class="back" (click)="back()" title="Back">
          <mat-icon>arrow_back</mat-icon>
        </div>
        <mat-button-toggle-group>
          <mat-button-toggle (click)="importEmailsNumbers()" title="Import Emails from contact list"><mat-icon>cloud_download</mat-icon> Import Emails from Contact</mat-button-toggle>
        </mat-button-toggle-group>
      </div>
      <h3>Compose</h3>

    </div>


    <div class="container">

      <mat-tab-group mat-stretch-tabs="false" mat-align-tabs="start">
        <mat-tab label="Enter Email Address">
          @if (partner) {
            <async-enter-email [partner]="partner"/>
          }
        </mat-tab>
        <!-- <mat-tab label="Import From Contacts">Content 2</mat-tab> -->
        <!-- <mat-tab label="Upload From Excel File">Content 3</mat-tab> -->
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
export class EmailComponent{

  @Input() partner!: PartnerInterface;
  readonly dialog = inject(MatDialog);

  constructor(
    private emailService: EmailService,
    private router: Router,
  ) {}


  showDescription () {
    this.dialog.open(HelpDialogComponent, {
      data: {help: `
        Here, you can effortlessly send single or bulk email to your contact list and manage your sent emails.
      `},
    });
  }

    importEmailsNumbers() {
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
