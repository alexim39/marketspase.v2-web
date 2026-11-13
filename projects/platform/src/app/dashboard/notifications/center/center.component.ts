import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { forkJoin } from 'rxjs';
import { NotificationService } from '../../../core/notifications/notification.service';
import {
  ActionInbox,
  CATEGORY_LABELS,
  NotificationPreferences,
  StoredNotificationItem,
} from '../../../core/notifications/notification.models';
import { ApiError } from '../../../core/http/api-error';

const KIND_META: Record<string, { label: string; color: string; text: string }> = {
  followup: { label: 'Follow-up', color: '#bbdefb', text: '#0d47a1' },
  inactive: { label: 'Inactive', color: '#ffecb3', text: '#7a5c00' },
  conversion: { label: 'Conversion', color: '#c8e6c9', text: '#1b5e20' },
  release: { label: 'Payout', color: '#e1bee7', text: '#4a148c' },
  mention: { label: 'Mention', color: '#ffe0b2', text: '#7a4a00' },
  prospect: { label: 'Prospects', color: '#bbdefb', text: '#0d47a1' },
  daily: { label: 'Daily', color: '#bbdefb', text: '#0d47a1' },
  goals: { label: 'Goals', color: '#c8e6c9', text: '#1b5e20' },
  progression: { label: 'Progression', color: '#c8e6c9', text: '#1b5e20' },
  promotion: { label: 'Promotions', color: '#e1bee7', text: '#4a148c' },
  commission: { label: 'Commissions', color: '#e1bee7', text: '#4a148c' },
  training: { label: 'Training', color: '#d1c4e9', text: '#4527a0' },
  community: { label: 'Community', color: '#ffe0b2', text: '#7a4a00' },
  recognition: { label: 'Recognition', color: '#ffe0b2', text: '#7a4a00' },
  team: { label: 'Team', color: '#ffccbc', text: '#7a2e00' },
  system: { label: 'System', color: '#e0e0e0', text: '#424242' },
  marketing: { label: 'Marketing', color: '#e0e0e0', text: '#424242' },
  birthday: { label: 'Birthday', color: '#f8bbd0', text: '#880e4f' },
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

/** Stored categories (and derived kinds) that belong to each UI group. */
const GROUP_CATEGORIES: Record<GroupKey, string[]> = {
  prospects: ['prospect', 'daily', 'followup', 'inactive', 'conversion'],
  community: ['community', 'recognition', 'birthday', 'mention'],
  training: ['training', 'progression'],
  goals: ['goals'],
  team: ['team', 'promotion'],
  commissions: ['commission', 'release'],
  system: ['system', 'marketing'],
};

/**
 * dp-status variant per kind — plain spans, no MDC internals. mat-chip
 * repaints its own container/label from theme tokens on inner elements,
 * which covered our inline pastel pairs and hid the text in dark mode.
 */
const KIND_CLASS: Record<string, 'info' | 'warn' | 'ok' | 'purple' | 'bad' | 'neutral'> = {
  followup: 'info', inactive: 'warn', conversion: 'ok', release: 'purple',
  mention: 'warn', prospect: 'info', daily: 'info', goals: 'ok',
  progression: 'ok', promotion: 'purple', commission: 'purple',
  training: 'info', community: 'warn', recognition: 'warn', team: 'warn',
  system: 'neutral', marketing: 'neutral', birthday: 'warn',
};

interface DayBucket { label: string; items: StoredNotificationItem[]; }

/** Bound the rendered history; search and group filters reach older records. */
const MAX_LOADED_STORED = 500;

/**
 * @title Notification Center — the single standard surface.
 *
 * Urgent-first hero, sticky filter/search toolbar, newest-first day
 * buckets with cursor pagination ("Load more" = history), inline detail
 * panel with contextual actions (open / archive / delete / mute / mark
 * unread), bulk read/archive/delete, click beacon for engagement
 * analytics, and touch-swipe quick actions. OnPush + signals.
 */
@Component({
  selector: 'async-notifications-center',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, PageSkeletonComponent, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>Notifications</span>
      </div>
    </section>

    <section class="center-page">
      <header class="page-head">
        <div>
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
          @if (statsLine(); as stats) {
            <p class="stats-line">{{ stats }}</p>
          }
        </div>
        <div class="head-actions">
          @if (all().length > 0) {
            <button mat-stroked-button type="button" (click)="markAllRead()" [disabled]="markingAll() || loading()">Mark all read</button>
            <button mat-stroked-button type="button" (click)="archiveAll()" [disabled]="markingAll() || loading()">Archive all</button>
            @if (confirmBulkDelete()) {
              <button mat-flat-button color="warn" type="button" (click)="deleteAll()" [disabled]="markingAll() || loading()">Confirm delete all</button>
              <button mat-button type="button" (click)="confirmBulkDelete.set(false)">Cancel</button>
            } @else {
              <button mat-button type="button" (click)="confirmBulkDelete.set(true)">Delete all</button>
            }
          }
          <a mat-button routerLink="/dashboard/notifications/preferences">Settings</a>
        </div>
      </header>

      @if (!loading() && all().length > 0) {
        <section class="summary-strip" aria-label="Notification summary">
          <div class="summary-card"><span class="summary-icon"><mat-icon>notifications</mat-icon></span><div><strong>{{ totalCount() }}</strong><span>Total</span><small>All visible updates</small></div></div>
          <div class="summary-card"><span class="summary-icon summary-icon--warn"><mat-icon>priority_high</mat-icon></span><div><strong>{{ unreadTotal() }}</strong><span>Unread</span><small>Not opened yet</small></div></div>
          <div class="summary-card"><span class="summary-icon summary-icon--bad"><mat-icon>bolt</mat-icon></span><div><strong>{{ urgentCount() }}</strong><span>Urgent</span><small>Needs action now</small></div></div>
          <div class="summary-card"><span class="summary-icon summary-icon--ok"><mat-icon>inbox</mat-icon></span><div><strong>{{ storedCount() }}</strong><span>Saved alerts</span><small>Can be archived or deleted</small></div></div>
        </section>
      }

      @if (inbox()?.items?.length) {
        <section class="action-inbox" aria-label="Resolve this next">
          <div class="inbox-head">
            <div><p class="eyebrow">Action inbox</p><h3>Resolve this next</h3></div>
            <span class="inbox-count">{{ inbox()?.total }}</span>
          </div>
          <div class="inbox-grid">
            @for (item of inbox()?.items; track item.id) {
              <article class="inbox-card" [class.inbox-card--high]="item.priority === 'high' || item.priority === 'critical'">
                <span class="inbox-icon"><mat-icon>{{ inboxIcon(item.category) }}</mat-icon></span>
                <div class="inbox-copy">
                  <span class="inbox-meta">{{ item.count }} · {{ item.priority }}</span>
                  <strong>{{ item.title }}</strong>
                  <p>{{ item.detail }}</p>
                </div>
                <a mat-stroked-button [routerLink]="item.link">{{ item.actionLabel }}</a>
              </article>
            }
          </div>
        </section>
      }

      <div class="toolbar">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Search notifications</mat-label>
          <input
            matInput
            type="search"
            placeholder="Search notifications…"
            aria-label="Search notifications"
            [value]="search()"
            (input)="onSearch($event)"
            (keyup.enter)="reload()"
          />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
        <button
          mat-button
          [color]="unreadOnly() ? 'primary' : undefined"
          [attr.aria-pressed]="unreadOnly()"
          (click)="toggleUnread()"
        >{{ unreadOnly() ? 'Unread ✓' : 'Unread' }}</button>
        <div class="filters" role="group" aria-label="Filter by group">
          <button mat-button [color]="!groupFilter() ? 'primary' : undefined" (click)="setGroup(null)">
            All @if (all().length > 0) { ({{ all().length }}) }
          </button>
          @for (g of groupKeys; track g) {
            <button mat-button [color]="groupFilter() === g ? 'primary' : undefined" (click)="setGroup(g)">
              {{ groupLabel(g) }} ({{ groupCount()(g) }})
            </button>
          }
        </div>
      </div>

      @if (loading()) {
        <async-page-skeleton layout="list" [rows]="5" label="notifications" [showHeader]="false" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (notice(); as note) {
        <p class="notice" role="status">{{ note }}</p>
      }

      @if (urgent().length > 0) {
        <h3 class="group-head">Needs action now <span class="count">{{ urgent().length }}</span></h3>
        <ul class="feed">
          @for (item of urgent(); track item.id) {
            <li
              class="feed-item feed-item--urgent"
              [class.feed-item--read]="item.read"
              [class.feed-item--swiped]="swipedId() === item.id"
              (touchstart)="onTouchStart($event)"
              (touchend)="onTouchEnd($event, item)"
            >
              @if (!item.read) { <span class="unread-dot" aria-hidden="true"></span> }
              <mat-icon class="warn">{{ item.icon }}</mat-icon>
              <div class="feed-body">
                <div class="feed-title-row">
                  <strong>{{ item.title }}</strong>
                  <span [class]="kindClass(item.kind)">
                    {{ chip(item.kind).label }}
                  </span>
                  @if (item.origin === 'stored') {
                    <span [class]="prioClass(item.priority)">{{ item.priority }}</span>
                  }
                </div>
                <p class="muted">{{ item.body }} · {{ item.tag }} · {{ timeAgo(item.at) }}</p>
                <div class="feed-actions">
                  @if (item.link) {
                    @if (item.origin === 'stored') {
                      <button mat-button (click)="openStored(item)">Open</button>
                    } @else {
                      <a mat-button [routerLink]="item.link">Open</a>
                    }
                  }
                  <button mat-button (click)="toggleDetail(item.id)">
                    {{ expandedId() === item.id ? 'Hide details' : 'Details' }}
                  </button>
                  @if (item.origin === 'stored') {
                    <button mat-button (click)="archiveStored(item.id)" [disabled]="busyId() === item.id">Archive</button>
                    @if (confirmDeleteId() === item.id) {
                      <button mat-button color="warn" (click)="deleteStored(item.id)" [disabled]="busyId() === item.id">Confirm delete</button>
                      <button mat-button (click)="confirmDeleteId.set(null)">Cancel</button>
                    } @else {
                      <button mat-button color="warn" (click)="confirmDeleteId.set(item.id)">Delete</button>
                    }
                  } @else {
                    <button mat-button (click)="dismiss(item.id)" [disabled]="busyId() === item.id">Dismiss</button>
                  }
                </div>
                @if (expandedId() === item.id) {
                  <div class="detail">
                    <p>{{ item.body }}</p>
                    <p class="muted">{{ categoryLabel(item.kind) }} · {{ item.at }}</p>
                    @if (item.origin === 'stored') {
                      <div class="feed-actions">
                        <button mat-button (click)="markUnread(item)" [disabled]="busyId() === item.id">
                          Mark unread
                        </button>
                        <button mat-button (click)="muteCategory(item)" [disabled]="busyId() === item.id">
                          Mute these
                        </button>
                        @if (confirmDeleteId() === item.id) {
                          <button mat-button color="warn" (click)="deleteStored(item.id)" [disabled]="busyId() === item.id">
                            Confirm delete
                          </button>
                          <button mat-button (click)="confirmDeleteId.set(null)">Cancel</button>
                        } @else {
                          <button mat-button (click)="confirmDeleteId.set(item.id)">Delete</button>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
              <div class="swipe-actions" aria-hidden="false">
                @if (item.origin === 'stored') {
                  <button mat-button (click)="archiveStored(item.id)" tabindex="-1">Archive</button>
                  <button mat-button color="warn" (click)="deleteStored(item.id)" tabindex="-1">Delete</button>
                } @else {
                  <button mat-button (click)="dismiss(item.id)" tabindex="-1">Dismiss</button>
                }
              </div>
            </li>
          }
        </ul>
      }

      @if (buckets().length > 0) {
        @for (bucket of buckets(); track bucket.label) {
          <h3 class="group-head">{{ bucket.label }} <span class="count">{{ bucket.items.length }}</span></h3>
          <ul class="feed">
            @for (item of bucket.items; track item.id) {
              <li
                class="feed-item"
                [class.feed-item--urgent]="item.urgency && !item.read"
                [class.feed-item--read]="item.read"
                [class.feed-item--swiped]="swipedId() === item.id"
                (touchstart)="onTouchStart($event)"
                (touchend)="onTouchEnd($event, item)"
              >
                @if (!item.read) { <span class="unread-dot" aria-hidden="true"></span> }
                <mat-icon [class.warn]="item.urgency && !item.read">{{ item.icon }}</mat-icon>
                <div class="feed-body">
                  <div class="feed-title-row">
                    <strong>{{ item.title }}</strong>
                    <span [class]="kindClass(item.kind)">
                      {{ chip(item.kind).label }}
                    </span>
                  </div>
                  <p class="muted">{{ item.body }} · {{ item.tag }} · {{ timeAgo(item.at) }}</p>
                  <div class="feed-actions">
                    @if (item.link) {
                      @if (item.origin === 'stored') {
                        <button mat-button (click)="openStored(item)">Open</button>
                      } @else {
                        <a mat-button [routerLink]="item.link">Open</a>
                      }
                    }
                    <button mat-button (click)="toggleDetail(item.id)">
                      {{ expandedId() === item.id ? 'Hide details' : 'Details' }}
                    </button>
                    @if (item.origin === 'stored') {
                      <button mat-button (click)="archiveStored(item.id)" [disabled]="busyId() === item.id">Archive</button>
                    } @else {
                      <button mat-button (click)="dismiss(item.id)" [disabled]="busyId() === item.id">Dismiss</button>
                    }
                  </div>
                  @if (expandedId() === item.id) {
                    <div class="detail">
                      <p>{{ item.body }}</p>
                      <p class="muted">{{ categoryLabel(item.kind) }} · {{ item.at }}</p>
                      @if (item.origin === 'stored') {
                        <div class="feed-actions">
                          <button mat-button (click)="markUnread(item)" [disabled]="busyId() === item.id">
                            Mark unread
                          </button>
                          <button mat-button (click)="muteCategory(item)" [disabled]="busyId() === item.id">
                            Mute these
                          </button>
                          @if (confirmDeleteId() === item.id) {
                            <button mat-button color="warn" (click)="deleteStored(item.id)" [disabled]="busyId() === item.id">
                              Confirm delete
                            </button>
                            <button mat-button (click)="confirmDeleteId.set(null)">Cancel</button>
                          } @else {
                            <button mat-button (click)="confirmDeleteId.set(item.id)">Delete</button>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
                <div class="swipe-actions" aria-hidden="false">
                  @if (item.origin === 'stored') {
                    <button mat-button (click)="archiveStored(item.id)" tabindex="-1">Archive</button>
                    <button mat-button color="warn" (click)="deleteStored(item.id)" tabindex="-1">Delete</button>
                  } @else {
                    <button mat-button (click)="dismiss(item.id)" tabindex="-1">Dismiss</button>
                  }
                </div>
              </li>
            }
          </ul>
        }
        @if (loadCapReached()) {
          <p class="load-cap" role="status"><mat-icon>info</mat-icon> Showing the latest {{ maxLoaded }} saved alerts. Use search or a group filter to reach older records.</p>
        } @else if (hasMore()) {
          <button mat-stroked-button class="load-more" type="button" (click)="loadMore()" [disabled]="loadingMore() || loading()">
            {{ loadingMore() ? 'Loading…' : 'Load older notifications' }}
          </button>
        }
        <p class="muted">Showing {{ stored().length }} loaded of {{ storedCount() }} saved alerts · {{ derived().length }} live items</p>
      } @else if (!loading() && !error()) {
        <div class="empty-card">
          <mat-icon>inbox</mat-icon>
          <p>
            @if (unreadOnly()) {
              You're all caught up — nothing unread.
            } @else {
              Nothing here yet — follow-ups, payouts, goals and team news will land in this feed.
            }
          </p>
          <a mat-button routerLink="/dashboard">Back to dashboard</a>
        </div>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .center-page { display: flex; flex-direction: column; gap: 1.25em; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1.5em; flex-wrap: wrap; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(2rem, 3vw, 2.5rem); letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .page-head .subtitle { margin: 0; color: var(--ms-text-muted); font-size: 0.9375rem; line-height: 1.6; }
    .page-head .subtitle .urgent { color: var(--ms-error); }
    .stats-line { margin: 6px 0 0; color: var(--ms-text-muted); font-size: 0.75rem; }
    .head-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .head-actions button, .head-actions a { min-height: 40px; }
    .summary-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 8px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .summary-card { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-md); }
    .summary-icon { width: 40px; height: 40px; flex: none; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .summary-icon--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .summary-icon--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .summary-icon--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .summary-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .summary-card > div { display: flex; flex-direction: column; gap: 1px; }
    .summary-card strong { font-family: var(--ms-font-display); font-size: 1.5rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .summary-card span:last-of-type { color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; }
    .summary-card small { color: var(--ms-text-muted); font-size: 0.6875rem; }
    .action-inbox { display: flex; flex-direction: column; gap: 0.75em; padding: 1em; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); }
    .inbox-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1em; }
    .inbox-head h3 { margin: 2px 0 0; font-size: 1.05em; }
    .inbox-head .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.7em; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
    .inbox-count { border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); padding: 3px 10px; font-weight: 700; font-size: 0.75em; }
    .inbox-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.6em; }
    .inbox-card { display: flex; align-items: flex-start; gap: 0.7em; padding: 0.8em; border: 1px solid var(--ms-line); border-radius: 12px; background: var(--ms-canvas); flex-wrap: wrap; }
    .inbox-card--high { border-left: 3px solid var(--ms-warning); }
    .inbox-icon { width: 34px; height: 34px; flex: none; border-radius: 10px; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .inbox-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .inbox-copy { flex: 1; min-width: 150px; display: flex; flex-direction: column; gap: 1px; }
    .inbox-meta { color: var(--ms-text-muted); font-size: 0.68em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .inbox-copy strong { font-size: 0.86em; }
    .inbox-copy p { margin: 0; color: var(--ms-text-muted); font-size: 0.76em; line-height: 1.45; }
    .inbox-card a { min-height: 36px; align-self: center; }
    .hero {
      display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1em;
      background: linear-gradient(135deg, var(--ms-surface) 0%, var(--ms-surface) 70%, color-mix(in srgb, var(--ms-primary, #667eea) 12%, var(--ms-surface)) 100%);
      border: 1px solid var(--ms-line); border-radius: 14px; padding: 1.1em 1.25em;
    }
    .hero h2 { margin: 0; font-size: 1.4em; letter-spacing: 0.01em; }
    .subtitle { margin: 0.3em 0 0; color: var(--ms-text-muted); }
    .next-step { display: block; margin-top: 0.2em; font-size: 0.9em; }
    .urgent { color: var(--ms-error); }
    .stats-line { margin: 0.4em 0 0; font-size: 0.85em; color: var(--ms-text-muted); }
    .hero-actions { display: flex; gap: 0.25em; flex-wrap: wrap; align-items: center; }
    .hero-actions button, .hero-actions a { min-height: 44px; }
    .toolbar {
      position: sticky; top: 0; z-index: 5;
      display: flex; gap: 0.5em; flex-wrap: wrap; align-items: center;
      background: var(--ms-canvas); padding: 0.6em 0;
    }
    .search-field { flex: 1 1 220px; }
    .filters { display: flex; gap: 0.25em; flex-wrap: wrap; }
    .filters button { min-height: 44px; }
    .group-head { margin: 0.5em 0 0; font-size: 1em; display: flex; align-items: center; gap: 0.5em; }
    .count { font-size: 0.75em; font-weight: 600; color: var(--ms-text-muted); background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 999px; padding: 0.1em 0.6em; }
    .feed { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75em; }
    .feed-item {
      position: relative; display: flex; gap: 0.9em; align-items: flex-start; overflow: hidden;
      background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 12px; padding: 0.9em 1em;
      transition: box-shadow 0.15s ease, transform 0.15s ease;
    }
    .feed-item:hover { box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08); }
    .feed-item--urgent { border-left: 4px solid var(--ms-error); }
    .feed-item--read { opacity: 0.68; }
    .feed-item mat-icon { margin-top: 0.1em; }
    .feed-item mat-icon.warn { color: var(--ms-error); }
    .unread-dot { flex: none; width: 9px; height: 9px; margin-top: 0.55em; border-radius: 50%; background: var(--ms-primary, #667eea); }
    .feed-body { flex: 1; display: flex; flex-direction: column; gap: 0.3em; min-width: 0; }
    .feed-body p { margin: 0; }
    .feed-title-row { display: flex; align-items: center; gap: 0.6em; flex-wrap: wrap; }
    .prio { text-transform: capitalize; }
    .feed-actions { display: flex; gap: 0.25em; flex-wrap: wrap; }
    .feed-actions button, .feed-actions a { min-height: 44px; }
    .detail { border-top: 1px dashed var(--ms-line); padding-top: 0.6em; display: flex; flex-direction: column; gap: 0.4em; }
    .swipe-actions { display: none; position: absolute; right: 0; top: 0; bottom: 0; align-items: stretch; background: var(--ms-surface); border-left: 1px solid var(--ms-line); }
    .swipe-actions button { min-width: 76px; min-height: 100%; border-radius: 0; }
    .feed-item--swiped .swipe-actions { display: flex; }
    .load-more { align-self: center; min-height: 44px; margin-top: 0.5em; }
    .load-cap { display: flex; align-items: center; gap: 6px; margin: 8px 0; padding: 10px 12px; border-radius: var(--ms-radius-md); background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.75rem; }
    .load-cap mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .notice { color: var(--ms-success, #2e7d32); display: flex; align-items: center; gap: 0.5em; }
    .empty-card {
      display: flex; flex-direction: column; align-items: center; gap: 0.6em; text-align: center;
      background: var(--ms-surface); border: 1px dashed var(--ms-line); border-radius: 14px; padding: 2.5em 1.5em;
      color: var(--ms-text-muted);
    }
    .empty-card mat-icon { font-size: 40px; height: 40px; width: 40px; opacity: 0.6; }
    .empty-card p { margin: 0; max-width: 34em; }
    @media (max-width: 900px) {
      .summary-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 640px) {
      .page-head h1 { font-size: 1.8rem; }
      .summary-strip { grid-template-columns: minmax(0, 1fr); }
      .head-actions { width: 100%; }
      .head-actions button, .head-actions a { flex: 1; justify-content: center; }
      .feed-item { padding: 0.8em 0.9em; }
      .feed-actions button, .feed-actions a { min-height: 48px; }
    }
  `],
})
export class NotificationsCenterComponent implements OnInit {
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
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
  protected readonly expandedId = signal<string | null>(null);
  protected readonly swipedId = signal<string | null>(null);
  protected readonly busyId = signal<string | null>(null);
  protected readonly confirmDeleteId = signal<string | null>(null);
  protected readonly confirmBulkDelete = signal(false);
  protected readonly markingAll = signal(false);

  private touchStartX: number | null = null;

  protected readonly groupKeys: GroupKey[] = ['prospects', 'community', 'training', 'goals', 'team', 'commissions', 'system'];

  protected readonly all = computed(() => {
    const group = this.groupFilter();
    const both = [...this.stored(), ...this.derived()]
      .filter((i) => !group || GROUP_OF[i.kind] === group)
      .sort((a, b) => +new Date(b.at) - +new Date(a.at));
    return both;
  });

  protected readonly groupCount = computed(() => {
    const counts = {} as Record<GroupKey, number>;
    for (const g of this.groupKeys) counts[g] = 0;
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
    return (g: GroupKey) => counts[g] ?? 0;
  });

  protected readonly urgent = computed(() => this.all().filter((i) => i.urgency && !i.read));
  protected readonly urgentCount = computed(() => this.urgent().length);
  protected readonly unreadCount = computed(() => this.all().filter((i) => !i.read).length);
  protected readonly storedCount = computed(() => this.summary()?.total ?? this.stored().length);
  protected readonly loadCapReached = computed(() => this.stored().length >= MAX_LOADED_STORED);
  protected readonly maxLoaded = MAX_LOADED_STORED;
  protected readonly totalCount = computed(() => this.storedCount() + this.derived().length);
  protected readonly unreadTotal = computed(() => (
    (this.summary()?.unread ?? this.stored().filter((item) => !item.read).length)
    + this.derived().filter((item) => !item.read).length
  ));

  protected readonly buckets = computed<DayBucket[]>(() => {
    const rest = this.all().filter((i) => !(i.urgency && !i.read));
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const buckets: DayBucket[] = [
      { label: 'Today', items: [] },
      { label: 'Yesterday', items: [] },
      { label: 'This week', items: [] },
      { label: 'Earlier', items: [] },
    ];
    for (const item of rest) {
      const t = +new Date(item.at);
      if (Number.isNaN(t) || t >= startOfToday) buckets[0].items.push(item);
      else if (t >= startOfToday - 86400000) buckets[1].items.push(item);
      else if (t >= startOfToday - 7 * 86400000) buckets[2].items.push(item);
      else buckets[3].items.push(item);
    }
    return buckets.filter((b) => b.items.length > 0);
  });

  ngOnInit(): void {
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

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected toggleUnread(): void {
    this.unreadOnly.update((v) => !v);
    this.reload();
  }

  protected setGroup(group: GroupKey | null): void {
    this.groupFilter.set(group);
    this.reload();
  }

  private selectedCategories(): string[] {
    const group = this.groupFilter();
    return group ? GROUP_CATEGORIES[group] : [];
  }

  protected groupLabel(group: GroupKey): string {
    return GROUP_LABELS[group];
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

  protected categoryLabel(kind: string): string {
    return CATEGORY_LABELS[kind] ?? this.chip(kind).label;
  }

  protected toggleDetail(id: string): void {
    this.swipedId.set(null);
    this.expandedId.update((cur) => (cur === id ? null : id));
  }

  protected onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0]?.clientX ?? null;
  }

  protected onTouchEnd(event: TouchEvent, item: StoredNotificationItem): void {
    if (this.touchStartX === null) return;
    const dx = (event.changedTouches[0]?.clientX ?? this.touchStartX) - this.touchStartX;
    this.touchStartX = null;
    if (dx <= -60) this.swipedId.set(item.id);
    else if (dx >= 24) this.swipedId.set(null);
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
    forkJoin({ list: this.notifications.list(params), prefs: this.notifications.getPreferences() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ list, prefs }) => {
          const stored = list.data?.stored ?? [];
          this.stored.set(stored);
          this.derived.set(list.data?.derived ?? []);
          this.hasMore.set(list.data?.hasMore ?? false);
          this.cursor.set(stored.length > 0 ? stored[stored.length - 1].id : null);
          this.prefs.set(prefs.data ?? null);
          this.summary.set(list.data?.summary ?? null);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
    this.notifications
      .stats(30)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const t = res.data?.totals;
          if (t && t.sent > 0) {
            this.statsLine.set(`Last 30 days: ${t.readRate}% read · ${t.clickRate}% clicked across ${t.sent} updates.`);
          }
        },
        error: () => { /* stats never block the feed */ },
      });
    this.notifications
      .actionInbox()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.inbox.set(res.data ?? null),
        error: () => { /* action inbox never blocks the center */ },
      });
  }

  protected loadMore(): void {
    const cursor = this.cursor();
    if (!cursor || this.loadingMore() || this.loading()) return;
    this.loadingMore.set(true);
    this.error.set(null);
    const params: { unread?: boolean; q?: string; cursor?: string; limit?: number; categories?: string[] } = { limit: 50, cursor };
    if (this.unreadOnly()) params.unread = true;
    if (this.search().trim()) params.q = this.search().trim();
    const categories = this.selectedCategories();
    if (categories.length > 0) params.categories = categories;
    if (this.stored().length >= MAX_LOADED_STORED) {
      this.loadingMore.set(false);
      this.notice.set('Showing the latest 500 saved alerts. Use search or a group filter to narrow the list.');
      return;
    }
    this.notifications
      .list(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const page = res.data?.stored ?? [];
          const next = [...this.stored(), ...page.filter((p) => !this.stored().some((s) => s.id === p.id))];
          this.stored.set(next);
          this.hasMore.set(res.data?.hasMore ?? false);
          this.cursor.set(next.length > 0 ? next[next.length - 1].id : null);
          this.loadingMore.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loadingMore.set(false);
        },
      });
  }

  protected chip(kind: string): { label: string; color: string; text: string } {
    return KIND_META[kind] ?? { label: kind, color: '#e0e0e0', text: '#424242' };
  }

  protected kindClass(kind: string): string {
    return `dp-status dp-status--${KIND_CLASS[kind] ?? 'neutral'}`;
  }

  protected prioClass(priority: string): string {
    const p = (priority ?? '').toLowerCase();
    if (p === 'critical' || p === 'high') return 'dp-status dp-status--bad';
    if (p === 'medium') return 'dp-status dp-status--warn';
    return 'dp-status dp-status--neutral';
  }

  /** Stored open: click beacon first (engagement analytics), then navigate. */
  protected openStored(item: StoredNotificationItem): void {
    if (!item.link) return;
    const link = item.link;
    this.notifications
      .recordOpen(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.stored.set(this.stored().map((s) => (s.id === item.id ? { ...s, read: true } : s)));
          void this.router.navigateByUrl(link);
        },
        error: () => {
          void this.router.navigateByUrl(link);
        },
      });
  }

  /** Derived (computed) items dismiss through the legacy read endpoint. */
  protected dismiss(id: string): void {
    this.busyId.set(id);
    this.notifications
      .markRead([id])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.swipedId.set(null);
          this.derived.set(this.derived().filter((i) => i.id !== id));
        },
        error: (err: ApiError) => {
          this.busyId.set(null);
          this.error.set(err.message);
        },
      });
  }

  protected markAllRead(): void {
    if (this.all().length === 0) return;
    this.markingAll.set(true);
    this.notifications
      .bulk('read-all')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const ids = this.derived().map((i) => i.id);
          if (ids.length === 0) {
            this.markingAll.set(false);
            this.reload();
            return;
          }
          this.notifications
            .markRead(ids)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                this.markingAll.set(false);
                this.reload();
              },
              error: (err: ApiError) => {
                this.markingAll.set(false);
                this.error.set(err.message);
              },
            });
        },
        error: (err: ApiError) => {
          this.markingAll.set(false);
          this.error.set(err.message);
        },
      });
  }

  protected archiveAll(): void {
    if (this.all().length === 0) return;
    this.markingAll.set(true);
    this.notifications
      .bulk('archive-all')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.markingAll.set(false);
          this.reload();
        },
        error: (err: ApiError) => {
          this.markingAll.set(false);
          this.error.set(err.message);
        },
      });
  }

  protected deleteAll(): void {
    if (this.all().length === 0) return;
    this.markingAll.set(true);
    this.notifications
      .bulk('delete-all')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.markingAll.set(false);
          this.confirmBulkDelete.set(false);
          this.reload();
        },
        error: (err: ApiError) => {
          this.markingAll.set(false);
          this.error.set(err.message);
        },
      });
  }

  protected archiveStored(id: string): void {
    this.busyId.set(id);
    this.notifications
      .archiveStored(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.swipedId.set(null);
          this.stored.set(this.stored().filter((i) => i.id !== id));
        },
        error: (err: ApiError) => {
          this.busyId.set(null);
          this.error.set(err.message);
        },
      });
  }

  protected markUnread(item: StoredNotificationItem): void {
    this.busyId.set(item.id);
    this.notifications
      .markStoredUnread(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.stored.set(this.stored().map((s) => (s.id === item.id ? { ...s, read: false } : s)));
        },
        error: (err: ApiError) => {
          this.busyId.set(null);
          this.error.set(err.message);
        },
      });
  }

  protected deleteStored(id: string): void {
    this.busyId.set(id);
    this.notifications
      .deleteStored(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.confirmDeleteId.set(null);
          this.swipedId.set(null);
          this.stored.set(this.stored().filter((i) => i.id !== id));
        },
        error: (err: ApiError) => {
          this.busyId.set(null);
          this.error.set(err.message);
        },
      });
  }

  /** "Mute these" turns the category off in-app for future items and archives this one. */
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
    this.notifications
      .updatePreferences({ channels, emailDigest: current.emailDigest })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.prefs.set(res.data ?? this.prefs());
          this.notice.set(
            `You muted “${this.categoryLabel(item.kind)}” — future ones won't appear in-app. Change anytime in Notification settings.`,
          );
          this.archiveStored(item.id);
        },
        error: (err: ApiError) => {
          this.busyId.set(null);
          this.error.set(err.message);
        },
      });
  }
}
