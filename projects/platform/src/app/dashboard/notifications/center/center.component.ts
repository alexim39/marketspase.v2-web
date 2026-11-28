import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { catchError, forkJoin, of } from 'rxjs';
import { NotificationService } from '../../../core/notifications/notification.service';
import {
  ActionInbox,
  CATEGORY_LABELS,
  NotificationPreferences,
  StoredNotificationItem,
} from '../../../core/notifications/notification.models';
import { ApiError, userError } from '../../../core/http/api-error';
import { NotificationDetailAction, NotificationDetailPaneComponent, NotificationDetailView } from './desktop/notification-detail-pane.component';
import { NotificationRowComponent, NotificationTone } from './desktop/notification-row.component';

const KIND_META: Record<string, { label: string }> = {
  followup: { label: 'Follow-up' },
  inactive: { label: 'Inactive' },
  conversion: { label: 'Conversion' },
  release: { label: 'Payout' },
  mention: { label: 'Mention' },
  prospect: { label: 'Prospects' },
  daily: { label: 'Daily' },
  goals: { label: 'Goals' },
  progression: { label: 'Progression' },
  promotion: { label: 'Promotions' },
  commission: { label: 'Commissions' },
  training: { label: 'Training' },
  community: { label: 'Community' },
  recognition: { label: 'Recognition' },
  team: { label: 'Team' },
  system: { label: 'System' },
  marketing: { label: 'Marketing' },
  birthday: { label: 'Birthday' },
};

type GroupKey = 'prospects' | 'community' | 'training' | 'goals' | 'team' | 'commissions' | 'system';

const GROUP_OF: Record<string, GroupKey> = {
  followup: 'prospects', inactive: 'prospects', conversion: 'prospects', prospect: 'prospects', daily: 'prospects',
  mention: 'community', community: 'community', recognition: 'community', birthday: 'community',
  training: 'training', progression: 'training',
  goals: 'goals',
  team: 'team', promotion: 'team',
  release: 'commissions', commission: 'commissions',
  system: 'system', marketing: 'system',
};

const GROUP_LABELS: Record<GroupKey, string> = {
  prospects: 'Prospects', community: 'Community', training: 'Training', goals: 'Goals',
  team: 'Team', commissions: 'Commissions', system: 'System',
};

const GROUP_CATEGORIES: Record<GroupKey, string[]> = {
  prospects: ['prospect', 'daily', 'followup', 'inactive', 'conversion'],
  community: ['community', 'recognition', 'birthday', 'mention'],
  training: ['training', 'progression'],
  goals: ['goals'],
  team: ['team', 'promotion'],
  commissions: ['commission', 'release'],
  system: ['system', 'marketing'],
};

const KIND_CLASS: Record<string, NotificationTone> = {
  followup: 'info', inactive: 'warn', conversion: 'ok', release: 'purple',
  mention: 'warn', prospect: 'info', daily: 'info', goals: 'ok',
  progression: 'ok', promotion: 'purple', commission: 'purple',
  training: 'info', community: 'warn', recognition: 'warn', team: 'warn',
  system: 'neutral', marketing: 'neutral', birthday: 'warn',
};

interface DayBucket { label: string; items: StoredNotificationItem[]; }

const MAX_LOADED_STORED = 500;

/**
 * Desktop notification centre — three-pane inbox.
 *
 * Folder rail for views/categories, scannable grouped feed in the middle and
 * a sticky reading pane with complete actions on the right. Bulk actions,
 * search, cursor history, action inbox and engagement stats stay available.
 */
