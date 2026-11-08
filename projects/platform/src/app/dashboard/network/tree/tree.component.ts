import { ChangeDetectionStrategy, Component, afterNextRender, computed, DestroyRef, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { AuthService } from '../../../core/auth/auth.service';
import { CompensationService } from '../../../core/compensation/compensation.service';
import { CommissionRank, CompensationPlan } from '../../../core/compensation/compensation.models';
import { ThemeTogglerService } from '../../../_common/services/theme-toggler.service';
import { ApiError } from '../../../core/http/api-error';
import { PresenceService, PresenceStatus } from '../../../core/presence/presence.service';
import { API_BASE_URL } from '../../../core/config/api-tokens';
import { NetworkService } from './network.service';
import { AvatarComponent } from '../../../_common/avatar.component';
import {
  NetworkChain, NetworkNode, NetworkRoot, NetworkTreeMeta, PositionedNode, TreeEdge,
} from './network.models';

const NODE_W = 168;
const NODE_H = 74;
const X_GAP = 196;
const Y_GAP = 128;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.25;

/** Node fills per theme — keyed by commission rank, not account role. */
const RANK_FILL: Record<string, Record<string, string>> = {
  light: { Partner: '#e8eaf6', Builder: '#bbdefb', Leader: '#c8e6c9', Ambassador: '#ffe0b2' },
  dark: { Partner: '#2c3140', Builder: '#274b6b', Leader: '#1f4a2a', Ambassador: '#5d4222' },
};

/** Extra left space for the commission-level band labels. */
const LABEL_GUTTER = 184;

const FALLBACK_PLAN: CompensationPlan = {
  rates: [
    { level: 1, rate: 0.09, percent: 9 },
    { level: 2, rate: 0.045, percent: 4.5 },
    { level: 3, rate: 0.025, percent: 2.5 },
    { level: 4, rate: 0.015, percent: 1.5 },
    { level: 5, rate: 0.01, percent: 1 },
  ],
  ranks: [
    { rank: 'Partner', depth: 1 },
    { rank: 'Builder', depth: 2 },
    { rank: 'Leader', depth: 3 },
    { rank: 'Ambassador', depth: 5 },
  ],
  mentorBonus: { amount: 1000, daysAfterActivation: 7 },
};

/**
 * @title Network tree — downline visualization.
 *
 * Dependency-free SVG tidy-tree (no D3): post-order x-assignment, parents
 * centered over children. Click toggles collapse, details panel focuses a
 * subtree, breadcrumb walks the upline chain. OnPush + signals throughout.
 */
@Component({
  selector: 'async-network-tree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent, MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressBarModule, MatSelectModule, PageSkeletonComponent, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Network</a> &gt;
        <span>Network Tree</span>
      </div>
    </section>

    <section class="tree-page">
      <div class="page-head">
        <div>
          <h2>Network Tree</h2>
          <p class="subtitle">{{ chainSubtitle() }}</p>
        </div>
        <mat-button-toggle-group>
          <mat-button-toggle routerLink="../org" title="Organization chart">
            <mat-icon>account_tree</mat-icon> Org Chart
          </mat-button-toggle>
          <mat-button-toggle routerLink="/dashboard/mentorship/partners/my-partners" title="Manage partners">
            <mat-icon>groups</mat-icon> Partners
          </mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      @if (systemRoot(); as root) {
        <div class="system-root-banner" role="note">
          <span class="root-mark" aria-hidden="true">{{ root.name.slice(0, 1) }}</span>
          <div class="root-copy">
            <strong>{{ root.name }} root</strong>
            <span>Structural root · non-earning · every partner and team connects here.</span>
          </div>
          <span class="root-pill">System</span>
        </div>
      }

      <div class="plan-summary">
        <div class="plan-you">
          <span class="eyebrow">{{ isSelf() ? 'Your commission position' : 'Viewing member position' }}</span>
          <strong>{{ rootRank() }} · earns {{ depthLabel(rootDepth()) }}</strong>
          <span class="muted">{{ isSelf() ? chainHint() : rootName() + ' · ' + chainHint() }}</span>
        </div>
        <div class="plan-next">
          @if (nextRank(); as next) {
            <span class="eyebrow">Next rank</span>
            <strong>{{ next.rank }}</strong>
            <span class="muted">Unlocks {{ levelRange(rootDepth() + 1, next.depth) }}</span>
          } @else {
            <span class="eyebrow">Top rank</span>
            <strong>Ambassador</strong>
            <span class="muted">All 5 levels active</span>
          }
        </div>
      </div>

      @if (upline().length > 0) {
        <nav class="upline" aria-label="Upline">
          <span class="upline-label">Upline</span>
          <mat-icon>arrow_upward</mat-icon>
          @for (ancestor of upline(); track ancestor.id; let last = $last) {
            <button mat-button (click)="focus(ancestor.id)">{{ names(ancestor) }}</button>
            @if (!last) {
              <span class="sep">›</span>
            }
          }
          <span class="sep">›</span>
          <strong>{{ names(rootLabel()) }}</strong>
        </nav>
      }

      <div class="toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Search network</mat-label>
          <input matInput type="search" placeholder="Username or name" (input)="onSearch($any($event.target).value)" />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
        @if (searching()) {
          <div class="match-nav" role="group" aria-label="Search results">
            <span class="muted">{{ matches().length }} found</span>
            <button mat-icon-button (click)="stepMatch(-1)" [disabled]="matches().length === 0" title="Previous match" aria-label="Previous match">
              <mat-icon>chevron_left</mat-icon>
            </button>
            <button mat-icon-button (click)="stepMatch(1)" [disabled]="matches().length === 0" title="Next match" aria-label="Next match">
              <mat-icon>chevron_right</mat-icon>
            </button>
          </div>
        }
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="depth-field">
          <mat-label>Generations to show</mat-label>
          <mat-select [value]="depth()" (selectionChange)="depth.set($event.value); reload()">
            @for (d of depthOptions; track d) {
              <mat-option [value]="d">{{ d }} generations</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <div class="zoom-group" role="group" aria-label="Zoom and layout">
          <button mat-icon-button (click)="zoomOut()" [disabled]="zoom() <= ZOOM_MIN" title="Zoom out" aria-label="Zoom out">
            <mat-icon>zoom_out</mat-icon>
          </button>
          <span class="muted zoom-label">{{ zoomLabel() }}</span>
          <button mat-icon-button (click)="zoomIn()" [disabled]="zoom() >= ZOOM_MAX" title="Zoom in" aria-label="Zoom in">
            <mat-icon>zoom_in</mat-icon>
          </button>
          <button mat-icon-button (click)="fit()" title="Fit to width" aria-label="Fit to width">
            <mat-icon>fit_screen</mat-icon>
          </button>
          <button mat-icon-button (click)="resetView()" title="Reset view" aria-label="Reset view">
            <mat-icon>restart_alt</mat-icon>
          </button>
          <button mat-icon-button (click)="expandAll()" title="Expand all" aria-label="Expand all">
            <mat-icon>unfold_more</mat-icon>
          </button>
          <button mat-icon-button (click)="collapseAll()" title="Collapse all" aria-label="Collapse all">
            <mat-icon>unfold_less</mat-icon>
          </button>
        </div>
        @if (loading()) {
          <async-page-skeleton layout="network" [rows]="5" label="network tree" [showHeader]="false" />
        }
      </div>

      <p class="depth-hint">{{ depthHint() }}</p>

      @if (meta(); as m) {
        <div class="stats">
          <span><strong>{{ m.total }}</strong> partners</span>
          <span><strong>{{ m.perLevel.length - 1 }}</strong> generations shown</span>
          <span class="ok"><strong>{{ summary().earning }}</strong> earning in view</span>
          <span class="muted"><strong>{{ summary().locked }}</strong> locked within L1–5</span>
          <span class="muted"><strong>{{ summary().viewOnly }}</strong> view-only beyond L5</span>
          @if (m.truncated) {
            <span class="warn">Showing partial tree — raise depth or focus a subtree.</span>
          }
        </div>
      }

      <div class="legend-row">
        <div class="rank-legend" aria-label="Commission rank legend">
          @for (r of rankLegend; track r.rank) {
            <span class="legend-item">
              <i [style.background]="rankColor(r.rank)"></i>
              {{ r.rank }} <small>earns {{ depthLabel(r.depth) }}</small>
            </span>
          }
        </div>
        <div class="edge-legend" aria-label="Edge legend">
          <span><i class="edge-swatch referral"></i> Referral</span>
          <span><i class="edge-swatch placement"></i> Campaign placement</span>
        </div>
      </div>

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (layout(); as layout) {
        <div class="canvas-wrap" #canvasWrap tabindex="0" (keydown)="onCanvasKey($event)" aria-label="Tree canvas. Plus and minus zoom, zero resets.">
          <svg
            [attr.viewBox]="'0 0 ' + layout.width + ' ' + layout.height"
            [attr.width]="layout.width * zoom()"
            [attr.height]="layout.height * zoom()"
            role="img"
            aria-label="Downline network tree"
          >
            <defs>
              <clipPath id="tree-avatar-clip">
                <circle cx="0" cy="0" r="16" />
              </clipPath>
            </defs>
            <g [attr.transform]="'translate(' + panX() + ' ' + panY() + ') scale(' + zoom() + ')'">
            <g class="bands" aria-hidden="true">
              @for (band of bands(); track band.level) {
                <rect
                  [attr.x]="0"
                  [attr.y]="band.y"
                  [attr.width]="layout.width"
                  [attr.height]="band.height"
                  [class.band-alt]="band.level % 2 === 0"
                  [class.band-root]="band.level === 0"
                  [class.band-locked]="band.state === 'locked'"
                />
                <text
                  class="band-title"
                  [class.band-title-locked]="band.state === 'locked'"
                  [attr.x]="12"
                  [attr.y]="band.labelY"
                >{{ band.title }}</text>
                @if (band.subtitle) {
                  <text class="band-sub" [attr.x]="12" [attr.y]="band.labelY + 16">{{ band.subtitle }}</text>
                }
                <line
                  class="band-rule"
                  [attr.x1]="LABEL_GUTTER - 16"
                  [attr.x2]="LABEL_GUTTER - 16"
                  [attr.y1]="band.y"
                  [attr.y2]="band.y + band.height"
                />
              }
              @if (viewOnlyBand(); as vb) {
                <rect [attr.x]="0" [attr.y]="vb.y" [attr.width]="layout.width" [attr.height]="vb.height" class="band-view" />
                <text class="band-title band-title-view" [attr.x]="12" [attr.y]="vb.labelY">Generations 6–{{ depth() }}</text>
                <text class="band-sub" [attr.x]="12" [attr.y]="vb.labelY + 16">View only — no commission</text>
                <line
                  class="band-rule"
                  [attr.x1]="LABEL_GUTTER - 16"
                  [attr.x2]="LABEL_GUTTER - 16"
                  [attr.y1]="vb.y"
                  [attr.y2]="vb.y + vb.height"
                />
              }
            </g>
            @for (edge of layout.edges; track $index) {
              <path
                [attr.d]="edge.d"
                class="edge"
                [class.edge-placement]="edge.relationType === 'placement'"
                [class.edge-referral]="edge.relationType === 'referral'"
              />
            }
            @for (node of layout.nodes; track node.id) {
              <g
                class="node"
                [class.selected]="selectedId() === node.id"
                [class.match]="isMatch(node)"
                (click)="toggle(node)"
                (keydown.enter)="toggle(node)"
                (keydown.space)="toggle(node); $event.preventDefault()"
                tabindex="0"
                role="button"
                [attr.aria-label]="nodeLabel(node)"
              >
                <rect
                  [attr.x]="node.x"
                  [attr.y]="node.y"
                  [attr.width]="nodeWidth"
                  [attr.height]="nodeHeight"
                  rx="10"
                  [attr.fill]="fill(node)"
                />
                <g [attr.transform]="'translate(' + (node.x + 26) + ' ' + (node.y + 31) + ')'">
                  @if (avatarUrl(node.profileImage); as photo) {
                    <image
                      x="-16"
                      y="-16"
                      width="32"
                      height="32"
                      preserveAspectRatio="xMidYMid slice"
                      clip-path="url(#tree-avatar-clip)"
                      [attr.href]="photo"
                    />
                  } @else {
                    <circle r="16" class="avatar-fallback" />
                    <text text-anchor="middle" dominant-baseline="central" class="avatar-initial">{{ avatarInitial(node) }}</text>
                  }
                  @if (presenceOf(node.id); as presence) {
                    <circle cx="11" cy="11" r="5.5" class="presence-dot" [attr.fill]="presenceFill(presence)" />
                  }
                </g>
                <text [attr.x]="node.x + 50" [attr.y]="node.y + 27" text-anchor="start" class="t-name">
                  {{ shortName(node) }}
                </text>
                <text [attr.x]="node.x + 50" [attr.y]="node.y + 43" text-anchor="start" class="t-sub">
                  {{ shortSub(node) }}
                </text>
                <text [attr.x]="node.x + 50" [attr.y]="node.y + 59" text-anchor="start" class="t-rank">
                  {{ node.commissionRank }} · L1–{{ node.commissionDepth }}
                </text>
                @if (node.children.length > 0) {
                  <circle
                    [attr.cx]="node.x + nodeWidth / 2"
                    [attr.cy]="node.y + nodeHeight"
                    r="10"
                    class="toggle"
                  />
                  <text
                    [attr.x]="node.x + nodeWidth / 2"
                    [attr.y]="node.y + nodeHeight + 4"
                    text-anchor="middle"
                    class="t-toggle"
                  >{{ isCollapsed(node.id) ? '+' : '−' }}</text>
                }
              </g>
            }
            </g>
          </svg>
        </div>

        @if (selected(); as detail) {
          <div class="details" role="status">
            <async-avatar [photo]="detail.profileImage" [name]="names(detail)" size="sm" [presence]="presenceOf(detail.id)" />
            <div class="details-main">
              <div class="detail-line">
                <strong>{{ names(detail) }}</strong>
                <span class="muted">@{{ detail.username }} · {{ detail.childCount }} direct downlines</span>
              </div>
              <div class="detail-chips">
                <span class="rank-pill">{{ detail.commissionRank }} · earns L1–{{ detail.commissionDepth }}</span>
                <span class="relation-pill" [class.placement]="detail.relationType === 'placement'">{{ relationLabel(detail) }}</span>
              </div>
              <p class="earning-note" [class.locked]="isNodeLocked(detail)">
                {{ earningNote(detail) }}
              </p>
            </div>
            <span class="spacer"></span>
            <a mat-button [routerLink]="['/dashboard/messages']" [queryParams]="{ chat: detail.id, chatName: names(detail) }">Chat</a>
            <button mat-flat-button color="primary" (click)="focus(detail.id)">Focus subtree</button>
          </div>
        }
      } @else if (!loading() && !error()) {
        <p class="empty">{{ emptyLabel() }}</p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .tree-page { display: flex; flex-direction: column; gap: 1.25em; min-width: 0; overflow-x: clip; }
    .tree-page > * { min-width: 0; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); }
    .plan-summary { display: flex; justify-content: space-between; align-items: center; gap: 1.25em; flex-wrap: wrap; padding: 1em 1.1em; border: 1px solid var(--ms-line); border-radius: 12px; background: linear-gradient(120deg, var(--ms-primary-soft), var(--ms-surface)); }
    .plan-you, .plan-next { display: flex; flex-direction: column; gap: 0.12em; }
    .plan-next { text-align: right; }
    .plan-summary strong { font-size: 1.05em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.7rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
    .upline { display: flex; align-items: center; gap: 0.25em; flex-wrap: wrap; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 8px; padding: 0.4em 0.8em; }
    .system-root-banner {
      display: flex;
      align-items: center;
      gap: 0.7em;
      padding: 0.7em 0.9em;
      border: 1px solid color-mix(in srgb, var(--ms-primary) 28%, var(--ms-line));
      border-radius: 12px;
      background: linear-gradient(120deg, color-mix(in srgb, var(--ms-primary-soft) 78%, var(--ms-surface)), var(--ms-surface));
    }
    .root-mark {
      flex: none;
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: var(--ms-primary);
      color: #fff;
      font-weight: 800;
    }
    .root-copy { display: flex; flex-direction: column; gap: 0.05em; min-width: 0; flex: 1; }
    .root-copy strong { font-size: 0.9em; }
    .root-copy span { color: var(--ms-text-muted); font-size: 0.78em; line-height: 1.35; }
    .root-pill {
      flex: none;
      padding: 2px 9px;
      border-radius: 999px;
      background: var(--ms-surface);
      border: 1px solid var(--ms-line);
      color: var(--ms-text-muted);
      font-size: 0.7em;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .upline .sep { color: var(--ms-text-muted); }
    .upline-label { color: var(--ms-text-muted); font-size: 0.78em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-right: 0.25em; }
    .toolbar { display: flex; align-items: center; gap: 1em; flex-wrap: wrap; }
    .toolbar mat-form-field { flex: 1; min-width: 200px; }
    .depth-field { max-width: 150px; }
    .loader { flex: 2; min-width: 120px; }
    .match-nav { display: flex; align-items: center; gap: 0.1em; }
    .zoom-group { display: flex; align-items: center; gap: 0.1em; }
    .zoom-label { min-width: 3.2em; text-align: center; }
    .depth-hint { margin: 0; color: var(--ms-text-muted); font-size: 0.85em; line-height: 1.45; }
    .stats { display: flex; gap: 1.5em; align-items: center; flex-wrap: wrap; }
    .ok { color: var(--ms-success); }
    .warn { color: var(--ms-warning); }
    .canvas-wrap { overflow: auto; border: 1px solid var(--ms-line); border-radius: 10px; background: var(--ms-canvas); max-height: 70vh; }
    .canvas-wrap:focus-visible { outline: 2px solid var(--ms-primary); outline-offset: -2px; }
    svg { display: block; }
    .edge { fill: none; stroke: var(--ms-text-muted); stroke-width: 2; opacity: 0.6; }
    .edge-referral { stroke-dasharray: none; }
    .edge-placement { stroke-dasharray: 6 4; }
    .bands rect { fill: transparent; }
    .bands .band-alt { fill: var(--ms-canvas); opacity: 0.35; }
    .bands .band-root { fill: var(--ms-primary-soft); opacity: 0.4; }
    .bands .band-locked { fill: var(--ms-warning-soft); opacity: 0.35; }
    .bands .band-view { fill: var(--ms-text-muted); opacity: 0.06; }
    .band-title { font-size: 12px; font-weight: 800; fill: var(--ms-text); }
    .band-title-locked { fill: var(--ms-warning); }
    .band-title-view { fill: var(--ms-text-muted); }
    .band-sub { font-size: 11px; fill: var(--ms-text-muted); }
    .band-rule { stroke: var(--ms-line); stroke-width: 1; }
    .node { cursor: pointer; }
    .node rect { stroke: var(--ms-text-muted); stroke-width: 1.5; }
    .node.selected rect { stroke: var(--ms-primary); stroke-width: 3; }
    .node.match rect { stroke: var(--ms-success); stroke-width: 3; stroke-dasharray: 5 3; }
    .t-name { font-size: 13px; font-weight: 600; fill: var(--ms-text); }
    .t-sub { font-size: 12px; fill: var(--ms-text-muted); }
    .t-rank { font-size: 11px; font-weight: 700; fill: var(--ms-primary-strong); }
    .legend-row { display: flex; justify-content: space-between; align-items: center; gap: 1em; flex-wrap: wrap; }
    .rank-legend { display: flex; gap: 1em; flex-wrap: wrap; align-items: center; font-size: 0.82em; color: var(--ms-text-muted); }
    .legend-item { display: inline-flex; align-items: center; gap: 0.35em; }
    .legend-item i { width: 12px; height: 12px; border-radius: 3px; border: 1px solid var(--ms-line); display: inline-block; }
    .legend-item small { font-size: 0.9em; }
    .edge-legend { display: flex; gap: 1em; align-items: center; font-size: 0.82em; color: var(--ms-text-muted); }
    .edge-swatch { width: 24px; height: 0; border-top: 2px solid var(--ms-text-muted); display: inline-block; }
    .edge-swatch.placement { border-top-style: dashed; }
    .avatar-fallback { fill: var(--ms-ink); stroke: rgba(245,243,255,0.32); stroke-width: 1.5; }
    .avatar-initial { font-size: 13px; font-weight: 800; fill: var(--ms-ink-text); pointer-events: none; }
    .presence-dot { stroke: var(--ms-surface, #fff); stroke-width: 2; }
    .toggle { fill: var(--ms-surface); stroke: var(--ms-text-muted); stroke-width: 2; }
    .t-toggle { font-size: 13px; font-weight: 700; fill: var(--ms-text); pointer-events: none; }
    .details { display: flex; align-items: flex-start; gap: 1em; background: var(--ms-info-soft); border: 1px solid var(--ms-line); border-radius: 8px; padding: 0.85em 1em; flex-wrap: wrap; }
    .details .spacer { flex: 1; }
    .details-main { display: flex; flex-direction: column; gap: 0.3em; min-width: min(100%, 320px); flex: 1; }
    .detail-line { display: flex; align-items: baseline; gap: 0.5em; flex-wrap: wrap; }
    .detail-chips { display: flex; align-items: center; gap: 0.4em; flex-wrap: wrap; }
    .rank-pill { background: var(--ms-primary-soft); color: var(--ms-primary-strong); border-radius: 999px; padding: 4px 10px; font-size: 0.78em; font-weight: 700; white-space: nowrap; }
    .relation-pill { background: var(--ms-canvas); color: var(--ms-text-muted); border: 1px solid var(--ms-line); border-radius: 999px; padding: 3px 9px; font-size: 0.75em; font-weight: 700; white-space: nowrap; }
    .relation-pill.placement { background: var(--ms-info-soft); color: var(--ms-info); border-color: transparent; }
    .earning-note { margin: 0.15em 0 0; font-size: 0.84em; line-height: 1.45; }
    .earning-note.locked { color: var(--ms-warning); font-weight: 600; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .empty { color: var(--ms-text-muted); }
  `],
})
export class NetworkTreeComponent implements OnInit {
  private readonly network = inject(NetworkService);
  private readonly auth = inject(AuthService);
  private readonly compensation = inject(CompensationService);
  private readonly themes = inject(ThemeTogglerService);
  private readonly presence = inject(PresenceService);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvasWrap = viewChild<ElementRef<HTMLDivElement>>('canvasWrap');

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly tree = signal<NetworkNode | null>(null);
  protected readonly meta = signal<NetworkTreeMeta | null>(null);
  protected readonly upline = signal<NetworkNode[]>([]);
  protected readonly systemRoot = signal<NetworkRoot | null>(null);
  protected readonly rootId = signal<string | null>(null);
  protected readonly depth = signal(5);
  protected readonly chain = signal<NetworkChain>('all');
  protected readonly plan = signal<CompensationPlan | null>(null);
  protected readonly search = signal('');
  protected readonly collapsed = signal<ReadonlySet<string>>(new Set());
  protected readonly selectedId = signal<string | null>(null);
  /** memberId → lastSeenAt (null = offline/stranger); drives avatar dots. */
  protected readonly presenceMap = signal<Record<string, string | null>>({});
  protected readonly zoom = signal(1);
  protected readonly panX = signal(0);
  protected readonly panY = signal(0);
  protected readonly matchIdx = signal(0);

  protected readonly ZOOM_MIN = ZOOM_MIN;
  protected readonly ZOOM_MAX = ZOOM_MAX;
  protected readonly LABEL_GUTTER = LABEL_GUTTER;

  protected readonly depthOptions = [2, 3, 4, 5, 6, 8, 10];
  protected readonly nodeWidth = NODE_W;
  protected readonly nodeHeight = NODE_H;
  protected readonly rankLegend = [
    { rank: 'Partner', depth: 1 },
    { rank: 'Builder', depth: 2 },
    { rank: 'Leader', depth: 3 },
    { rank: 'Ambassador', depth: 5 },
  ] as const;

  protected readonly searching = computed(() => this.search().trim().length > 0);
  protected readonly ranks = computed(() => this.plan()?.ranks ?? FALLBACK_PLAN.ranks);
  protected readonly viewerRank = computed<CommissionRank>(() =>
    (this.auth.currentUser()?.commissionRank as CommissionRank | undefined) ?? 'Partner',
  );
  protected readonly viewerDepth = computed(() =>
    this.ranks().find((r) => r.rank === this.viewerRank())?.depth ?? 1,
  );
  protected readonly isSelf = computed(() => {
    const me = String(this.auth.currentUser()?.id ?? '');
    const root = String(this.rootId() ?? '');
    return me.length > 0 && root === me;
  });
  protected readonly rootRank = computed<CommissionRank>(() =>
    this.tree()?.commissionRank ?? this.viewerRank(),
  );
  protected readonly rootDepth = computed(() =>
    this.tree()?.commissionDepth ?? this.viewerDepth(),
  );
  protected readonly rootName = computed(() => {
    const root = this.tree();
    return root ? this.names(root) : 'This member';
  });
  protected readonly nextRank = computed(() => {
    const ranks = this.ranks();
    const index = ranks.findIndex((r) => r.rank === this.rootRank());
    return index >= 0 ? ranks[index + 1] ?? null : null;
  });

  protected readonly chainSubtitle = computed(() =>
    'One team network — every member has one upline. Campaign history stays on the node, not in a second tree.',
  );

  protected readonly chainHint = computed(() =>
    'One upline tree. Rank depth controls commission levels; earnings stop at Level 5.',
  );

  protected readonly depthHint = computed(() =>
    `Rows show your team. Node badges are each member's own rank; the row rate is what this member earns. Earnings stop at Level ${this.rootDepth()} now and never exceed Level 5.`,
  );

  protected readonly summary = computed(() => {
    const nodes = this.layout()?.nodes ?? [];
    const earning: number[] = [];
    let locked = 0;
    let viewOnly = 0;
    for (const node of nodes) {
      if (node.depth === 0) continue;
      if (node.depth > 5) viewOnly += 1;
      else if (node.depth <= this.rootDepth()) earning.push(node.depth);
      else locked += 1;
    }
    return { total: nodes.length, earning: earning.length, locked, viewOnly };
  });

  protected readonly bands = computed(() => {
    const depth = this.depth();
    const bands: Array<{
      level: number; y: number; height: number; labelY: number;
      title: string; subtitle: string; state: 'root' | 'active' | 'locked' | 'info';
    }> = [{
      level: 0,
      y: 8,
      height: Y_GAP - 8,
      labelY: 57,
      title: this.isSelf() ? 'You' : 'Focused',
      subtitle: `${this.rootRank()} · earns ${this.depthLabel(this.rootDepth())}`,
      state: 'root',
    }];
    for (let level = 1; level <= Math.min(5, depth); level += 1) {
      const state = level <= this.rootDepth() ? 'active' as const : 'locked' as const;
      bands.push({
        level,
        y: level * Y_GAP + 8,
        height: Y_GAP - 8,
        labelY: level * Y_GAP + 57,
        title: `Level ${level} · ${this.rateFor(level)}%`,
        subtitle: state === 'active' ? 'Active — earns this level' : `Locked · ${this.unlockRank(level)}`,
        state,
      });
    }
    return bands;
  });

  protected readonly viewOnlyBand = computed(() => {
    const depth = this.depth();
    if (depth <= 5) return null;
    return {
      y: 6 * Y_GAP + 8,
      height: (depth - 5) * Y_GAP,
      labelY: 6 * Y_GAP + 57,
    };
  });

  protected rateFor(level: number): number {
    const rate = (this.plan() ?? FALLBACK_PLAN).rates.find((r) => r.level === level);
    return rate?.percent ?? 0;
  }

  protected unlockRank(level: number): string {
    return this.ranks().find((r) => r.depth >= level)?.rank ?? 'a higher rank';
  }

  protected depthLabel(depth: number): string {
    return depth <= 1 ? 'Level 1' : `Levels 1–${depth}`;
  }

  protected levelRange(from: number, to: number): string {
    return from >= to ? `Level ${from}` : `Levels ${from}–${to}`;
  }

  /** Tidy-tree layout over the visible (uncollapsed, or all when searching) nodes. */
  protected readonly layout = computed(() => {
    const root = this.tree();
    if (!root) return null;
    const collapsed = this.searching() ? new Set<string>() : this.collapsed();
    const nodes: PositionedNode[] = [];
    const edges: TreeEdge[] = [];
    let leaf = 0;
    const walk = (node: NetworkNode, depthLevel: number, parent: PositionedNode | null): PositionedNode => {
      const positioned: PositionedNode = { ...node, x: 0, y: depthLevel * Y_GAP + 20, depth: depthLevel };
      const kids = collapsed.has(node.id) ? [] : (node.children ?? []);
      if (kids.length === 0) {
        positioned.x = leaf * X_GAP + 20 + LABEL_GUTTER;
        leaf += 1;
      } else {
        const placed = kids.map((k) => walk(k, depthLevel + 1, positioned));
        positioned.x = (placed[0].x + placed[placed.length - 1].x) / 2;
        for (const child of placed) {
          const px = positioned.x + NODE_W / 2;
          const py = positioned.y + NODE_H;
          const cx = child.x + NODE_W / 2;
          const cy = child.y;
          const my = (py + cy) / 2;
          edges.push({
            d: `M ${px} ${py} L ${px} ${my} L ${cx} ${my} L ${cx} ${cy}`,
            relationType: child.relationType,
          });
        }
      }
      nodes.push(positioned);
      return positioned;
    };
    walk(root, 0, null);
    const width = Math.max(leaf * X_GAP + 40 + LABEL_GUTTER, NODE_W + 40 + LABEL_GUTTER);
    const maxY = nodes.reduce((m, n) => Math.max(m, n.y), 0);
    return { nodes, edges, width, height: maxY + NODE_H + 40 };
  });

  protected readonly selected = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.layout()?.nodes.find((n) => n.id === id) ?? null;
  });

  protected readonly matches = computed(() => {
    if (!this.searching()) return [];
    return (this.layout()?.nodes ?? []).filter((n) => this.isMatch(n));
  });

  protected readonly zoomLabel = computed(() => `${Math.round(this.zoom() * 100)}%`);

  /** Set after each data load — the next render fits the tree to the
   * visible width, so wide teams land scrollbar-free. Zooming in afterwards
   * still pans via the wrap (explicit exploration, not the default). */
  private needsFit = false;

  constructor() {
    afterNextRender(() => {
      if (this.needsFit) {
        this.needsFit = false;
        this.fit();
      }
    });
  }

  protected rootLabel(): { name: string; surname: string; username: string } {
    return this.tree() ?? { username: '', name: '', surname: '' };
  }

  ngOnInit(): void {
    this.loadPlan();
    const me = this.auth.currentUser()?.id;
    if (me) {
      this.rootId.set(me);
      this.reload();
    } else {
      this.error.set('Session expired. Please sign in again.');
      this.loading.set(false);
    }
  }

  private loadPlan(): void {
    this.compensation.plan().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => this.plan.set(res.data ?? null),
      error: () => this.plan.set(null),
    });
  }

  protected reload(): void {
    const root = this.rootId();
    if (!root) return;
    this.loading.set(true);
    this.error.set(null);
    this.network
      .tree(root, this.depth(), this.chain())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.tree.set(res.data.tree);
          this.meta.set(res.data.meta);
          this.systemRoot.set(res.data.systemRoot ?? null);
          this.collapsed.set(new Set());
          this.selectedId.set(null);
          this.matchIdx.set(0);
          this.panX.set(0);
          this.panY.set(0);
          this.needsFit = true;
          this.loading.set(false);
          this.refreshPresence(res.data.tree);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
    this.network
      .upline(root, this.chain())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.upline.set([...(res.data.chain ?? [])].reverse()),
        error: () => this.upline.set([]),
      });
  }

  protected focus(partnerId: string): void {
    this.rootId.set(partnerId);
    this.tree.set(null);
    this.meta.set(null);
    this.upline.set([]);
    this.selectedId.set(null);
    this.search.set('');
    this.matchIdx.set(0);
    this.resetView();
    this.reload();
  }

  protected toggle(node: PositionedNode): void {
    this.selectedId.set(node.id);
    if (node.children.length === 0) return;
    const next = new Set(this.collapsed());
    if (next.has(node.id)) {
      next.delete(node.id);
    } else {
      next.add(node.id);
    }
    this.collapsed.set(next);
  }

  protected isCollapsed(id: string): boolean {
    return !this.searching() && this.collapsed().has(id);
  }

  protected isMatch(node: PositionedNode): boolean {
    const q = this.search().trim().toLowerCase();
    if (!q) return false;
    return `${node.username} ${node.name} ${node.surname}`.toLowerCase().includes(q);
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.matchIdx.set(0);
  }

  protected zoomIn(): void {
    this.zoom.set(Math.min(ZOOM_MAX, Math.round((this.zoom() + ZOOM_STEP) * 100) / 100));
  }

  protected zoomOut(): void {
    this.zoom.set(Math.max(ZOOM_MIN, Math.round((this.zoom() - ZOOM_STEP) * 100) / 100));
  }

  protected resetView(): void {
    this.zoom.set(1);
    this.panX.set(0);
    this.panY.set(0);
  }

  /** Scale the tree to the visible width. */
  protected fit(): void {
    const el = this.canvasWrap()?.nativeElement;
    const layout = this.layout();
    if (!el || !layout || layout.width <= 0) return;
    this.zoom.set(Math.min(1.5, Math.max(ZOOM_MIN, el.clientWidth / layout.width)));
    this.panX.set(0);
    this.panY.set(0);
  }

  /** Center a node in the viewport (transform is translate then scale). */
  protected centerOn(node: PositionedNode): void {
    const el = this.canvasWrap()?.nativeElement;
    if (!el) return;
    const z = Math.max(this.zoom(), 1);
    this.zoom.set(z);
    this.selectedId.set(node.id);
    this.panX.set(el.clientWidth / 2 / z - (node.x + NODE_W / 2));
    this.panY.set(Math.max(0, el.clientHeight / 2 / z - (node.y + NODE_H / 2)));
    el.focus({ preventScroll: true });
  }

  protected stepMatch(dir: 1 | -1): void {
    const list = this.matches();
    if (list.length === 0) return;
    const next = (this.matchIdx() + dir + list.length) % list.length;
    this.matchIdx.set(next);
    const node = list[next];
    if (node) this.centerOn(node);
  }

  protected expandAll(): void {
    this.collapsed.set(new Set());
  }

  protected collapseAll(): void {
    const root = this.tree();
    if (!root) return;
    const ids = new Set<string>();
    const walk = (node: NetworkNode): void => {
      if ((node.children ?? []).length > 0) {
        ids.add(node.id);
        node.children.forEach(walk);
      }
    };
    walk(root);
    this.collapsed.set(ids);
    this.selectedId.set(root.id);
  }

  protected onCanvasKey(event: KeyboardEvent): void {
    if (event.key === '+' || event.key === '=') {
      this.zoomIn();
      event.preventDefault();
    } else if (event.key === '-' || event.key === '_') {
      this.zoomOut();
      event.preventDefault();
    } else if (event.key === '0') {
      this.resetView();
      event.preventDefault();
    } else if (event.key === 'Escape') {
      this.selectedId.set(null);
    }
  }

  protected names(node: { name: string; surname: string; username: string }): string {
    return this.network.displayName(node);
  }

  protected relationLabel(node: PositionedNode): string {
    if (node.depth === 0) return 'Root';
    return node.relationType === 'placement' ? 'Campaign placement' : 'Referral';
  }

  protected isNodeLocked(node: PositionedNode): boolean {
    if (node.depth === 0) return false;
    return node.depth > this.rootDepth() && node.depth <= 5;
  }

  protected earningNote(node: PositionedNode): string {
    if (node.depth === 0) {
      return this.isSelf()
        ? 'This is you — the root of your network.'
        : 'This member is the root of the current view.';
    }
    if (node.depth > 5) return 'Beyond Level 5 — view only, no commission.';
    const earner = this.isSelf() ? 'You' : 'This member';
    if (node.depth > this.rootDepth()) {
      return `Locked — ${this.unlockRank(node.depth)} unlocks Level ${node.depth}. ${earner} cannot earn this level yet.`;
    }
    return `${earner} ${this.isSelf() ? 'earn' : 'earns'} Level ${node.depth} · ${this.rateFor(node.depth)}% from this member's purchases.`;
  }

  protected emptyLabel(): string {
    return 'No team yet — invite someone with your referral link or wait for a system-owned campaign placement.';
  }

  protected shortName(node: PositionedNode): string {
    const full = this.names(node);
    return full.length > 15 ? `${full.slice(0, 14)}…` : full;
  }

  protected shortSub(node: PositionedNode): string {
    const suffix = ` · ${node.childCount}`;
    const base = `@${node.username}${suffix}`;
    if (base.length <= 18) return base;
    return `@${node.username.slice(0, Math.max(0, 18 - suffix.length - 2))}…${suffix}`;
  }

  /** Same photo resolution as the shared avatar (absolute or legacy uploads). */
  protected avatarUrl(photo: string | null | undefined): string | null {
    const raw = String(photo ?? '').trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${this.baseUrl}/uploads/${raw.replace(/^\/+/, '')}`;
  }

  protected avatarInitial(node: PositionedNode): string {
    const full = this.names(node).trim();
    return full ? full.charAt(0).toUpperCase() : '?';
  }

  /** One bulk presence lookup over every loaded member (cached 60s). */
  protected refreshPresence(root: NetworkNode | null): void {
    if (!root) return;
    const ids: string[] = [];
    const queue: NetworkNode[] = [root];
    while (queue.length > 0) {
      const node = queue.shift()!;
      ids.push(node.id);
      for (const child of node.children ?? []) queue.push(child);
    }
    this.presence
      .lookup(ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((map) => this.presenceMap.set({ ...this.presenceMap(), ...map }));
  }

  protected presenceOf(id: string | null | undefined): PresenceStatus {
    if (!id) return null;
    return this.presence.statusOf(this.presenceMap()[id] ?? null);
  }

  protected presenceFill(status: PresenceStatus): string {
    return status === 'online' ? '#2e7d32' : '#d9a406';
  }

  protected nodeLabel(node: PositionedNode): string {
    const presence = this.presenceOf(node.id);
    const suffix = presence === 'online' ? ', online now' : presence === 'recent' ? ', active recently' : '';
    return `${this.names(node)}, ${node.commissionRank}, earns levels 1 to ${node.commissionDepth}${suffix}`;
  }

  protected rankColor(rank: string): string {
    const palette = RANK_FILL[this.themes.theme()] ?? RANK_FILL['light'] ?? {};
    return palette[rank] ?? palette['Partner'] ?? '#e8eaf6';
  }

  protected fill(node: PositionedNode): string {
    return this.rankColor(node.commissionRank);
  }
}
