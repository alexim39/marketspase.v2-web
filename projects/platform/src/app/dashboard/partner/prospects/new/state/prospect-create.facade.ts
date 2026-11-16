import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LeadPipelineService } from '../../lead-pipeline/lead-pipeline.service';
import { CreateContactPayload } from '../../lead-pipeline/lead.models';
import { ApiError, userError } from '../../../../../core/http/api-error';

/** Shared quick-add prospect form. */
@Injectable()
export class ProspectCreateFacade {
  private readonly leads = inject(LeadPipelineService);
  private readonly router = inject(Router);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = {
    prospectName: '',
    prospectSurname: '',
    prospectPhone: '',
    prospectEmail: '',
    prospectSource: 'Personal conversation',
    relationship: 'Other',
    consentToContact: false,
    notes: '',
  };

  canSave(): boolean {
    return this.form.prospectName.trim().length >= 2 && this.form.prospectPhone.trim().length >= 7;
  }

  save(): void {
    if (!this.canSave() || this.saving()) {
      this.error.set('Add at least a name and phone number.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.leads.createContact({
      prospectName: this.form.prospectName.trim(),
      prospectSurname: this.form.prospectSurname.trim(),
      prospectPhone: this.form.prospectPhone.trim(),
      prospectEmail: this.form.prospectEmail.trim(),
      prospectSource: this.form.prospectSource.trim() || 'Personal conversation',
      relationship: this.form.relationship as CreateContactPayload['relationship'],
      consentToContact: this.form.consentToContact,
      notes: this.form.notes.trim(),
    }).subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigate(['/dashboard/prospects/pipeline']);
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        this.error.set(userError(err));
      },
    });
  }
}
