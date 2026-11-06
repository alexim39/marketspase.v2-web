import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';
import { ExportContactAndEmailService } from '../../../../_common/services/exportContactAndEmail.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApiError, userError } from '../../../../core/http/api-error';
import { LeadPipelineService } from './lead-pipeline.service';
import {
  ImportReport, nextStage, ProspectLead, ProspectListEnvelope, ProspectStage,
  STAGE_META, STAGE_ORDER, STAGE_TONE, StuckEntry, StuckEnvelope,
} from './lead.models';
import { formatStuckDuration } from '../stuck-duration';
import { CollectCodeComponent } from '../../contacts/manage/details/collect-code.component';
import { RateLeadDialogComponent } from './rate-lead-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { EmptyStateComponent } from '@marketspase/shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '@marketspase/shared/ui/error-state/error-state.component';
import { PageHeaderComponent } from '@marketspase/shared/ui/page-header/page-header.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { forkJoin, map, of, switchMap } from 'rxjs';

/**
 * Minimal CSV parse (quoted commas + escaped quotes). Header row maps to
 * importer keys case-insensitively; unknown columns are ignored.
 */
function parseImportCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let cur = '';
  let row: string[] = [];
  let quoted = false;
  const push = () => {
    row.push(cur);
    cur = '';
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      push();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      push();
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  push();
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  if (rows.length < 2) return [];
  const heads = rows[0].map((h) => h.trim().toLowerCase());
  const pick = (...names: string[]): number => heads.findIndex((h) => names.includes(h));
  const ci = {
    name: pick('name', 'firstname', 'first name'),
    surname: pick('surname', 'lastname', 'last name'),
    phone: pick('phone', 'phonenumber', 'phone number', 'mobile', 'tel'),
    email: pick('email', 'e-mail'),
    source: pick('source', 'channel'),
    relationship: pick('relationship'),
  };
  return rows.slice(1, 501).map((cells) => {
    const out: Record<string, string> = {};
    const put = (key: string, idx: number) => {
      if (idx >= 0 && (cells[idx] ?? '').trim() !== '') out[key] = cells[idx].trim();
    };
    put('name', ci.name);
    put('surname', ci.surname);
    put('phone', ci.phone);
    put('email', ci.email);
    put('source', ci.source);
    put('relationship', ci.relationship);
    return out;
  }).filter((r) => Object.keys(r).length > 0);
}

/**
 * @title Lead pipeline — modern lead management.
 *
 * OnPush + signals + `@for`/`@if`. Stage chips color-code the canonical
 * pipeline; "Advance" walks a lead forward; "Convert" issues an enrollment
 * code via two-step confirm and surfaces it for sharing with the prospect.
 */
