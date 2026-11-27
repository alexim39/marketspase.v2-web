import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterModule } from '@angular/router';
import { EmptyStateComponent } from '@marketspase/shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '@marketspase/shared/ui/error-state/error-state.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { LeadPipelineFacade } from '../state/lead-pipeline.facade';
import { PipelineFunnelComponent } from '../funnel/pipeline-funnel.component';

@Component({
  selector: 'async-lead-pipeline-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatMenuModule, MatChipsModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatPaginatorModule, MatTooltipModule,
    MatSnackBarModule, EmptyStateComponent, ErrorStateComponent, PageSkeletonComponent, RouterModule, DatePipe,
    PipelineFunnelComponent,
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

      <async-pipeline-funnel [funnel]="funnel()" />

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
              <article class="signup-card">
                <span class="signup-avatar">{{ memberInitial(member) }}</span>
                <div class="signup-copy">
                  <strong>{{ member.name }} {{ member.surname }}</strong>
                  <span class="signup-handle">&#64;{{ member.username }}</span>
                  <span class="signup-meta">
                    <mat-icon aria-hidden="true">schedule</mat-icon>
                    Joined {{ member.joinedAt | date:'MMM d, y' }}
                  </span>
                </div>
                <div class="signup-actions">
                  <span class="signup-stage">Signed up</span>
                  <a mat-stroked-button [routerLink]="['/dashboard/mentorship/partners/my-partners/detail', member.id]">
                    Open dossier
                  </a>
                </div>
              </article>
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
        <div class="lead-cards">
          @for (lead of filtered(); track lead.id) {
            <article class="lead-card" [class.is-converted]="isConverted(lead)">
              <header class="lead-head">
                <span class="lead-avatar">{{ initial(lead) }}</span>
                <div class="lead-identity">
                  <a class="lead-name" [routerLink]="['../detail', lead.id]">{{ names(lead) }}</a>
                  <span class="lead-contact">
                    <span><mat-icon aria-hidden="true">call</mat-icon>{{ lead.prospectPhone }}</span>
                    @if (lead.prospectEmail) {
                      <span class="lead-email"><mat-icon aria-hidden="true">mail</mat-icon>{{ lead.prospectEmail }}</span>
                    }
                  </span>
                </div>
                <span class="dp-status {{ stageTone(lead) }}">{{ stageLabel(lead) }}</span>
              </header>

              <div class="lead-meta">
                <span class="lead-interest"><mat-icon aria-hidden="true">local_fire_department</mat-icon>{{ interest(lead) }}</span>
                @if (stuckOf(lead); as stuck) {
                  <span class="stuck-badge"><mat-icon aria-hidden="true">schedule</mat-icon>Stuck {{ stuckDuration(stuck.daysInStage) }}</span>
                }
                @if (lead.convertedPartnerId) {
                  <span class="joined-badge"><mat-icon aria-hidden="true">verified</mat-icon>Joined your team</span>
                }
              </div>

              <div class="lead-actions">
                @if (nextOf(lead); as next) {
                  <button
                    mat-flat-button
                    color="primary"
                    type="button"
                    class="lead-advance"
                    (click)="advance(lead, next)"
                    [disabled]="actingId() === lead.id">
                    Advance to {{ next }}
                  </button>
                }
                <a mat-stroked-button [routerLink]="['/dashboard/prospects/detail', lead.id]">Work contact</a>
                <button
                  mat-icon-button
                  type="button"
                  [matMenuTriggerFor]="leadMenu"
                  [attr.aria-label]="'More actions for ' + names(lead)">
                  <mat-icon>more_vert</mat-icon>
                </button>
              </div>

              @if (isConverted(lead) && !lead.convertedPartnerId) {
                <div class="lead-converted">
                  <span>Converted. Share their signup link so they join your team.</span>
                  <button mat-stroked-button type="button" (click)="copyConversionLink(lead.id)">
                    <mat-icon>link</mat-icon> Copy link
                  </button>
                  <button mat-button type="button" (click)="shareConversionOnWhatsApp(lead)">
                    <mat-icon>chat</mat-icon> WhatsApp
                  </button>
                </div>
              }

              @if (confirmId() === lead.id) {
                <div class="confirm-strip">
                  <span>Convert {{ names(lead) }} and issue an enrollment code?</span>
                  <button mat-flat-button color="primary" type="button" (click)="convert(lead)" [disabled]="actingId() === lead.id">
                    Confirm convert
                  </button>
                  <button mat-button type="button" (click)="confirmId.set(null)">Cancel</button>
                </div>
              }

              @if (deleteConfirmId() === lead.id) {
                <div class="confirm-strip danger">
                  <span>Delete {{ names(lead) }} from your pipeline?</span>
                  <button mat-button color="warn" type="button" (click)="remove(lead)" [disabled]="actingId() === lead.id">
                    Delete lead
                  </button>
                  <button mat-button type="button" (click)="deleteConfirmId.set(null)">Cancel</button>
                </div>
              }

              <mat-menu #leadMenu="matMenu">
                <a mat-menu-item [routerLink]="['../edit', lead.id]">
                  <mat-icon>edit</mat-icon>Edit lead
                </a>
                @if (canConvert(lead)) {
                  <button mat-menu-item type="button" (click)="confirmId.set(lead.id)">
                    <mat-icon>how_to_reg</mat-icon>Convert lead
                  </button>
                }
                @if (isConverted(lead) && !lead.convertedPartnerId) {
                  <button mat-menu-item type="button" (click)="copyConversionLink(lead.id)">
                    <mat-icon>link</mat-icon>Copy signup link
                  </button>
                  <button mat-menu-item type="button" (click)="shareConversionOnWhatsApp(lead)">
                    <mat-icon>chat</mat-icon>Share on WhatsApp
                  </button>
                }
                <button mat-menu-item type="button" (click)="deleteConfirmId.set(lead.id)">
                  <mat-icon>delete</mat-icon>Delete lead
                </button>
              </mat-menu>
            </article>
          }
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
    .signup-list { display: flex; flex-direction: column; gap: 0.65em; }
    .signup-card { display: flex; align-items: flex-start; gap: 0.7em; padding: 0.8em; border: 1px solid var(--ms-line); border-radius: 12px; background: var(--ms-surface); flex-wrap: wrap; }
    .signup-avatar { width: 40px; height: 40px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--ms-primary-soft); font-weight: 800; color: var(--ms-primary-strong); }
    .signup-copy { display: flex; flex-direction: column; gap: 0.15em; min-width: 0; flex: 1; }
    .signup-copy strong { text-transform: capitalize; }
    .signup-handle { color: var(--ms-text-muted); font-size: 0.78em; }
    .signup-meta { display: inline-flex; align-items: center; gap: 4px; color: var(--ms-text-muted); font-size: 0.72em; }
    .signup-meta mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .signup-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 0.35em; flex: none; }
    .signup-stage { border-radius: 999px; padding: 3px 9px; font-size: 0.72em; font-weight: 700; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .signup-actions a { min-height: 40px; }
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
    .lead-cards { display: flex; flex-direction: column; gap: 0.85em; }
    .lead-card { display: flex; flex-direction: column; gap: 0.7em; padding: 0.95em; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); box-shadow: 0 6px 18px rgba(20, 18, 43, 0.05); }
    .lead-card.is-converted { border-color: color-mix(in srgb, var(--ms-success) 32%, var(--ms-line)); }
    .lead-head { display: flex; align-items: flex-start; gap: 0.7em; }
    .lead-avatar { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 800; }
    .lead-identity { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2em; }
    .lead-name { font-weight: 700; color: var(--ms-text); text-decoration: none; text-transform: capitalize; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lead-name:hover { color: var(--ms-primary-strong); }
    .lead-contact { display: flex; flex-direction: column; gap: 0.15em; color: var(--ms-text-muted); font-size: 0.78em; }
    .lead-contact > span { display: inline-flex; align-items: center; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lead-contact mat-icon { font-size: 14px; width: 14px; height: 14px; flex: none; margin-right: 4px; }
    .lead-head .dp-status { flex: none; align-self: flex-start; }
    .lead-meta { display: flex; flex-wrap: wrap; gap: 0.4em 0.65em; align-items: center; }
    .lead-interest { display: inline-flex; align-items: center; gap: 4px; padding: 0.2em 0.6em; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.75em; text-transform: capitalize; }
    .lead-interest mat-icon { font-size: 14px; width: 14px; height: 14px; color: var(--ms-warning); }
    .lead-actions { display: flex; align-items: center; gap: 0.5em; flex-wrap: wrap; }
    .lead-actions .lead-advance { flex: 1 1 100%; min-height: 44px; }
    .lead-actions > a { min-height: 44px; }
    .lead-actions > button[mat-icon-button] { margin-left: auto; }
    .lead-converted { display: flex; align-items: center; gap: 0.5em; flex-wrap: wrap; padding: 0.6em 0.7em; border-radius: 10px; background: var(--ms-success-soft); color: var(--ms-success); font-size: 0.8em; }
    .lead-converted > span { flex: 1 1 100%; line-height: 1.4; }
    .lead-converted button { min-height: 40px; }
    .confirm-strip { display: flex; align-items: center; gap: 0.5em; flex-wrap: wrap; padding: 0.6em 0.7em; border-radius: 10px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.8em; }
    .confirm-strip > span { flex: 1 1 100%; font-weight: 600; line-height: 1.4; }
    .confirm-strip.danger { background: var(--ms-error-soft); color: var(--ms-error); }
    .confirm-strip button { min-height: 40px; }
    .joined-badge { display: inline-flex; align-items: center; gap: 0.25em; padding: 0.2em 0.6em; border-radius: 999px; background: var(--ms-success-soft); color: var(--ms-success); font-size: 0.75em; font-weight: 700; }
    .joined-badge mat-icon { width: 14px; height: 14px; font-size: 14px; }
    .stuck-badge { display: inline-flex; align-items: center; gap: 4px; padding: 0.2em 0.6em; border-radius: 999px; background: var(--ms-error-soft); color: var(--ms-error); font-size: 0.75em; font-weight: 700; }
    .stuck-badge mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .total { margin: 0; }
    @media only screen and (max-width: 900px) {
      .pipeline-hero { grid-template-columns: 1fr; }
      .hero-steps { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }
    @media only screen and (max-width: 600px) {
      .mat-mdc-paginator-page-size { display: none; }
      .ms-head-actions { width: 100%; }
      .pipeline-hero { padding: 1em; }
      .hero-copy { min-width: 0; }
      .hero-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .hero-actions { width: 100%; }
      .hero-actions a, .hero-actions button { flex: 1 1 100%; min-width: 0; white-space: normal; }
      .hero-link { flex-wrap: wrap; }
      .hero-link code { width: 100%; }
      .hero-link button { width: 100%; }
      .converted-actions { width: 100%; }
      .converted-actions button { flex: 1; }
      .stage-cards { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 0.5em; }
      .lead-card { padding: 0.85em; }
      .lead-head { flex-wrap: wrap; }
      .lead-head .dp-status { margin-left: 3.2em; }
      .signup-card { padding: 0.7em; }
      .signup-actions { width: 100%; flex-direction: row; align-items: center; justify-content: space-between; }
    }
  `],
})
export class LeadPipelineMobileComponent implements OnInit {
  private readonly facade = inject(LeadPipelineFacade);

  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly rows = this.facade.rows;
  protected readonly total = this.facade.total;
  protected readonly search = this.facade.search;
  protected readonly stageFilter = this.facade.stageFilter;
  protected readonly stuckOnly = this.facade.stuckOnly;
  protected readonly pageSize = this.facade.pageSize;
  protected readonly pageIndex = this.facade.pageIndex;
  protected readonly stuckDays = this.facade.stuckDays;
  protected readonly signupRows = this.facade.signupRows;
  protected readonly funnel = this.facade.funnel;
  protected readonly actingId = this.facade.actingId;
  protected readonly confirmId = this.facade.confirmId;
  protected readonly convertedNotice = this.facade.convertedNotice;
  protected readonly serverStageCounts = this.facade.serverStageCounts;
  protected readonly displayedColumns = this.facade.displayedColumns;
  protected readonly deleteConfirmId = this.facade.deleteConfirmId;
  protected readonly stageCounts = this.facade.stageCounts;
  protected readonly filtered = this.facade.filtered;
  protected readonly stuckCount = this.facade.stuckCount;
  protected readonly stuckDuration = this.facade.stuckDuration;

  ngOnInit(): void { this.facade.ensureLoaded(); }
  protected remove(lead: Parameters<LeadPipelineFacade['remove']>[0]): void { this.facade.remove(lead); }
  protected reload(): void { this.facade.reload(); }
  protected toggleStuckOnly(): void { this.facade.toggleStuckOnly(); }
  protected onSearch(value: string): void { this.facade.onSearch(value); }
  protected onPage(event: PageEvent): void { this.facade.onPage(event.pageSize, event.pageIndex); }
  protected toggleStageFilter(stage: Parameters<LeadPipelineFacade['toggleStageFilter']>[0]): void { this.facade.toggleStageFilter(stage); }
  protected stuckOf(lead: Parameters<LeadPipelineFacade['stuckOf']>[0]) { return this.facade.stuckOf(lead); }
  protected names(lead: Parameters<LeadPipelineFacade['names']>[0]): string { return this.facade.names(lead); }
  protected initial(lead: Parameters<LeadPipelineFacade['names']>[0]): string {
    const name = this.facade.names(lead).trim();
    return name ? name.charAt(0).toUpperCase() : '?';
  }
  protected stageTone(lead: Parameters<LeadPipelineFacade['stageTone']>[0]): string { return this.facade.stageTone(lead); }
  protected stageLabel(lead: Parameters<LeadPipelineFacade['stageLabel']>[0]): string { return this.facade.stageLabel(lead); }
  protected interest(lead: Parameters<LeadPipelineFacade['interest']>[0]): string { return this.facade.interest(lead); }
  protected nextOf(lead: Parameters<LeadPipelineFacade['nextOf']>[0]) { return this.facade.nextOf(lead); }
  protected canConvert(lead: Parameters<LeadPipelineFacade['canConvert']>[0]): boolean { return this.facade.canConvert(lead); }
  protected isConverted(lead: Parameters<LeadPipelineFacade['isConverted']>[0]): boolean { return this.facade.isConverted(lead); }
  protected advance(lead: Parameters<LeadPipelineFacade['advance']>[0], stage: Parameters<LeadPipelineFacade['advance']>[1]): void { this.facade.advance(lead, stage); }
  protected convert(lead: Parameters<LeadPipelineFacade['convert']>[0]): void { this.facade.convert(lead); }
  protected referralLink(): string | null { return this.facade.referralLink(); }
  protected conversionLink(leadId: string): string | null { return this.facade.conversionLink(leadId); }
  protected leadPageLink(): string | null { return this.facade.leadPageLink(); }
  protected copyLeadPageLink(): void { this.facade.copyLeadPageLink(); }
  protected memberInitial(member: Parameters<LeadPipelineFacade['memberInitial']>[0]): string { return this.facade.memberInitial(member); }
  protected copyReferralLink(): void { this.facade.copyReferralLink(); }
  protected copyConversionLink(leadId: string): void { this.facade.copyConversionLink(leadId); }
  protected shareConversionOnWhatsApp(lead: Parameters<LeadPipelineFacade['shareConversionOnWhatsApp']>[0]): void { this.facade.shareConversionOnWhatsApp(lead); }
  protected shareConvertedOnWhatsApp(leadId: string, name: string): void { this.facade.shareConvertedOnWhatsApp(leadId, name); }
}
