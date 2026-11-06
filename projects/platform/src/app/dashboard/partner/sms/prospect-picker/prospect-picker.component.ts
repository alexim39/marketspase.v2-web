import { Component, Input, OnDestroy, OnInit, ChangeDetectionStrategy, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { PartnerInterface } from '../../../../_common/services/partner.service';
import { ExportContactAndEmailService } from '../../../../_common/services/exportContactAndEmail.service';
import { LeadPipelineService } from '../../prospects/lead-pipeline/lead-pipeline.service';
import { ProspectLead } from '../../prospects/lead-pipeline/lead.models';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApiError } from '../../../../core/http/api-error';

/**
 * @title prospect-picker — choose SMS recipients from the pipeline.
 *
 * Only prospects with a phone are listed; consent badges surface who
 * agreed to be contacted, and one tap excludes everyone else — outreach
 * stays reachable without ever touching the gateway secret.
 */
@Component({
  selector: 'async-prospect-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MatButtonModule, MatCheckboxModule, MatChipsModule, MatFormFieldModule, MatInputModule, MatProgressBarModule, RouterModule],
  template: `
    <div class="picker">
      <mat-form-field appearance="outline">
        <mat-label>Search prospects</mat-label>
        <input matInput type="search" [value]="query()" (input)="query.set($any($event.target).value)" placeholder="Name or phone" />
      </mat-form-field>
      <div class="picker-actions">
        <button mat-button type="button" (click)="onlyConsented.set(!onlyConsented())">
          {{ onlyConsented() ? 'Showing: consented only ✓' : 'Show: everyone' }}
        </button>
        <span class="spacer"></span>
        <button mat-flat-button color="primary" type="button" (click)="useSelected()" [disabled]="selectedCount() === 0">
          Use {{ selectedCount() }} number{{ selectedCount() === 1 ? '' : 's' }}
        </button>
      </div>
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }
      @if (error(); as err) {
        <p class="error" role="alert">{{ err }}</p>
      }
      <ul class="pick-list">
        @for (p of visible(); track p.id) {
          <li>
            <mat-checkbox [checked]="isSelected(p.id)" (change)="toggle(p.id)">
              {{ p.prospectName }} {{ p.prospectSurname ?? '' }} · {{ p.prospectPhone }}
            </mat-checkbox>
            @if (p.consentToContact) {
              <mat-chip highlighted>Consented</mat-chip>
            }
          </li>
        }
      </ul>
      @if (!loading() && visible().length === 0 && !error()) {
        @if (rows().length === 0) {
          <p class="empty">No prospects found — add some from <a routerLink="/dashboard/tools/contacts/new">Add someone</a>, then come back.</p>
        } @else {
          <p class="empty">No prospects match.</p>
        }
      }
    </div>
  `,
  styles: [`
    .picker { display: flex; flex-direction: column; gap: 0.6em; padding: 1em 0; }
    .picker-actions { display: flex; align-items: center; gap: 0.5em; flex-wrap: wrap; }
    .picker-actions button { min-height: 44px; }
    .spacer { flex: 1; }
    .pick-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; max-height: 320px; overflow-y: auto; }
    .pick-list li { display: flex; align-items: center; gap: 0.5em; padding: 0.35em 0; border-top: 1px solid var(--ms-line); flex-wrap: wrap; }
    .error { color: var(--ms-error); }
    .empty { color: var(--ms-text-muted); }
  `],
})
export class ProspectPickerComponent implements OnInit, OnDestroy {
  @Input() partnerId!: string;
  /** Emits after numbers are handed to the composer (parent switches tabs). */
  @Output() applied = new EventEmitter<void>();

  private readonly leads = inject(LeadPipelineService);
  private readonly auth = inject(AuthService);
  private readonly exporter = inject(ExportContactAndEmailService);
  private readonly subs: Subscription[] = [];

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<ProspectLead[]>([]);
  protected readonly query = signal('');
  // Default: everyone visible (badges still show consent). Defaulting this
  // to consented-only hid the whole list for members whose older contacts
  // carry no consent flag — the reported empty picker.
  protected readonly onlyConsented = signal(false);
  protected readonly selected = signal<Set<string>>(new Set());

  ngOnInit(): void {
    // Same identity the pipeline page uses (v1 session), falling back to
    // the legacy input — otherwise this list and My follow-ups can disagree
    // about whose prospects these are.
    const ownerId = String(this.auth.currentUser()?.id ?? this.partnerId ?? '').trim();
    if (!ownerId) {
      this.loading.set(false);
      this.error.set('Could not determine your account — please sign in again.');
      return;
    }
    this.subs.push(
      this.leads.listByPartner(ownerId, { limit: 500 }).subscribe({
        next: (res) => {
          this.rows.set((res.data ?? []).filter((p) => p.prospectPhone));
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      })
    );
  }

  protected visible(): ProspectLead[] {
    const q = this.query().trim().toLowerCase();
    return this.rows().filter((p) => {
      if (this.onlyConsented() && !p.consentToContact) return false;
      if (!q) return true;
      return `${p.prospectName ?? ''} ${p.prospectSurname ?? ''} ${p.prospectPhone ?? ''}`.toLowerCase().includes(q);
    });
  }

  protected isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  protected toggle(id: string): void {
    this.selected.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected selectedCount(): number {
    return this.selected().size;
  }

  protected useSelected(): void {
    const ids = this.selected();
    const phones = this.rows()
      .filter((p) => ids.has(p.id))
      .map((p) => p.prospectPhone);
    if (phones.length === 0) return;
    this.exporter.setData(phones);
    this.applied.emit();
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