@Component({
  selector: 'async-lead-pipeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTableModule, MatChipsModule, MatButtonModule, MatCheckboxModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatPaginatorModule, MatTooltipModule,
    MatSnackBarModule, EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, PageSkeletonComponent, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Prospects</a> &gt;
        <span>Lead Pipeline</span>
      </div>
    </section>

    <section class="pipeline-page">
      <async-page-header
        eyebrow="Prospects · Lead pipeline"
        title="Lead Pipeline"
        subtitle="Work your leads from first contact to converted partner."
      >
        <a mat-stroked-button routerLink="../personal-list" title="My Page Leads — submissions from your public page">
          <mat-icon>inbox</mat-icon> My Page Leads
        </a>
        <a mat-flat-button color="primary" routerLink="/dashboard/tools/contacts/new" title="Add someone to your contact list">
          <mat-icon>person_add</mat-icon> Add someone
        </a>
      </async-page-header>

      @if (convertedNotice(); as converted) {
        <div class="code-banner" role="status">
          <mat-icon>celebration</mat-icon>
          <div>
            <strong>{{ converted.name }}</strong> is marked converted. Share your open registration or referral link
            so they can join.
          </div>
          <button mat-icon-button (click)="convertedNotice.set(null)" aria-label="Dismiss">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }

      @if (loading()) {
        <async-page-skeleton layout="table" [rows]="5" label="lead pipeline" [showHeader]="false" />
      } @else {

      <div class="stage-cards">
        @for (entry of stageCounts(); track entry.stage) {
          <button
            class="stage-card"
            [class.active]="stageFilter() === entry.stage"
            [attr.aria-pressed]="stageFilter() === entry.stage"
            (click)="toggleStageFilter(entry.stage)"
            [style.--chip-bg]="entry.meta.color"
            [style.--chip-fg]="entry.meta.text"
          >
            <span class="count">{{ entry.count }}</span>
            <span class="label">{{ entry.meta.label }}</span>
          </button>
        }
      </div>

      <div class="toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Search leads</mat-label>
          <input matInput type="search" placeholder="Name, phone or email" [value]="search()" (input)="onSearch($any($event.target).value)" />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
        <button
          mat-button
          [color]="stuckOnly() ? 'warn' : undefined"
          (click)="toggleStuckOnly()"
          [disabled]="stuckCount() === 0"
          title="Show only prospects past their stage attention threshold"
        >
          <mat-icon>warning</mat-icon> Stuck ({{ stuckCount() }})
        </button>
        <button mat-button (click)="showImport.set(!showImport())" title="Bulk-add contacts from a CSV file">
          <mat-icon>upload</mat-icon> Import
        </button>
      </div>

      @if (showImport()) {
        <div class="dp-card import-card">
          <div class="import-head">
            <div>
              <h3>Import contacts</h3>
              <p class="muted">CSV with name, phone + optional surname, email, source, relationship. Duplicates are reported, never imported twice.</p>
            </div>
            <button mat-button (click)="downloadTemplate()">Template</button>
          </div>
          <div class="import-row">
            <label class="file-pick">
              <input type="file" accept=".csv,text/csv" (change)="onImportFile($event)" [attr.aria-label]="'Choose CSV file'" />
              <span>{{ importFileName() || 'Choose CSV file…' }}</span>
            </label>
            <button mat-flat-button color="primary" (click)="doImport()" [disabled]="importRows().length === 0 || importing()">
              {{ importing() ? 'Importing…' : importRows().length > 0 ? 'Import ' + importRows().length : 'Import' }}
            </button>
          </div>
          @if (importError(); as err) {
            <p class="error" role="alert">{{ err }}</p>
          }
          @if (importRows().length > 0) {
            <p class="muted">First {{ importRows().slice(0, 5).length }} of {{ importRows().length }} rows: {{ importRows().slice(0, 5).map((r) => r['name'] || 'Unnamed').join(', ') }}</p>
          }
          @if (importReport(); as report) {
            <p class="notice" role="status">Imported {{ report.inserted }} of {{ report.total }}@if (report.skipped.length > 0) { — {{ report.skipped.length }} skipped }.</p>
            @if (report.skipped.length > 0) {
              <ul class="skip-list">
                @for (s of report.skipped.slice(0, 10); track s.index) {
                  <li><strong>{{ s.name }}</strong> <span class="muted">— {{ s.reason }}</span></li>
                }
                @if (report.skipped.length > 10) {
                  <li class="muted">…and {{ report.skipped.length - 10 }} more.</li>
                }
              </ul>
            }
          }
        </div>
      }

      @if (error(); as err) {
        <async-error-state [message]="err" context="your lead pipeline">
          <button mat-stroked-button type="button" (click)="reload()">Try again</button>
          <a mat-button routerLink="/dashboard">Back to dashboard</a>
        </async-error-state>
      }

      @if (!loading() && filtered().length === 0 && !error()) {
        <async-empty-state
          icon="person_search"
          title="No leads yet"
          message="Your pipeline has no leads yet."
          reason="No prospect has been added, or the current filter hides them."
          next="Add a prospect or import a CSV to start building the pipeline."
        >
          <a mat-flat-button color="primary" routerLink="/dashboard/tools/contacts/new">Add prospect</a>
        </async-empty-state>
      }

      @if (selectionCount() > 0) {
        <div class="bulk-bar" role="group" aria-label="Bulk outreach">
          <span class="muted">{{ selectionCount() }} selected</span>
          <button mat-button (click)="sendSms()">
            <mat-icon>smartphone</mat-icon> Send SMS
          </button>
          <button mat-button (click)="sendEmail()">
            <mat-icon>mail</mat-icon> Send email
          </button>
          <button mat-button (click)="clearSelection()">Clear</button>
        </div>
      }

      @if (filtered().length > 0) {
        <div class="table-wrap">
          <table mat-table [dataSource]="filtered()" class="mat-elevation-z2">
            <ng-container matColumnDef="select">
              <th mat-header-cell *matHeaderCellDef>
                <mat-checkbox
                  [checked]="allVisibleSelected()"
                  [indeterminate]="someVisibleSelected()"
                  (change)="toggleAllVisible()"
                  aria-label="Select all visible"
                />
              </th>
              <td mat-cell *matCellDef="let lead">
                <mat-checkbox
                  [checked]="isSelected(lead.id)"
                  (change)="toggleSelect(lead.id)"
                  [aria-label]="'Select ' + names(lead)"
                />
              </td>
            </ng-container>
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let lead" class="name-cell" data-label="Prospect"><a [routerLink]="['../detail', lead.id]" class="name-link">{{ names(lead) }}</a>
                @if (lead.campaignId) {
                  <span class="camp-badge" [title]="'Allocated by ' + (campaignNames()[lead.campaignId] ?? 'campaign')">
                    <mat-icon>campaign</mat-icon><span>{{ campaignNames()[lead.campaignId] ?? 'Campaign lead' }}</span>
                  </span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="contact">
              <th mat-header-cell *matHeaderCellDef>Contact</th>
              <td mat-cell *matCellDef="let lead" data-label="Contact">
                <div>{{ lead.prospectPhone }}</div>
                <div class="muted">{{ lead.prospectEmail || '—' }}</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="stage">
              <th mat-header-cell *matHeaderCellDef>Stage</th>
              <td mat-cell *matCellDef="let lead" data-label="Stage">
                <span class="dp-status {{ stageTone(lead) }}">{{ stageLabel(lead) }}</span>
                @if (stuckOf(lead); as stuck) {
                  <div class="stuck-badge" title="No movement for {{ stuckDuration(stuck.daysInStage) }} (threshold {{ stuck.limit }}d)">
                    ⚠ stuck {{ stuckDuration(stuck.daysInStage) }}
                  </div>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="interest">
              <th mat-header-cell *matHeaderCellDef>Interest</th>
              <td mat-cell *matCellDef="let lead" class="interest-cell" data-label="Interest">{{ interest(lead) }}</td>
            </ng-container>
            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef>Action</th>
              <td mat-cell *matCellDef="let lead" class="action-cell" data-label="Actions">
                @if (nextOf(lead); as next) {
                  <button mat-button (click)="advance(lead, next)" [disabled]="actingId() === lead.id">
                    Advance to {{ next }}
                  </button>
                }
                <a mat-icon-button [routerLink]="['../edit', lead.id]" title="Edit {{ names(lead) }}" aria-label="Edit {{ names(lead) }}">
                  <mat-icon>edit</mat-icon>
                </a>
                @if (deleteConfirmId() === lead.id) {
                  <button mat-button color="warn" (click)="remove(lead)" [disabled]="actingId() === lead.id">Delete?</button>
                  <button mat-button (click)="deleteConfirmId.set(null)">Cancel</button>
                } @else {
                  <button mat-icon-button (click)="deleteConfirmId.set(lead.id)" title="Delete {{ names(lead) }}" aria-label="Delete {{ names(lead) }}">
                    <mat-icon>delete</mat-icon>
                  </button>
                }
                @if (!isConverted(lead)) {
                  <a mat-button [routerLink]="['../booking', lead.id]" title="Book a chat with {{ names(lead) }}">Book</a>
                }
                <a mat-button [routerLink]="['/dashboard/insights/contact-analytics']" [queryParams]="{ id: lead.id }" title="Work {{ names(lead) }} — status, outreach and history in one place">Work contact</a>
                @if (canConvert(lead)) {
                  @if (confirmId() === lead.id) {
                    <button mat-flat-button color="primary" (click)="convert(lead)" [disabled]="actingId() === lead.id">
                      Confirm convert?
                    </button>
                    <button mat-button (click)="confirmId.set(null)">Cancel</button>
                  } @else {
                    <button
                      mat-flat-button
                      color="accent"
                      matTooltip="Issue an enrollment code for this prospect"
                      (click)="confirmId.set(lead.id)"
                    >Convert</button>
                  }
                }
                @if (isConverted(lead)) {
                  <span class="muted">Enrolled ✓</span>
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        </div>
        <mat-paginator
          [length]="total()"
          [pageSize]="pageSize()"
          [pageIndex]="pageIndex()"
          [pageSizeOptions]="[25, 50, 100]"
          showFirstLastButtons
          (page)="onPage($event)"
        />
        <p class="total muted">Showing {{ filtered().length }} of {{ total() }} leads</p>
      }
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .pipeline-page { display: flex; flex-direction: column; gap: 1.25em; }
    .code-banner {
      display: flex; align-items: center; gap: 0.75em;
      background: var(--ms-success-soft); border: 1px solid var(--ms-success); border-radius: 8px; padding: 0.75em 1em;
    }
    .code-banner code { font-size: 1.2em; font-weight: 700; letter-spacing: 0.1em; background: var(--ms-surface); padding: 0.1em 0.5em; border-radius: 4px; }
    .code-banner div { flex: 1; }
    .stage-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75em; }
    .stage-card {
      display: flex; flex-direction: column; align-items: center; gap: 0.15em;
      background: color-mix(in srgb, var(--chip-bg) 20%, var(--ms-surface));
      color: var(--chip-fg);
      border: 2px solid transparent; border-radius: 10px; padding: 0.8em 0.5em; cursor: pointer;
      transition: border-color 140ms ease, transform 140ms ease;
    }
    .stage-card:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--chip-fg) 36%, transparent); }
    .stage-card.active { border-color: var(--ms-primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--ms-primary) 20%, transparent); }
    :host-context(html[data-theme="dark"]) .stage-card { color: var(--ms-text); }
    .stage-card .count { font-size: 1.6em; font-weight: 700; }
    .stage-card .label { font-size: 0.85em; }
    .toolbar { display: flex; align-items: center; gap: 1em; flex-wrap: wrap; }
    .toolbar mat-form-field { flex: 1; min-width: 220px; }
    .bulk-bar { display: flex; align-items: center; gap: 0.5em; flex-wrap: wrap; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 8px; padding: 0.5em 0.75em; }
    .bulk-bar button { min-height: 44px; }
    .import-card { padding: 1em; display: flex; flex-direction: column; gap: 0.6em; }
    .import-card h3 { margin: 0; font-size: 1em; }
    .import-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75em; flex-wrap: wrap; }
    .import-head p { margin: 0.25em 0 0; }
    .import-row { display: flex; gap: 0.6em; flex-wrap: wrap; align-items: center; }
    .import-row button { min-height: 44px; }
    .file-pick { display: inline-flex; align-items: center; gap: 0.5em; border: 1px dashed var(--ms-line); border-radius: 8px; padding: 0.6em 0.9em; cursor: pointer; min-height: 44px; font-size: 0.9em; }
    .file-pick input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .notice { color: var(--ms-success); }
    .skip-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25em; font-size: 0.9em; }
    .table-wrap { overflow-x: auto; border-radius: 8px; }
    table { width: 100%; }
    .name-cell { font-weight: 600; text-transform: capitalize; }
    .name-link { text-decoration: none; color: inherit; }
    .name-link:hover { color: var(--ms-primary-strong); }
    .camp-badge { display: inline-flex; align-items: center; gap: 0.25em; margin-top: 0.3em; padding: 0.1em 0.6em; border: 1px solid var(--ms-primary); border-radius: 999px; color: var(--ms-primary-strong); font-size: 0.75em; font-weight: 600; text-decoration: none; max-width: 100%; }
    .camp-badge mat-icon { font-size: 15px; height: 15px; width: 15px; }
    .camp-badge span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .camp-badge:hover { background: var(--ms-primary-soft); }
    .stuck-badge { color: var(--ms-error); font-size: 0.85em; font-weight: 600; margin-top: 0.25em; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .interest-cell { text-transform: capitalize; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .total { margin: 0; }
    @media only screen and (max-width: 600px) {
      /* Paginator controls overflow 360px viewports — page-size stays 50. */
      .mat-mdc-paginator-page-size { display: none; }
      .ms-head-actions { width: 100%; }
      .stage-cards { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 0.5em; }
      /* Mobile card layout: rows become labeled cards, no sideways scroll. */
      .table-wrap { overflow-x: visible; }
      .mat-mdc-table thead { display: none; }
      .mat-mdc-table tbody { display: flex; flex-direction: column; gap: 0.75em; background: transparent; }
      .mat-mdc-table tr.mat-row {
        display: block; background: var(--ms-surface);
        border: 1px solid var(--ms-line); border-radius: 10px; padding: 0.25em 0;
      }
      .mat-mdc-table td.mat-cell {
        display: flex; align-items: center; gap: 0.75em;
        border-bottom: 1px solid var(--ms-line); padding: 0.6em 0.9em;
      }
      .mat-mdc-table td.mat-cell:last-child { border-bottom: none; }
      .mat-mdc-table td.mat-cell::before {
        content: attr(data-label); flex: none; width: 6em;
        color: var(--ms-text-muted); font-size: 0.75em; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.05em;
      }
      .mat-mdc-table td.mat-cell:not([data-label])::before { display: none; }
      .mat-mdc-table td.action-cell { flex-wrap: wrap; row-gap: 0.5em; }
      .mat-mdc-table td.action-cell .mat-mdc-button,
      .mat-mdc-table td.action-cell .mat-mdc-flat-button { flex: 1 1 100%; }
    }
  `],
})
export class LeadPipelineComponent implements OnInit {
  private readonly leads = inject(LeadPipelineService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly exportContacts = inject(ExportContactAndEmailService);
  private readonly snack = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<ProspectLead[]>([]);
  protected readonly total = signal(0);
  protected readonly search = signal('');
  protected readonly stageFilter = signal<ProspectStage | null>(null);
  protected readonly stuckOnly = signal(false);
  protected readonly pageSize = signal(50);
  protected readonly pageIndex = signal(0);
  protected readonly stuckDays = signal<Record<string, StuckEntry>>({});
  protected readonly campaignNames = signal<Record<string, string>>({});
  protected readonly actingId = signal<string | null>(null);
  protected readonly confirmId = signal<string | null>(null);
  protected readonly convertedNotice = signal<{ name: string } | null>(null);
  protected readonly serverStageCounts = signal<Record<string, number>>({});
  protected readonly showImport = signal(false);
  protected readonly importRows = signal<Array<Record<string, string>>>([]);
  protected readonly importFileName = signal('');
  protected readonly importing = signal(false);
  protected readonly importError = signal<string | null>(null);
  protected readonly importReport = signal<ImportReport | null>(null);

  protected readonly displayedColumns = ['select', 'name', 'contact', 'stage', 'interest', 'action'];
  protected readonly selected = signal<Set<string>>(new Set());
  protected readonly deleteConfirmId = signal<string | null>(null);

  protected readonly selectionCount = computed(() => this.selected().size);

  protected readonly stageCounts = computed(() => {
    const server = this.serverStageCounts();
    const useServer = Object.keys(server).length > 0;
    const counts = new Map<ProspectStage, number>();
    if (!useServer) {
      for (const lead of this.rows()) {
        const stage = (lead.status?.stage ?? 'New') as ProspectStage;
        counts.set(stage, (counts.get(stage) ?? 0) + 1);
      }
    }
    return [...STAGE_ORDER, 'Closed' as ProspectStage].map((stage) => ({
      stage,
      count: useServer ? (server[stage] ?? 0) : (counts.get(stage) ?? 0),
      meta: STAGE_META[stage],
    }));
  });

  protected readonly filtered = computed(() => this.rows());

  protected readonly stuckCount = computed(() => Object.keys(this.stuckDays()).length);

  protected isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  protected allVisibleSelected(): boolean {
    const visible = this.filtered();
    return visible.length > 0 && visible.every((lead) => this.selected().has(lead.id));
  }

  protected someVisibleSelected(): boolean {
    const visible = this.filtered();
    const count = visible.filter((lead) => this.selected().has(lead.id)).length;
    return count > 0 && count < visible.length;
  }

  protected toggleSelect(id: string): void {
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected toggleAllVisible(): void {
    const visible = this.filtered();
    this.selected.update((set) => {
      const next = new Set(set);
      if (visible.every((lead) => next.has(lead.id))) {
        for (const lead of visible) next.delete(lead.id);
      } else {
        for (const lead of visible) next.add(lead.id);
      }
      return next;
    });
  }

  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  /** Bulk outreach handoff — only consenting contacts reach the compose pages. */
  protected sendSms(): void {
    const selected = this.rows().filter((lead) => this.selected().has(lead.id));
    const allowed = selected.filter((lead) => lead.consentToContact === true && lead.prospectPhone?.trim());
    const skipped = selected.length - allowed.length;
    if (allowed.length === 0) {
      this.snack.open('No consented phone numbers in the selected contacts.', 'Close', { duration: 4000 });
      return;
    }
    this.exportContacts.setData(allowed.map((lead) => lead.prospectPhone!.trim()));
    if (skipped > 0) {
      this.snack.open(`Skipped ${skipped} contact${skipped === 1 ? '' : 's'} without consent.`, 'Close', { duration: 4000 });
    }
    this.router.navigate(['/dashboard/tools/sms/new']);
  }

  protected sendEmail(): void {
    const selected = this.rows().filter((lead) => this.selected().has(lead.id));
    const allowed = selected.filter((lead) => lead.consentToContact === true && lead.prospectEmail?.trim());
    const skipped = selected.length - allowed.length;
    if (allowed.length === 0) {
      this.snack.open('No consented email addresses in the selected contacts.', 'Close', { duration: 4000 });
      return;
    }
    this.exportContacts.setData(allowed.map((lead) => lead.prospectEmail!.trim()));
    if (skipped > 0) {
      this.snack.open(`Skipped ${skipped} contact${skipped === 1 ? '' : 's'} without consent.`, 'Close', { duration: 4000 });
    }
    this.router.navigate(['/dashboard/tools/email/new']);
  }

  protected remove(lead: ProspectLead): void {
    this.actingId.set(lead.id);
    this.leads
      .removeProspect(lead.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleteConfirmId.set(null);
          this.actingId.set(null);
          this.reload();
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(userError(err));
        },
      });
  }

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    const partnerId = this.auth.currentUser()?.id;
    if (!partnerId) {
      this.error.set('Session expired. Please sign in again.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const limit = this.pageSize();
    const skip = this.pageIndex() * limit;
    const q = this.search().trim() || undefined;
    const stage = this.stageFilter() ?? undefined;
    const stuck$ = this.leads.stuck(partnerId);

    // Stuck is a server-side filter: load the stuck ids first, then fetch the
    // matching page. Otherwise a stuck lead on page 2 would never appear.
    if (this.stuckOnly()) {
      stuck$.pipe(
        switchMap((stuck) => {
          const ids = (stuck.data ?? []).map((s) => s.prospectId).slice(0, 500);
          if (ids.length === 0) return of({ stuck, leads: null as ProspectListEnvelope | null });
          return this.leads
            .listByPartner(partnerId, { limit, skip, q, stage, ids })
            .pipe(map((leads) => ({ stuck, leads })));
        }),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe({
        next: ({ stuck, leads }) => this.applyResult(leads, stuck),
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
      return;
    }

    forkJoin({
      leads: this.leads.listByPartner(partnerId, { limit, skip, q, stage }),
      stuck: stuck$,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ leads, stuck }) => this.applyResult(leads, stuck),
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  private applyResult(leads: ProspectListEnvelope | null, stuck: StuckEnvelope): void {
    this.stuckDays.set(Object.fromEntries((stuck.data ?? []).map((s) => [s.prospectId, s])));
    this.rows.set(leads?.data ?? []);
    this.total.set(leads?.meta?.total ?? (leads?.data?.length ?? 0));
    this.serverStageCounts.set(leads?.meta?.stageCounts ?? {});
    this.selected.set(new Set());
    this.loading.set(false);
    this.resolveCampaignNames();
  }

  protected toggleStuckOnly(): void {
    if (this.stuckCount() === 0) return;
    this.stuckOnly.set(!this.stuckOnly());
    this.pageIndex.set(0);
    this.reload();
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.pageIndex.set(0);
    this.reload();
  }

  /** Batch-resolve owning campaign names for allocated rows (one round trip). */
  protected resolveCampaignNames(): void {
    const ids = [...new Set(
      this.rows().map((r) => String((r as ProspectLead & { campaignId?: unknown }).campaignId ?? '').trim()).filter(Boolean),
    )].filter((id) => !(id in this.campaignNames()));
    if (ids.length === 0) return;
    this.leads
      .campaignNames(ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.campaignNames.set({ ...this.campaignNames(), ...(res?.data ?? {}) }),
        error: () => null,
      });
  }

  /** Downloadable CSV template — exact headers the importer accepts. */
  protected downloadTemplate(): void {
    const csv = 'name,surname,phone,email,source,relationship\nAdaobi,Temitope,08031234567,ada@example.com,Contact Import,Friend\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'marketspase-contact-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  protected onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.importError.set(null);
    this.importReport.set(null);
    if (!file) return;
    this.importFileName.set(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.importRows.set(parseImportCsv(String(reader.result ?? '')));
      } catch {
        this.importError.set('Could not read that file — export it as CSV and try again.');
        this.importRows.set([]);
      }
    };
    reader.onerror = () => {
      this.importError.set('Could not read that file — try again.');
      this.importRows.set([]);
    };
    reader.readAsText(file);
    if (input) input.value = '';
  }

  protected doImport(): void {
    const rows = this.importRows();
    if (rows.length === 0 || this.importing()) return;
    this.importing.set(true);
    this.importError.set(null);
    this.importReport.set(null);
    this.leads
      .importContacts(rows.slice(0, 500))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.importing.set(false);
          this.importReport.set(res.data);
          this.importRows.set([]);
          this.importFileName.set('');
          this.pageIndex.set(0);
          this.reload();
        },
        error: (err: ApiError) => {
          this.importing.set(false);
          this.importError.set(userError(err));
        },
      });
  }

  protected onPage(event: PageEvent): void {
    this.pageSize.set(event.pageSize);
    this.pageIndex.set(event.pageIndex);
    this.reload();
  }

  protected toggleStageFilter(stage: ProspectStage): void {
    const next = this.stageFilter() === stage ? null : stage;
    this.stageFilter.set(next);
    this.pageIndex.set(0);
    this.reload();
  }

  protected stuckOf(lead: ProspectLead): StuckEntry | null {
    return this.stuckDays()[lead.id] ?? null;
  }

  protected readonly stuckDuration = formatStuckDuration;

  protected names(lead: ProspectLead): string {
    return this.leads.prospectName(lead);
  }

  protected chip(lead: ProspectLead): { label: string; color: string; text: string } {
    return STAGE_META[((lead.status?.stage ?? 'New') as ProspectStage)] ?? STAGE_META.New;
  }

  protected stageTone(lead: ProspectLead): string {
    return STAGE_TONE[((lead.status?.stage ?? 'New') as ProspectStage)] ?? STAGE_TONE.New;
  }

  protected stageLabel(lead: ProspectLead): string {
    return this.chip(lead).label;
  }

  protected interest(lead: ProspectLead): string {
    return this.leads.lastInterest(lead);
  }

  protected nextOf(lead: ProspectLead): ProspectStage | null {
    const next = nextStage(lead.status?.stage);
    // Conversion is a separate confirm flow — never a one-click stage move.
    return next === 'Converted' ? null : next;
  }

  protected canConvert(lead: ProspectLead): boolean {
    const stage = lead.status?.stage ?? 'New';
    return stage !== 'Converted' && stage !== 'Closed';
  }

  protected isConverted(lead: ProspectLead): boolean {
    return lead.status?.stage === 'Converted';
  }

  protected advance(lead: ProspectLead, stage: ProspectStage): void {
    this.actingId.set(lead.id);
    this.leads
      .advanceStage(lead.id, stage)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.reload();
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(userError(err));
        },
      });
  }

  protected convert(lead: ProspectLead): void {
    this.confirmId.set(null);
    this.dialog.open(CollectCodeComponent, {
      data: { ...lead, _id: lead.id },
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res: any) => {
        if (res?.converted) {
          this.convertedNotice.set({ name: this.names(lead) });
          this.reload();
          this.askRating(lead, 'converted');
        }
      });
  }

  /** Quality vote after convert/release — skippable, feeds pool ranking. */
  protected askRating(lead: ProspectLead, context: 'converted' | 'released' | 'expired'): void {
    this.dialog.open(RateLeadDialogComponent, {
      data: { prospectId: lead.id, leadName: this.names(lead), context },
    });
  }
}
