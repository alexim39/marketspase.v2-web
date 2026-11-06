import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, Input, OnChanges, OnInit, SimpleChanges, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { PartnerInterface } from '../../../../_common/services/partner.service';
import { HelpDialogComponent } from '../../../../_common/help-dialog.component';
import { ProspectListInterface } from '../prospects.service';
import { ProspectResponseComponent } from './prospect-response.component';
import { LeadPipelineService } from '../lead-pipeline/lead-pipeline.service';
import { ApiError, userError } from '../../../../core/http/api-error';
import { timeAgo } from '../../../../_common/date-util';

interface InboxRow extends ProspectListInterface {
  _id: string;
  name: string;
  surname: string;
  email: string;
  phoneNumber: string;
  createdAt: Date;
  prospectStatus?: string;
  referral?: string;
  referralCode?: string;
  state?: string;
  campaignId?: string;
}

/**
 * @title My Page Leads — private inbox for /:partnerUsername submissions.
 *
 * MarketSpase design language (dp-card, gold accents, mobile card rows like the
 * pipeline). One job: accept each submission into My follow-ups (free,
 * session-owned, no wallet movement) or inspect full answers first.
 * Private rows stay private to the partner.
 */
@Component({
  selector: 'async-my-prospect-list',
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard" (click)="scrollToTop()">Dashboard</a> &gt;
        <a>Prospects</a> &gt;
        <span>My Page Leads</span>
      </div>
    </section>

    <section class="inbox-page">
      <div class="page-head">
        <div>
          <h2>My Page Leads <mat-icon class="help" (click)="showDescription()">help</mat-icon></h2>
          <p class="subtitle">
            Private submissions via your public page
            @if (partner?.username) { <strong>/{{ partner.username }}</strong> }
            — accept each to work it in My follow-ups.
          </p>
        </div>
        <mat-button-toggle-group>
          <mat-button-toggle routerLink="../personal-list" [checked]="true" title="My Page Leads — your public page submissions">
            <mat-icon>inbox</mat-icon> My Page Leads
          </mat-button-toggle>
          <mat-button-toggle routerLink="../pipeline" title="My follow-ups — accepted leads you are working">
            <mat-icon>trending_up</mat-icon> My follow-ups
          </mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      @if (notice(); as note) {
        <p class="notice" role="status">{{ note }}</p>
      }
      @if (error(); as err) {
        <p class="error" role="alert">{{ err }}</p>
      }

      <div class="kpi-grid">
        <mat-card class="kpi"><mat-card-content>
          <mat-icon>inbox</mat-icon>
          <span class="kpi-value">{{ rows().length }}</span>
          <span class="kpi-label">Awaiting accept</span>
        </mat-card-content></mat-card>
        <mat-card class="kpi"><mat-card-content>
          <mat-icon>fiber_new</mat-icon>
          <span class="kpi-value">{{ todayCount() }}</span>
          <span class="kpi-label">Arrived today</span>
        </mat-card-content></mat-card>
        <mat-card class="kpi"><mat-card-content>
          <mat-icon>link</mat-icon>
          <span class="kpi-value kpi-path">@if (partner?.username) { /{{ partner.username }} } @else { — }</span>
          <span class="kpi-label">Your public page</span>
        </mat-card-content></mat-card>
      </div>

      <div class="toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
          <mat-label>Search name, phone or email</mat-label>
          <input matInput type="search" [value]="query()" (input)="query.set($any($event.target).value)" maxlength="60" />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
        @if (accepting()) { <mat-progress-bar mode="indeterminate" class="loader" aria-label="Loading" /> }
      </div>

      @if (filtered().length === 0) {
        <div class="empty-card">
          <mat-icon>inbox</mat-icon>
          <p>No page leads right now — share your public page link
            @if (partner?.username) { <strong>/{{ partner.username }}</strong> }
            and submissions land here instantly.</p>
          <a mat-flat-button color="primary" routerLink="../pipeline">Open My follow-ups</a>
        </div>
      } @else {
        <div class="table-wrap">
          <table mat-table [dataSource]="filtered()" class="mat-elevation-z2">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let row" class="name-cell" data-label="Lead">
                <button class="name-btn" (click)="view(row)" [matTooltip]="'View full answers'" matTooltipPosition="above">
                  {{ row.name }} {{ row.surname }}
                </button>
                <div class="muted">{{ row.state || '' }}</div>
                @if (row.campaignId) {
                  <div><span class="dp-status dp-status--info">Campaign lead</span></div>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="contact">
              <th mat-header-cell *matHeaderCellDef>Contact</th>
              <td mat-cell *matCellDef="let row" data-label="Contact">
                <div>{{ row.phoneNumber || '—' }}</div>
                <div class="muted">{{ row.email || '—' }}</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="via">
              <th mat-header-cell *matHeaderCellDef>Heard via</th>
              <td mat-cell *matCellDef="let row" data-label="Heard via">
                <div>{{ row.referral || '—' }}</div>
                @if (row.referralCode) { <div class="muted">{{ row.referralCode }}</div> }
              </td>
            </ng-container>
            <ng-container matColumnDef="arrived">
              <th mat-header-cell *matHeaderCellDef>Arrived</th>
              <td mat-cell *matCellDef="let row" data-label="Arrived">
                <div>{{ row.createdAt | date:'mediumDate' }}</div>
                <div class="muted">{{ ageOf(row) }}</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef>Action</th>
              <td mat-cell *matCellDef="let row" class="action-cell" data-label="Actions">
                <button mat-button (click)="view(row)">View</button>
                @if (confirmId() === row._id) {
                  <button mat-flat-button color="primary" (click)="accept(row)" [disabled]="accepting()">Confirm accept?</button>
                  <button mat-button (click)="confirmId.set(null)">Back</button>
                } @else {
                  <button mat-flat-button color="primary" (click)="confirmId.set(row._id)" [disabled]="accepting()">Accept</button>
                  @if (row.campaignId) {
                    <button mat-button (click)="report(row)" [disabled]="accepting()" title="Flag this allocated lead as bad">Report</button>
                  }
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns;"></tr>
          </table>
        </div>
        <p class="total muted">Showing {{ filtered().length }} of {{ rows().length }} awaiting accept</p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; cursor: pointer; }
    .inbox-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1em; flex-wrap: wrap; }
    .page-head h2 { margin: 0; display: flex; align-items: center; gap: 0.4em; }
    .help { cursor: pointer; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 46em; }
    .subtitle strong { color: var(--ms-primary-strong); }
    .notice { color: var(--ms-success); }
    .error { color: var(--ms-error); }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75em; }
    .kpi mat-card-content { display: flex; flex-direction: column; gap: 0.2em; }
    .kpi mat-icon { color: var(--ms-primary-strong); }
    .kpi-value { font-size: 1.5em; font-weight: 700; }
    .kpi-path { font-size: 1.1em; word-break: break-all; }
    .kpi-label { color: var(--ms-text-muted); font-size: 0.85em; }
    .toolbar { display: flex; gap: 0.75em; align-items: center; flex-wrap: wrap; }
    .toolbar .search-field { flex: 1 1 220px; }
    .loader { flex: 2; min-width: 120px; }
    .table-wrap { overflow-x: auto; border-radius: 8px; }
    table { width: 100%; }
    .name-cell { font-weight: 600; }
    .name-btn { background: none; border: none; padding: 0; font: inherit; font-weight: 700; cursor: pointer; color: inherit; text-transform: capitalize; }
    .name-btn:hover { color: var(--ms-primary-strong); text-decoration: underline; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .total { margin: 0; }
    .empty-card { display: flex; flex-direction: column; align-items: center; gap: 0.7em; text-align: center; background: var(--ms-canvas); border: 1px dashed var(--ms-line); border-radius: 14px; padding: 2.5em 1.5em; color: var(--ms-text-muted); }
    .empty-card mat-icon { font-size: 40px; height: 40px; width: 40px; opacity: 0.6; }
    .empty-card p { margin: 0; max-width: 34em; }
    .empty-card strong { color: var(--ms-primary-strong); }
    button, a[mat-button], a[mat-flat-button] { min-height: 44px; }
    @media only screen and (max-width: 600px) {
      .table-wrap { overflow-x: visible; }
      .mat-mdc-table thead { display: none; }
      .mat-mdc-table tbody { display: flex; flex-direction: column; gap: 0.75em; background: transparent; }
      .mat-mdc-table tr.mat-row { display: block; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 10px; padding: 0.25em 0; }
      .mat-mdc-table td.mat-cell { display: flex; align-items: center; gap: 0.75em; border-bottom: 1px solid var(--ms-line); padding: 0.6em 0.9em; }
      .mat-mdc-table td.mat-cell:last-child { border-bottom: none; }
      .mat-mdc-table td.mat-cell::before { content: attr(data-label); flex: none; width: 6em; color: var(--ms-text-muted); font-size: 0.75em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
      .mat-mdc-table td.action-cell { flex-wrap: wrap; row-gap: 0.5em; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatButtonToggleModule, MatCardModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule,
    MatTableModule, MatTooltipModule, RouterModule,
  ],
})
export class MyProspectListComponent implements OnInit, OnChanges {
  @Input() partner!: PartnerInterface;
  @Input() prospectList!: ProspectListInterface[];

  private readonly dialog = inject(MatDialog);
  private readonly leads = inject(LeadPipelineService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columns = ['name', 'contact', 'via', 'arrived', 'action'];
  protected readonly rows = signal<InboxRow[]>([]);
  protected readonly query = signal('');
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly accepting = signal(false);
  protected readonly confirmId = signal<string | null>(null);

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = [...this.rows()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (!q) return list;
    return list.filter((r) =>
      `${r.name ?? ''} ${r.surname ?? ''} ${r.phoneNumber ?? ''} ${r.email ?? ''}`.toLowerCase().includes(q),
    );
  });

  protected readonly todayCount = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.rows().filter((r) => String((r as { createdAt?: unknown }).createdAt ?? '').slice(0, 10) === today).length;
  });

  ngOnInit(): void {
    this.resetRows(this.prospectList);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['prospectList']) this.resetRows(changes['prospectList'].currentValue);
  }

  private resetRows(list: ProspectListInterface[] | undefined): void {
    this.rows.set(Array.isArray(list) ? (list as InboxRow[]) : []);
    this.confirmId.set(null);
  }

  protected ageOf(row: InboxRow): string {
    return timeAgo(new Date(row.createdAt));
  }

  protected view(row: InboxRow): void {
    this.dialog.open(ProspectResponseComponent, {
      data: { prospect: row, partner: this.partner },
    }).afterClosed().subscribe((res: { accepted?: boolean; id?: string } | undefined) => {
      if (res?.accepted && res?.id) {
        this.rows.set(this.rows().filter((r) => r._id !== res.id));
        this.notice.set('Lead accepted — find it in My follow-ups.');
      }
    });
  }

  /** Free accept into My follow-ups (session-owned v1, no wallet movement). */
  protected accept(row: InboxRow): void {
    if (this.accepting()) return;
    this.confirmId.set(null);
    this.accepting.set(true);
    this.error.set(null);
    this.leads
      .acceptPageLead(row._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.accepting.set(false);
          this.rows.set(this.rows().filter((r) => r._id !== row._id));
          this.notice.set(res.message ?? 'Lead accepted — find it in My follow-ups.');
        },
        error: (err: ApiError) => {
          this.accepting.set(false);
          this.error.set(userError(err));
        },
      });
  }

  /** Flag an allocated inbox lead as bad — admin reviews for credit/replacement. */
  protected report(row: InboxRow): void {
    const reason = window.prompt('Why is this lead bad? (dead line, wrong person, …)');
    if (!reason || !reason.trim() || this.accepting()) return;
    this.accepting.set(true);
    this.error.set(null);
    this.leads
      .reportAllocatedLead(row._id, reason.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.accepting.set(false);
          this.notice.set(res.message ?? 'Lead reported — AI Admin will review it.');
        },
        error: (err: ApiError) => {
          this.accepting.set(false);
          this.error.set(userError(err));
        },
      });
  }

  protected showDescription(): void {
    this.dialog.open(HelpDialogComponent, {
      data: {
        help: 'My Page Leads: people who joined via your public page (/:your-username). Accept each for free — it moves to My follow-ups.',
      },
    });
  }

  protected scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
