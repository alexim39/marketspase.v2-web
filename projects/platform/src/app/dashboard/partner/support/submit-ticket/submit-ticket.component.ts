import { Component, inject, Input, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { PartnerInterface } from '../../../../_common/services/partner.service';
import { MatDialog } from '@angular/material/dialog';
import { HelpDialogComponent } from '../../../../_common/help-dialog.component';
import { MatIconModule } from '@angular/material/icon';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Router, RouterModule } from '@angular/router';
import { TicketService } from './submit-ticket.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';

import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatDatepickerModule} from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core'; // For native date adapter  
import { HttpErrorResponse } from '@angular/common/http';
import { userError } from '../../../../core/http/api-error';
import { UiFeedbackService } from '../../../../core/ui/ui-feedback.service';

/**
 * @title Mentors Program
 */
@Component({
selector: 'async-submit-ticket',
template: `

<section class="async-background ">
  <h2>Help & Feedback <mat-icon (click)="showDescription()">help</mat-icon></h2>

  <section class="async-container">

    <div class="title">
      <h3>Submit A New Ticket</h3>
      <div class="action-area">
        <!-- <a mat-list-item title="Import Numbers from Contact" mat-raised-button><mat-icon>cloud_download</mat-icon>Import Numbers from Contact</a> -->
        <!-- <mat-button-toggle-group>
        <mat-button-toggle routerLink="../manage-contacts" routerLinkActive="active" (click)="scrollToTop()" title="View contact list"><mat-icon>list</mat-icon>Contact List</mat-button-toggle>
        <mat-button-toggle (click)="importContacts()" title="Import Contacts from campain prospect list"><mat-icon>cloud_download</mat-icon>Import Prospect from Online</mat-button-toggle>
      </mat-button-toggle-group> -->

    </div>
  </div>

  <div class="form-container">
    <form class="flex-form" [formGroup]="ticketForm" (ngSubmit)="onSubmit()">


      <div class="form-group">
        <mat-form-field appearance="outline">
          <mat-label>Subject of the issue</mat-label>
          <input matInput formControlName="subject" required>
          @if (ticketForm.get('subject')?.hasError('required') ) {
            <mat-error>
              This field is required.
            </mat-error>
          }
        </mat-form-field>
      </div>

      <div class="form-group">
        <mat-form-field appearance="outline">
          <mat-label>Description of the challenge faced</mat-label>
          <textarea matInput formControlName="description"></textarea>
          @if (ticketForm.get('description')?.hasError('required') ) {
            <mat-error>
              This field is required.
            </mat-error>
          }
        </mat-form-field>
      </div>

      <div class="form-group">
        <mat-form-field appearance="outline">
          <mat-label>Date the issue occurred</mat-label>
          <input matInput [matDatepicker]="dp" formControlName="date">
          <mat-hint>MMMM DD, YYYY</mat-hint>
          <mat-datepicker-toggle matIconSuffix [for]="dp"></mat-datepicker-toggle>
          <mat-datepicker #dp></mat-datepicker>
          @if (ticketForm.get('date')?.hasError('required') ) {
            <mat-error>
              This field is required.
            </mat-error>
          }
        </mat-form-field>
      </div>

      <div class="form-group">
        <mat-form-field appearance="outline">
          <mat-label>Category</mat-label>
          <mat-select formControlName="category" required>
            <mat-option value="Technical Issue">Technical Issue</mat-option>
            <mat-option value="Feature Request">Feature Request</mat-option>
            <mat-option value="Feedback/Suggestion">Feedback/Suggestion</mat-option>
            <mat-option value="Account Issues">Account Issues</mat-option>
            <mat-option value="Billing/Payment Issues">Billing/Payment Issues</mat-option>
            <mat-option value="Usability Issue">Usability Issue</mat-option>
            <mat-option value="Performance Issues">Performance Issues</mat-option>
            <mat-option value="Bug Report">Bug Report</mat-option>
            <mat-option value="Accessibility Issue">Accessibility Issue</mat-option>
            <mat-option value="Security Concern">Security Concern</mat-option>
            <mat-option value="Onboarding/Setup Assistance">Onboarding/Setup Assistance</mat-option>
            <mat-option value="Integration Questions">Integration Questions</mat-option>
            <mat-option value="General Inquiry">General Inquiry</mat-option>
          </mat-select>
          @if (ticketForm.get('category')?.hasError('required') ) {
            <mat-error>
              This field is required.
            </mat-error>
          }
        </mat-form-field>
      </div>

      <div class="form-group">
        <mat-form-field appearance="outline">
          <mat-label>Priority Level </mat-label>
          <mat-select formControlName="priority" required>
            <mat-option value="Low">Low</mat-option>
            <mat-option value="Medium">Medium</mat-option>
            <mat-option value="High">High</mat-option>
          </mat-select>
          @if (ticketForm.get('priority')?.hasError('required') ) {
            <mat-error>
              This field is required.
            </mat-error>
          }
        </mat-form-field>
      </div>

      <div class="form-group">
        <mat-form-field appearance="outline">
          <mat-label>Additional Comments (optional)</mat-label>
          <textarea matInput formControlName="comment"></textarea>
        </mat-form-field>
      </div>


      <div class="form-group"></div>
      <button mat-flat-button color="primary">Submit</button>
    </form>
  </div>

</section>

</section>

`,
styles: [`

.async-background {
    margin: 2em;
    .async-container {
        background-color: #dcdbdb;
        border-radius: 10px;
        height: 100%;
        padding: 1em;
        .title {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #ccc;
            padding: 1em;
            .action-area {
                .action {
                    font-weight: bold;
                    margin-top: 1em;
                }
            }
        }

        .search {
            padding: 0.5em 0;
            text-align: center;
            mat-form-field {
                width: 70%;

            }
        }       

        .no-campaign {
            text-align: center;
            color: rgb(196, 129, 4);
            font-weight: bold;
        }
    }
}


.form-container {
    margin-top: 1em;
    padding: 20px;
    background-color: white;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    border-radius: 5px;
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


@media (max-width: 600px) {
    .form-group {
        flex: 1 1 100%;
    }
}


`],
providers: [TicketService],
changeDetection: ChangeDetectionStrategy.Eager,
imports: [MatIconModule, RouterModule, MatNativeDateModule, MatDatepickerModule, MatExpansionModule, MatFormFieldModule, MatButtonModule, FormsModule, MatInputModule, ReactiveFormsModule, MatSelectModule]
})
export class SubmitTicketComponent implements OnInit {
  readonly panelOpenState = signal(false);
  
