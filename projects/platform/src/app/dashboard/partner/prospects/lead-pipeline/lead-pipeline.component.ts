import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { environment } from '../../../../../environments/environment';
import { ApiError, userError } from '../../../../core/http/api-error';
import { LeadPipelineService } from './lead-pipeline.service';
import {
  nextStage, ProspectLead, ProspectListEnvelope, ProspectStage,
  ReferralMember,
  STAGE_META, STAGE_ORDER, STAGE_TONE, StuckEntry, StuckEnvelope,
} from './lead.models';
import { formatStuckDuration } from '../stuck-duration';
import { CollectCodeComponent } from '../../contacts/manage/details/collect-code.component';
import { RateLeadDialogComponent } from './rate-lead-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { EmptyStateComponent } from '@marketspase/shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '@marketspase/shared/ui/error-state/error-state.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { forkJoin, map, of, switchMap } from 'rxjs';

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
    MatTableModule, MatChipsModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatPaginatorModule, MatTooltipModule,
    MatSnackBarModule, EmptyStateComponent, ErrorStateComponent, PageSkeletonComponent, RouterModule, DatePipe,
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
      <header class="pipeline-hero">
        <div class="hero-copy">
          <p class="eyebrow">Prospects · Team builder</p>
          <h1>Turn conversations into partners.</h1>
          <p class="hero-lede">
            Every lead you convert is protected for your team. Share your referral link, work the conversation,
            and when they sign up they join under you — never under a random campaign owner.
          </p>
          <div class="hero-actions">
            <button mat-flat-button color="primary" type="button" (click)="copyReferralLink()">
              <mat-icon>link</mat-icon> Copy my referral link
            </button>
            <a mat-stroked-button routerLink="/dashboard/prospects/customer-leads" title="People who checked out in your store">
              <mat-icon>groups</mat-icon> Customer leads
            </a>
            <button mat-stroked-button type="button" (click)="copyLeadPageLink()" title="Share your personal lead page">
              <mat-icon>person_add</mat-icon> Copy lead page
            </button>
            <a mat-stroked-button routerLink="/dashboard/prospects/new" title="Add someone to your pipeline">
              <mat-icon>person_add</mat-icon> Add prospect
            </a>
          </div>
          @if (referralLink(); as link) {
            <div class="hero-link">
              <code>{{ link }}</code>
              <button mat-button type="button" (click)="copyReferralLink()">Copy</button>
            </div>
          }
        </div>
        <div class="hero-steps" aria-label="How conversion works">
          <div><span>1</span><strong>Capture</strong><small>Add or import a lead</small></div>
          <div><span>2</span><strong>Work</strong><small>Advance the conversation</small></div>
          <div><span>3</span><strong>Convert</strong><small>Mark them ready to join</small></div>
          <div><span>4</span><strong>Join your team</strong><small>Share their personal signup link</small></div>
        </div>
      </header>

      @if (convertedNotice(); as converted) {
        <div class="code-banner" role="status">
          <mat-icon>celebration</mat-icon>
          <div class="converted-copy">
            <strong>{{ converted.name }} is converted.</strong>
            <span>Share their signup link — they join your team automatically.</span>
            @if (conversionLink(converted.leadId); as link) {
              <code class="conversion-link">{{ link }}</code>
            }
          </div>
          <div class="converted-actions">
            <button mat-flat-button color="primary" type="button" (click)="copyConversionLink(converted.leadId)">
              <mat-icon>content_copy</mat-icon> Copy link
            </button>
            <button mat-stroked-button type="button" (click)="shareConvertedOnWhatsApp(converted.leadId, converted.name)">
              <mat-icon>chat</mat-icon> WhatsApp
            </button>
          </div>
          <button mat-icon-button (click)="convertedNotice.set(null)" aria-label="Dismiss">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }

      @if (loading()) {
        <async-page-skeleton layout="table" [rows]="5" label="lead pipeline" [showHeader]="false" />
      } @else {

      @if (signupRows().length > 0) {
        <div class="dp-card signup-panel">
          <div class="signup-head">
            <div>
              <p class="eyebrow">Referral signups</p>
              <h3>{{ signupRows().length }} joined your team and are not activated yet</h3>
              <p class="muted">These people used your referral link and created an account. Help them activate — they are already in your team.</p>
            </div>
            <span class="signup-count">{{ signupRows().length }}</span>
          </div>
          <div class="signup-list">
            @for (member of signupRows(); track member.id) {
              <div class="signup-row">
                <span class="signup-avatar">{{ memberInitial(member) }}</span>
                <div class="signup-copy">
                  <strong>{{ member.name }} {{ member.surname }}</strong>
                  <span class="muted">&#64;{{ member.username }} · joined {{ member.joinedAt | date:'mediumDate' }}</span>
                </div>
                <span class="signup-stage">Signed up</span>
                <a mat-button [routerLink]="['/dashboard/mentorship/partners/my-partners/detail', member.id]">Open dossier</a>
              </div>
            }
          </div>
        </div>
      }

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
      </div>

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
          <a mat-flat-button color="primary" routerLink="/dashboard/prospects/new">Add prospect</a>
        </async-empty-state>
      }

      @if (filtered().length > 0) {
        <div class="table-wrap">
          <table mat-table [dataSource]="filtered()" class="mat-elevation-z2">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let lead" class="name-cell" data-label="Prospect"><a [routerLink]="['../detail', lead.id]" class="name-link">{{ names(lead) }}</a>
                @if (lead.convertedPartnerId) {
                  <span class="joined-badge" title="This converted lead signed up under you">
                    <mat-icon>verified</mat-icon><span>Joined your team</span>
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
                <a mat-button [routerLink]="['/dashboard/prospects/detail', lead.id]" title="Work {{ names(lead) }} - status, outreach and history in one place">Work contact</a>
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
                  @if (lead.convertedPartnerId) {
                    <span class="joined-badge"><mat-icon>verified</mat-icon> Joined your team</span>
                  } @else {
                    <button mat-stroked-button type="button" (click)="copyConversionLink(lead.id)">
                      <mat-icon>link</mat-icon> Copy signup link
                    </button>
                    <button mat-button type="button" (click)="shareConversionOnWhatsApp(lead)">
                      <mat-icon>chat</mat-icon> WhatsApp
                    </button>
                  }
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
    .pipeline-hero {
      position: relative;
      overflow: hidden;
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.65fr);
      gap: 1em;
      padding: 1.35em;
      border-radius: 20px;
      background: linear-gradient(135deg, #17152e 0%, #2d2a5c 55%, #4f46e5 100%);
      color: #fff;
      box-shadow: 0 18px 44px rgba(20, 18, 43, 0.24);
    }
    .pipeline-hero .eyebrow { color: #c7d2fe; }
    .pipeline-hero h1 { margin: 0.2em 0 0.3em; font-size: clamp(1.7rem, 3vw, 2.35rem); letter-spacing: -0.03em; line-height: 1.1; }
    .hero-lede { max-width: 52em; margin: 0; color: rgba(255, 255, 255, 0.78); line-height: 1.55; }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 0.45em; margin-top: 1em; }
    .hero-actions a, .hero-actions button { min-height: 44px; }
    .hero-link { display: flex; align-items: center; gap: 0.5em; max-width: 100%; margin-top: 0.9em; padding: 0.5em 0.6em; border-radius: 10px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.16); }
    .hero-link code { flex: 1; min-width: 0; overflow: hidden; color: #e0e7ff; font-size: 0.8em; text-overflow: ellipsis; white-space: nowrap; }
    .hero-link button { color: #e0e7ff; min-height: 36px; }
    .hero-steps { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5em; align-content: start; }
    .hero-steps > div { display: flex; flex-direction: column; gap: 0.1em; padding: 0.65em 0.7em; border-radius: 12px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.14); }
    .hero-steps span { display: inline-grid; place-items: center; width: 22px; height: 22px; margin-bottom: 0.15em; border-radius: 50%; background: rgba(255, 255, 255, 0.16); font-size: 0.72em; font-weight: 800; }
    .hero-steps strong { font-size: 0.82em; }
    .hero-steps small { color: rgba(255, 255, 255, 0.68); font-size: 0.72em; line-height: 1.35; }
    .code-banner {
      display: flex; align-items: center; gap: 0.75em; flex-wrap: wrap;
      background: var(--ms-success-soft); border: 1px solid var(--ms-success); border-radius: 12px; padding: 0.8em 1em;
    }
    .converted-copy { display: flex; flex-direction: column; gap: 0.15em; flex: 1; min-width: 220px; }
    .converted-copy > span { color: var(--ms-text-muted); font-size: 0.85em; }
    .conversion-link { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.78em; background: var(--ms-surface); border-radius: 6px; padding: 0.25em 0.45em; }
    .converted-actions { display: flex; gap: 0.4em; flex-wrap: wrap; }
    .converted-actions button { min-height: 42px; }
    .signup-panel { padding: 1em 1.1em; display: flex; flex-direction: column; gap: 0.8em; border-left: 4px solid var(--ms-primary); }
    .signup-head { display: flex; justify-content: space-between; gap: 1em; align-items: flex-start; flex-wrap: wrap; }
    .signup-head h3 { margin: 0.15em 0 0.25em; }
    .signup-head p { margin: 0; }
    .signup-count { min-width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 800; }
    .signup-list { display: flex; flex-direction: column; }
    .signup-row { display: flex; align-items: center; gap: 0.7em; padding: 0.6em 0; border-top: 1px solid var(--ms-line); flex-wrap: wrap; }
    .signup-avatar { width: 32px; height: 32px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--ms-surface-3); font-weight: 800; color: var(--ms-primary-strong); }
    .signup-copy { display: flex; flex-direction: column; gap: 0.05em; min-width: 0; flex: 1; }
    .signup-copy strong { text-transform: capitalize; }
    .signup-stage { border-radius: 999px; padding: 3px 9px; font-size: 0.72em; font-weight: 700; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .stage-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75em; }
    .stage-card {
      display: flex; flex-direction: column; align-items: center; gap: 0.15em;
      background: linear-gradient(160deg, color-mix(in srgb, var(--chip-bg) 30%, var(--ms-surface)), var(--ms-surface));
      color: var(--chip-fg);
      border: 2px solid transparent; border-radius: 14px; padding: 0.9em 0.55em; cursor: pointer;
      transition: border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
      box-shadow: 0 6px 16px rgba(20, 18, 43, 0.05);
    }
    .stage-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--chip-fg) 36%, transparent); }
    .stage-card.active { border-color: var(--ms-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ms-primary) 18%, transparent); }
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
    .joined-badge { display: inline-flex; align-items: center; gap: 0.25em; margin-top: 0.3em; padding: 0.12em 0.6em; border-radius: 999px; background: var(--ms-success-soft); color: var(--ms-success); font-size: 0.75em; font-weight: 700; }
    .joined-badge mat-icon { width: 15px; height: 15px; font-size: 15px; }
    .stuck-badge { color: var(--ms-error); font-size: 0.85em; font-weight: 600; margin-top: 0.25em; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .interest-cell { text-transform: capitalize; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .total { margin: 0; }
    @media only screen and (max-width: 900px) {
      .pipeline-hero { grid-template-columns: 1fr; }
      .hero-steps { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }
    @media only screen and (max-width: 600px) {
      /* Paginator controls overflow 360px viewports — page-size stays 50. */
      .mat-mdc-paginator-page-size { display: none; }
      .ms-head-actions { width: 100%; }
      .hero-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .hero-actions { width: 100%; }
      .hero-actions a, .hero-actions button { flex: 1 1 auto; }
      .converted-actions { width: 100%; }
      .converted-actions button { flex: 1; }
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
  protected readonly signupRows = signal<ReferralMember[]>([]);
  protected readonly actingId = signal<string | null>(null);
  protected readonly confirmId = signal<string | null>(null);
  protected readonly convertedNotice = signal<{ name: string; leadId: string } | null>(null);
  protected readonly serverStageCounts = signal<Record<string, number>>({});

  protected readonly displayedColumns = ['name', 'contact', 'stage', 'interest', 'action'];
  protected readonly deleteConfirmId = signal<string | null>(null);

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
    this.leads.referralMembers(partnerId, this.search().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.signupRows.set(res.data ?? []),
        error: () => this.signupRows.set([]),
      });
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
    this.loading.set(false);
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
          this.convertedNotice.set({ name: this.names(lead), leadId: lead.id });
          this.reload();
          this.askRating(lead, 'converted');
        }
      });
  }

  protected referralLink(): string | null {
    const username = String(this.auth.currentUser()?.username ?? '').trim();
    if (!username || typeof location === 'undefined') return null;
    return `${location.origin}/join?ref=${encodeURIComponent(username)}`;
  }

  protected conversionLink(leadId: string): string | null {
    const base = this.referralLink();
    return base ? `${base}&lead=${encodeURIComponent(leadId)}` : null;
  }

  protected leadPageLink(): string | null {
    const username = String(this.auth.currentUser()?.username ?? '').trim();
    if (!username) return null;
    const base = String((environment as { publicSiteUrl?: string }).publicSiteUrl ?? '')
      .replace(/\/+$/, '') || (typeof location !== 'undefined' ? location.origin : '');
    return `${base}/lead/${encodeURIComponent(username)}`;
  }

  protected copyLeadPageLink(): void {
    const url = this.leadPageLink();
    if (!url) return;
    this.copyText(url, 'Personal lead page copied');
  }

  protected memberInitial(member: ReferralMember): string {
    return String(member.name || member.username || 'M').trim().charAt(0).toUpperCase();
  }

  protected copyReferralLink(): void {
    const url = this.referralLink();
    if (!url) return;
    this.copyText(url, 'Referral link copied — new signups join your team');
  }

  protected copyConversionLink(leadId: string): void {
    const url = this.conversionLink(leadId);
    if (!url) return;
    this.copyText(url, 'Signup link copied — this lead will join your team');
  }

  protected shareConversionOnWhatsApp(lead: ProspectLead): void {
    this.shareConversionLink(lead.id, this.names(lead));
  }

  protected shareConvertedOnWhatsApp(leadId: string, name: string): void {
    this.shareConversionLink(leadId, name);
  }

  private shareConversionLink(leadId: string, name: string): void {
    const url = this.conversionLink(leadId);
    if (!url) return;
    const text = `Hi ${name}, your MarketSpase account is ready. Use my link to join my team: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  private copyText(url: string, message: string): void {
    const done = () => this.snack.open(message, 'Close', { duration: 3000 });
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, done);
    else done();
  }

  /** Quality vote after convert/release — skippable, feeds pool ranking. */
  protected askRating(lead: ProspectLead, context: 'converted' | 'released' | 'expired'): void {
    this.dialog.open(RateLeadDialogComponent, {
      data: { prospectId: lead.id, leadName: this.names(lead), context },
    });
  }
}
