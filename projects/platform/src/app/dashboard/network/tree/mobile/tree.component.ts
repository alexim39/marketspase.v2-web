import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { CompensationService } from '../../../../core/compensation/compensation.service';
import { CommissionRank, CompensationPlan } from '../../../../core/compensation/compensation.models';
import { ApiError } from '../../../../core/http/api-error';
import { PresenceService, PresenceStatus } from '../../../../core/presence/presence.service';
import { API_BASE_URL } from '../../../../core/config/api-tokens';
import { AvatarComponent } from '../../../../_common/avatar.component';
import { NetworkService } from '../network.service';
import { NetworkChain, NetworkNode, NetworkTreeMeta } from '../network.models';
import {
  NetworkLevelTone,
  NetworkRankTone,
  NetworkTreeNodeCardComponent,
} from './node-card.component';

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
  mentorBonus: { amount: 1000, daysAfterActivation: 0 },
};

interface LadderStep {
  level: number;
  percent: number;
  state: 'earning' | 'locked';
  unlock: string;
}

/**
 * Mobile network tree.
 *
 * The desktop canvas is a wide SVG tidy-tree. A phone cannot show that canvas
 * without pinching and panning, so the same hierarchy becomes a vertical,
 * indented branch tree: one root card, per-level connector rails, expandable
 * branches and the same rank/commission context. Search expands every branch
 * and highlights matches; focusing any node makes it the new root.
 */
