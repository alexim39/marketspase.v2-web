import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { RouterModule } from '@angular/router';
import { AvatarComponent } from '../../../../../_common/avatar.component';
import { PartnerInterface } from '../../../../../_common/services/partner.service';
import { MyPartnersFacade } from '../state/my-partners.facade';

@Component({
selector: 'async-my-partners-desktop',
templateUrl: 'my-partners.component.html',
styles: [`
.breadcrumb-wrapper { margin-bottom: 16px; }
.breadcrumb a { text-decoration: none; }
.partners-page { display: flex; flex-direction: column; gap: 24px; max-width: 1200px; margin: 0 auto; padding-bottom: 32px; }
.page-head { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 24px; }
.page-head h1 { margin: 4px 0 8px; font-size: clamp(2rem, 3vw, 2.5rem); letter-spacing: -0.03em; }
.eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
.subtitle { margin: 0; max-width: 62em; color: var(--ms-text-muted); line-height: 1.6; }
.page-head > a mat-icon { margin-right: 6px; }

.summary-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 8px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); }
.summary-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-md); }
.summary-icon { flex: none; width: 40px; height: 40px; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
.summary-icon--ok { background: var(--ms-success-soft); color: var(--ms-success); }
.summary-icon--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
.summary-icon--bad { background: var(--ms-error-soft); color: var(--ms-error); }
.summary-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
.summary-item div { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.summary-item strong { font-family: var(--ms-font-display); font-size: 1.5rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
.summary-item span:last-child { color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; letter-spacing: 0.02em; }

.toolbar-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 16px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); }
.search-field { flex: 1; min-width: 240px; }
.result-count { color: var(--ms-text-muted); font-size: 0.875rem; font-variant-numeric: tabular-nums; white-space: nowrap; }

.partner-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.partner-card { display: flex; flex-direction: column; gap: 16px; padding: 24px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); box-shadow: var(--ms-shadow-sm); transition: border-color 160ms ease, transform 160ms ease; }
.partner-card:hover { border-color: var(--ms-primary); transform: translateY(-1px); }
.partner-top { display: flex; align-items: center; gap: 12px; }
.partner-identity { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.partner-identity strong { font-size: 1rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.partner-identity span { color: var(--ms-text-muted); font-size: 0.8125rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.member-badge { flex: none; display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 10px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 800; letter-spacing: 0.03em; white-space: nowrap; }
.member-badge--partner { background: var(--ms-success-soft); color: var(--ms-success); }
.rank-chip { flex: none; display: inline-flex; align-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); border-radius: 999px; padding: 4px 10px; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.03em; white-space: nowrap; }

.stamp-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 32px; }
.mini-stamp { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--ms-line); color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; }
.mini-stamp mat-icon { font-size: 16px; width: 16px; height: 16px; }
.mini-stamp--done { background: var(--ms-success-soft); border-color: transparent; color: var(--ms-success); }
.overdue-pill { margin-left: auto; padding: 4px 10px; border-radius: 999px; background: var(--ms-error-soft); color: var(--ms-error); font-size: 0.6875rem; font-weight: 700; }

.partner-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; margin: 0; padding: 16px 0; border-top: 1px solid var(--ms-line); border-bottom: 1px solid var(--ms-line); }
.partner-facts div { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.partner-facts dt { color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.partner-facts dd { margin: 0; font-size: 0.8125rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.partner-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: auto; }
.partner-actions button { flex: 1; min-height: 44px; }
.partner-actions mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 4px; }
.partner-actions button:last-child mat-icon { margin-right: 0; margin-left: 4px; }

.mat-mdc-paginator { background: transparent; }
.muted { color: var(--ms-text-muted); font-size: 0.875rem; }
.empty-card { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; padding: 48px 24px; background: var(--ms-surface); border: 1px dashed var(--ms-line); border-radius: var(--ms-radius-lg); color: var(--ms-text-muted); }
.empty-card h2 { margin: 0; color: var(--ms-text); font-size: 1.25rem; }
.empty-card p { margin: 0; max-width: 42em; line-height: 1.6; }
.empty-icon { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
.empty-icon mat-icon { font-size: 28px; width: 28px; height: 28px; }

@media (max-width: 1080px) {
  .partner-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 900px) {
  .summary-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .partners-page { gap: 16px; }
  .partner-grid { grid-template-columns: minmax(0, 1fr); }
  .partner-card { padding: 16px; }
  .partner-facts { grid-template-columns: minmax(0, 1fr); }
  .partner-actions button { flex: 1 1 100%; }
}
`],
imports: [
  AvatarComponent, CommonModule, FormsModule, MatButtonModule, MatFormFieldModule,
  MatIconModule, MatInputModule, MatPaginatorModule, RouterModule,
],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyPartnersDesktopComponent {
  private readonly facade = inject(MyPartnersFacade);

  protected readonly partners = this.facade.partners;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly pageSize = this.facade.pageSize;

  protected get filterText(): string { return this.facade.filterText(); }
  protected get pagedPartners(): PartnerInterface[] { return this.facade.pagedPartners(); }
  protected get pageIndex(): number { return this.facade.pageIndex(); }
  protected get totalFiltered(): number { return this.facade.totalFiltered(); }
  protected get teamCount(): number { return this.facade.teamCount(); }
  protected get activatedCount(): number { return this.facade.activatedCount(); }
  protected get needsSupportCount(): number { return this.facade.needsSupportCount(); }
  protected get pendingStampCount(): number { return this.facade.pendingStampCount(); }

  constructor() { this.facade.ensureLoaded(); }
  protected get isEmptyRecord(): boolean { return this.facade.isEmptyRecord(); }
  protected applyFilter(value: string): void { this.facade.applyFilter(value); }
  protected clearFilter(): void { this.facade.clearFilter(); }
  protected onPage(event: PageEvent): void { this.facade.setPage(event.pageIndex); }
  protected presenceStatus(id: string | null | undefined) { return this.facade.presenceStatus(id); }
  protected info(id: string) { return this.facade.info(id); }
  protected isActivatedPartner(partner: PartnerInterface): boolean { return this.facade.isActivatedPartner(partner); }
  protected support(id: string): void { this.facade.support(id); }
  protected chat(partner: PartnerInterface): void { this.facade.chat(partner); }
  protected displayName(partner: PartnerInterface): string { return this.facade.displayName(partner); }
  protected reload(): void { this.facade.reload(); }
  protected scrollToTop(): void { window.scrollTo({ top: 0, behavior: 'smooth' }); }
}
