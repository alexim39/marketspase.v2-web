import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, inject, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { ContactsService } from '../../contacts.service';
import { PartnerInterface, PartnerService } from '../../../../../_common/services/partner.service';
import { userError } from '../../../../../core/http/api-error';
import { UiFeedbackService } from '../../../../../core/ui/ui-feedback.service';
import { Subscription } from 'rxjs';

/**
 * Convert a prospect to a partner — no reservation code.
 *
 * The prospect is marked Converted and can complete open registration. The
 * system places new partners; the old business-issued code step is retired.
 */
@Component({
  selector: 'async-collect-code-dialog',
  styles: `
    p { margin: 0 0 0.6em; line-height: 1.5; }
    .muted { color: var(--ms-text-muted); font-size: 0.88em; }
  `,
  providers: [ContactsService],
  template: `
    <h2 mat-dialog-title>Convert {{ data.prospectName | titlecase }} {{ data.prospectSurname | titlecase }}?</h2>

    <mat-dialog-content>
      <p>Mark this prospect as <strong>Converted</strong>. They can then sign up as a partner.</p>
      <p class="muted">After converting, share their personal signup link from the pipeline. Anyone who signs up through it — or with the email on this lead — joins your team automatically.</p>
    </mat-dialog-content>

    <mat-dialog-actions>
      <button mat-button type="button" (click)="close()">Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="convert()">Convert to partner</button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatDialogTitle, MatDialogContent, MatDialogActions],
})
export class CollectCodeComponent implements OnDestroy {
  readonly dialogRef = inject(MatDialogRef<CollectCodeComponent>);
  readonly data = inject<{ prospectId: string; _id?: string; partnerId: string; prospectName: string; prospectSurname: string }>(MAT_DIALOG_DATA);
  private readonly ui = inject(UiFeedbackService);
  private readonly contactsService = inject(ContactsService);
  private readonly partnerService = inject(PartnerService);
  private currentPartner: PartnerInterface | null = null;
  private subscription?: Subscription;
  private readonly partnerSubscription: Subscription;

  constructor() {
    this.partnerSubscription = this.partnerService.getSharedPartnerData$.subscribe({
      next: (partner) => { this.currentPartner = partner ?? null; },
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  convert(): void {
    const prospectId = String(this.data.prospectId ?? this.data._id ?? '');
    if (!prospectId) return;
    this.subscription = this.contactsService.promoteProspectToPartner({
      prospectId,
      ...(this.currentPartner?._id ? { by: this.currentPartner._id } : {}),
      ...((this.currentPartner?.name || this.currentPartner?.surname || this.currentPartner?.username)
        ? { byName: [this.currentPartner?.name, this.currentPartner?.surname].filter(Boolean).join(' ') || this.currentPartner?.username }
        : {}),
    }).subscribe({
      next: () => {
        this.dialogRef.close({ converted: true });
        void this.ui.alert({
          title: 'Prospect converted',
          message: `${this.data.prospectName} ${this.data.prospectSurname} can now sign up. Share their personal signup link from the pipeline so they join your team automatically.`,
          tone: 'success',
        });
      },
      error: (error: unknown) => {
        this.ui.error(userError(error));
      },
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.partnerSubscription.unsubscribe();
  }
}