@Component({
  selector: 'async-network-tree-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent, MatButtonModule, MatIconModule, NetworkTreeNodeCardComponent,
    NgTemplateOutlet, PageSkeletonComponent, RouterModule,
  ],
  template: `
    <section class="tree-page">
      <header class="tree-hero">
        <div class="hero-top">
          <a mat-icon-button routerLink="/dashboard" aria-label="Back to dashboard">
            <mat-icon>arrow_back</mat-icon>
          </a>
          <div class="hero-title">
            <p class="eyebrow">Network</p>
            <h1>{{ pageTitle() }}</h1>
          </div>
          <button mat-icon-button type="button" (click)="reload()" [disabled]="loading()" aria-label="Refresh network tree">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
        <p class="hero-lede">{{ heroLede() }}</p>
        <div class="hero-actions">
          <a mat-stroked-button routerLink="/dashboard/network/org"><mat-icon>layers</mat-icon> Org chart</a>
          <a mat-stroked-button routerLink="/dashboard/mentorship/partners/my-partners"><mat-icon>groups</mat-icon> Partners</a>
          @if (!isSelf()) {
            <button mat-stroked-button type="button" (click)="backToMyTree()"><mat-icon>home</mat-icon> My tree</button>
          }
        </div>
      </header>

      @if (loading() && !tree()) {
        <async-page-skeleton layout="network" [rows]="4" label="network tree" [showHeader]="false" />
      }

      @if (error(); as err) {
        <div class="alert" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>{{ err }}</p>
          <button mat-stroked-button type="button" (click)="reload()">Retry</button>
        </div>
      }

      @if (tree(); as root) {
        <section class="commission-card" aria-label="Commission position">
          <div class="commission-head">
            <div class="commission-you">
              <span class="eyebrow">{{ isSelf() ? 'Your commission position' : 'Viewing member position' }}</span>
              <strong>{{ rootRank() }} · earns {{ depthLabel(rootDepth()) }}</strong>
              <span>{{ isSelf() ? 'Your rank depth sets the commission levels on every branch.' : rootName() + ' · rank depth sets their commission levels.' }}</span>
            </div>
            <div class="commission-next">
              @if (nextRank(); as next) {
                <span>Next rank</span>
                <strong>{{ next.rank }}</strong>
                <small>Unlocks {{ levelRange(rootDepth() + 1, next.depth) }}</small>
              } @else {
                <span>Top rank</span>
                <strong>Ambassador</strong>
                <small>All 5 levels active</small>
              }
            </div>
          </div>

          <div class="ladder" role="list" aria-label="Commission ladder">
            @for (step of ladder(); track step.level) {
              <span
                class="ladder-step"
                [class.is-earning]="step.state === 'earning'"
                [class.is-locked]="step.state === 'locked'"
                role="listitem"
                [attr.aria-label]="'Level ' + step.level + ', ' + step.percent + '%, ' + (step.state === 'earning' ? 'earning' : 'locked until ' + step.unlock)">
                <strong>L{{ step.level }}</strong>
                <span>{{ step.percent }}%</span>
                @if (step.state === 'locked') {
                  <mat-icon aria-hidden="true">lock</mat-icon>
                }
              </span>
            }
          </div>

          @if (depth() > 5) {
            <p class="view-note">
              <mat-icon aria-hidden="true">visibility</mat-icon>
              {{ depth() === 6 ? 'Generation 6 is' : 'Generations 6–' + depth() + ' are' }} view only — no commission.
            </p>
          }
          <p class="commission-hint">Rank depth controls commission levels. Earnings stop at Level 5.</p>
        </section>

        @if (loading()) {
          <div class="loading-strip" role="status" aria-label="Updating network tree"></div>
        }

        <div class="tree-controls">
          <div class="search-row">
            <div class="search-box">
              <mat-icon aria-hidden="true">search</mat-icon>
              <input
                type="search"
                inputmode="search"
                placeholder="Search name or &#64;username"
                [value]="search()"
                (input)="onSearch($any($event.target).value)"
                maxlength="80"
                aria-label="Search network" />
              @if (search()) {
                <button type="button" class="search-clear" (click)="clearSearch()" aria-label="Clear search">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </div>
            <label class="depth-pill">
              <mat-icon aria-hidden="true">account_tree</mat-icon>
              <select (change)="setDepth(+$any($event.target).value)" aria-label="Generations to show">
                @for (d of depthOptions; track d) {
                  <option [value]="d" [selected]="d === depth()">{{ d }} gen</option>
                }
              </select>
              <mat-icon class="select-chevron" aria-hidden="true">expand_more</mat-icon>
            </label>
          </div>

          @if (searching()) {
            <div class="match-row">
              <span class="match-chip"><mat-icon aria-hidden="true">search</mat-icon>{{ matches().length }} found</span>
              <button mat-icon-button type="button" (click)="stepMatch(-1)" [disabled]="matches().length === 0" aria-label="Previous match">
                <mat-icon>keyboard_arrow_up</mat-icon>
              </button>
              <button mat-icon-button type="button" (click)="stepMatch(1)" [disabled]="matches().length === 0" aria-label="Next match">
                <mat-icon>keyboard_arrow_down</mat-icon>
              </button>
              <button mat-button type="button" (click)="clearSearch()">Clear</button>
            </div>
          }
        </div>

        <div class="tree-head">
          <div class="tree-head-copy">
            <h2>{{ searching() ? 'Search results' : (isSelf() ? 'Your branches' : shortName(root) + '’s branches') }}</h2>
            <span>{{ visibleCount() }} of {{ meta()?.total ?? 0 }} partners shown</span>
          </div>
          <div class="tree-tools">
            <button mat-icon-button type="button" (click)="expandAll()" [disabled]="!canExpand()" aria-label="Expand all branches" title="Expand all">
              <mat-icon>unfold_more</mat-icon>
            </button>
            <button mat-icon-button type="button" (click)="collapseBranches()" [disabled]="!canCollapse()" aria-label="Collapse all branches" title="Collapse branches">
              <mat-icon>unfold_less</mat-icon>
            </button>
          </div>
        </div>

        <div class="tree-summary" aria-label="Tree summary">
          <span class="summary-chip summary-chip--ok"><strong>{{ summary().earning }}</strong> earning</span>
          <span class="summary-chip summary-chip--warn"><strong>{{ summary().locked }}</strong> locked</span>
          <span class="summary-chip"><strong>{{ summary().viewOnly }}</strong> view only</span>
          <span class="summary-chip">{{ generations() }} generation{{ generations() === 1 ? '' : 's' }}</span>
          @if (meta()?.truncated) {
            <span class="summary-chip summary-chip--warn">Partial tree</span>
          }
        </div>

        @if (parentId() || !isSelf()) {
          <div class="tree-nav">
            @if (parentId()) {
              <button mat-button type="button" (click)="back()"><mat-icon>arrow_upward</mat-icon> Up one level</button>
            }
            @if (!isSelf()) {
              <button mat-button type="button" (click)="backToMyTree()"><mat-icon>home</mat-icon> My tree</button>
            }
            <span class="tree-nav-copy">Viewing {{ rootName() }}</span>
          </div>
        }

        <div class="tree-body">
          @if (immediateUpline(); as up) {
            <article class="upline-card" role="note">
              <async-avatar [photo]="avatarUrl(up.profileImage)" [name]="names(up)" size="sm" [presence]="presenceOf(up.id)" />
              <div class="upline-copy">
                <span class="eyebrow">{{ isSelf() ? 'Your upline' : 'Member upline' }}</span>
                <strong>{{ names(up) }}</strong>
                <span>&#64;{{ up.username }} · {{ up.commissionRank }}</span>
                <span class="upline-meta">Earns {{ depthLabel(up.commissionDepth) }} · {{ relationLabel(up) }}</span>
              </div>
              <div class="upline-actions">
                <a mat-icon-button [routerLink]="['/dashboard/network/view', up.id]" aria-label="Open upline 360 view">
                  <mat-icon>person_search</mat-icon>
                </a>
                <a
                  mat-icon-button
                  [routerLink]="['/dashboard/messages']"
                  [queryParams]="{ chat: up.id, chatName: names(up) }"
                  aria-label="Chat with upline">
                  <mat-icon>chat</mat-icon>
                </a>
              </div>
            </article>
          } @else if (uplineReady()) {
            <article class="upline-card upline-card--empty" role="note">
              <span class="upline-mark" aria-hidden="true">?</span>
              <div class="upline-copy">
                <strong>{{ isSelf() ? 'No upline yet' : 'No upline on record' }}</strong>
                <span>{{ isSelf()
                  ? 'You joined without a sponsor. Fair allocation places you with a campaign mentor after activation.'
                  : 'This member sits at the top of the visible network.' }}</span>
              </div>
            </article>
          }

          <article
            class="root-card"
            [class.rank-builder]="rankTone(root.commissionRank) === 'builder'"
            [class.rank-leader]="rankTone(root.commissionRank) === 'leader'"
            [class.rank-ambassador]="rankTone(root.commissionRank) === 'ambassador'"
            [class.is-match]="searching() && isMatch(root)"
            [class.is-dimmed]="searching() && !isMatch(root)"
            [id]="'network-node-' + root.id">
            <async-avatar [photo]="avatarUrl(root.profileImage)" [name]="names(root)" size="md" [presence]="presenceOf(root.id)" />
            <div class="root-copy">
              <span class="eyebrow">{{ isSelf() ? 'Root of your tree' : 'Focused member' }}</span>
              <strong>{{ names(root) }}</strong>
              <span>&#64;{{ root.username }} · {{ root.commissionRank }} · {{ root.childCount }} direct partner{{ root.childCount === 1 ? '' : 's' }}</span>
              <div class="root-chips">
                <span class="root-chip">Earns {{ depthLabel(rootDepth()) }}</span>
                @if (isSelf()) { <span class="you-pill">You</span> }
              </div>
            </div>
            @if (!isSelf()) {
              <a mat-icon-button [routerLink]="['/dashboard/network/view', root.id]" aria-label="Open 360 view">
                <mat-icon>person_search</mat-icon>
              </a>
            }
          </article>

          @if (searching() && matches().length === 0) {
            <div class="empty-card">
              <span class="empty-icon"><mat-icon>search_off</mat-icon></span>
              <h3>No matches for “{{ search() }}”</h3>
              <p>Search looks across every branch. Try a name or &#64;username.</p>
              <button mat-stroked-button type="button" (click)="clearSearch()">Clear search</button>
            </div>
          } @else if (!hasChildren(root)) {
            <div class="empty-card">
              <span class="empty-icon"><mat-icon>account_tree</mat-icon></span>
              <h3>{{ isSelf() ? 'Your first branch is waiting' : 'No downline yet' }}</h3>
              <p>{{ isSelf()
                ? 'Invite someone with your referral link or wait for a campaign placement. Your first partner will appear here.'
                : 'This member has not built a downline yet. Use Up or My tree to keep exploring.' }}</p>
              @if (isSelf()) {
                <a mat-flat-button color="primary" routerLink="/dashboard/prospects/pipeline"><mat-icon>link</mat-icon> Get my referral link</a>
              } @else {
                <button mat-stroked-button type="button" (click)="backToMyTree()"><mat-icon>home</mat-icon> My tree</button>
              }
            </div>
          } @else {
            <ul class="tree-root" [attr.aria-label]="'Downline tree for ' + names(root)">
              @for (child of root.children; track child.id) {
                <ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: child, depth: 1 }" />
              }
            </ul>
          }
        </div>
      }
    </section>

    <ng-template #nodeTpl let-node let-depth="depth">
      <li class="tree-node" [class.is-placement]="node.relationType === 'placement'">
        <async-network-node-card
          [node]="node"
          [expanded]="isExpanded(node)"
          [hasChildren]="hasChildren(node)"
          [searching]="searching()"
          [matched]="searching() && isMatch(node)"
          [presence]="presenceOf(node.id)"
          [avatar]="avatarUrl(node.profileImage)"
          [levelLabel]="levelLabel(depth)"
          [levelTone]="levelState(depth)"
          [relationLabel]="relationLabel(node)"
          [rankTone]="rankTone(node.commissionRank)"
          [earningNote]="earningNote(depth)"
          (toggled)="toggle($event)"
          (focused)="focus($event.id)" />
        @if (hasChildren(node) && isExpanded(node)) {
          <ul class="tree-children">
            @for (child of node.children; track child.id) {
              <ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: child, depth: depth + 1 }" />
            }
          </ul>
        }
      </li>
    </ng-template>
  `,
  styles: [`
    :host { display: block; -webkit-tap-highlight-color: transparent; }
    .tree-page { display: flex; flex-direction: column; gap: 12px; max-width: 720px; margin: 0 auto; padding-bottom: 28px; }

    .tree-hero { padding: 14px; border: 1px solid color-mix(in srgb, var(--ms-primary) 16%, var(--ms-line)); border-radius: 20px; background: linear-gradient(155deg, var(--ms-primary-soft), var(--ms-surface) 70%); }
    .hero-top { display: flex; align-items: center; gap: 8px; }
    .hero-top > a, .hero-top > button { flex: none; background: color-mix(in srgb, var(--ms-surface) 72%, transparent); }
    .hero-title { flex: 1; min-width: 0; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.66rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .hero-title h1 { margin: 1px 0 0; font-size: 1.65rem; letter-spacing: -0.03em; }
    .hero-lede { margin: 9px 0 12px; max-width: 42em; color: var(--ms-text-muted); font-size: 0.82rem; line-height: 1.55; }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .hero-actions a, .hero-actions button { flex: 1 1 45%; min-width: 0; min-height: 44px; }
    .hero-actions mat-icon { margin-right: 4px; }

    .commission-card { padding: 12px; border: 1px solid var(--ms-line); border-radius: 16px; background: linear-gradient(135deg, color-mix(in srgb, var(--ms-primary-soft) 70%, var(--ms-surface)), var(--ms-surface)); }
    .commission-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .commission-you { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .commission-you strong { font-size: 0.96rem; }
    .commission-you > span:last-child { color: var(--ms-text-muted); font-size: 0.7rem; line-height: 1.4; }
    .commission-next { display: flex; flex-direction: column; gap: 1px; flex: none; text-align: right; }
    .commission-next > span { color: var(--ms-text-muted); font-size: 0.61rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .commission-next strong { font-size: 0.86rem; }
    .commission-next small { color: var(--ms-text-muted); font-size: 0.64rem; }
    .ladder { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; margin-top: 10px; }
    .ladder-step { display: flex; flex-direction: column; align-items: center; gap: 0; padding: 6px 2px; border: 1px solid var(--ms-line); border-radius: 10px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.62rem; line-height: 1.35; }
    .ladder-step strong { font-size: 0.72rem; }
    .ladder-step.is-earning { border-color: color-mix(in srgb, var(--ms-success) 28%, var(--ms-line)); background: var(--ms-success-soft); color: var(--ms-success); }
    .ladder-step.is-locked { border-color: color-mix(in srgb, var(--ms-warning) 28%, var(--ms-line)); background: var(--ms-warning-soft); color: var(--ms-warning); }
    .ladder-step mat-icon { font-size: 11px; width: 11px; height: 11px; }
    .view-note { display: flex; align-items: flex-start; gap: 4px; margin: 9px 0 0; padding: 7px 8px; border-radius: 9px; background: var(--ms-warning-soft); color: var(--ms-warning); font-size: 0.7rem; line-height: 1.4; }
    .view-note mat-icon { flex: none; margin-top: 1px; font-size: 15px; width: 15px; height: 15px; }
    .commission-hint { margin: 8px 0 0; color: var(--ms-text-muted); font-size: 0.68rem; line-height: 1.4; }

    .loading-strip { position: relative; height: 3px; overflow: hidden; border-radius: 999px; background: var(--ms-line); }
    .loading-strip::after { content: ''; position: absolute; inset: 0; width: 38%; border-radius: inherit; background: var(--ms-primary); animation: slide-bar 1.05s ease-in-out infinite; }

    .tree-controls { position: sticky; top: calc(var(--ms-mobile-appbar-height) + var(--ms-safe-top)); z-index: 10; display: flex; flex-direction: column; gap: 6px; margin: 0 -2px; padding: 6px 2px 7px; background: var(--ms-canvas); border-bottom: 1px solid color-mix(in srgb, var(--ms-line) 65%, transparent); }
    .search-row { display: flex; align-items: center; gap: 7px; }
    .search-box { flex: 1; display: flex; align-items: center; gap: 7px; min-width: 0; min-height: 46px; padding: 0 10px 0 12px; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); }
    .search-box:focus-within { border-color: var(--ms-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ms-primary) 16%, transparent); }
    .search-box > mat-icon { flex: none; color: var(--ms-text-muted); font-size: 20px; width: 20px; height: 20px; }
    .search-box input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--ms-text); font: inherit; font-size: 0.84rem; }
    .search-box input::placeholder { color: var(--ms-text-muted); }
    .search-box input::-webkit-search-cancel-button { display: none; }
    .search-clear { flex: none; width: 30px; height: 30px; display: grid; place-items: center; border: 0; border-radius: 50%; background: var(--ms-canvas); color: var(--ms-text-muted); cursor: pointer; }
    .search-clear mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .depth-pill { position: relative; display: flex; align-items: center; gap: 3px; flex: none; min-height: 46px; padding: 0 24px 0 9px; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); color: var(--ms-text); }
    .depth-pill > mat-icon { flex: none; color: var(--ms-text-muted); font-size: 18px; width: 18px; height: 18px; }
    .depth-pill select { appearance: none; border: 0; outline: none; background: transparent; color: var(--ms-text); font: inherit; font-size: 0.76rem; font-weight: 650; cursor: pointer; }
    .select-chevron { position: absolute; right: 6px; color: var(--ms-text-muted); font-size: 17px; width: 17px; height: 17px; pointer-events: none; }
    .match-row { display: flex; align-items: center; gap: 2px; }
    .match-chip { display: inline-flex; align-items: center; gap: 3px; margin-right: auto; padding: 3px 8px; border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.68rem; font-weight: 750; }
    .match-chip mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .match-row button { min-height: 40px; }

    .tree-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 2px; }
    .tree-head-copy { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .tree-head h2 { margin: 0; overflow: hidden; font-size: 1rem; text-overflow: ellipsis; white-space: nowrap; }
    .tree-head-copy > span { color: var(--ms-text-muted); font-size: 0.68rem; }
    .tree-tools { display: flex; flex: none; }
    .tree-tools button { width: 40px; height: 40px; }

    .tree-summary { display: flex; flex-wrap: wrap; gap: 5px; }
    .summary-chip { display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; border: 1px solid var(--ms-line); border-radius: 999px; background: var(--ms-surface); color: var(--ms-text-muted); font-size: 0.63rem; font-weight: 650; }
    .summary-chip strong { color: var(--ms-text); }
    .summary-chip--ok { border-color: transparent; background: var(--ms-success-soft); color: var(--ms-success); }
    .summary-chip--ok strong { color: var(--ms-success); }
    .summary-chip--warn { border-color: transparent; background: var(--ms-warning-soft); color: var(--ms-warning); }
    .summary-chip--warn strong { color: var(--ms-warning); }

    .tree-nav { display: flex; align-items: center; flex-wrap: wrap; gap: 3px; padding: 0 2px; }
    .tree-nav button { min-height: 44px; }
    .tree-nav-copy { color: var(--ms-text-muted); font-size: 0.7rem; }

    .tree-body { display: flex; flex-direction: column; }
    .upline-card { position: relative; display: flex; align-items: center; gap: 9px; margin-bottom: 16px; padding: 10px 11px; border: 1px solid color-mix(in srgb, var(--ms-primary) 28%, var(--ms-line)); border-radius: 14px; background: linear-gradient(120deg, color-mix(in srgb, var(--ms-primary-soft) 70%, var(--ms-surface)), var(--ms-surface)); }
    .upline-card::after { content: ''; position: absolute; left: 16px; bottom: -16px; height: 16px; border-left: 1.5px solid color-mix(in srgb, var(--ms-primary) 35%, var(--ms-line)); }
    .upline-card--empty { border-style: dashed; background: var(--ms-surface); }
    .upline-card--empty::after { border-left-style: dashed; }
    .upline-copy { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
    .upline-copy strong { overflow: hidden; font-size: 0.88rem; text-overflow: ellipsis; white-space: nowrap; }
    .upline-copy span { color: var(--ms-text-muted); font-size: 0.69rem; line-height: 1.35; }
    .upline-meta { font-size: 0.65rem !important; }
    .upline-actions { display: flex; flex: none; align-items: center; gap: 0; }
    .upline-actions a { min-height: 44px; }
    .upline-mark { flex: none; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 9px; background: var(--ms-primary); color: var(--ms-ink); font-weight: 800; }

    .root-card { position: relative; display: flex; align-items: center; gap: 10px; padding: 11px 12px; border: 1px solid var(--ms-line); border-left: 3px solid var(--ms-primary); border-radius: 16px; background: linear-gradient(155deg, var(--ms-primary-soft), var(--ms-surface) 75%); }
    .root-card.rank-builder { border-left-color: var(--ms-info); }
    .root-card.rank-leader { border-left-color: var(--ms-success); }
    .root-card.rank-ambassador { border-left-color: var(--ms-warning); }
    .root-card.is-match { border-color: var(--ms-success); border-left-color: var(--ms-success); box-shadow: 0 0 0 3px var(--ms-success-soft); }
    .root-card.is-dimmed { opacity: 0.55; }
    .root-copy { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
    .root-copy strong { overflow: hidden; font-size: 0.96rem; text-overflow: ellipsis; text-transform: capitalize; white-space: nowrap; }
    .root-copy > span { overflow: hidden; color: var(--ms-text-muted); font-size: 0.7rem; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
    .root-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }
    .root-chip { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 999px; background: var(--ms-surface); color: var(--ms-primary-strong); font-size: 0.62rem; font-weight: 750; }
    .you-pill { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 999px; background: var(--ms-success-soft); color: var(--ms-success); font-size: 0.62rem; font-weight: 750; }
    .root-card > a { flex: none; }

    .tree-root, .tree-children { margin: 0; padding: 0; list-style: none; }
    .tree-root { position: relative; margin: 8px 0 0 16px; }
    .tree-root::before { content: ''; position: absolute; left: 0; top: -8px; height: 8px; border-left: 1.5px solid var(--ms-line-strong); }
    .tree-node { position: relative; padding: 0 0 8px 20px; }
    .tree-node::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; border-left: 1.5px solid var(--ms-line-strong); }
    .tree-node::after { content: ''; position: absolute; left: 0; top: 28px; width: 18px; border-top: 1.5px solid var(--ms-line-strong); }
    .tree-node:last-child::before { bottom: auto; height: 29px; }
    .tree-node.is-placement::after { border-top-style: dashed; }
    .tree-children { margin-top: 8px; }

    .empty-card { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 26px 18px; text-align: center; border: 1px dashed var(--ms-line-strong); border-radius: 16px; background: var(--ms-surface); }
    .empty-icon { width: 50px; height: 50px; display: grid; place-items: center; border-radius: 50%; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .empty-icon mat-icon { font-size: 25px; width: 25px; height: 25px; }
    .empty-card h3 { margin: 0; font-size: 1rem; }
    .empty-card p { margin: 0; max-width: 32em; color: var(--ms-text-muted); font-size: 0.8rem; line-height: 1.5; }
    .empty-card a, .empty-card button { min-height: 44px; margin-top: 2px; }
    .alert { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; padding: 11px 12px; border-radius: 14px; background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { flex: 1; min-width: 170px; margin: 0; font-size: 0.8rem; }
    .alert button { min-height: 40px; }

    @media (prefers-reduced-motion: reduce) {
      .loading-strip::after { animation: none; width: 100%; opacity: 0.5; }
    }
    @keyframes slide-bar { 0% { transform: translateX(-110%); } 100% { transform: translateX(290%); } }
  `],
})
export class NetworkTreeMobileComponent implements OnInit {
  private readonly network = inject(NetworkService);
  private readonly auth = inject(AuthService);
  private readonly compensation = inject(CompensationService);
  private readonly presence = inject(PresenceService);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly tree = signal<NetworkNode | null>(null);
  protected readonly meta = signal<NetworkTreeMeta | null>(null);
  protected readonly upline = signal<NetworkNode[]>([]);
  protected readonly uplineReady = signal(false);
  protected readonly rootId = signal<string | null>(null);
  protected readonly depth = signal(5);
  protected readonly plan = signal<CompensationPlan | null>(null);
  protected readonly search = signal('');
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());
  protected readonly matchIdx = signal(0);
  protected readonly presenceMap = signal<Record<string, string | null>>({});
  protected readonly depthOptions = [2, 3, 4, 5, 6, 8, 10];

  protected readonly searching = computed(() => this.search().trim().length > 0);
  protected readonly immediateUpline = computed<NetworkNode | null>(() => {
    const chain = this.upline();
    return chain.length > 0 ? chain[chain.length - 1] : null;
  });
  protected readonly ranks = computed(() => this.plan()?.ranks ?? FALLBACK_PLAN.ranks);
  protected readonly viewerRank = computed<CommissionRank>(() =>
    (this.auth.currentUser()?.commissionRank as CommissionRank | undefined) ?? 'Partner');
  protected readonly viewerDepth = computed(() =>
    this.ranks().find((r) => r.rank === this.viewerRank())?.depth ?? 1);
  protected readonly isSelf = computed(() => {
    const me = String(this.auth.currentUser()?.id ?? '');
    const root = String(this.rootId() ?? '');
    return me.length > 0 && root === me;
  });
  protected readonly rootRank = computed<CommissionRank>(() =>
    this.tree()?.commissionRank ?? this.viewerRank());
  protected readonly rootDepth = computed(() =>
    this.tree()?.commissionDepth ?? this.viewerDepth());
  protected readonly nextRank = computed(() => {
    const ranks = this.ranks();
    const index = ranks.findIndex((r) => r.rank === this.rootRank());
    return index >= 0 ? ranks[index + 1] ?? null : null;
  });
  protected readonly parentId = computed(() => {
    const chain = this.upline();
    return chain.length > 0 ? chain[chain.length - 1].id : null;
  });
  protected readonly rootName = computed(() => {
    const root = this.tree();
    return root ? this.names(root) : (this.isSelf() ? 'You' : 'this member');
  });
  protected readonly pageTitle = computed(() => this.isSelf() ? 'Your network tree' : 'Network tree');
  protected readonly heroLede = computed(() => this.isSelf()
    ? 'See how your team branches from you. Expand a branch to go deeper, or focus a partner to walk their tree.'
    : `Viewing ${this.rootName()}’s downline. Use Up or My tree to move through the network.`);

  protected readonly ladder = computed<LadderStep[]>(() => {
    const rates = [...(this.plan() ?? FALLBACK_PLAN).rates]
      .filter((r) => r.level >= 1 && r.level <= 5)
      .sort((a, b) => a.level - b.level);
    const depth = this.rootDepth();
    return rates.map((rate) => ({
      level: rate.level,
      percent: rate.percent,
      state: (rate.level <= depth ? 'earning' : 'locked') as 'earning' | 'locked',
      unlock: this.unlockRank(rate.level),
    }));
  });

  protected readonly summary = computed(() => {
    const root = this.tree();
    if (!root) return { earning: 0, locked: 0, viewOnly: 0 };
    let earning = 0;
    let locked = 0;
    let viewOnly = 0;
    const walk = (node: NetworkNode, depth: number): void => {
      if (depth > 0) {
        if (depth > 5) viewOnly += 1;
        else if (depth <= this.rootDepth()) earning += 1;
        else locked += 1;
      }
      for (const child of node.children ?? []) walk(child, depth + 1);
    };
    walk(root, 0);
    return { earning, locked, viewOnly };
  });

  protected readonly generations = computed(() => Math.max(0, (this.meta()?.perLevel?.length ?? 1) - 1));

  protected readonly visibleCount = computed(() => {
    const root = this.tree();
    if (!root) return 0;
    let count = 1;
    const walk = (node: NetworkNode): void => {
      if (!this.hasChildren(node) || !this.isExpanded(node)) return;
      for (const child of node.children) {
        count += 1;
        walk(child);
      }
    };
    walk(root);
    return count;
  });

  protected readonly matches = computed<NetworkNode[]>(() => {
    const root = this.tree();
    if (!root || !this.searching()) return [];
    const found: NetworkNode[] = [];
    const walk = (node: NetworkNode): void => {
      if (this.isMatch(node)) found.push(node);
      for (const child of node.children ?? []) walk(child);
    };
    walk(root);
    return found;
  });

  protected readonly canExpand = computed(() => {
    const root = this.tree();
    if (!root || this.searching()) return false;
    let expandable = false;
    const walk = (node: NetworkNode): void => {
      if (this.hasChildren(node) && node.id !== root.id && !this.expanded().has(node.id)) expandable = true;
      for (const child of node.children ?? []) walk(child);
    };
    walk(root);
    return expandable;
  });

  protected readonly canCollapse = computed(() => {
    if (this.searching()) return false;
    const rootId = this.tree()?.id;
    return Array.from(this.expanded()).some((id) => id !== rootId);
  });

  ngOnInit(): void {
    this.compensation.plan().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => this.plan.set(res.data ?? null),
      error: () => this.plan.set(null),
    });
    const me = this.auth.currentUser()?.id;
    if (!me) {
      this.error.set('Session expired. Please sign in again.');
      this.loading.set(false);
      return;
    }
    this.rootId.set(me);
    this.reload();
  }

  protected reload(): void {
    const root = this.rootId();
    if (!root) return;
    this.loading.set(true);
    this.error.set(null);
    this.network.tree(root, this.depth(), 'all' as NetworkChain)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.tree.set(res.data.tree);
          this.meta.set(res.data.meta);
          this.expanded.set(new Set());
          this.matchIdx.set(0);
          this.loading.set(false);
          this.refreshPresence(res.data.tree);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
    this.uplineReady.set(false);
    this.network.upline(root, 'all' as NetworkChain)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const chain = [...(res.data.chain ?? [])].reverse();
          this.upline.set(chain);
          this.uplineReady.set(true);
          const immediate = chain[chain.length - 1];
          if (immediate) this.refreshPresenceIds([immediate.id]);
        },
        error: () => {
          this.upline.set([]);
          this.uplineReady.set(true);
        },
      });
  }

  protected focus(partnerId: string): void {
    this.rootId.set(partnerId);
    this.tree.set(null);
    this.meta.set(null);
    this.upline.set([]);
    this.expanded.set(new Set());
    this.search.set('');
    this.matchIdx.set(0);
    this.reload();
  }

  protected back(): void {
    const id = this.parentId();
    if (id) this.focus(id);
  }

  protected backToMyTree(): void {
    const me = this.auth.currentUser()?.id;
    if (me) this.focus(me);
  }

  protected setDepth(value: number): void {
    if (!Number.isFinite(value)) return;
    this.depth.set(value);
    this.reload();
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.matchIdx.set(0);
  }

  protected clearSearch(): void {
    this.search.set('');
    this.matchIdx.set(0);
  }

  protected stepMatch(dir: 1 | -1): void {
    const list = this.matches();
    if (list.length === 0) return;
    const next = (this.matchIdx() + dir + list.length) % list.length;
    this.matchIdx.set(next);
    if (typeof document === 'undefined') return;
    const target = document.getElementById(`network-node-${list[next].id}`);
    const behavior: ScrollBehavior = typeof matchMedia !== 'undefined'
      && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    target?.scrollIntoView({ behavior, block: 'center' });
  }

  protected toggle(node: NetworkNode): void {
    if (!this.hasChildren(node) || this.searching()) return;
    const next = new Set(this.expanded());
    if (next.has(node.id)) next.delete(node.id);
    else next.add(node.id);
    this.expanded.set(next);
  }

  protected expandAll(): void {
    const root = this.tree();
    if (!root) return;
    const ids = new Set<string>();
    const walk = (node: NetworkNode): void => {
      if (this.hasChildren(node)) {
        ids.add(node.id);
        for (const child of node.children) walk(child);
      }
    };
    walk(root);
    this.expanded.set(ids);
  }

  protected collapseBranches(): void {
    this.expanded.set(new Set());
  }

  protected hasChildren(node: NetworkNode): boolean {
    return (node.children?.length ?? 0) > 0;
  }

  protected isExpanded(node: NetworkNode): boolean {
    if (this.searching()) return true;
    if (node.id === this.tree()?.id) return true;
    return this.expanded().has(node.id);
  }

  protected isMatch(node: NetworkNode): boolean {
    const q = this.search().trim().toLowerCase().replace(/^@/, '');
    if (!q) return false;
    return `${node.username} ${node.name} ${node.surname}`.toLowerCase().includes(q);
  }

  protected rankTone(rank: string): NetworkRankTone {
    switch (rank) {
      case 'Builder': return 'builder';
      case 'Leader': return 'leader';
      case 'Ambassador': return 'ambassador';
      default: return 'partner';
    }
  }

  protected levelState(depth: number): NetworkLevelTone {
    if (depth > 5) return 'view';
    return depth <= this.rootDepth() ? 'earning' : 'locked';
  }

  protected levelLabel(depth: number): string {
    if (depth > 5) return `L${depth} · view only`;
    const rate = this.rateFor(depth);
    return depth <= this.rootDepth() ? `L${depth} · ${rate}%` : `L${depth} · locked`;
  }

  protected earningNote(depth: number): string {
    if (depth > 5) return `Generation ${depth} is beyond Level 5 — view only, no commission.`;
    if (depth <= this.rootDepth()) return `Earns ${this.rateFor(depth)}% at Level ${depth}.`;
    return `Locked. ${this.unlockRank(depth)} unlocks Level ${depth}.`;
  }

  protected rateFor(level: number): number {
    return (this.plan() ?? FALLBACK_PLAN).rates.find((r) => r.level === level)?.percent ?? 0;
  }

  protected unlockRank(level: number): string {
    return this.ranks().find((r) => r.depth >= level)?.rank ?? 'A higher rank';
  }

  protected levelRange(from: number, to: number): string {
    return from >= to ? `Level ${from}` : `Levels ${from}–${to}`;
  }

  protected depthLabel(depth: number): string {
    return depth <= 1 ? 'Level 1' : `Levels 1–${depth}`;
  }

  protected relationLabel(node: Pick<NetworkNode, 'relationType'>): string {
    return node.relationType === 'placement' ? 'Campaign placement' : 'Referral';
  }

  protected names(node: { name: string; surname: string; username: string }): string {
    return this.network.displayName(node);
  }

  protected shortName(node: NetworkNode): string {
    const full = this.names(node);
    return full.length > 18 ? `${full.slice(0, 17)}…` : full;
  }

  protected avatarUrl(photo: string | null | undefined): string | null {
    const raw = String(photo ?? '').trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${this.baseUrl}/uploads/${raw.replace(/^\/+/, '')}`;
  }

  protected presenceOf(id: string | null | undefined): PresenceStatus {
    if (!id) return null;
    return this.presence.statusOf(this.presenceMap()[id] ?? null);
  }

  private refreshPresence(root: NetworkNode | null): void {
    if (!root) return;
    const ids: string[] = [];
    const queue: NetworkNode[] = [root];
    while (queue.length > 0) {
      const node = queue.shift()!;
      ids.push(node.id);
      for (const child of node.children ?? []) queue.push(child);
    }
    this.presence.lookup(ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((map) => this.presenceMap.update((current) => ({ ...current, ...map })));
  }

  private refreshPresenceIds(ids: string[]): void {
    if (ids.length === 0) return;
    this.presence.lookup(ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((map) => this.presenceMap.update((current) => ({ ...current, ...map })));
  }
}
