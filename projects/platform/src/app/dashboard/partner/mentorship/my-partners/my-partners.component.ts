import { AfterViewInit, Component, inject, Input, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatCardModule } from '@angular/material/card';
import { PartnerInterface } from '../../../../_common/services/partner.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { Subscription } from 'rxjs';
import { FormsModule, ReactiveFormsModule} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AvatarComponent } from '../../../../_common/avatar.component';
import { PresenceService, PresenceStatus } from '../../../../core/presence/presence.service';


@Component({
selector: 'async-my-partners',
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
        MatCardModule, ReactiveFormsModule, FormsModule, MatFormFieldModule,
        CommonModule, MatPaginatorModule, MatInputModule, MatChipsModule,
        MatTableModule,
        MatRadioModule,
        MatIconModule,
        RouterModule,
        MatButtonModule,
        FormsModule,
        MatCheckboxModule,
        MatSlideToggleModule,
        MatTooltipModule,
        AvatarComponent
    ],
    changeDetection: ChangeDetectionStrategy.Eager,
    providers: []
})
export class MyPartnersComponent implements OnInit, AfterViewInit {
  @Input() partner!: PartnerInterface;
  @Input() myPartners!: PartnerInterface[];
  /** Activation snapshot keyed by partner id — fail-soft, missing rows hide extra chips. */
  @Input() supportMap: Record<string, { levelLabel?: string; relation?: string; ipoDone?: boolean; qsgDone?: boolean; smoDone?: boolean; worked?: number; total?: number; unworked?: number; overdue?: boolean }> = {};
  subscriptions: Subscription[] = [];
  dataSource = new MatTableDataSource<PartnerInterface>([]);  
  isEmptyRecord = false;
  filterText: string = '';
  displayedColumns: string[] = ['name', 'rank', 'status', 'phone', 'email', 'username', 'date', 'actions'];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  readonly dialog = inject(MatDialog);

  constructor(
    private router: Router,
    private presence: PresenceService,
  ) {}

  /** partnerId → lastSeenAt (null = offline); drives avatar dots. */
  presenceMap: Record<string, string | null> = {};

  protected presenceStatus(id: string | null | undefined): PresenceStatus {
    if (!id) return null;
    return this.presence.statusOf(this.presenceMap[String(id)] ?? null);
  }

  protected rankDepth(rank?: string | null): number {
    const depths: Record<string, number> = { Partner: 1, Builder: 2, Leader: 3, Ambassador: 5 };
    return depths[rank ?? 'Partner'] ?? 1;
  }

  ngOnInit() {
    
    // Check if myPartners has data
    if (this.myPartners && this.myPartners.length > 0) {
      // Use data property to set the array as the table's data source
      this.dataSource = new MatTableDataSource<PartnerInterface>(this.myPartners);
      this.dataSource.paginator = this.paginator; // Ensure paginator is set
    } else {
      this.isEmptyRecord = true;
    }
  
    // Custom filter predicate — name and username only (contact details masked).
    this.dataSource.filterPredicate = (data: PartnerInterface, filter: string) => {
      const q = filter.toLowerCase();
      return [data.name, data.surname, data.username]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    };

    // Presence dots for direct downline (single bulk call, cached 60s).
    const ids = (this.myPartners ?? []).map((p) => (p as PartnerInterface & { _id?: string })._id).filter(Boolean) as string[];
    if (ids.length > 0) {
      this.subscriptions.push(
        this.presence.lookup(ids).subscribe((map) => {
          this.presenceMap = { ...this.presenceMap, ...map };
        })
      );
    }
  }



  
  ngAfterViewInit() {
    // Link the paginator to the data source
    this.dataSource.paginator = this.paginator;
  }

  applyFilter(filterValue: string) {
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }


  support(id: string) {
    this.router.navigate(['/dashboard/mentorship/partners/my-partners/detail', id]);
  }

  /** Open a private one-to-one conversation with this partner. */
  chat(partner: PartnerInterface) {
    const id = String((partner as { _id?: unknown })._id ?? '');
    if (!id) return;
    const name = `${partner.name ?? ''} ${partner.surname ?? ''}`.trim() || partner.username || 'Partner';
    this.router.navigate(['/dashboard/messages'], { queryParams: { chat: id, chatName: name } });
  }

  /** Activation snapshot for one partner id (null when not loaded). */
  info(id: string): { levelLabel?: string; relation?: string; ipoDone?: boolean; qsgDone?: boolean; smoDone?: boolean; worked?: number; total?: number; unworked?: number; overdue?: boolean } | null {
    return this.supportMap?.[String(id)] ?? null;
  }

  get teamCount(): number {
    return this.myPartners?.length ?? 0;
  }

  get activatedCount(): number {
    return (this.myPartners ?? []).filter((p) => {
      const s = this.info(p._id);
      return !!s && !!s.ipoDone && !!s.qsgDone && !!s.smoDone;
    }).length;
  }

  get needsSupportCount(): number {
    return Math.max(0, this.teamCount - this.activatedCount);
  }

  get overdueCount(): number {
    return (this.myPartners ?? []).filter((p) => !!this.info(p._id)?.overdue).length;
  }

  get pendingStampCount(): number {
    let pending = 0;
    for (const p of this.myPartners ?? []) {
      const s = this.info(p._id);
      if (!s) continue;
      if (!s.ipoDone) pending += 1;
      if (!s.qsgDone) pending += 1;
      if (!s.smoDone) pending += 1;
    }
    return pending;
  }

  get totalFiltered(): number {
    return this.dataSource.filteredData?.length ?? 0;
  }

  /** Card page slice — filtering still runs through MatTableDataSource. */
  get pagedPartners(): PartnerInterface[] {
    const data = this.dataSource.filteredData ?? [];
    const paginator = this.paginator;
    if (!paginator) return data.slice(0, 10);
    const start = paginator.pageIndex * paginator.pageSize;
    return data.slice(start, start + paginator.pageSize);
  }

  // Scroll to top when clicked
  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  ngOnDestroy() {
    // unsubscribe list
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
