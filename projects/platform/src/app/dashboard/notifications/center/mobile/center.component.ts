import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { catchError, forkJoin, of } from 'rxjs';
import { NotificationService } from '../../../../core/notifications/notification.service';
import {
  ActionInbox,
  CATEGORY_LABELS,
  NotificationPreferences,
  StoredNotificationItem,
} from '../../../../core/notifications/notification.models';
import { ApiError, userError } from '../../../../core/http/api-error';
import { NotificationCardComponent } from './notification-card.component';
import {
  NotificationDetailSheetComponent,
  NotificationSheetAction,
  NotificationSheetData,
} from './notification-detail-sheet.component';

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
type Tone = 'info' | 'warn' | 'ok' | 'purple' | 'bad' | 'neutral';

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

const KIND_CLASS: Record<string, Tone> = {
  followup: 'info', inactive: 'warn', conversion: 'ok', release: 'purple',
  mention: 'warn', prospect: 'info', daily: 'info', goals: 'ok',
  progression: 'ok', promotion: 'purple', commission: 'purple',
  training: 'info', community: 'warn', recognition: 'warn', team: 'warn',
  system: 'neutral', marketing: 'neutral', birthday: 'warn',
};

interface DayBucket { label: string; items: StoredNotificationItem[]; }

const MAX_LOADED_STORED = 500;

