import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { ApiError, userError } from '../../../core/http/api-error';
import { AvatarComponent } from '../../../_common/avatar.component';
import {
  AdminOraConversationSummary,
  AdminOraDetail,
  AdminOraOverview,
  AdminOraService,
} from './admin-ora.service';

@Component({
  selector: 'async-admin-ora',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe, DecimalPipe, FormsModule, MatButtonModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatProgressBarModule, MatSelectModule, MatTableModule, MatTooltipModule, RouterModule,
    AvatarComponent,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Admin</a> &gt;
        <span>Ora monitor</span>
      </div>
    </section>

    <section class="ora-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Communications · Ora oversight</p>
          <h1>Ora monitor</h1>
          <p class="subtitle">Read every Ora conversation, inspect actions and plans, and moderate chats that need review.</p>
        </div>
        <div class="head-actions">
          <button mat-stroked-button type="button" (click)="exportCsv()" [disabled]="exporting() || loading()">
            <mat-icon>download</mat-icon>
            {{ exporting() ? 'Exporting…' : 'Export CSV' }}
          </button>
          <button mat-stroked-button type="button" (click)="refreshAll()" [disabled]="loading()">
            <mat-icon>refresh</mat-icon>
            Refresh
          </button>
        </div>
      </header>

      @if (overview(); as o) {
        <section class="kpi-grid" aria-label="Ora summary">
          <article class="kpi"><span class="kpi-icon"><mat-icon>forum</mat-icon></span><div><strong>{{ o.conversations | number }}</strong><span>Conversations</span><small>{{ o.activeUsers }} active users</small></div></article>
          <article class="kpi"><span class="kpi-icon kpi-icon--info"><mat-icon>chat</mat-icon></span><div><strong>{{ o.messages | number }}</strong><span>Messages</span><small>{{ o.exchanges }} exchanges</small></div></article>
          <article class="kpi" [class.kpi--warn]="o.flagged > 0"><span class="kpi-icon kpi-icon--warn"><mat-icon>flag</mat-icon></span><div><strong>{{ o.flagged }}</strong><span>Flagged</span><small>Need review</small></div></article>
          <article class="kpi" [class.kpi--warn]="o.hidden > 0"><span class="kpi-icon kpi-icon--bad"><mat-icon>visibility_off</mat-icon></span><div><strong>{{ o.hidden }}</strong><span>Hidden</span><small>Removed from partner view</small></div></article>
          <article class="kpi"><span class="kpi-icon"><mat-icon>bolt</mat-icon></span><div><strong>{{ o.actions.proposed }}</strong><span>Actions waiting</span><small>{{ o.actions.failed }} failed</small></div></article>
          <article class="kpi"><span class="kpi-icon kpi-icon--info"><mat-icon>speed</mat-icon></span><div><strong>{{ o.avgLatencyMs | number }}ms</strong><span>Avg reply</span><small>Provider latency</small></div></article>
        </section>

        @if (o.topics.length > 0) {
          <section class="topic-strip" aria-label="Top Ora topics">
            @for (topic of o.topics; track topic.topic) {
              <span class="topic-chip">{{ topic.topic }} <strong>{{ topic.count }}</strong></span>
            }
          </section>
        }

        @if (o.daily.length > 0) {
          <section class="daily-card" aria-labelledby="ora-daily-title">
            <div class="daily-head">
              <div>
                <p class="eyebrow">Daily activity</p>
                <h2 id="ora-daily-title">Conversations per day</h2>
              </div>
              <span>Last {{ o.windowDays }} days</span>
            </div>
            <div class="sparkline" role="img" aria-label="Daily Ora conversation volume">
              @for (day of o.daily; track day.date) {
                <span
                  class="spark-bar"
                  [style.height.%]="barHeight(day.count, dailyMax())"
                  [title]="day.date + ': ' + day.count + ' conversations'"></span>
              }
            </div>
            <div class="spark-axis">
              <span>{{ o.daily[0].date }}</span>
              <span>{{ o.daily[o.daily.length - 1].date }}</span>
            </div>
          </section>
        }
      }

      @if (error(); as err) {
        <div class="alert" role="alert">{{ err }} <button mat-button type="button" (click)="refreshAll()">Retry</button></div>
      }

      <div class="toolbar-card">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>Search user, username, title or message</mat-label>
          <input matInput type="search" [value]="query()" (input)="onSearch($any($event.target).value)" maxlength="120" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Activation</mat-label>
          <mat-select [value]="accountState()" (selectionChange)="accountState.set($event.value); skip.set(0); reload()">
            <mat-option value="">All accounts</mat-option>
            <mat-option value="member">Members</mat-option>
            <mat-option value="partner">Partners</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Flag</mat-label>
          <mat-select [value]="flagged()" (selectionChange)="flagged.set($event.value); skip.set(0); reload()">
            <mat-option value="all">All</mat-option>
            <mat-option value="yes">Flagged only</mat-option>
            <mat-option value="no">Not flagged</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Visibility</mat-label>
          <mat-select [value]="hidden()" (selectionChange)="hidden.set($event.value); skip.set(0); reload()">
            <mat-option value="all">All</mat-option>
            <mat-option value="yes">Hidden only</mat-option>
            <mat-option value="no">Visible only</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>From</mat-label>
          <input matInput type="date" [value]="from()" (change)="from.set($any($event.target).value); skip.set(0); reload()" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>To</mat-label>
          <input matInput type="date" [value]="to()" (change)="to.set($any($event.target).value); skip.set(0); reload()" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Per page</mat-label>
          <mat-select [value]="limit()" (selectionChange)="limit.set($event.value); skip.set(0); reload()">
            <mat-option [value]="25">25</mat-option>
            <mat-option [value]="50">50</mat-option>
            <mat-option [value]="100">100</mat-option>
          </mat-select>
        </mat-form-field>
        @if (hasFilters()) { <button mat-button type="button" (click)="clearFilters()">Clear</button> }
      </div>

      @if (loading()) { <mat-progress-bar mode="indeterminate" aria-label="Loading Ora conversations" /> }

      @if (rows().length > 0) {
        <div class="table-wrap">
          <table mat-table [dataSource]="rows()" class="mat-elevation-z2">
            <ng-container matColumnDef="partner">
              <th mat-header-cell *matHeaderCellDef>User</th>
              <td mat-cell *matCellDef="let row" class="partner-cell">
                <async-avatar [photo]="row.partner?.profileImage" [name]="row.partner?.name || 'Unknown user'" size="sm" />
                <div>
                  <button mat-button type="button" (click)="open(row)" [matTooltip]="'Open Ora conversation for ' + (row.partner?.name || 'user')">{{ row.partner?.name || 'Unknown user' }}</button>
                  <span class="muted">&#64;{{ row.partner?.username || '—' }}</span>
                  <span class="muted">{{ row.partner?.email || '' }}</span>
                </div>
                <span class="dp-status" [class.dp-status--ok]="row.partner?.accountState === 'partner'" [class.dp-status--warn]="row.partner?.accountState !== 'partner'">
                  {{ row.partner?.accountState === 'partner' ? 'Partner' : 'Member' }}
                </span>
              </td>
            </ng-container>
            <ng-container matColumnDef="conversation">
              <th mat-header-cell *matHeaderCellDef>Conversation</th>
              <td mat-cell *matCellDef="let row">
                <strong>{{ row.title }}</strong>
                <span class="muted">{{ row.lastMessage?.role === 'assistant' ? 'Ora' : 'User' }}: {{ row.lastMessage?.content || 'No messages yet' }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="activity">
              <th mat-header-cell *matHeaderCellDef>Activity</th>
              <td mat-cell *matCellDef="let row">
                <strong>{{ row.messageCount }} messages</strong>
                <span class="muted">{{ row.updatedAt | date:'medium' }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                @if (row.moderation.flagged) { <span class="dp-status dp-status--bad">flagged</span> }
                @if (row.moderation.hidden) { <span class="dp-status dp-status--warn">hidden</span> }
                @if (!row.moderation.flagged && !row.moderation.hidden) { <span class="dp-status dp-status--ok">visible</span> }
                @if (row.moderation.notesCount) { <span class="dp-status dp-status--info">{{ row.moderation.notesCount }} notes</span> }
              </td>
            </ng-container>
            <ng-container matColumnDef="manage">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let row"><button mat-button type="button" (click)="open(row)">Inspect</button></td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" (click)="open(row)"></tr>
          </table>
        </div>
        <div class="pager">
          <button mat-button type="button" (click)="page(-1)" [disabled]="skip() === 0 || loading()">Previous</button>
          <span class="muted">{{ skip() + 1 }}–{{ skip() + rows().length }} of {{ total() }}</span>
          <button mat-button type="button" (click)="page(1)" [disabled]="skip() + limit() >= total() || loading()">Next</button>
        </div>
      } @else if (!loading() && !error()) {
        <p class="empty">No Ora conversations match those filters.</p>
      }

      @if (detail(); as view) {
        <section class="detail-card" role="region" aria-label="Ora conversation detail">
          <header class="detail-head">
            <div class="detail-user">
              <async-avatar [photo]="view.conversation.partner?.profileImage" [name]="view.conversation.partner?.name || 'Unknown user'" size="md" />
              <div>
                <h2>{{ view.conversation.partner?.name || 'Unknown user' }}</h2>
                <p class="muted">
                  &#64;{{ view.conversation.partner?.username || '—' }} ·
                  {{ view.conversation.partner?.email || 'no email' }} ·
                  <span [class]="view.conversation.partner?.accountState === 'partner' ? 'dp-status dp-status--ok' : 'dp-status dp-status--warn'">
                    {{ view.conversation.partner?.accountState === 'partner' ? 'Partner' : 'Member' }}
                  </span>
                </p>
                @if (view.conversation.partner?.id) {
                  <a mat-button [routerLink]="['/members', view.conversation.partner?.id]">Open Member 360</a>
                }
              </div>
            </div>
            <div class="detail-actions">
              <button mat-button type="button" (click)="close()">Close</button>
              <button mat-stroked-button type="button" (click)="toggleFlag(view)" [disabled]="busy()">
                <mat-icon>flag</mat-icon>
                {{ view.conversation.moderation.flagged ? 'Unflag' : 'Flag' }}
              </button>
              <button mat-stroked-button type="button" (click)="toggleHide(view)" [disabled]="busy()">
                <mat-icon>{{ view.conversation.moderation.hidden ? 'visibility' : 'visibility_off' }}</mat-icon>
                {{ view.conversation.moderation.hidden ? 'Restore' : 'Hide from partner' }}
              </button>
            </div>
          </header>

          <div class="detail-meta">
            <span>{{ view.conversation.messageCount }} messages</span>
            <span>{{ view.conversation.updatedAt | date:'medium' }}</span>
            @if (view.plan) { <span>Plan {{ view.plan.dateKey }}</span> }
            @if (view.conversation.moderation.flagged) { <span class="alert-text">Flagged: {{ view.conversation.moderation.flagReason || 'review requested' }}</span> }
            @if (view.conversation.moderation.hidden) { <span class="alert-text">Hidden: {{ view.conversation.moderation.hiddenReason || 'no reason recorded' }}</span> }
          </div>

          <div class="detail-grid">
            <div class="transcript-panel">
              <h3>Transcript</h3>
              <div class="transcript">
                @for (message of view.conversation.messages; track message.at + message.role + message.content) {
                  <article class="message" [class.message--user]="message.role === 'user'" [class.message--ora]="message.role === 'assistant'">
                    <span class="message-role">{{ message.role === 'user' ? 'User' : 'Ora' }}</span>
                    <p>{{ message.content }}</p>
                    @if (message.at) { <span class="message-time">{{ message.at | date:'medium' }}</span> }
                  </article>
                } @empty {
                  <p class="empty">This conversation has no messages.</p>
                }
              </div>
            </div>

            <aside class="side-panel">
              <div class="side-block">
                <h3>Actions</h3>
                @for (action of view.actions; track action.id) {
                  <div class="action-row">
                    <div><strong>{{ action.title || action.label }}</strong><span class="muted">{{ action.type }} · {{ action.createdAt | date:'mediumDate' }}</span></div>
                    <span class="dp-status" [class.dp-status--ok]="action.status === 'executed'" [class.dp-status--bad]="action.status === 'failed'" [class.dp-status--warn]="action.status === 'proposed'">{{ action.status }}</span>
                  </div>
                } @empty { <p class="muted">No actions recorded.</p> }
              </div>

              <div class="side-block">
                <h3>Admin note</h3>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Internal note</mat-label>
                  <textarea matInput rows="2" maxlength="1000" [value]="note()" (input)="note.set($any($event.target).value)"></textarea>
                </mat-form-field>
                <button mat-stroked-button type="button" (click)="addNote()" [disabled]="busy() || note().trim().length < 2">Save note</button>
                @for (entry of view.conversation.moderation.notes ?? []; track entry.at + entry.note) {
                  <p class="admin-note"><strong>{{ entry.at | date:'medium' }}</strong> {{ entry.note }}</p>
                }
                @if (actionError(); as err) { <p class="error" role="alert">{{ err }}</p> }
              </div>

              <div class="side-block">
                <h3>Usage</h3>
                @for (event of view.events; track event.id) {
                  <div class="event-row"><span>{{ event.topic }}</span><span class="muted">{{ event.latencyMs }}ms · {{ event.at | date:'medium' }}</span></div>
                } @empty { <p class="muted">No event metadata.</p> }
              </div>
            </aside>
          </div>
        </section>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 16px; }
    .breadcrumb a { text-decoration: none; }
    .ora-page { display: flex; flex-direction: column; gap: 16px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
    .page-head h1 { margin: 4px 0 6px; font-size: clamp(1.8rem, 3vw, 2.4rem); letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .subtitle { margin: 0; max-width: 62em; color: var(--ms-text-muted); line-height: 1.55; }
    .head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .head-actions mat-icon { margin-right: 4px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
    .kpi { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); min-width: 0; }
    .kpi--warn { border-color: var(--ms-warning); background: var(--ms-warning-soft); }
    .kpi-icon { flex: none; width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .kpi-icon--info { background: var(--ms-info-soft); }
    .kpi-icon--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .kpi-icon--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .kpi div { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .kpi strong { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
    .kpi span:not(.kpi-icon) { color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; }
    .kpi small { color: var(--ms-text-muted); font-size: 0.7rem; }
    .topic-strip { display: flex; gap: 6px; flex-wrap: wrap; }
    .topic-chip { padding: 5px 9px; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.74rem; }
    .topic-chip strong { color: var(--ms-primary-strong); margin-left: 3px; }
    .daily-card { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .daily-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
    .daily-head h2 { margin: 2px 0 0; font-size: 0.95rem; }
    .daily-head > span { color: var(--ms-text-muted); font-size: 0.68rem; }
    .sparkline { display: flex; align-items: flex-end; justify-content: center; gap: 3px; height: 64px; padding-top: 4px; }
    .spark-bar { flex: 0 1 26px; min-width: 3px; border-radius: 3px 3px 0 0; background: linear-gradient(180deg, var(--ms-primary), color-mix(in srgb, var(--ms-primary) 58%, transparent)); transition: height 240ms ease; }
    .spark-bar:hover { filter: brightness(1.15); }
    .spark-axis { display: flex; justify-content: space-between; color: var(--ms-text-muted); font-size: 0.62rem; }
    .alert { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: var(--ms-radius-md); background: var(--ms-error-soft); color: var(--ms-error); }
    .toolbar-card { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .search-field { flex: 1 1 260px; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    table { width: 100%; min-width: 900px; }
    th, td { padding: 10px 12px; text-align: left; vertical-align: middle; border-bottom: 1px solid var(--ms-line); }
    th { color: var(--ms-text-muted); font-size: 0.68rem; letter-spacing: 0.06em; text-transform: uppercase; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr { cursor: pointer; }
    tbody tr:hover { background: var(--ms-canvas); }
    .partner-cell { display: flex; align-items: center; gap: 9px; min-width: 220px; }
    .partner-cell > div { display: flex; flex-direction: column; min-width: 0; }
    .partner-cell button { min-height: 30px; padding: 0; justify-content: flex-start; font-weight: 700; }
    .partner-cell .dp-status { margin-left: auto; }
    .muted { color: var(--ms-text-muted); font-size: 0.78rem; }
    .pager { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .empty { padding: 20px; color: var(--ms-text-muted); text-align: center; }
    .detail-card { padding: 18px; border: 1px solid var(--ms-primary); border-radius: var(--ms-radius-lg); background: var(--ms-surface); display: flex; flex-direction: column; gap: 14px; }
    .detail-head { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .detail-user { display: flex; align-items: center; gap: 12px; }
    .detail-user h2 { margin: 0; }
    .detail-user p { margin: 2px 0; }
    .detail-actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .detail-meta { display: flex; gap: 8px 16px; flex-wrap: wrap; padding: 8px 10px; border-radius: 8px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.78rem; }
    .alert-text { color: var(--ms-warning); font-weight: 700; }
    .detail-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(260px, 0.8fr); gap: 16px; align-items: start; }
    h3 { margin: 0 0 8px; font-size: 0.95rem; }
    .transcript { display: flex; flex-direction: column; gap: 8px; max-height: 620px; overflow-y: auto; padding-right: 4px; }
    .message { max-width: 88%; padding: 9px 11px; border-radius: 12px; background: var(--ms-canvas); border: 1px solid var(--ms-line); }
    .message--user { align-self: flex-end; background: var(--ms-primary-soft); }
    .message--ora { align-self: flex-start; }
    .message-role { display: block; font-size: 0.66rem; font-weight: 800; text-transform: uppercase; color: var(--ms-text-muted); margin-bottom: 3px; }
    .message p { margin: 0; white-space: pre-wrap; line-height: 1.5; }
    .message-time { display: block; margin-top: 4px; color: var(--ms-text-muted); font-size: 0.66rem; }
    .side-panel { display: flex; flex-direction: column; gap: 12px; }
    .side-block { padding: 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); background: var(--ms-canvas); }
    .action-row, .event-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px solid var(--ms-line); }
    .action-row:first-of-type, .event-row:first-of-type { border-top: none; }
    .action-row div { display: flex; flex-direction: column; gap: 1px; }
    .admin-note { margin: 8px 0 0; padding-top: 8px; border-top: 1px solid var(--ms-line); font-size: 0.78rem; line-height: 1.45; }
    .error { color: var(--ms-error); }
    @media (max-width: 900px) {
      .detail-grid { grid-template-columns: minmax(0, 1fr); }
      .transcript { max-height: 480px; }
    }
    @media (max-width: 600px) {
      .page-head, .toolbar-card { flex-direction: column; align-items: stretch; }
      .head-actions button { flex: 1 1 auto; }
      .partner-cell { min-width: 0; }
      .detail-card { padding: 14px; }
    }
  `],
})
export class AdminOraComponent implements OnInit {
  private readonly ora = inject(AdminOraService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly overview = signal<AdminOraOverview | null>(null);
  protected readonly dailyMax = computed(() =>
    Math.max(1, ...(this.overview()?.daily ?? []).map((day) => Number(day.count) || 0)));
  protected readonly rows = signal<AdminOraConversationSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly limit = signal(25);
  protected readonly skip = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly detail = signal<AdminOraDetail | null>(null);
  protected readonly busy = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly exporting = signal(false);
  protected readonly query = signal('');
  protected readonly accountState = signal<'' | 'member' | 'partner'>('');
  protected readonly flagged = signal<'all' | 'yes' | 'no'>('all');
  protected readonly hidden = signal<'all' | 'yes' | 'no'>('all');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly note = signal('');
  protected readonly displayedColumns = ['partner', 'conversation', 'activity', 'status', 'manage'];
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly hasFilters = computed(() =>
    this.query().trim() !== '' || this.accountState() !== '' || this.flagged() !== 'all'
    || this.hidden() !== 'all' || this.from() !== '' || this.to() !== '');

  ngOnInit(): void {
    this.loadOverview();
    this.reload();
  }

  protected refreshAll(): void {
    this.loadOverview();
    this.reload();
  }

  protected barHeight(count: number, max: number): number {
    return Math.max(4, (Math.max(0, Number(count) || 0) / Math.max(1, Number(max) || 1)) * 100);
  }

  protected loadOverview(): void {
    this.ora.overview(30).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => this.overview.set(res.data ?? null),
      error: () => this.overview.set(null),
    });
  }

  protected onSearch(value: string): void {
    this.query.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.skip.set(0);
      this.reload();
    }, 350);
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.ora.conversations({
      q: this.query(),
      ...(this.accountState() ? { accountState: this.accountState() as 'member' | 'partner' } : {}),
      flagged: this.flagged(),
      hidden: this.hidden(),
      ...(this.from() ? { from: new Date(`${this.from()}T00:00:00.000`).toISOString() } : {}),
      ...(this.to() ? { to: new Date(`${this.to()}T23:59:59.999`).toISOString() } : {}),
      limit: this.limit(),
      skip: this.skip(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.rows.set(res.data?.items ?? []);
        this.total.set(res.data?.total ?? 0);
        this.loading.set(false);
      },
      error: (err: ApiError) => {
        this.loading.set(false);
        this.error.set(userError(err));
      },
    });
  }

  protected page(direction: -1 | 1): void {
    this.skip.set(Math.max(0, this.skip() + direction * this.limit()));
    this.reload();
  }

  protected open(row: AdminOraConversationSummary): void {
    this.ora.conversation(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.detail.set(res.data ?? null);
        this.note.set('');
        this.actionError.set(null);
      },
      error: (err: ApiError) => this.actionError.set(userError(err)),
    });
  }

  protected close(): void {
    this.detail.set(null);
    this.note.set('');
    this.actionError.set(null);
  }

  protected toggleFlag(view: AdminOraDetail): void {
    const flagged = !view.conversation.moderation.flagged;
    const reason = flagged ? (window.prompt('Reason for flagging this conversation?') ?? '') : '';
    if (flagged && !reason.trim()) return;
    this.runModeration(
      this.ora.flag(view.conversation.id, flagged, reason),
      flagged ? 'Conversation flagged' : 'Conversation unflagged',
    );
  }

  protected toggleHide(view: AdminOraDetail): void {
    const hidden = !view.conversation.moderation.hidden;
    const reason = hidden ? (window.prompt('Reason for hiding this conversation from the partner?') ?? '') : '';
    if (hidden && !reason.trim()) return;
    this.runModeration(
      this.ora.hide(view.conversation.id, hidden, reason),
      hidden ? 'Conversation hidden from partner' : 'Conversation restored',
    );
  }

  protected addNote(): void {
    const view = this.detail();
    if (!view || this.note().trim().length < 2 || this.busy()) return;
    this.busy.set(true);
    this.actionError.set(null);
    this.ora.note(view.conversation.id, this.note().trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.note.set('');
        this.open(view.conversation);
        this.reload();
      },
      error: (err: ApiError) => {
        this.busy.set(false);
        this.actionError.set(userError(err));
      },
    });
  }

  private runModeration(request: ReturnType<AdminOraService['flag']>, message: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.busy.set(false);
        const view = this.detail();
        if (view && res.data) {
          this.detail.set({ ...view, conversation: { ...view.conversation, moderation: { ...res.data.moderation, notes: view.conversation.moderation.notes ?? [] } } });
        }
        this.reload();
        this.loadOverview();
      },
      error: (err: ApiError) => {
        this.busy.set(false);
        this.actionError.set(userError(err));
      },
    });
  }

  protected clearFilters(): void {
    this.query.set('');
    this.accountState.set('');
    this.flagged.set('all');
    this.hidden.set('all');
    this.from.set('');
    this.to.set('');
    this.skip.set(0);
    this.reload();
  }

  protected exportCsv(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.ora.exportCsv({
      q: this.query(),
      ...(this.accountState() ? { accountState: this.accountState() as 'member' | 'partner' } : {}),
      flagged: this.flagged(),
      hidden: this.hidden(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'ora-conversations.csv';
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (err: ApiError) => {
        this.exporting.set(false);
        this.error.set(userError(err));
      },
    });
  }
}
