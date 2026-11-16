import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { EditContactsFacade } from '../state/edit-contacts.facade';

@Component({
selector: 'async-edit-contacts-mobile',
imports: [
  CommonModule, MatButtonModule, MatButtonToggleModule, MatCheckboxModule,
  MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule,
  MatTimepickerModule, PageSkeletonComponent, ReactiveFormsModule, RouterModule,
],
template: `
<section class="breadcrumb-wrapper">
  <div class="breadcrumb">
    <a routerLink="/dashboard">Dashboard</a> &gt;
    <a routerLink="/dashboard/prospects/pipeline">Prospects</a> &gt;
    <span>{{ loading() ? 'Edit contact' : (prospectName() || 'Edit contact') }}</span>
  </div>
</section>

<section class="edit-page">
  <div class="page-head">
    <div class="control">
      <button mat-icon-button (click)="back()" aria-label="Back">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <div>
        <h2>Edit contact</h2>
        <p class="subtitle">Fix a typo, update a number, or add context your upline will see.</p>
      </div>
    </div>
  </div>

  @if (loading()) {
    <async-page-skeleton layout="form" [rows]="8" label="contact form" [showHeader]="false" />
  }

  @if (error(); as err) {
    <p class="error" role="alert">
      {{ err }}
      <button mat-button (click)="load()">Retry</button>
    </p>
  }

  @if (notice(); as note) {
    <p class="notice" role="status">{{ note }}</p>
  }

  @if (form) {
    <form class="dp-card form-card" [formGroup]="form" (ngSubmit)="save()">
      <h3>Identity</h3>
      <div class="two-col">
        <mat-form-field appearance="outline">
          <mat-label>First name</mat-label>
          <input matInput formControlName="prospectName" maxlength="80" />
          @if (form.get('prospectName')?.hasError('required') && form.get('prospectName')?.touched) {
            <mat-error>This is required</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Surname</mat-label>
          <input matInput formControlName="prospectSurname" maxlength="80" />
        </mat-form-field>
      </div>

      <div class="two-col">
        <mat-form-field appearance="outline">
          <mat-label>Phone number</mat-label>
          <input matInput formControlName="prospectPhone" inputmode="tel" maxlength="20" />
          @if (form.get('prospectPhone')?.hasError('required') && form.get('prospectPhone')?.touched) {
            <mat-error>This is required</mat-error>
          }
          @if (form.get('prospectPhone')?.hasError('ngPhone') && form.get('prospectPhone')?.touched) {
            <mat-error>Enter a valid Nigerian mobile number (e.g. 0803 123 4567).</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Email (optional)</mat-label>
          <input matInput formControlName="prospectEmail" inputmode="email" maxlength="254" />
          @if (form.get('prospectEmail')?.hasError('email') && form.get('prospectEmail')?.touched) {
            <mat-error>Enter a valid email.</mat-error>
          }
        </mat-form-field>
      </div>

      <h3>Context your upline sees</h3>
      <div class="two-col">
        <mat-form-field appearance="outline">
          <mat-label>Relationship</mat-label>
          <mat-select formControlName="relationship">
            @for (t of tags; track t) {
              <mat-option [value]="t">{{ t }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <div class="priority-row" role="group" aria-label="Priority">
          <mat-button-toggle-group formControlName="priority" aria-label="Priority">
            <mat-button-toggle value="normal">Normal</mat-button-toggle>
            <mat-button-toggle value="high">High priority</mat-button-toggle>
          </mat-button-toggle-group>
        </div>
      </div>

      <div class="two-col">
        <mat-form-field appearance="outline">
          <mat-label>Best time to call</mat-label>
          <input matInput [matTimepicker]="bestTimePicker" formControlName="bestTimeToCall" placeholder="e.g. 19:00" />
          <mat-timepicker-toggle matSuffix [for]="bestTimePicker" />
          <mat-timepicker #bestTimePicker interval="30m" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Source</mat-label>
          <mat-select formControlName="prospectSource">
            <mat-option value="Contact List">Contact List</mat-option>
            <mat-option value="Family">Family</mat-option>
            <mat-option value="Friend">Friend</mat-option>
            <mat-option value="Referrals">Referrals</mat-option>
            <mat-option value="Social Media">Social Media</mat-option>
            <mat-option value="Website">Website</mat-option>
            <mat-option value="Networking Events">Networking Events</mat-option>
            <mat-option value="Other Means">Other Means</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <mat-checkbox formControlName="consentToContact">They agreed to be contacted</mat-checkbox>

      <mat-form-field appearance="outline">
        <mat-label>Notes</mat-label>
        <textarea matInput rows="3" formControlName="notes" maxlength="2000" placeholder="Interests, context, anything useful"></textarea>
      </mat-form-field>

      <div class="form-actions">
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'Saving…' : 'Save changes' }}</button>
        <button mat-button type="button" (click)="back()" [disabled]="saving()">Cancel</button>
        @if (formError(); as err) {
          <span class="error" role="alert">{{ err }}</span>
        }
      </div>
    </form>
  }
</section>
`,
changeDetection: ChangeDetectionStrategy.OnPush,
styles: [`
  .breadcrumb-wrapper { margin-bottom: 1em; }
  .breadcrumb a { text-decoration: none; }
  .edit-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
  .page-head { display: flex; align-items: center; }
  .control { display: flex; gap: 0.6em; align-items: flex-start; }
  .control button { flex: none; }
  .page-head h2 { margin: 0; }
  .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
  .form-card { padding: 1em; display: flex; flex-direction: column; gap: 0.75em; }
  .form-card h3 { margin: 0.5em 0 0; font-size: 1em; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75em; }
  @media only screen and (max-width: 600px) {
    .two-col { grid-template-columns: 1fr; }
  }
  .priority-row { display: flex; align-items: center; }
  .form-actions { display: flex; align-items: center; gap: 0.75em; flex-wrap: wrap; }
  .form-actions button { min-height: 44px; }
  .muted { color: var(--ms-text-muted); font-size: 0.85em; }
  .error { color: var(--ms-error); }
  .notice { color: var(--ms-success, #2e7d32); }
`],
})
export class EditContactsMobileComponent {
  private readonly facade = inject(EditContactsFacade);

  protected readonly loading = this.facade.loading;
  protected readonly saving = this.facade.saving;
  protected readonly error = this.facade.error;
  protected readonly notice = this.facade.notice;
  protected readonly formError = this.facade.formError;
  protected readonly prospectName = this.facade.prospectName;
  protected readonly tags = this.facade.tags;
  protected get form() { return this.facade.form; }

  constructor() { this.facade.ensureLoaded(); }
  protected load(): void { this.facade.load(); }
  protected back(): void { this.facade.back(); }
  protected save(): void { this.facade.save(); }
}