@Component({
  selector: 'async-notifications-center',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule, MatIconModule, MatMenuModule, NotificationDetailPaneComponent,
    NotificationRowComponent, PageSkeletonComponent, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>Notifications</span>
      </div>
    </section>

    <section class="center-page">
      <header class="page-hero">
        <div class="hero-copy">
          <p class="eyebrow">Inbox · Alerts &amp; actions</p>
          <h1>Notifications</h1>
          <p class="subtitle">
            @if (urgent().length > 0) {
              <strong class="urgent">{{ urgent().length }} need action now.</strong>
              <span>Each item tells you what to do next.</span>
            } @else {
              You're all caught up on urgent items.
            }
          </p>
          @if (statsLine(); as stats) { <p class="stats-line">{{ stats }}</p> }
        </div>
        <div class="head-actions">
          @if (unreadTotal() > 0) {
            <button mat-flat-button color="primary" type="button" (click)="markAllRead()" [disabled]="markingAll() || loading()">
              <mat-icon>done_all</mat-icon> Mark all read
            </button>
          }
          <button mat-stroked-button type="button" [matMenuTriggerFor]="manageMenu">
            <mat-icon>tune</mat-icon> Manage
          </button>
          <a mat-icon-button routerLink="/dashboard/notifications/preferences" aria-label="Notification settings">
            <mat-icon>settings</mat-icon>
          </a>
          <button mat-icon-button type="button" (click)="reload()" [disabled]="loading()" aria-label="Refresh notifications">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      </header>

      <mat-menu #manageMenu="matMenu">
        <button mat-menu-item type="button" (click)="markAllRead()" [disabled]="markingAll() || loading() || unreadTotal() === 0">
          <mat-icon>done_all</mat-icon> Mark all read
        </button>
        <button mat-menu-item type="button" (click)="archiveAll()" [disabled]="markingAll() || loading() || storedCount() === 0">
          <mat-icon>archive</mat-icon> Archive all
        </button>
        <button mat-menu-item type="button" (click)="requestDeleteAll()" [disabled]="markingAll() || loading() || storedCount() === 0">
          <mat-icon>delete_sweep</mat-icon> Delete all
        </button>
        <a mat-menu-item routerLink="/dashboard/notifications/preferences">
          <mat-icon>settings</mat-icon> Notification settings
        </a>
      </mat-menu>

      @if (confirmBulkDelete()) {
        <div class="confirm-banner" role="alert">
          <mat-icon>delete_forever</mat-icon>
          <div><strong>Delete all stored notifications?</strong><span>Saved alerts will be removed. Live action reminders remain in the action inbox.</span></div>
          <button mat-flat-button color="warn" type="button" (click)="deleteAll()" [disabled]="markingAll()">Delete all</button>
          <button mat-button type="button" (click)="confirmBulkDelete.set(false)">Cancel</button>
        </div>
      }

      @if (notice(); as note) {
        <div class="notice-banner" role="status">
          <mat-icon>check_circle</mat-icon>
          <span>{{ note }}</span>
          <button mat-icon-button type="button" (click)="notice.set(null)" aria-label="Dismiss"><mat-icon>close</mat-icon></button>
        </div>
      }

      @if (initialLoading()) {
        <async-page-skeleton layout="list" [rows]="5" label="notifications" [showHeader]="false" />
      }

      @if (loading() && loadedOnce()) {
        <div class="loading-strip" role="status" aria-label="Updating notifications"></div>
      }

      @if (error(); as err) {
        <div class="alert" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>{{ err }}</p>
          <button mat-stroked-button type="button" (click)="reload()">Retry</button>
        </div>
      }

      @if (!initialLoading()) {
        @if (totalCount() > 0) {
          <section class="summary-strip" aria-label="Notification summary">
            <div class="summary-card"><span class="summary-icon"><mat-icon>notifications</mat-icon></span><div><strong>{{ totalCount() }}</strong><span>Total</span><small>All visible updates</small></div></div>
            <div class="summary-card"><span class="summary-icon summary-icon--warn"><mat-icon>mark_email_unread</mat-icon></span><div><strong>{{ unreadTotal() }}</strong><span>Unread</span><small>Not opened yet</small></div></div>
            <div class="summary-card"><span class="summary-icon summary-icon--bad"><mat-icon>bolt</mat-icon></span><div><strong>{{ urgentCount() }}</strong><span>Urgent</span><small>Needs action now</small></div></div>
            <div class="summary-card"><span class="summary-icon summary-icon--ok"><mat-icon>inbox</mat-icon></span><div><strong>{{ storedCount() }}</strong><span>Saved alerts</span><small>Can be archived or deleted</small></div></div>
          </section>
        }

        @if (inbox()?.items?.length) {
          <section class="action-inbox" aria-label="Resolve this next">
            <div class="inbox-head">
              <div><p class="eyebrow">Action inbox</p><h2>Resolve this next</h2></div>
              <span class="inbox-count">{{ inbox()?.total }}</span>
            </div>
            <div class="inbox-grid">
              @for (item of inbox()?.items; track item.id) {
                <a class="inbox-card" [class.inbox-card--high]="item.priority === 'high' || item.priority === 'critical'" [routerLink]="item.link">
                  <span class="inbox-icon"><mat-icon>{{ inboxIcon(item.category) }}</mat-icon></span>
                  <span class="inbox-copy">
                    <span class="inbox-meta">{{ item.count }} · {{ item.priority }}</span>
                    <strong>{{ item.title }}</strong>
                    <span>{{ item.detail }}</span>
                    <span class="inbox-cta">{{ item.actionLabel }} <mat-icon>arrow_forward</mat-icon></span>
                  </span>
                </a>
              }
            </div>
          </section>
        }

        <div class="workspace">
          <aside class="filters-pane" aria-label="Notification filters">
            <div class="filter-group">
              <p class="filter-label">Views</p>
              <button type="button" class="filter-item" [class.is-active]="!unreadOnly() && !groupFilter() && !search()" (click)="showAll()">
                <mat-icon>inbox</mat-icon><span>All notifications</span><span class="filter-count">{{ totalCount() }}</span>
              </button>
              <button type="button" class="filter-item" [class.is-active]="unreadOnly()" (click)="showUnread()">
                <mat-icon>mark_email_unread</mat-icon><span>Unread</span><span class="filter-count">{{ unreadTotal() }}</span>
              </button>
            </div>
            <div class="filter-group">
              <p class="filter-label">Categories</p>
              @for (group of groupKeys; track group) {
                <button type="button" class="filter-item" [class.is-active]="groupFilter() === group" (click)="selectGroup(group)">
                  <mat-icon>{{ groupIcon(group) }}</mat-icon><span>{{ groupLabel(group) }}</span><span class="filter-count">{{ groupCount()(group) }}</span>
                </button>
              }
            </div>
            <a mat-stroked-button routerLink="/dashboard/notifications/preferences" class="settings-link"><mat-icon>settings</mat-icon> Notification settings</a>
          </aside>

          <section class="feed-pane" aria-label="Notification feed">
            <header class="feed-head">
              <div class="feed-title">
                <p class="eyebrow">Inbox</p>
                <h2>{{ feedTitle() }}</h2>
                <span>{{ all().length }} notification{{ all().length === 1 ? '' : 's' }}</span>
              </div>
              <div class="search-box">
                <mat-icon aria-hidden="true">search</mat-icon>
                <input type="search" placeholder="Search notifications…" [value]="search()" (input)="onSearchInput($any($event.target).value)" (keyup.enter)="reload()" aria-label="Search notifications" />
                @if (search()) {
                  <button type="button" class="search-clear" (click)="clearSearch()" aria-label="Clear search"><mat-icon>close</mat-icon></button>
                }
              </div>
            </header>

            <div class="compact-rail" role="group" aria-label="Notification filters">
              <button type="button" class="compact-chip" [class.is-active]="!unreadOnly() && !groupFilter() && !search()" (click)="showAll()">All <span>{{ totalCount() }}</span></button>
              <button type="button" class="compact-chip" [class.is-active]="unreadOnly()" (click)="showUnread()">Unread <span>{{ unreadTotal() }}</span></button>
              @for (group of groupKeys; track group) {
                <button type="button" class="compact-chip" [class.is-active]="groupFilter() === group" (click)="selectGroup(group)">{{ groupLabel(group) }} <span>{{ groupCount()(group) }}</span></button>
              }
            </div>

            @if (urgent().length > 0) {
              <h3 class="group-head group-head--urgent"><span><mat-icon>bolt</mat-icon> Needs action now</span><span class="count">{{ urgent().length }}</span></h3>
              <div class="notif-list">
                @for (item of urgent(); track item.id) {
                  <async-notification-row
                    [item]="item"
                    [kindLabel]="chip(item.kind).label"
                    [kindTone]="kindTone(item.kind)"
                    [timeLabel]="timeAgo(item.at)"
                    [categoryLabel]="categoryLabel(item.kind)"
                    [selected]="selectedId() === item.id"
                    (selectedChange)="select($event)" />
                }
              </div>
            }

            @for (bucket of buckets(); track bucket.label) {
              <h3 class="group-head"><span>{{ bucket.label }}</span><span class="count">{{ bucket.items.length }}</span></h3>
              <div class="notif-list">
                @for (item of bucket.items; track item.id) {
                  <async-notification-row
                    [item]="item"
                    [kindLabel]="chip(item.kind).label"
                    [kindTone]="kindTone(item.kind)"
                    [timeLabel]="timeAgo(item.at)"
                    [categoryLabel]="categoryLabel(item.kind)"
                    [selected]="selectedId() === item.id"
                    (selectedChange)="select($event)" />
                }
              </div>
            }

            @if (!loading() && !error() && urgent().length === 0 && buckets().length === 0) {
              <div class="empty-card">
                <mat-icon>inbox</mat-icon>
                <h3>{{ unreadOnly() ? 'Nothing unread' : 'Nothing here yet' }}</h3>
                <p>{{ unreadOnly() ? 'You are all caught up in this view.' : 'Follow-ups, payouts, goals and team news will land in this feed.' }}</p>
                @if (unreadOnly() || groupFilter() || search()) {
                  <button mat-stroked-button type="button" (click)="showAll()">Clear filters</button>
                } @else {
                  <a mat-stroked-button routerLink="/dashboard">Back to dashboard</a>
                }
              </div>
            }

            @if (urgent().length > 0 || buckets().length > 0) {
              @if (loadCapReached()) {
                <p class="load-cap"><mat-icon>info</mat-icon> Showing the latest {{ maxLoaded }} saved alerts. Use search or a category to reach older records.</p>
              } @else if (hasMore()) {
                <button mat-stroked-button class="load-more" type="button" (click)="loadMore()" [disabled]="loadingMore() || loading()">{{ loadingMore() ? 'Loading…' : 'Load older notifications' }}</button>
              }
              <p class="feed-foot">Showing {{ stored().length }} of {{ storedCount() }} saved alerts · {{ derived().length }} live items</p>
            }
          </section>

          <async-notification-detail-pane
            [view]="selectedView()"
            [canStep]="canStep()"
            [busy]="busyId() === selectedId()"
            (action)="handleDetailAction($event)"
            (step)="stepSelection($event)"
            (closed)="clearSelection()" />
        </div>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .center-page { display: flex; flex-direction: column; gap: 14px; max-width: 1340px; margin: 0 auto; padding-bottom: 40px; }

    .page-hero { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap; padding: 18px 20px; border: 1px solid color-mix(in srgb, var(--ms-primary) 16%, var(--ms-line)); border-radius: 16px; background: linear-gradient(125deg, var(--ms-primary-soft), var(--ms-surface) 62%); }
    .hero-copy { min-width: 0; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .hero-copy h1 { margin: 4px 0 6px; font-size: clamp(1.8rem, 2.6vw, 2.2rem); letter-spacing: -0.03em; }
    .subtitle { margin: 0; color: var(--ms-text-muted); font-size: 0.9rem; line-height: 1.5; }
    .subtitle .urgent { color: var(--ms-error); }
    .stats-line { margin: 6px 0 0; color: var(--ms-text-muted); font-size: 0.72rem; }
    .head-actions { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
    .head-actions button, .head-actions a { min-height: 42px; }
    .head-actions mat-icon { margin-right: 4px; }
    .head-actions > a[mat-icon-button] mat-icon, .head-actions > button[mat-icon-button] mat-icon { margin-right: 0; }

    .confirm-banner, .notice-banner, .alert { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 11px 14px; border-radius: 12px; }
    .confirm-banner { background: var(--ms-error-soft); color: var(--ms-error); }
    .confirm-banner > div { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 240px; }
    .confirm-banner strong { font-size: 0.84rem; }
    .confirm-banner span { color: var(--ms-text-muted); font-size: 0.74rem; line-height: 1.4; }
    .confirm-banner button, .alert button { min-height: 40px; }
    .notice-banner { background: var(--ms-success-soft); color: var(--ms-success); font-size: 0.8rem; }
    .notice-banner span { flex: 1; min-width: 200px; line-height: 1.4; }
    .notice-banner button { flex: none; color: currentColor; }
    .alert { background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { flex: 1; min-width: 200px; margin: 0; font-size: 0.82rem; }

    .loading-strip { position: relative; height: 3px; overflow: hidden; border-radius: 999px; background: var(--ms-line); }
    .loading-strip::after { content: ''; position: absolute; inset: 0; width: 38%; border-radius: inherit; background: var(--ms-primary); animation: slide-bar 1.05s ease-in-out infinite; }

    .summary-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 8px; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); }
    .summary-card { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border-radius: 10px; }
    .summary-icon { width: 34px; height: 34px; flex: none; display: grid; place-items: center; border-radius: 9px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .summary-icon--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .summary-icon--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .summary-icon--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .summary-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .summary-card > div { display: flex; flex-direction: column; gap: 0; min-width: 0; }
    .summary-card strong { font-family: var(--ms-font-display); font-size: 1.35rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .summary-card span:last-of-type { color: var(--ms-text-muted); font-size: 0.7rem; font-weight: 650; }
    .summary-card small { color: var(--ms-text-muted); font-size: 0.63rem; }

    .action-inbox { display: flex; flex-direction: column; gap: 8px; padding: 14px; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); }
    .inbox-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
    .inbox-head h2 { margin: 2px 0 0; font-size: 1.05rem; }
    .inbox-count { display: inline-grid; place-items: center; min-width: 26px; height: 26px; padding: 0 8px; border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; }
    .inbox-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .inbox-card { display: flex; align-items: flex-start; gap: 9px; padding: 10px; border: 1px solid var(--ms-line); border-left: 3px solid var(--ms-primary); border-radius: 10px; background: var(--ms-canvas); color: var(--ms-text); text-decoration: none; }
    .inbox-card:hover { border-color: var(--ms-primary); }
    .inbox-card--high { border-left-color: var(--ms-warning); background: color-mix(in srgb, var(--ms-warning-soft) 35%, var(--ms-canvas)); }
    .inbox-icon { display: grid; place-items: center; flex: none; width: 34px; height: 34px; border-radius: 9px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .inbox-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .inbox-copy { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
    .inbox-meta { color: var(--ms-text-muted); font-size: 0.6rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
    .inbox-copy strong { font-size: 0.84rem; line-height: 1.3; }
    .inbox-copy > span:not(.inbox-meta, .inbox-cta) { color: var(--ms-text-muted); font-size: 0.73rem; line-height: 1.45; }
    .inbox-cta { display: inline-flex; align-items: center; gap: 2px; margin-top: 2px; color: var(--ms-primary-strong); font-size: 0.68rem; font-weight: 800; }
    .inbox-cta mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .workspace { display: grid; grid-template-columns: minmax(0, 1fr) 356px; gap: 14px; align-items: start; }
    .filters-pane { position: sticky; top: 88px; display: none; flex-direction: column; gap: 14px; padding: 11px; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); }
    .filter-group { display: flex; flex-direction: column; gap: 2px; }
    .filter-label { margin: 0 0 3px; padding: 0 6px; color: var(--ms-text-muted); font-size: 0.62rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
    .filter-item { display: flex; align-items: center; gap: 7px; width: 100%; min-height: 38px; padding: 7px 8px; border: 1px solid transparent; border-radius: 9px; background: transparent; color: var(--ms-text); font: inherit; font-size: 0.78rem; font-weight: 600; text-align: left; cursor: pointer; }
    .filter-item:hover { background: var(--ms-canvas); }
    .filter-item.is-active { border-color: color-mix(in srgb, var(--ms-primary) 26%, var(--ms-line)); background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 750; }
    .filter-item mat-icon { flex: none; color: var(--ms-text-muted); font-size: 17px; width: 17px; height: 17px; }
    .filter-item.is-active mat-icon { color: var(--ms-primary-strong); }
    .filter-item > span:nth-child(2) { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .filter-count { display: inline-grid; place-items: center; min-width: 22px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.63rem; font-weight: 800; font-variant-numeric: tabular-nums; }
    .filter-item.is-active .filter-count { background: var(--ms-surface); color: var(--ms-primary-strong); }
    .settings-link { width: 100%; min-height: 40px; margin-top: 2px; }

    .feed-pane { display: flex; flex-direction: column; gap: 7px; min-width: 0; min-height: 560px; padding: 12px; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); }
    .feed-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-bottom: 9px; border-bottom: 1px solid var(--ms-line); }
    .feed-title { min-width: 0; }
    .feed-title h2 { margin: 2px 0 0; font-size: 1.08rem; }
    .feed-title > span { color: var(--ms-text-muted); font-size: 0.7rem; }
    .search-box { display: flex; align-items: center; gap: 6px; flex: 0 1 300px; min-width: 210px; min-height: 40px; padding: 0 8px 0 10px; border: 1px solid var(--ms-line); border-radius: 10px; background: var(--ms-canvas); }
    .search-box:focus-within { border-color: var(--ms-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ms-primary) 14%, transparent); }
    .search-box > mat-icon { flex: none; color: var(--ms-text-muted); font-size: 18px; width: 18px; height: 18px; }
    .search-box input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--ms-text); font: inherit; font-size: 0.8rem; }
    .search-box input::placeholder { color: var(--ms-text-muted); }
    .search-box input::-webkit-search-cancel-button { display: none; }
    .search-clear { flex: none; width: 26px; height: 26px; display: grid; place-items: center; border: 0; border-radius: 50%; background: var(--ms-surface); color: var(--ms-text-muted); cursor: pointer; }
    .search-clear mat-icon { font-size: 15px; width: 15px; height: 15px; }

    .compact-rail { display: flex; gap: 5px; padding: 2px 0 4px; overflow-x: auto; scrollbar-width: none; }
    .compact-rail::-webkit-scrollbar { display: none; }
    .compact-chip { display: inline-flex; align-items: center; gap: 4px; flex: none; min-height: 32px; padding: 0 9px; border: 1px solid var(--ms-line); border-radius: 999px; background: var(--ms-surface); color: var(--ms-text-muted); font: inherit; font-size: 0.7rem; font-weight: 650; white-space: nowrap; cursor: pointer; }
    .compact-chip.is-active { border-color: var(--ms-primary); background: var(--ms-primary); color: var(--ms-ink); }
    .compact-chip > span { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.6rem; font-weight: 800; }
    .compact-chip.is-active > span { background: color-mix(in srgb, var(--ms-surface) 78%, transparent); color: var(--ms-text); }

    .group-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 3px 0 0; padding: 2px 3px; color: var(--ms-text-muted); font-size: 0.66rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
    .group-head > span:first-child { display: inline-flex; align-items: center; gap: 4px; }
    .group-head mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .group-head--urgent { color: var(--ms-error); }
    .group-head .count { display: inline-grid; place-items: center; min-width: 22px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.62rem; letter-spacing: 0; }
    .notif-list { display: flex; flex-direction: column; gap: 3px; }

    .empty-card { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 34px 18px; text-align: center; border: 1px dashed var(--ms-line-strong); border-radius: 12px; background: var(--ms-surface); }
    .empty-card mat-icon { font-size: 36px; width: 36px; height: 36px; color: var(--ms-text-muted); opacity: 0.7; }
    .empty-card h3 { margin: 0; font-size: 1rem; }
    .empty-card p { margin: 0; max-width: 32em; color: var(--ms-text-muted); font-size: 0.8rem; line-height: 1.5; }
    .empty-card a, .empty-card button { min-height: 40px; margin-top: 2px; }

    .load-more { align-self: center; min-width: 240px; min-height: 40px; margin-top: 4px; }
    .load-cap { display: flex; align-items: flex-start; gap: 5px; margin: 3px 0; padding: 8px 10px; border-radius: 9px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.7rem; line-height: 1.4; }
    .load-cap mat-icon { flex: none; margin-top: 1px; font-size: 15px; width: 15px; height: 15px; }
    .feed-foot { margin: 0; text-align: center; color: var(--ms-text-muted); font-size: 0.66rem; }

    @media (min-width: 1350px) {
      .workspace { grid-template-columns: 226px minmax(0, 1fr) 356px; }
      .filters-pane { display: flex; }
      .compact-rail { display: none; }
    }
    @media (max-width: 1000px) {
      .workspace { grid-template-columns: minmax(0, 1fr) 320px; }
      .summary-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 900px) {
      .workspace { grid-template-columns: minmax(0, 1fr); }
      .summary-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .inbox-grid { grid-template-columns: 1fr; }
      .page-hero { flex-direction: column; }
      .head-actions { width: 100%; }
    }
    @media (prefers-reduced-motion: reduce) {
      .loading-strip::after { animation: none; width: 100%; opacity: 0.5; }
    }
    @keyframes slide-bar { 0% { transform: translateX(-110%); } 100% { transform: translateX(290%); } }
  `],
})
export class NotificationsCenterComponent implements OnInit {
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly loadedOnce = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly stored = signal<StoredNotificationItem[]>([]);
  protected readonly derived = signal<StoredNotificationItem[]>([]);
  protected readonly hasMore = signal(false);
  protected readonly cursor = signal<string | null>(null);
  protected readonly prefs = signal<NotificationPreferences | null>(null);
  protected readonly inbox = signal<ActionInbox | null>(null);
  protected readonly summary = signal<{ total: number; unread: number; categories: Record<string, number> } | null>(null);
  protected readonly statsLine = signal<string | null>(null);
  protected readonly unreadOnly = signal(false);
  protected readonly groupFilter = signal<GroupKey | null>(null);
  protected readonly search = signal('');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly busyId = signal<string | null>(null);
  protected readonly confirmBulkDelete = signal(false);
  protected readonly markingAll = signal(false);
  protected readonly maxLoaded = MAX_LOADED_STORED;
  protected readonly groupKeys: GroupKey[] = ['prospects', 'community', 'training', 'goals', 'team', 'commissions', 'system'];

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly all = computed(() => {
    const group = this.groupFilter();
    return [...this.stored(), ...this.derived()]
      .filter((item) => !group || GROUP_OF[item.kind] === group)
      .sort((a, b) => +new Date(b.at) - +new Date(a.at));
  });

  protected readonly groupCount = computed(() => {
    const counts = {} as Record<GroupKey, number>;
    for (const group of this.groupKeys) counts[group] = 0;
    const categories = this.summary()?.categories ?? {};
    const categoryToGroup = new Map<string, GroupKey>();
    for (const group of this.groupKeys) {
      for (const category of GROUP_CATEGORIES[group]) categoryToGroup.set(category, group);
    }
    for (const [category, count] of Object.entries(categories)) {
      const group = categoryToGroup.get(category);
      if (group) counts[group] += Number(count) || 0;
    }
    for (const item of this.derived()) {
      const group = GROUP_OF[item.kind];
      if (group) counts[group] += 1;
    }
    return (group: GroupKey) => counts[group] ?? 0;
  });

  protected readonly urgent = computed(() => this.all().filter((item) => item.urgency && !item.read));
  protected readonly urgentCount = computed(() => this.urgent().length);
  protected readonly storedCount = computed(() => this.summary()?.total ?? this.stored().length);
  protected readonly loadCapReached = computed(() => this.stored().length >= MAX_LOADED_STORED);
  protected readonly totalCount = computed(() => this.storedCount() + this.derived().length);
  protected readonly unreadTotal = computed(() => (
    (this.summary()?.unread ?? this.stored().filter((item) => !item.read).length)
    + this.derived().filter((item) => !item.read).length
  ));
  protected readonly initialLoading = computed(() => this.loading() && !this.loadedOnce());

  protected readonly buckets = computed<DayBucket[]>(() => {
    const rest = this.all().filter((item) => !(item.urgency && !item.read));
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const buckets: DayBucket[] = [
      { label: 'Today', items: [] },
      { label: 'Yesterday', items: [] },
      { label: 'This week', items: [] },
      { label: 'Earlier', items: [] },
    ];
    for (const item of rest) {
      const time = +new Date(item.at);
      if (Number.isNaN(time) || time >= startOfToday) buckets[0].items.push(item);
      else if (time >= startOfToday - 86400000) buckets[1].items.push(item);
      else if (time >= startOfToday - 7 * 86400000) buckets[2].items.push(item);
      else buckets[3].items.push(item);
    }
    return buckets.filter((bucket) => bucket.items.length > 0);
  });

  protected readonly selected = computed(() => {
    const id = this.selectedId();
    return id ? this.all().find((item) => item.id === id) ?? null : null;
  });

  protected readonly selectedView = computed<NotificationDetailView | null>(() => {
    const item = this.selected();
    if (!item) return null;
    return {
      item,
      kindLabel: this.chip(item.kind).label,
      kindTone: this.kindTone(item.kind),
      categoryLabel: this.categoryLabel(item.kind),
      timeLabel: this.timeAgo(item.at),
    };
  });

  protected readonly canStep = computed(() => this.all().length > 1);

  protected readonly feedTitle = computed(() => {
    if (this.search().trim()) return 'Search results';
    const group = this.groupFilter();
    if (this.unreadOnly() && group) return `Unread · ${this.groupLabel(group)}`;
    if (this.unreadOnly()) return 'Unread notifications';
    if (group) return this.groupLabel(group);
    return 'All notifications';
  });

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
    });
    this.reload();
  }

  protected timeAgo(iso: string): string {
    const mins = Math.max(0, Math.round((Date.now() - +new Date(iso)) / 60000));
    if (!Number.isFinite(mins)) return '';
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  protected onSearchInput(value: string): void {
    this.search.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.reload();
    }, 350);
  }

  protected clearSearch(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.search.set('');
    this.reload();
  }

  protected showAll(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.unreadOnly.set(false);
    this.groupFilter.set(null);
    this.search.set('');
    this.reload();
  }

  protected showUnread(): void {
    this.unreadOnly.update((value) => !value);
    this.reload();
  }

  protected selectGroup(group: GroupKey): void {
    this.groupFilter.set(this.groupFilter() === group ? null : group);
    this.reload();
  }

  protected select(item: StoredNotificationItem): void {
    this.selectedId.set(item.id);
  }

  protected clearSelection(): void {
    this.selectedId.set(null);
  }

  protected stepSelection(dir: 1 | -1): void {
    const list = this.all();
    if (list.length === 0) return;
    const current = this.selectedId();
    const index = current ? list.findIndex((item) => item.id === current) : -1;
    const next = index < 0 ? 0 : (index + dir + list.length) % list.length;
    this.selectedId.set(list[next].id);
  }

  protected groupLabel(group: GroupKey): string {
    return GROUP_LABELS[group];
  }

  protected groupIcon(group: GroupKey): string {
    switch (group) {
      case 'prospects': return 'person_search';
      case 'community': return 'forum';
      case 'training': return 'school';
      case 'goals': return 'flag';
      case 'team': return 'groups';
      case 'commissions': return 'payments';
      default: return 'settings';
    }
  }

  protected chip(kind: string): { label: string } {
    return KIND_META[kind] ?? { label: kind };
  }

  protected kindTone(kind: string): NotificationTone {
    return KIND_CLASS[kind] ?? 'neutral';
  }

  protected categoryLabel(kind: string): string {
    return CATEGORY_LABELS[kind] ?? this.chip(kind).label;
  }

  protected inboxIcon(category: string): string {
    switch (category) {
      case 'followup': return 'person_search';
      case 'reorder': return 'shopping_bag';
      case 'campaign': return 'campaign';
      case 'rank': return 'workspace_premium';
      case 'payout': return 'payments';
      default: return 'bolt';
    }
  }

  private selectedCategories(): string[] {
    const group = this.groupFilter();
    return group ? GROUP_CATEGORIES[group] : [];
  }

  private adjustSummary(kind: string, unreadDelta: number, totalDelta: number): void {
    this.summary.update((summary) => {
      if (!summary) return summary;
      const categories = { ...summary.categories };
      if (totalDelta !== 0) categories[kind] = Math.max(0, (categories[kind] ?? 0) + totalDelta);
      return {
        ...summary,
        unread: Math.max(0, summary.unread + unreadDelta),
        total: Math.max(0, summary.total + totalDelta),
        categories,
      };
    });
  }

  protected handleDetailAction(action: NotificationDetailAction): void {
    const item = this.selected();
    if (!item) return;
    switch (action) {
      case 'open':
        if (item.origin === 'stored') this.openStored(item);
        else if (item.link) void this.router.navigateByUrl(item.link);
        break;
      case 'read':
        this.markStoredRead(item);
        this.notice.set('Marked as read.');
        break;
      case 'unread':
        this.markUnread(item);
        this.notice.set('Marked as unread.');
        break;
      case 'archive':
        this.archiveStored(item.id);
        this.notice.set('Notification archived.');
        break;
      case 'delete':
        this.deleteStored(item.id);
        this.notice.set('Notification deleted.');
        break;
      case 'mute':
        this.muteCategory(item);
        break;
      case 'dismiss':
        this.dismiss(item.id);
        this.notice.set('Notification dismissed.');
        break;
    }
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.cursor.set(null);
    const params: { unread?: boolean; q?: string; limit?: number; categories?: string[] } = { limit: 50 };
    if (this.unreadOnly()) params.unread = true;
    if (this.search().trim()) params.q = this.search().trim();
    const categories = this.selectedCategories();
    if (categories.length > 0) params.categories = categories;
    forkJoin({
      list: this.notifications.list(params),
      prefs: this.notifications.getPreferences().pipe(catchError(() => of(null))),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ list, prefs }) => {
        const stored = list.data?.stored ?? [];
        this.stored.set(stored);
        this.derived.set(list.data?.derived ?? []);
        this.hasMore.set(list.data?.hasMore ?? false);
        this.cursor.set(stored.length > 0 ? stored[stored.length - 1].id : null);
        this.prefs.set(prefs?.data ?? null);
        this.summary.set(list.data?.summary ?? null);
        this.loading.set(false);
        this.loadedOnce.set(true);
      },
      error: (err: ApiError) => {
        this.error.set(userError(err));
        this.loading.set(false);
        this.loadedOnce.set(true);
      },
    });
    this.notifications.stats(30)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const totals = res.data?.totals;
          if (totals && totals.sent > 0) {
            this.statsLine.set(`Last 30 days: ${totals.readRate}% read · ${totals.clickRate}% clicked across ${totals.sent} updates.`);
          }
        },
        error: () => { /* stats never block the feed */ },
      });
    this.notifications.actionInbox()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.inbox.set(res.data ?? null),
        error: () => { /* action inbox never blocks the centre */ },
      });
  }

  protected loadMore(): void {
    const cursor = this.cursor();
    if (!cursor || this.loadingMore() || this.loading()) return;
    if (this.stored().length >= MAX_LOADED_STORED) {
      this.notice.set('Showing the latest 500 saved alerts. Use search or a category to narrow the list.');
      return;
    }
    this.loadingMore.set(true);
    this.error.set(null);
    const params: { unread?: boolean; q?: string; cursor?: string; limit?: number; categories?: string[] } = { limit: 50, cursor };
    if (this.unreadOnly()) params.unread = true;
    if (this.search().trim()) params.q = this.search().trim();
    const categories = this.selectedCategories();
    if (categories.length > 0) params.categories = categories;
    this.notifications.list(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const page = res.data?.stored ?? [];
          const next = [...this.stored(), ...page.filter((item) => !this.stored().some((known) => known.id === item.id))];
          this.stored.set(next);
          this.hasMore.set(res.data?.hasMore ?? false);
          this.cursor.set(next.length > 0 ? next[next.length - 1].id : null);
          this.loadingMore.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loadingMore.set(false);
        },
      });
  }

  protected openStored(item: StoredNotificationItem): void {
    if (!item.link) return;
    this.notifications.recordOpen(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const wasUnread = !item.read;
          this.stored.update((rows) => rows.map((row) => row.id === item.id ? { ...row, read: true } : row));
          if (wasUnread) this.adjustSummary(item.kind, -1, 0);
          void this.router.navigateByUrl(item.link as string);
        },
        error: () => {
          void this.router.navigateByUrl(item.link as string);
        },
      });
  }

  protected markStoredRead(item: StoredNotificationItem): void {
    this.busyId.set(item.id);
    this.notifications.markStoredRead(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyId.set(null);
          if (!item.read) {
            this.stored.update((rows) => rows.map((row) => row.id === item.id ? { ...row, read: true } : row));
            this.adjustSummary(item.kind, -1, 0);
          }
        },
        error: (err: ApiError) => {
          this.busyId.set(null);
          this.error.set(userError(err));
        },
      });
  }

  protected markUnread(item: StoredNotificationItem): void {
    this.busyId.set(item.id);
    this.notifications.markStoredUnread(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyId.set(null);
          if (item.read) {
            this.stored.update((rows) => rows.map((row) => row.id === item.id ? { ...row, read: false } : row));
            this.adjustSummary(item.kind, 1, 0);
          }
        },
        error: (err: ApiError) => {
          this.busyId.set(null);
          this.error.set(userError(err));
        },
      });
  }

  protected archiveStored(id: string): void {
    const item = this.stored().find((row) => row.id === id);
    this.busyId.set(id);
    this.notifications.archiveStored(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.stored.set(this.stored().filter((row) => row.id !== id));
          if (item) this.adjustSummary(item.kind, item.read ? 0 : -1, -1);
        },
        error: (err: ApiError) => {
          this.busyId.set(null);
          this.error.set(userError(err));
        },
      });
  }

  protected deleteStored(id: string): void {
    const item = this.stored().find((row) => row.id === id);
    this.busyId.set(id);
    this.notifications.deleteStored(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.stored.set(this.stored().filter((row) => row.id !== id));
          if (item) this.adjustSummary(item.kind, item.read ? 0 : -1, -1);
        },
        error: (err: ApiError) => {
          this.busyId.set(null);
          this.error.set(userError(err));
        },
      });
  }

  protected dismiss(id: string): void {
    this.busyId.set(id);
    this.notifications.markRead([id])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.derived.set(this.derived().filter((item) => item.id !== id));
        },
        error: (err: ApiError) => {
          this.busyId.set(null);
          this.error.set(userError(err));
        },
      });
  }

  protected muteCategory(item: StoredNotificationItem): void {
    const current = this.prefs();
    if (!current) {
      this.error.set('Preferences are still loading — try again in a moment.');
      return;
    }
    this.busyId.set(item.id);
    const channels = {
      ...current.channels,
      [item.kind]: { inApp: false, email: false, sms: false, push: false },
    };
    this.notifications.updatePreferences({ channels, emailDigest: current.emailDigest })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.prefs.set(res.data ?? this.prefs());
          this.notice.set(`You muted “${this.categoryLabel(item.kind)}” — future ones won't appear in-app. Change anytime in Notification settings.`);
          this.archiveStored(item.id);
        },
        error: (err: ApiError) => {
          this.busyId.set(null);
          this.error.set(userError(err));
        },
      });
  }

  protected requestDeleteAll(): void {
    this.confirmBulkDelete.set(true);
  }

  protected markAllRead(): void {
    if (this.unreadTotal() === 0) return;
    this.markingAll.set(true);
    this.notifications.bulk('read-all')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const ids = this.derived().map((item) => item.id);
          if (ids.length === 0) {
            this.markingAll.set(false);
            this.notice.set('All notifications marked as read.');
            this.reload();
            return;
          }
          this.notifications.markRead(ids)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                this.markingAll.set(false);
                this.notice.set('All notifications marked as read.');
                this.reload();
              },
              error: (err: ApiError) => {
                this.markingAll.set(false);
                this.error.set(userError(err));
              },
            });
        },
        error: (err: ApiError) => {
          this.markingAll.set(false);
          this.error.set(userError(err));
        },
      });
  }

  protected archiveAll(): void {
    if (this.storedCount() === 0) return;
    this.markingAll.set(true);
    this.notifications.bulk('archive-all')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.markingAll.set(false);
          this.notice.set('All saved notifications archived.');
          this.reload();
        },
        error: (err: ApiError) => {
          this.markingAll.set(false);
          this.error.set(userError(err));
        },
      });
  }

  protected deleteAll(): void {
    if (this.storedCount() === 0) return;
    this.markingAll.set(true);
    this.notifications.bulk('delete-all')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.markingAll.set(false);
          this.confirmBulkDelete.set(false);
          this.notice.set('Saved notifications deleted.');
          this.reload();
        },
        error: (err: ApiError) => {
          this.markingAll.set(false);
          this.error.set(userError(err));
        },
      });
  }
}
