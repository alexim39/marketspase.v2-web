import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterModule } from '@angular/router';
import { LeadPipelineService } from './lead-pipeline/lead-pipeline.service';
import { CreateContactPayload } from './lead-pipeline/lead.models';
import { ApiError, userError } from '../../../core/http/api-error';

/**
 * Manual prospect quick-add. This replaces the retired warm-list/contact-list
 * onboarding page while keeping the core "add someone to my pipeline" flow.
 */
@Component({
  selector: 'async-prospect-create',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/prospects/pipeline">Pipeline</a> &gt;
        <span>Add prospect</span>
      </div>
    </section>

    <section class="page">
      <header class="page-head">
        <div>
          <p class="eyebrow">New conversation</p>
          <h1>Add someone to your pipeline</h1>
          <p class="subtitle">Record a person you are already talking to. Imported warm lists and bulk contact submission are retired.</p>
        </div>
        <a mat-stroked-button routerLink="/dashboard/prospects/pipeline"><mat-icon>arrow_back</mat-icon> Back to pipeline</a>
      </header>

      <form class="dp-card form" (ngSubmit)="save()">
        @if (error(); as message) {
          <p class="error" role="alert">{{ message }}</p>
        }
        @if (saving()) { <mat-progress-bar mode="indeterminate" aria-label="Saving prospect" /> }

        <div class="grid">
          <mat-form-field appearance="outline">
            <mat-label>First name</mat-label>
            <input matInput name="name" [(ngModel)]="form.prospectName" required maxlength="80" autocomplete="given-name" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Surname (optional)</mat-label>
            <input matInput name="surname" [(ngModel)]="form.prospectSurname" maxlength="80" autocomplete="family-name" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Phone</mat-label>
            <input matInput name="phone" [(ngModel)]="form.prospectPhone" required maxlength="20" inputmode="tel" autocomplete="tel" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Email (optional)</mat-label>
            <input matInput type="email" name="email" [(ngModel)]="form.prospectEmail" maxlength="254" autocomplete="email" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Source</mat-label>
            <input matInput name="source" [(ngModel)]="form.prospectSource" required maxlength="120" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Relationship</mat-label>
            <mat-select name="relationship" [(ngModel)]="form.relationship">
              <mat-option value="Friend">Friend</mat-option>
              <mat-option value="Family">Family</mat-option>
              <mat-option value="Colleague">Colleague</mat-option>
              <mat-option value="Church">Church</mat-option>
              <mat-option value="Neighbour">Neighbour</mat-option>
              <mat-option value="Referral">Referral</mat-option>
              <mat-option value="Other">Other</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Notes (optional)</mat-label>
            <textarea matInput name="notes" rows="3" [(ngModel)]="form.notes" maxlength="2000"></textarea>
          </mat-form-field>
        </div>

        <label class="consent">
          <input type="checkbox" name="consent" [(ngModel)]="form.consentToContact" />
          <span>This person has agreed to be contacted. Leave unchecked if consent is not recorded.</span>
        </label>

        <div class="actions">
          <button mat-flat-button color="primary" type="submit" [disabled]="saving() || !canSave()">
            {{ saving() ? 'Saving…' : 'Add to pipeline' }}
          </button>
          <a mat-button routerLink="/dashboard/prospects/pipeline">Cancel</a>
        </div>
      </form>
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .page { max-width: 860px; margin: 0 auto; display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1em; flex-wrap: wrap; }
    .page-head h1 { margin: 0.15em 0 0.25em; font-size: clamp(1.5rem, 3vw, 2rem); }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .subtitle { margin: 0; color: var(--ms-text-muted); max-width: 46em; line-height: 1.5; }
    .form { display: flex; flex-direction: column; gap: 1em; padding: 1.25em; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75em 1em; }
    .span-2 { grid-column: span 2; }
    .consent { display: flex; gap: 0.6em; align-items: flex-start; line-height: 1.45; color: var(--ms-text-muted); }
    .consent input { margin-top: 0.25em; }
    .actions { display: flex; gap: 0.5em; flex-wrap: wrap; }
    .error { margin: 0; color: var(--ms-error); }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } .span-2 { grid-column: auto; } }
  `],
})
export class ProspectCreateComponent {
  private readonly leads = inject(LeadPipelineService);
  private readonly router = inject(Router);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = {
    prospectName: '',
    prospectSurname: '',
    prospectPhone: '',
    prospectEmail: '',
    prospectSource: 'Personal conversation',
    relationship: 'Other',
    consentToContact: false,
    notes: '',
  };

  protected canSave(): boolean {
    return this.form.prospectName.trim().length >= 2 && this.form.prospectPhone.trim().length >= 7;
  }

  protected save(): void {
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
