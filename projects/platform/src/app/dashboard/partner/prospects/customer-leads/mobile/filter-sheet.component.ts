import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CustomerLeadsFacade } from '../state/customer-leads.facade';

/** Native bottom-sheet status filter for the mobile customer list. */
@Component({
  selector: 'async-customer-filter-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="filter-sheet" role="dialog" aria-modal="true" aria-label="Filter customers">
      <span class="sheet-handle" aria-hidden="true"></span>
      <header class="filter-head">
        <h2>Filter customers</h2>
        <button mat-icon-button type="button" (click)="close()" aria-label="Close filters"><mat-icon>close</mat-icon></button>
      </header>

      <div class="filter-options">
        <button type="button" class="filter-option" [class.is-active]="!status()" [attr.aria-pressed]="!status()" (click)="choose('')">
          <span class="filter-check"><mat-icon aria-hidden="true">{{ !status() ? 'check' : '' }}</mat-icon></span>
          <span>All statuses</span>
          <span class="filter-count">{{ allCount() }}</span>
        </button>
        @for (option of statuses; track option) {
          <button type="button" class="filter-option" [class.is-active]="status() === option" [attr.aria-pressed]="status() === option" (click)="choose(option)">
            <span class="filter-check"><mat-icon aria-hidden="true">{{ status() === option ? 'check' : '' }}</mat-icon></span>
            <span>{{ option }}</span>
            <span class="filter-count">{{ statusCount(option) }}</span>
          </button>
        }
      </div>

      <p class="sheet-note"><mat-icon aria-hidden="true">info</mat-icon> Status filters apply on top of the selected customer segment.</p>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .filter-sheet { display: flex; flex-direction: column; gap: 11px; width: 100%; max-width: 560px; margin: 0 auto; padding: 8px 16px calc(18px + var(--ms-safe-bottom)); background: var(--ms-surface); color: var(--ms-text); }
    .sheet-handle { width: 42px; height: 4px; flex: none; margin: 0 auto 2px; border-radius: 999px; background: var(--ms-line-strong); }
    .filter-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .filter-head h2 { margin: 0; font-size: 1.08rem; letter-spacing: -0.02em; }
    .filter-options { display: flex; flex-direction: column; gap: 3px; }
    .filter-option { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 6px 10px; border: 1px solid transparent; border-radius: 12px; background: transparent; color: var(--ms-text); font: inherit; font-size: 0.85rem; text-align: left; cursor: pointer; }
    .filter-option.is-active { border-color: color-mix(in srgb, var(--ms-primary) 35%, var(--ms-line)); background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 700; }
    .filter-check { flex: none; width: 23px; height: 23px; display: grid; place-items: center; border: 1px solid var(--ms-line); border-radius: 50%; color: transparent; }
    .filter-option.is-active .filter-check { border-color: var(--ms-primary); background: var(--ms-primary); color: var(--ms-ink); }
    .filter-check mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .filter-count { margin-left: auto; min-width: 24px; height: 24px; padding: 0 7px; display: inline-grid; place-items: center; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.68rem; font-weight: 700; }
    .filter-option.is-active .filter-count { background: var(--ms-surface); color: var(--ms-primary-strong); }
    .sheet-note { display: flex; align-items: flex-start; gap: 5px; margin: 0; color: var(--ms-text-muted); font-size: 0.71rem; line-height: 1.45; }
    .sheet-note mat-icon { flex: none; margin-top: 1px; font-size: 15px; width: 15px; height: 15px; }
  `],
})
export class CustomerFilterSheetComponent {
  private readonly facade = inject(CustomerLeadsFacade);
  private readonly sheetRef = inject(MatBottomSheetRef<CustomerFilterSheetComponent>);

  protected readonly statuses = this.facade.statuses;
  protected readonly status = this.facade.status;
  protected readonly statusCounts = this.facade.statusCounts;
  protected readonly allCount = computed(
    () => this.statuses.reduce((sum, status) => sum + (this.statusCounts()[status] ?? 0), 0),
  );

  protected statusCount(status: string): number {
    return this.statusCounts()[status] ?? 0;
  }

  protected choose(value: string): void {
    this.facade.setStatus(value);
    this.sheetRef.dismiss(value);
  }

  protected close(): void {
    this.sheetRef.dismiss();
  }
}