/** Native mobile notification centre: urgent first, day buckets, tap for actions. */
@Component({
  selector: 'async-notifications-center-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatBottomSheetModule, MatButtonModule, MatIconModule, MatMenuModule,
    NotificationCardComponent, PageSkeletonComponent, RouterModule,
  ],
  template: `
    <section class="notif-page">
      <header class="notif-hero">
        <div class="hero-top">
          <a mat-icon-button routerLink="/dashboard" aria-label="Back to dashboard">
            <mat-icon>arrow_back</mat-icon>
          </a>
          <div class="hero-title">
            <p class="eyebrow">Inbox · Alerts</p>
            <h1>Notifications</h1>
          </div>
          <button mat-icon-button type="button" (click)="reload()" [disabled]="loading()" aria-label="Refresh notifications">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
        <p class="hero-lede">
          @if (urgent().length > 0) {
            <strong class="urgent">{{ urgent().length }} need action now.</strong>
            <span>Each alert tells you what to do next.</span>
          } @else {
            <span>You’re all caught up on urgent items.</span>
          }
        </p>
        <div class="hero-actions" [class.is-single]="all().length === 0">
          @if (all().length > 0) {
            <button mat-stroked-button type="button" (click)="markAllRead()" [disabled]="markingAll() || loading()">
              <mat-icon>done_all</mat-icon> Mark all read
            </button>
          }
          <button mat-stroked-button type="button" [matMenuTriggerFor]="pageMenu">
            <mat-icon>tune</mat-icon> Manage
          </button>
        </div>
      </header>

      <mat-menu #pageMenu="matMenu">
        <a mat-menu-item routerLink="/dashboard/notifications/preferences">
          <mat-icon>settings</mat-icon> Notification settings
        </a>
        <button mat-menu-item type="button" (click)="markAllRead()" [disabled]="markingAll() || loading() || all().length === 0">
          <mat-icon>done_all</mat-icon> Mark all read
        </button>
        <button mat-menu-item type="button" (click)="archiveAll()" [disabled]="markingAll() || loading() || all().length === 0">
          <mat-icon>archive</mat-icon> Archive saved
        </button>
        <button mat-menu-item type="button" (click)="requestDeleteAll()" [disabled]="markingAll() || loading() || all().length === 0">
          <mat-icon>delete_sweep</mat-icon> Delete saved
        </button>
      </mat-menu>

      @if (confirmBulkDelete()) {
        <div class="confirm-banner" role="alert">
          <mat-icon>delete_forever</mat-icon>
          <div>
            <strong>Delete all saved notifications?</strong>
            <span>Saved alerts will be removed. Live action reminders stay in the action inbox.</span>
          </div>
          <button mat-flat-button color="warn" type="button" (click)="deleteAll()" [disabled]="markingAll()">Delete saved</button>
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
        @if (all().length > 0) {
          <section class="summary-grid" aria-label="Notification summary">
            <div class="summary-tile">
              <span class="summary-icon"><mat-icon aria-hidden="true">notifications</mat-icon></span>
              <strong>{{ totalCount() }}</strong>
              <span>Total</span>
            </div>
            <div class="summary-tile summary-tile--warn">
              <span class="summary-icon summary-icon--warn"><mat-icon aria-hidden="true">mark_email_unread</mat-icon></span>
              <strong>{{ unreadTotal() }}</strong>
              <span>Unread</span>
            </div>
            <div class="summary-tile summary-tile--bad">
              <span class="summary-icon summary-icon--bad"><mat-icon aria-hidden="true">bolt</mat-icon></span>
              <strong>{{ urgentCount() }}</strong>
              <span>Urgent</span>
            </div>
            <div class="summary-tile summary-tile--ok">
              <span class="summary-icon summary-icon--ok"><mat-icon aria-hidden="true">inbox</mat-icon></span>
              <strong>{{ storedCount() }}</strong>
              <span>Saved alerts</span>
            </div>
          </section>
          @if (statsLine(); as stats) {
            <p class="stats-line">{{ stats }}</p>
          }
        }

        @if (inbox()?.items?.length) {
          <section class="action-inbox" aria-label="Resolve this next">
            <div class="section-head">
              <div>
                <p class="eyebrow">Action inbox</p>
                <h2>Resolve this next</h2>
              </div>
              <span class="count-pill">{{ inbox()?.total }}</span>
            </div>
            <div class="action-list">
              @for (item of inbox()?.items; track item.id) {
                <a class="action-card" [class.is-high]="item.priority === 'high' || item.priority === 'critical'" [routerLink]="item.link">
                  <span class="action-icon"><mat-icon aria-hidden="true">{{ inboxIcon(item.category) }}</mat-icon></span>
                  <span class="action-copy">
                    <span class="action-meta">{{ item.count }} · {{ item.priority }}</span>
                    <strong>{{ item.title }}</strong>
                    <span>{{ item.detail }}</span>
                    <span class="action-cta">{{ item.actionLabel }} <mat-icon aria-hidden="true">arrow_forward</mat-icon></span>
                  </span>
                </a>
              }
            </div>
          </section>
        }

        <div class="notif-controls">
          <div class="search-box">
            <mat-icon aria-hidden="true">search</mat-icon>
            <input
              type="search"
              inputmode="search"
              placeholder="Search notifications"
              [value]="search()"
              (input)="onSearchInput($any($event.target).value)"
              aria-label="Search notifications" />
            @if (search()) {
              <button type="button" class="search-clear" (click)="clearSearch()" aria-label="Clear search">
                <mat-icon>close</mat-icon>
              </button>
            }
          </div>
          <div class="filter-rail" role="group" aria-label="Filter notifications">
            <button type="button" class="filter-chip" [class.is-active]="!unreadOnly() && !groupFilter() && !search()" [attr.aria-pressed]="!unreadOnly() && !groupFilter() && !search()" (click)="showAll()">
              All <span>{{ totalCount() }}</span>
            </button>
            <button type="button" class="filter-chip filter-chip--unread" [class.is-active]="unreadOnly()" [attr.aria-pressed]="unreadOnly()" (click)="toggleUnread()">
              Unread <span>{{ unreadTotal() }}</span>
            </button>
            @for (g of groupKeys; track g) {
              <button type="button" class="filter-chip" [class.is-active]="groupFilter() === g" [attr.aria-pressed]="groupFilter() === g" (click)="selectGroup(g)">
                {{ groupLabel(g) }} <span>{{ groupCount()(g) }}</span>
              </button>
            }
          </div>
        </div>

        @if (!error()) {
          @if (urgent().length > 0) {
            <h3 class="group-head group-head--urgent">
              <span><mat-icon aria-hidden="true">bolt</mat-icon> Needs action now</span>
              <span class="count">{{ urgent().length }}</span>
            </h3>
            <div class="notif-list">
              @for (item of urgent(); track item.id) {
                <async-notification-card
                  [item]="item"
                  [kindLabel]="chip(item.kind).label"
                  [kindTone]="kindTone(item.kind)"
                  [timeLabel]="timeAgo(item.at)"
                  [categoryLabel]="categoryLabel(item.kind)"
                  (selected)="openDetails($event)" />
              }
            </div>
          }

          @for (bucket of buckets(); track bucket.label) {
            <h3 class="group-head">
              <span>{{ bucket.label }}</span>
              <span class="count">{{ bucket.items.length }}</span>
            </h3>
            <div class="notif-list">
              @for (item of bucket.items; track item.id) {
                <async-notification-card
                  [item]="item"
                  [kindLabel]="chip(item.kind).label"
                  [kindTone]="kindTone(item.kind)"
                  [timeLabel]="timeAgo(item.at)"
                  [categoryLabel]="categoryLabel(item.kind)"
                  (selected)="openDetails($event)" />
              }
            </div>
          }

          @if (!loading() && urgent().length === 0 && buckets().length === 0) {
            <div class="empty-card">
              <span class="empty-icon"><mat-icon>notifications_off</mat-icon></span>
              <strong>{{ unreadOnly() ? 'You’re all caught up' : 'Nothing here yet' }}</strong>
              <p>{{ unreadOnly()
                ? 'No unread notifications match this view.'
                : 'Follow-ups, payouts, goals and team news will land in this feed.' }}</p>
              @if (unreadOnly() || groupFilter() || search()) {
                <button mat-stroked-button type="button" (click)="showAll()">Show all notifications</button>
              } @else {
                <a mat-flat-button color="primary" routerLink="/dashboard">Back to dashboard</a>
              }
            </div>
          }

          @if (urgent().length > 0 || buckets().length > 0) {
            @if (loadCapReached()) {
              <p class="load-cap"><mat-icon aria-hidden="true">info</mat-icon> Latest {{ maxLoaded }} saved alerts. Use search or a group filter to reach older records.</p>
            } @else if (hasMore()) {
              <button mat-flat-button class="load-more" type="button" (click)="loadMore()" [disabled]="loadingMore() || loading()">
                {{ loadingMore() ? 'Loading…' : 'Load older notifications' }}
              </button>
            }
            <p class="feed-foot">Showing {{ stored().length }} of {{ storedCount() }} saved alerts · {{ derived().length }} live items</p>
          }
        }
      }
    </section>
  `,
  styles: [`
    :host { display: block; -webkit-tap-highlight-color: transparent; }
    .notif-page { display: flex; flex-direction: column; gap: 12px; max-width: 720px; margin: 0 auto; padding-bottom: 28px; }

    .notif-hero { padding: 14px; border: 1px solid color-mix(in srgb, var(--ms-primary) 16%, var(--ms-line)); border-radius: 20px; background: linear-gradient(155deg, var(--ms-primary-soft), var(--ms-surface) 70%); }
    .hero-top { display: flex; align-items: center; gap: 7px; }
    .hero-top > a, .hero-top > button { flex: none; background: color-mix(in srgb, var(--ms-surface) 72%, transparent); }
    .hero-title { flex: 1; min-width: 0; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.66rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .hero-title h1 { margin: 1px 0 0; font-size: 1.65rem; letter-spacing: -0.03em; }
    .hero-lede { display: flex; flex-direction: column; gap: 1px; margin: 9px 0 12px; color: var(--ms-text-muted); font-size: 0.82rem; line-height: 1.5; }
    .hero-lede .urgent { color: var(--ms-error); font-size: 0.84rem; }
    .hero-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .hero-actions.is-single { grid-template-columns: 1fr; }
    .hero-actions a, .hero-actions button { min-width: 0; min-height: 44px; }
    .hero-actions mat-icon { margin-right: 4px; }

    .confirm-banner, .notice-banner, .alert { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; padding: 11px 12px; border-radius: 14px; }
    .confirm-banner { background: var(--ms-error-soft); color: var(--ms-error); }
    .confirm-banner > div { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 180px; }
    .confirm-banner strong { font-size: 0.82rem; }
    .confirm-banner span { color: var(--ms-text-muted); font-size: 0.7rem; line-height: 1.4; }
    .confirm-banner button, .alert button { min-height: 40px; }
    .notice-banner { background: var(--ms-success-soft); color: var(--ms-success); font-size: 0.76rem; line-height: 1.4; }
    .notice-banner span { flex: 1; min-width: 160px; }
    .notice-banner button { flex: none; color: currentColor; }
    .alert { background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { flex: 1; min-width: 170px; margin: 0; font-size: 0.8rem; }

    .loading-strip { position: relative; height: 3px; overflow: hidden; border-radius: 999px; background: var(--ms-line); }
    .loading-strip::after { content: ''; position: absolute; inset: 0; width: 38%; border-radius: inherit; background: var(--ms-primary); animation: slide-bar 1.05s ease-in-out infinite; }

    .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .summary-tile { display: flex; flex-direction: column; gap: 1px; min-width: 0; padding: 10px; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); }
    .summary-tile--warn { border-color: color-mix(in srgb, var(--ms-warning) 24%, var(--ms-line)); }
    .summary-tile--bad { border-color: color-mix(in srgb, var(--ms-error) 24%, var(--ms-line)); }
    .summary-tile--ok { border-color: color-mix(in srgb, var(--ms-success) 24%, var(--ms-line)); }
    .summary-icon { display: grid; place-items: center; width: 30px; height: 30px; margin-bottom: 2px; border-radius: 9px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .summary-icon--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .summary-icon--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .summary-icon--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .summary-icon mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .summary-tile strong { font-family: var(--ms-font-display); font-size: 1.25rem; line-height: 1.15; font-variant-numeric: tabular-nums; }
    .summary-tile > span:last-child { color: var(--ms-text-muted); font-size: 0.68rem; font-weight: 650; }
    .stats-line { margin: -4px 2px 0; color: var(--ms-text-muted); font-size: 0.68rem; line-height: 1.4; }

    .section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; }
    .section-head h2 { margin: 1px 0 0; font-size: 1rem; }
    .count-pill { display: inline-grid; place-items: center; min-width: 26px; height: 26px; padding: 0 8px; border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.7rem; font-weight: 800; }

    .action-inbox { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--ms-line); border-radius: 16px; background: var(--ms-surface); }
    .action-list { display: flex; flex-direction: column; gap: 8px; }
    .action-card { display: flex; align-items: flex-start; gap: 9px; padding: 10px; border: 1px solid var(--ms-line); border-left: 3px solid var(--ms-primary); border-radius: 12px; background: var(--ms-canvas); color: var(--ms-text); text-decoration: none; }
    .action-card.is-high { border-left-color: var(--ms-warning); background: color-mix(in srgb, var(--ms-warning-soft) 45%, var(--ms-canvas)); }
    .action-card:active { transform: scale(0.995); }
    .action-icon { display: grid; place-items: center; flex: none; width: 34px; height: 34px; border-radius: 10px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .action-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .action-copy { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
    .action-meta { color: var(--ms-text-muted); font-size: 0.59rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
    .action-copy strong { font-size: 0.84rem; line-height: 1.3; }
    .action-copy > span:not(.action-meta, .action-cta) { color: var(--ms-text-muted); font-size: 0.71rem; line-height: 1.4; }
    .action-cta { display: inline-flex; align-items: center; gap: 2px; margin-top: 2px; color: var(--ms-primary-strong); font-size: 0.64rem; font-weight: 800; }
    .action-cta mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .notif-controls { position: sticky; top: calc(var(--ms-mobile-appbar-height) + var(--ms-safe-top)); z-index: 10; display: flex; flex-direction: column; gap: 6px; margin: 0 -2px; padding: 6px 2px 7px; background: var(--ms-canvas); border-bottom: 1px solid color-mix(in srgb, var(--ms-line) 65%, transparent); }
    .search-box { display: flex; align-items: center; gap: 7px; min-height: 46px; padding: 0 10px 0 12px; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); }
    .search-box:focus-within { border-color: var(--ms-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ms-primary) 16%, transparent); }
    .search-box > mat-icon { flex: none; color: var(--ms-text-muted); font-size: 20px; width: 20px; height: 20px; }
    .search-box input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--ms-text); font: inherit; font-size: 0.84rem; }
    .search-box input::placeholder { color: var(--ms-text-muted); }
    .search-box input::-webkit-search-cancel-button { display: none; }
    .search-clear { flex: none; width: 30px; height: 30px; display: grid; place-items: center; border: 0; border-radius: 50%; background: var(--ms-canvas); color: var(--ms-text-muted); cursor: pointer; }
    .search-clear mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .filter-rail { display: flex; gap: 5px; margin: 0 -2px; padding: 1px 2px 3px; overflow-x: auto; scrollbar-width: none; }
    .filter-rail::-webkit-scrollbar { display: none; }
    .filter-chip { display: inline-flex; align-items: center; gap: 4px; flex: none; min-height: 36px; padding: 0 10px; border: 1px solid var(--ms-line); border-radius: 999px; background: var(--ms-surface); color: var(--ms-text-muted); font: inherit; font-size: 0.71rem; font-weight: 650; cursor: pointer; white-space: nowrap; }
    .filter-chip.is-active { border-color: var(--ms-primary); background: var(--ms-primary); color: var(--ms-ink); }
    .filter-chip > span { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.61rem; font-weight: 800; font-variant-numeric: tabular-nums; }
    .filter-chip.is-active > span { background: color-mix(in srgb, var(--ms-surface) 78%, transparent); color: var(--ms-text); }

    .group-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0; padding: 2px; color: var(--ms-text-muted); font-size: 0.7rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; }
    .group-head > span:first-child { display: inline-flex; align-items: center; gap: 4px; }
    .group-head mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .group-head--urgent { color: var(--ms-error); }
    .group-head .count { display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; background: var(--ms-surface); border: 1px solid var(--ms-line); color: var(--ms-text-muted); font-size: 0.64rem; letter-spacing: 0; }
    .notif-list { display: flex; flex-direction: column; gap: 8px; }

    .load-more { align-self: center; width: 100%; max-width: 320px; min-height: 46px; margin-top: 2px; }
    .load-cap { display: flex; align-items: flex-start; gap: 5px; margin: 2px 0; padding: 9px 10px; border-radius: 11px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.7rem; line-height: 1.4; }
    .load-cap mat-icon { flex: none; margin-top: 1px; font-size: 15px; width: 15px; height: 15px; }
    .feed-foot { margin: 0; text-align: center; color: var(--ms-text-muted); font-size: 0.66rem; }

    .empty-card { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 26px 18px; text-align: center; border: 1px dashed var(--ms-line-strong); border-radius: 16px; background: var(--ms-surface); }
    .empty-icon { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .empty-icon mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .empty-card strong { font-size: 0.94rem; }
    .empty-card p { margin: 0; max-width: 30em; color: var(--ms-text-muted); font-size: 0.79rem; line-height: 1.5; }
    .empty-card a, .empty-card button { min-height: 44px; margin-top: 2px; }

    @media (min-width: 700px) {
      .summary-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .action-list, .notif-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .filter-rail { flex-wrap: wrap; overflow: visible; }
    }
    @media (prefers-reduced-motion: reduce) {
      .loading-strip::after { animation: none; width: 100%; opacity: 0.5; }
    }
    @keyframes slide-bar { 0% { transform: translateX(-110%); } 100% { transform: translateX(290%); } }
  `],
})
export class NotificationsCenterMobileComponent implements OnInit {
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly sheet = inject(MatBottomSheet);
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
    this.search.set('');
    this.unreadOnly.set(false);
    this.groupFilter.set(null);
    this.reload();
  }

  protected toggleUnread(): void {
    this.unreadOnly.update((value) => !value);
    this.reload();
  }

  protected selectGroup(group: GroupKey): void {
    this.groupFilter.set(this.groupFilter() === group ? null : group);
    this.reload();
  }

  protected groupLabel(group: GroupKey): string {
    return GROUP_LABELS[group];
  }

  protected chip(kind: string): { label: string } {
    return KIND_META[kind] ?? { label: kind };
  }

  protected kindTone(kind: string): Tone {
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
      this.notice.set('Showing the latest 500 saved alerts. Use search or a group filter to narrow the list.');
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

  protected openDetails(item: StoredNotificationItem): void {
    const data: NotificationSheetData = {
      item,
      kindLabel: this.chip(item.kind).label,
      kindTone: this.kindTone(item.kind),
      categoryLabel: this.categoryLabel(item.kind),
      timeLabel: this.timeAgo(item.at),
    };
    this.sheet.open(NotificationDetailSheetComponent, {
      data,
      panelClass: 'ms-notification-sheet-panel',
      autoFocus: 'dialog',
      restoreFocus: true,
    }).afterDismissed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((action) => {
      if (action) this.handleSheetAction(item, action);
    });
  }

  private handleSheetAction(item: StoredNotificationItem, action: NotificationSheetAction): void {
    switch (action) {
      case 'open':
        if (item.origin === 'stored') this.openStored(item);
        else if (item.link) void this.router.navigateByUrl(item.link);
        break;
      case 'read':
        this.markStoredRead(item);
        break;
      case 'unread':
        this.markUnread(item);
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

  protected requestDeleteAll(): void {
    this.confirmBulkDelete.set(true);
  }

  protected markAllRead(): void {
    if (this.all().length === 0) return;
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
    if (this.all().length === 0) return;
    this.markingAll.set(true);
    this.notifications.bulk('archive-all')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.markingAll.set(false);
          this.notice.set('Saved notifications archived.');
          this.reload();
        },
        error: (err: ApiError) => {
          this.markingAll.set(false);
          this.error.set(userError(err));
        },
      });
  }

  protected deleteAll(): void {
    if (this.all().length === 0) return;
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
          this.notice.set('Marked as read.');
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
          this.notice.set('Marked as unread.');
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
}