    @Input() partner!: PartnerInterface;
    readonly dialog = inject(MatDialog);
  private readonly ui = inject(UiFeedbackService);

    ticketForm!: FormGroup;
    subscriptions: Array<Subscription> = [];

    constructor(
     private ticketService: TicketService,
      private router: Router,
    ) {}


    ngOnInit(): void {

        if (this.partner) {
          this.ticketForm = new FormGroup({
            subject: new FormControl('', Validators.required),
            description: new FormControl('', Validators.required),
            date: new FormControl('', Validators.required),
            category: new FormControl('', Validators.required),
            priority: new FormControl('', Validators.required),
            comment: new FormControl(''),
            partnerId: new FormControl(this.partner._id),
          });
        }
    }

    onSubmit() {
      const ticketObject = this.ticketForm.value;

      if (this.ticketForm.valid) {
        this.subscriptions.push(
          this.ticketService.submitTicket(ticketObject).subscribe({
            next: (response) => {
              this.ui.success(response.message || 'Your ticket has been submitted. We will follow up with updates.');
            },
            error: (error: HttpErrorResponse) => {
              this.ui.error(userError(error));
            }
          })
        )
      }
    }

    showDescription () {
      this.dialog.open(HelpDialogComponent, {
        data: {help: `
          Contact the application administrator for assistance, feedback, and suggestions for improvement.

          <p>Feel free to share any challenges you encounter while using the app, along with any suggestions for improvements or features you would like to see added.</p>
        `},
      });
    }

    ngOnDestroy() {
      // unsubscribe list
      this.subscriptions.forEach(subscription =>  subscription.unsubscribe());
    }
}
