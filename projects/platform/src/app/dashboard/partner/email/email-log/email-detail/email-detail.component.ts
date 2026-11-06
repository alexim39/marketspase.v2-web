import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { Subscription } from 'rxjs';
import { EmailService } from '../../email.service';
import { HttpErrorResponse } from '@angular/common/http';
import { userError } from '../../../../../core/http/api-error';
import { UiFeedbackService } from '../../../../../core/ui/ui-feedback.service';

/**
 * @title Email Details Dialog
*/

@Component({
    selector: 'async-email-detail-dialog',
    template: `
    <section>
        <h2 mat-dialog-title>
            {{data.emailSubject | uppercase }}
        </h2>
        <mat-dialog-content class="mat-typography">
            <small class="muted">Message:</small>
            <p [innerHTML]="safeHtmlEmailBody" class="body-text"></p>

            <small class="muted">Recipient: {{data.prospects.length}}</small>
            <p class="body-text muted">
                {{ data.prospects.join(', ') }}
            </p>
        </mat-dialog-content>

        <mat-accordion>

        <mat-expansion-panel class="more-action">
            <mat-expansion-panel-header>
                <mat-panel-title> More Action </mat-panel-title>
                </mat-expansion-panel-header>
                <p class="muted">Delete prospect from system</p>
                <button mat-stroked-button (click)="delete(data._id)" class="danger">
                <mat-icon>delete</mat-icon>
                Delete
                </button>
            </mat-expansion-panel>
        </mat-accordion>

        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close>Ok</button>
        </mat-dialog-actions>
    </section>
  `,
    styles: `
    .muted { color: var(--ms-text-muted); }
    .body-text { line-height: 1.7em; overflow-wrap: anywhere; }
    .more-action { margin: 2em; }
    .danger { color: var(--ms-error); }
    html[data-theme='dark'] .danger { color: #e89a9a; }
  `,
    providers: [EmailService],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatDialogModule, MatExpansionModule, CommonModule, MatListModule, MatIconModule, MatButtonModule]
})
export class EmailDetailDialogComponent implements OnDestroy, OnInit {
    readonly data = inject<any>(MAT_DIALOG_DATA);
    subscriptions: Array<Subscription> = [];
    readonly dialogRef = inject(MatDialogRef<EmailDetailDialogComponent>);
  private readonly ui = inject(UiFeedbackService);

    // Angular sanitizes [innerHTML] by default — no bypass (stored-XSS safe).
    safeHtmlEmailBody = '';

    constructor(
        private email: EmailService
    ) { }

    ngOnInit(): void {
        this.safeHtmlEmailBody = String(this.data?.emailBody ?? '');
    }

    close(): void {
        this.dialogRef.close();
    }

    delete(id: string) {
        void this.ui.confirm({
            title: 'Delete email?',
            message: 'This removes the email from your sent log. This cannot be undone.',
            tone: 'error',
            confirmText: 'Delete',
        }).then((confirmed) => {
            if (!confirmed) return;
            this.subscriptions.push(
                this.email.deleteSingleEmail(id).subscribe({
                    next: (response) => {
                        void this.ui.alert({
                            title: 'Email deleted',
                            message: response.message || 'The email was removed from your log.',
                            tone: 'success',
                        }).then(() => location.reload());
                    },
                    error: (error: HttpErrorResponse) => this.ui.error(userError(error)),
                })
            );
        });
    }

    ngOnDestroy() {
        // unsubscribe list
        this.subscriptions.forEach(subscription => {
            subscription.unsubscribe();
        });
    }
}
