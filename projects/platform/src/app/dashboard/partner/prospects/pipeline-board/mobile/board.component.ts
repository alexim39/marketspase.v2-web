import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { ProspectLead, ProspectStage, STAGE_META, STAGE_ORDER, nextStage } from '../../lead-pipeline/lead.models';
import { PipelineBoardFacade } from '../state/pipeline-board.facade';

@Component({
  selector: 'async-pipeline-board-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    A11yModule, MatButtonModule, MatFormFieldModule, MatIconModule,
    MatInputModule, PageSkeletonComponent, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Prospects</a> &gt;
        <span>Pipeline board</span>
      </div>
    </section>

    <section class="board-page">
      <header class="page-head">
        <div class="head-copy">
          <p class="eyebrow">Pipeline · Deal movement</p>
          <h1>Pipeline board</h1>
          <p class="subtitle">Pick a stage below, then tap <strong>Move to…</strong> on a card. No dragging needed on mobile — every move is a single tap.</p>
        </div>
        <div class="head-actions">
          <button mat-stroked-button type="button" (click)="reload()" [disabled]="loading()">
            <mat-icon>refresh</mat-icon>
            Refresh
          </button>
          <a mat-stroked-button routerLink="../pipeline"><mat-icon>table_rows</mat-icon> List view</a>
          <a mat-stroked-button routerLink="../customer-leads"><mat-icon>groups</mat-icon> Customers</a>
        </div>
      </header>

      @if (convertedNotice(); as converted) {
        <div class="code-banner" role="status">
          <span class="banner-icon"><mat-icon>celebration</mat-icon></span>
          <div>
            <strong>{{ converted.name }}</strong> is converted. Share their signup link so they join your team.
            @if (conversionLink(converted.leadId); as link) {
              <code class="conversion-link">{{ link }}</code>
            }
          </div>
          <button mat-stroked-button type="button" (click)="copyConversionLink(converted.leadId)">Copy link</button>
          <button mat-icon-button (click)="convertedNotice.set(null)" aria-label="Dismiss"><mat-icon>close</mat-icon></button>
        </div>
      }

      <section class="summary-strip" aria-label="Pipeline summary">
        <div class="summary-card"><span class="summary-icon"><mat-icon>view_kanban</mat-icon></span><div><strong>{{ totalCards() }}</strong><span>Total prospects</span><small>Across every stage</small></div></div>
        <div class="summary-card"><span class="summary-icon summary-icon--info"><mat-icon>bolt</mat-icon></span><div><strong>{{ activeCount() }}</strong><span>Active conversations</span><small>Open pipeline</small></div></div>
        <div class="summary-card"><span class="summary-icon summary-icon--ok"><mat-icon>verified</mat-icon></span><div><strong>{{ convertedCount() }}</strong><span>Converted</span><small>Ready or already joined</small></div></div>
        <div class="summary-card" [class.summary-card--attention]="stuckCount() > 0"><span class="summary-icon summary-icon--bad"><mat-icon>hourglass_bottom</mat-icon></span><div><strong>{{ stuckCount() }}</strong><span>Stuck cards</span><small>Need a next step</small></div></div>
      </section>

      <div class="search-card">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>Search deals</mat-label>
          <input matInput type="search" placeholder="Name, phone or email" [value]="search()" (input)="onSearch($any($event.target).value)" />
          @if (search()) {
            <button matSuffix mat-icon-button type="button" aria-label="Clear search" (click)="clearSearch()">
              <mat-icon>close</mat-icon>
            </button>
          }
        </mat-form-field>
        @if (searchActive()) {
          <p class="search-note">
            <mat-icon>filter_alt</mat-icon>
            {{ matchCount() }} {{ matchCount() === 1 ? 'match' : 'matches' }} across
            {{ matchingStageCount() }} {{ matchingStageCount() === 1 ? 'stage' : 'stages' }}
          </p>
        }
      </div>

      @if (error(); as err) {
        <div class="alert" role="alert"><mat-icon>error_outline</mat-icon><p>{{ err }}</p><button mat-stroked-button type="button" (click)="reload()">Retry</button></div>
      }

      @if (loading()) {
        <async-page-skeleton layout="board" [rows]="3" label="pipeline board" [showHeader]="false" />
      } @else {
        <nav class="stage-rail" aria-label="Pipeline stages">
          @for (col of columns(); track col.stage) {
            <button
              type="button"
              class="stage-tab"
              [class.is-active]="activeStage() === col.stage"
              [attr.aria-pressed]="activeStage() === col.stage"
              (click)="selectStage(col.stage)">
              <span class="stage-dot stage-dot--{{ stageTone(col.stage) }}"></span>
              <span class="stage-name">{{ col.meta.label }}</span>
              <span class="stage-count">{{ col.cards.length }}</span>
            </button>
          }
        </nav>

        <header class="focus-head">
          <div class="focus-copy">
            <p class="eyebrow">{{ activeStepLabel() }}</p>
            <h2>
              {{ activeLabel() }}
              <span class="focus-count">{{ focusedCards().length }}</span>
            </h2>
            <p class="focus-hint">{{ stageHint() }}</p>
          </div>
          <a mat-flat-button color="primary" routerLink="/dashboard/prospects/new" class="focus-add">
            <mat-icon>person_add</mat-icon> Add
          </a>
        </header>

        @if (activeStep() > 0) {
          <div class="stage-meter" aria-hidden="true">
            @for (step of stageSteps; track step) {
              <span class="meter-seg" [class.is-on]="step <= activeStep()" [class.is-current]="step === activeStep()"></span>
            }
          </div>
        }

        @if (focusedCards().length > 0) {
          <div class="lead-cards">
            @for (lead of focusedCards(); track lead.id) {
              <article class="lead-card" [class.is-converted]="isConverted(lead)">
                <header class="card-head">
                  <span class="avatar" aria-hidden="true">{{ initials(lead) }}</span>
                  <div class="card-id">
                    <a class="card-name" [routerLink]="['../detail', lead.id]">{{ names(lead) }}</a>
                    <span class="card-contact">{{ lead.prospectPhone }}</span>
                    @if (lead.prospectEmail) {
                      <span class="card-contact card-email">{{ lead.prospectEmail }}</span>
                    }
                  </div>
                </header>

                @if (stuckOf(lead) || isConverted(lead)) {
                  <div class="card-badges">
                    @if (stuckOf(lead); as stuck) {
                      <span class="stuck-badge">
                        <mat-icon>hourglass_bottom</mat-icon>
                        Stuck {{ stuckDuration(stuck.daysInStage) }}
                      </span>
                    }
                    @if (isConverted(lead)) {
                      @if (lead.convertedPartnerId) {
                        <span class="joined-badge"><mat-icon>verified</mat-icon> Joined your team</span>
                      } @else {
                        <span class="joined-badge joined-badge--pending"><mat-icon>link</mat-icon> Signup pending</span>
                      }
                    }
                  </div>
                }

                @if (nextStageOf(lead); as next) {
                  <button mat-flat-button color="primary" type="button" class="advance-btn" (click)="moveTo(lead, next)" [disabled]="actingId() !== null">
                    <mat-icon>{{ next === 'Converted' ? 'how_to_reg' : 'arrow_forward' }}</mat-icon>
                    {{ next === 'Converted' ? 'Convert & get signup link' : 'Move to ' + next }}
                  </button>
                } @else if (isConverted(lead) && !lead.convertedPartnerId) {
                  <button mat-flat-button color="primary" type="button" class="advance-btn" (click)="copyConversionLink(lead.id)">
                    <mat-icon>link</mat-icon> Copy signup link
                  </button>
                }

                <div class="card-actions">
                  <a mat-stroked-button [routerLink]="['../detail', lead.id]"><mat-icon>open_in_new</mat-icon> Open deal</a>
                  <button mat-stroked-button type="button" (click)="openMoveSheet(lead)" [disabled]="actingId() !== null">
                    <mat-icon>swap_horiz</mat-icon> Move to…
                  </button>
                </div>

                @if (actingId() === lead.id) {
                  <div class="moving-note" role="status"><mat-icon>sync</mat-icon> Moving deal…</div>
                }
              </article>
            }
          </div>
        } @else {
          <div class="empty-stage">
            <span class="empty-icon"><mat-icon>{{ searchActive() ? 'search_off' : 'inbox' }}</mat-icon></span>
            <h3>{{ searchActive() ? 'No matches in ' + activeLabel() : 'No deals in ' + activeLabel() }}</h3>
            @if (searchActive()) {
              @if (otherMatchStage(); as other) {
                <p>{{ matchCount() }} {{ matchCount() === 1 ? 'match is' : 'matches are' }} in other stages.</p>
                <button mat-flat-button color="primary" type="button" (click)="selectStage(other)">
                  Show {{ stageLabel(other) }} matches
                </button>
              } @else {
                <p>Try a different name, phone number or email.</p>
                <button mat-stroked-button type="button" (click)="clearSearch()">Clear search</button>
              }
            } @else {
              <p>Add a prospect, or move an existing deal into this stage from another tab.</p>
              <a mat-flat-button color="primary" routerLink="/dashboard/prospects/new"><mat-icon>person_add</mat-icon> Add prospect</a>
            }
          </div>
        }
      }
    </section>

    @if (movingLead(); as lead) {
      <div class="sheet-backdrop" (click)="closeMoveSheet()" aria-hidden="true"></div>
      <section
        class="move-sheet"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'Move ' + names(lead) + ' to another stage'"
        (keydown.escape)="closeMoveSheet()">
        <span class="sheet-handle" aria-hidden="true"></span>
        <header class="sheet-head">
          <span class="avatar" aria-hidden="true">{{ initials(lead) }}</span>
          <div class="sheet-id">
            <strong>{{ names(lead) }}</strong>
            <span>Currently in {{ stageLabel(currentStage(lead)) }}</span>
          </div>
          <button mat-icon-button type="button" (click)="closeMoveSheet()" aria-label="Close stage picker">
            <mat-icon>close</mat-icon>
          </button>
        </header>

        <div class="sheet-stages">
          @for (stage of boardStages; track stage) {
            <button
              type="button"
              class="sheet-stage"
              [class.is-current]="stage === currentStage(lead)"
              [class.is-danger]="stage === 'Closed'"
              [disabled]="stage === currentStage(lead) || actingId() !== null"
              (click)="moveTo(lead, stage)">
              <span class="stage-dot stage-dot--{{ stageTone(stage) }}"></span>
              <span class="sheet-stage-copy">
                <strong>{{ stageLabel(stage) }}</strong>
                <small>{{ stageDetail(stage) }}</small>
              </span>
              @if (stage === currentStage(lead)) {
                <span class="current-chip">Current</span>
              } @else {
                <mat-icon>arrow_forward</mat-icon>
              }
            </button>
          }
        </div>

        <p class="sheet-note">
          <mat-icon>info</mat-icon>
          Moving to Converted asks for confirmation and creates the prospect's signup link.
        </p>
      </section>
    }

    @if (pendingConvert(); as pending) {
      <div class="sheet-backdrop" (click)="pendingConvert.set(null)" aria-hidden="true"></div>
      <section
        class="move-sheet confirm-sheet"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        role="alertdialog"
        aria-modal="true"
        aria-label="Confirm conversion"
        (keydown.escape)="pendingConvert.set(null)">
        <span class="sheet-handle" aria-hidden="true"></span>
        <span class="confirm-icon"><mat-icon>how_to_reg</mat-icon></span>
        <h2>Convert {{ names(pending) }}?</h2>
        <p>This marks the deal as converted and creates their personal signup link. They join your team automatically when they activate.</p>
        <div class="confirm-actions">
          <button mat-flat-button color="primary" type="button" (click)="confirmConvert()" [disabled]="actingId() !== null">
            Convert & get link
          </button>
          <button mat-button type="button" (click)="pendingConvert.set(null)">Not yet</button>
        </div>
      </section>
    }
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 16px; }
    .breadcrumb a { text-decoration: none; }
    .board-page { display: flex; flex-direction: column; gap: 16px; max-width: 1400px; margin: 0 auto; padding-bottom: 24px; }
    .page-head { display: flex; flex-direction: column; gap: 12px; }
    .page-head h1 { margin: 2px 0 6px; font-size: clamp(1.9rem, 7vw, 2.4rem); letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .subtitle { margin: 0; color: var(--ms-text-muted); font-size: 0.86rem; line-height: 1.55; }
    .subtitle strong { color: var(--ms-text); }
    .head-actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .head-actions a, .head-actions button { flex: 1 1 auto; min-height: 44px; }
    .head-actions mat-icon { margin-right: 4px; }

    .code-banner { display: flex; align-items: center; gap: 10px; border-radius: var(--ms-radius-lg); padding: 12px 14px; flex-wrap: wrap; background: var(--ms-success-soft); border: 1px solid var(--ms-success); }
    .banner-icon { width: 34px; height: 34px; flex: none; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-surface); }
    .banner-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .code-banner > div { flex: 1; min-width: 200px; line-height: 1.5; font-size: 0.86rem; }
    .conversion-link { display: block; max-width: 100%; margin-top: 4px; overflow: hidden; font-size: 0.72rem; text-overflow: ellipsis; white-space: nowrap; background: var(--ms-surface); padding: 4px 8px; border-radius: var(--ms-radius-sm); }
    .code-banner button { min-height: 40px; }

    .summary-strip { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; padding: 6px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .summary-card { display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: var(--ms-radius-md); min-width: 0; }
    .summary-card--attention { background: var(--ms-warning-soft); }
    .summary-icon { width: 32px; height: 32px; flex: none; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .summary-icon--info { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .summary-icon--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .summary-icon--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .summary-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .summary-card > div { display: flex; flex-direction: column; gap: 0; min-width: 0; }
    .summary-card strong { font-family: var(--ms-font-display); font-size: 1.2rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .summary-card span:last-of-type { color: var(--ms-text-muted); font-size: 0.66rem; font-weight: 600; line-height: 1.25; }
    .summary-card small { display: none; }

    .search-card { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .search-field { width: 100%; }
    .search-note { display: inline-flex; align-items: center; gap: 4px; margin: 0 2px; color: var(--ms-text-muted); font-size: 0.74rem; }
    .search-note mat-icon { font-size: 15px; width: 15px; height: 15px; }

    .stage-rail { display: flex; gap: 6px; margin: 0 -2px; padding: 2px 2px 6px; overflow-x: auto; scroll-snap-type: x proximity; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
    .stage-rail::-webkit-scrollbar { display: none; }
    .stage-tab { flex: none; display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px; border: 1px solid var(--ms-line); border-radius: 999px; background: var(--ms-surface); color: var(--ms-text-muted); font: inherit; font-size: 0.8rem; font-weight: 650; cursor: pointer; scroll-snap-align: start; transition: background 140ms ease, color 140ms ease, border-color 140ms ease, box-shadow 140ms ease; }
    .stage-tab.is-active { background: var(--ms-primary); border-color: var(--ms-primary); color: var(--ms-ink); box-shadow: 0 6px 16px color-mix(in srgb, var(--ms-primary) 24%, transparent); }
    .stage-tab:focus-visible { outline: 2px solid var(--ms-primary); outline-offset: 2px; }
    .stage-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; background: var(--ms-text-muted); }
    .stage-dot--new { background: var(--ms-info); }
    .stage-dot--contacted { background: #3b82f6; }
    .stage-dot--interested { background: var(--ms-warning); }
    .stage-dot--negotiation { background: #8b5cf6; }
    .stage-dot--converted { background: var(--ms-success); }
    .stage-dot--closed { background: var(--ms-error); }
    .stage-tab.is-active .stage-dot { box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.36); }
    .stage-count { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; display: inline-grid; place-items: center; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.7rem; font-weight: 800; font-variant-numeric: tabular-nums; }
    .stage-tab.is-active .stage-count { background: color-mix(in srgb, var(--ms-surface) 78%, transparent); color: var(--ms-text); }

    .focus-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .focus-copy { min-width: 0; }
    .focus-copy h2 { display: flex; align-items: center; gap: 8px; margin: 2px 0 4px; font-size: 1.5rem; letter-spacing: -0.02em; }
    .focus-count { min-width: 26px; height: 26px; padding: 0 8px; border-radius: 999px; display: inline-grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; font-variant-numeric: tabular-nums; }
    .focus-hint { margin: 0; color: var(--ms-text-muted); font-size: 0.8rem; line-height: 1.5; }
    .focus-add { flex: none; min-height: 44px; margin-top: 4px; }

    .stage-meter { display: flex; gap: 4px; margin-top: -4px; }
    .meter-seg { flex: 1; height: 5px; border-radius: 999px; background: var(--ms-line); transition: background 160ms ease, box-shadow 160ms ease; }
    .meter-seg.is-on { background: var(--ms-primary); }
    .meter-seg.is-current { background: var(--ms-primary-strong); box-shadow: 0 0 0 2px var(--ms-primary-soft); }

    .lead-cards { display: flex; flex-direction: column; gap: 10px; }
    .lead-card { display: flex; flex-direction: column; gap: 10px; padding: 13px; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); box-shadow: 0 5px 16px rgba(20, 18, 43, 0.05); }
    .lead-card.is-converted { border-color: color-mix(in srgb, var(--ms-success) 35%, var(--ms-line)); }
    .card-head { display: flex; align-items: flex-start; gap: 10px; }
    .avatar { width: 40px; height: 40px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.78rem; font-weight: 800; }
    .card-id { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .card-name { color: var(--ms-text); text-decoration: none; font-size: 0.92rem; font-weight: 700; text-transform: capitalize; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .card-name:hover { color: var(--ms-primary-strong); }
    .card-contact { color: var(--ms-text-muted); font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .card-email { font-size: 0.71rem; }
    .card-badges { display: flex; gap: 5px; flex-wrap: wrap; }
    .stuck-badge, .joined-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 999px; font-size: 0.68rem; font-weight: 700; }
    .stuck-badge { background: var(--ms-error-soft); color: var(--ms-error); }
    .joined-badge { background: var(--ms-success-soft); color: var(--ms-success); }
    .joined-badge--pending { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .stuck-badge mat-icon, .joined-badge mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .advance-btn { width: 100%; min-height: 46px; font-weight: 650; }
    .advance-btn mat-icon { margin-right: 4px; }
    .card-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .card-actions a, .card-actions button { min-height: 44px; min-width: 0; }
    .card-actions mat-icon { margin-right: 4px; }
    .moving-note { display: inline-flex; align-items: center; gap: 5px; color: var(--ms-primary-strong); font-size: 0.76rem; font-weight: 600; }
    .moving-note mat-icon { font-size: 16px; width: 16px; height: 16px; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .empty-stage { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 28px 18px; text-align: center; border: 1px dashed var(--ms-line-strong); border-radius: 16px; background: var(--ms-surface); }
    .empty-icon { width: 52px; height: 52px; display: grid; place-items: center; border-radius: 50%; background: var(--ms-canvas); color: var(--ms-text-muted); }
    .empty-icon mat-icon { font-size: 26px; width: 26px; height: 26px; }
    .empty-stage h3 { margin: 0; font-size: 1.02rem; }
    .empty-stage p { margin: 0; max-width: 30em; color: var(--ms-text-muted); font-size: 0.82rem; line-height: 1.5; }
    .empty-stage a, .empty-stage button { min-height: 44px; margin-top: 4px; }

    .alert { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: var(--ms-radius-lg); background: var(--ms-error-soft); color: var(--ms-error); flex-wrap: wrap; }
    .alert p { flex: 1; min-width: 180px; margin: 0; font-size: 0.84rem; }
    .alert button { min-height: 40px; }

    .sheet-backdrop { position: fixed; inset: 0; z-index: 1090; background: rgba(11, 10, 30, 0.55); backdrop-filter: blur(2px); animation: fade-in 160ms ease; }
    .move-sheet { position: fixed; right: 0; bottom: 0; left: 0; z-index: 1100; display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 560px; max-height: 88vh; margin: 0 auto; padding: 8px 16px calc(18px + var(--ms-safe-bottom)); overflow-y: auto; overscroll-behavior: contain; border-radius: 22px 22px 0 0; background: var(--ms-surface); color: var(--ms-text); box-shadow: 0 -18px 50px rgba(0, 0, 0, 0.25); animation: sheet-up 200ms ease; }
    .sheet-handle { width: 42px; height: 4px; flex: none; margin: 0 auto 2px; border-radius: 999px; background: var(--ms-line-strong); }
    .sheet-head { display: flex; align-items: center; gap: 10px; }
    .sheet-id { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .sheet-id strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sheet-id span { color: var(--ms-text-muted); font-size: 0.76rem; }
    .sheet-stages { display: flex; flex-direction: column; gap: 5px; }
    .sheet-stage { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 54px; padding: 8px 11px; border: 1px solid var(--ms-line); border-radius: 12px; background: var(--ms-surface-2); color: var(--ms-text); font: inherit; text-align: left; cursor: pointer; }
    .sheet-stage.is-current { background: var(--ms-primary-soft); border-color: color-mix(in srgb, var(--ms-primary) 40%, var(--ms-line)); }
    .sheet-stage.is-danger:not(.is-current) { color: var(--ms-error); }
    .sheet-stage:disabled { opacity: 0.7; cursor: default; }
    .sheet-stage-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .sheet-stage-copy strong { font-size: 0.88rem; }
    .sheet-stage-copy small { color: var(--ms-text-muted); font-size: 0.72rem; line-height: 1.35; }
    .sheet-stage.is-danger:not(.is-current) .sheet-stage-copy small { color: color-mix(in srgb, var(--ms-error) 70%, var(--ms-text-muted)); }
    .sheet-stage > mat-icon { color: var(--ms-text-muted); }
    .current-chip { flex: none; border-radius: 999px; padding: 2px 8px; background: var(--ms-surface); color: var(--ms-primary-strong); font-size: 0.64rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
    .sheet-note { display: flex; align-items: flex-start; gap: 5px; margin: 0; color: var(--ms-text-muted); font-size: 0.73rem; line-height: 1.45; }
    .sheet-note mat-icon { flex: none; margin-top: 1px; font-size: 16px; width: 16px; height: 16px; }
    .confirm-sheet { align-items: center; text-align: center; }
    .confirm-sheet .sheet-handle { align-self: center; }
    .confirm-icon { width: 54px; height: 54px; display: grid; place-items: center; border-radius: 50%; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .confirm-icon mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .confirm-sheet h2 { margin: 0; font-size: 1.2rem; letter-spacing: -0.02em; }
    .confirm-sheet p { margin: 0; max-width: 34em; color: var(--ms-text-muted); font-size: 0.85rem; line-height: 1.55; }
    .confirm-actions { display: flex; flex-direction: column; gap: 6px; width: 100%; margin-top: 4px; }
    .confirm-actions button { width: 100%; min-height: 48px; }
    @keyframes sheet-up { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

    @media (min-width: 560px) {
      .summary-strip { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .summary-card small { display: block; color: var(--ms-text-muted); font-size: 0.64rem; }
    }
    @media (prefers-reduced-motion: reduce) {
      .move-sheet, .sheet-backdrop { animation: none; }
      .moving-note mat-icon { animation: none; }
    }
  `],
})
export class PipelineBoardMobileComponent implements OnInit {
  private readonly facade = inject(PipelineBoardFacade);

  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly rows = this.facade.rows;
  protected readonly search = this.facade.search;
  protected readonly actingId = this.facade.actingId;
  protected readonly pendingConvert = this.facade.pendingConvert;
  protected readonly convertedNotice = this.facade.convertedNotice;
  protected readonly boardStages = this.facade.boardStages;
  protected readonly columns = this.facade.columns;
  protected readonly totalCards = this.facade.totalCards;
  protected readonly activeCount = this.facade.activeCount;
  protected readonly convertedCount = this.facade.convertedCount;
  protected readonly stuckCount = this.facade.stuckCount;
  protected readonly stuckDuration = this.facade.stuckDuration;

  protected readonly stageSteps = [1, 2, 3, 4, 5];
  protected readonly activeStage = signal<ProspectStage>('New');
  protected readonly movingLead = signal<ProspectLead | null>(null);

  protected readonly searchActive = computed(() => this.search().trim().length > 0);
  protected readonly focusedCards = computed(
    () => this.columns().find((col) => col.stage === this.activeStage())?.cards ?? [],
  );
  protected readonly matchCount = computed(
    () => this.columns().reduce((sum, col) => sum + col.cards.length, 0),
  );
  protected readonly matchingStageCount = computed(
    () => this.columns().filter((col) => col.cards.length > 0).length,
  );
  protected readonly otherMatchStage = computed<ProspectStage | null>(
    () => this.columns().find((col) => col.stage !== this.activeStage() && col.cards.length > 0)?.stage ?? null,
  );
  protected readonly activeStep = computed(() => this.stageStep(this.activeStage()));
  protected readonly activeLabel = computed(() => this.stageLabel(this.activeStage()));
  protected readonly activeStepLabel = computed(() => {
    const step = this.activeStep();
    return step > 0 ? `Stage ${step} of ${STAGE_ORDER.length}` : 'Closed deals';
  });
  protected readonly stageHint = computed(() => this.hintFor(this.activeStage()));

  private initialStagePicked = false;
  private readonly pickInitialStage = effect(() => {
    if (this.initialStagePicked || this.loading()) return;
    this.initialStagePicked = true;
    const columns = this.columns();
    if ((columns.find((col) => col.stage === this.activeStage())?.cards.length ?? 0) > 0) return;
    const first = columns.find((col) => col.cards.length > 0);
    if (first) this.activeStage.set(first.stage);
  });

  ngOnInit(): void { this.facade.ensureLoaded(); }

  protected reload(): void { this.facade.reload(); }
  protected names(lead: ProspectLead): string { return this.facade.names(lead); }
  protected initials(lead: ProspectLead): string { return this.facade.initials(lead); }
  protected stageTone(stage: ProspectStage): string { return this.facade.stageTone(stage); }
  protected stuckOf(lead: ProspectLead) { return this.facade.stuckOf(lead); }
  protected isConverted(lead: ProspectLead): boolean { return this.facade.isConverted(lead); }
  protected copyConversionLink(leadId: string): void { this.facade.copyConversionLink(leadId); }
  protected confirmConvert(): void { this.facade.confirmConvert(); }
  protected conversionLink(leadId: string): string | null { return this.facade.conversionLink(leadId); }

  protected currentStage(lead: ProspectLead): ProspectStage {
    return lead.status?.stage ?? 'New';
  }

  protected nextStageOf(lead: ProspectLead): ProspectStage | null {
    return nextStage(lead.status?.stage);
  }

  protected stageLabel(stage: ProspectStage): string {
    return STAGE_META[stage].label;
  }

  protected stageStep(stage: ProspectStage): number {
    const index = STAGE_ORDER.indexOf(stage);
    return index < 0 ? 0 : index + 1;
  }

  protected selectStage(stage: ProspectStage): void {
    this.activeStage.set(stage);
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    if (!value.trim()) return;
    const columns = this.columns();
    if ((columns.find((col) => col.stage === this.activeStage())?.cards.length ?? 0) > 0) return;
    const first = columns.find((col) => col.cards.length > 0);
    if (first) this.activeStage.set(first.stage);
  }

  protected clearSearch(): void {
    this.search.set('');
  }

  protected openMoveSheet(lead: ProspectLead): void {
    this.movingLead.set(lead);
  }

  protected closeMoveSheet(): void {
    this.movingLead.set(null);
  }

  protected moveTo(lead: ProspectLead, stage: ProspectStage): void {
    this.movingLead.set(null);
    if (stage === this.currentStage(lead)) return;
    if (stage === 'Converted') {
      this.pendingConvert.set(lead);
      return;
    }
    this.facade.advance(lead, stage);
  }

  protected stageDetail(stage: ProspectStage): string {
    switch (stage) {
      case 'New': return 'Fresh contact, not spoken to yet';
      case 'Contacted': return 'You have reached out';
      case 'Interested': return 'Warm and wants more detail';
      case 'In Negotiation': return 'Discussing the offer';
      case 'Converted': return 'Enrolls them and creates a signup link';
      case 'Closed': return 'Marked as lost — you can reopen any time';
      default: return 'Move this deal to another stage';
    }
  }

  private hintFor(stage: ProspectStage): string {
    if (this.searchActive()) {
      return 'Showing search matches in this stage. Tap another stage above to check it.';
    }
    switch (stage) {
      case 'New': return 'Fresh contacts that have not been spoken to yet. Move one forward when you reach out.';
      case 'Contacted': return 'You have made contact. Keep the conversation moving to Interested.';
      case 'Interested': return 'Warm deals that want more detail. Confirm the offer and move them forward.';
      case 'In Negotiation': return 'Close to a decision. Agree the next step, then convert them.';
      case 'Converted': return 'Enrollment issued. Share their signup link if they have not joined yet.';
      case 'Closed': return 'Deals marked lost. Reopen any that come back to life.';
      default: return 'Keep this deal moving through the funnel.';
    }
  }
}
