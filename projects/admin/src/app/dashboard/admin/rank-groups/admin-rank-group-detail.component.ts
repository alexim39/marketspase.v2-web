import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { environment } from '../../../../environments/environment';
import { ApiError, userError } from '../../../core/http/api-error';
import {
  AdminRankGroupsService,
  RankGroupDetail,
  RankGroupRank,
} from './admin-rank-groups.service';

const RANKS: RankGroupRank[] = ['Partner', 'Builder', 'Leader', 'Ambassador'];
const isRank = (value: string): value is RankGroupRank => (RANKS as string[]).includes(value);

/**
 * In-admin moderation for one official journey-level group: read and reply,
 * remove messages, update the pinned welcome, ban/unban members and resolve
 * reported messages without leaving the admin app.
 */
@Component({
  selector: 'async-admin-rank-group-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatProgressBarModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/rank-groups">Rank groups</a> &gt;
        <span>{{ detail()?.name ?? rank() ?? 'Group' }}</span>
      </div>
    </section>

    <section class="detail-page">
      <header class="page-head">
        <div>
          <h2>{{ detail()?.name ?? (rank() ? rank() + ' Circle' : 'Rank group') }}</h2>
          <p class="subtitle">{{ detail()?.description || 'Official journey-level group.' }}</p>
          @if (detail(); as d) {
            <div class="chips">
              <span class="ms-chip ms-chip--brand">{{ d.rank }}</span>
              <span class="ms-chip">{{ d.memberCount }} members</span>
              <span class="ms-chip">{{ d.adminCount }} admins</span>
              <span class="ms-chip">Auto-managed</span>
            </div>
          }
        </div>
        <div class="head-actions">
          <a mat-stroked-button routerLink="/rank-groups"><mat-icon>arrow_back</mat-icon> All groups</a>
          @if (detail(); as d) {
            <a mat-stroked-button [href]="groupUrl(d.groupId)" target="_blank" rel="noopener">
              <mat-icon>open_in_new</mat-icon> Partner view
            </a>
          }
          <button mat-button type="button" (click)="load()" [disabled]="loading()">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
        </div>
      </header>

      @if (notice(); as note) { <p class="notice" role="status">{{ note }}</p> }
      @if (error(); as err) {
        <p class="error" role="alert">{{ err }} <button mat-button (click)="load()">Retry</button></p>
      }
      @if (loading()) { <mat-progress-bar mode="indeterminate" aria-label="Loading group" /> }

      @if (detail(); as d) {
        <div class="detail-layout">
          <section class="dp-card chat-card" aria-label="Group messages">
            <header class="card-head">
              <strong>Recent messages</strong>
              <span class="muted">Newest first · {{ d.messages.length }} loaded</span>
            </header>
            <div class="message-list">
              @for (m of messages(); track m.id) {
                <article class="message-row">
                  <div class="message-main">
                    <div class="message-meta">
                      <strong>{{ m.senderName || 'Member' }}</strong>
                      @if (m.senderRole === 'admin') { <span class="mini-badge">admin</span> }
                      <span class="muted">{{ m.createdAt | date:'medium' }}</span>
                      @if (m.id === d.pinnedMessage?.id) { <span class="mini-badge pinned">pinned</span> }
                    </div>
                    <p>{{ m.body }}</p>
                    @if (m.attachments?.length) {
                      <p class="muted">{{ m.attachments!.length }} attachment{{ m.attachments!.length === 1 ? '' : 's' }}</p>
                    }
                  </div>
                  <button
                    mat-icon-button
                    type="button"
                    color="warn"
                    aria-label="Delete message"
                    title="Delete message"
                    (click)="removeMessage(m.id)"
                    [disabled]="busy() === 'message:' + m.id"
                  >
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </article>
              } @empty {
                <p class="empty">No messages yet. Say hello or update the pinned welcome.</p>
              }
            </div>
            <div class="composer">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Message the group</mat-label>
                <textarea matInput rows="2" maxlength="2000" [ngModel]="draft()" (ngModelChange)="draft.set($event)" placeholder="Reply as an admin…"></textarea>
              </mat-form-field>
              <button mat-flat-button color="primary" type="button" (click)="send()" [disabled]="busy() === 'send' || !draft().trim()">
                @if (busy() === 'send') { Sending… } @else { Send }
              </button>
            </div>
          </section>

          <aside class="side">
            <section class="dp-card side-card">
              <h3>Pinned welcome</h3>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Welcome message</mat-label>
                <textarea matInput rows="4" maxlength="2000" [ngModel]="pinnedDraft()" (ngModelChange)="pinnedDraft.set($event)"></textarea>
              </mat-form-field>
              <button mat-stroked-button type="button" (click)="savePinned()" [disabled]="busy() === 'pinned' || !pinnedDraft().trim()">
                {{ busy() === 'pinned' ? 'Saving…' : 'Save pinned welcome' }}
              </button>
            </section>

            <section class="dp-card side-card">
              <h3>Members <span class="muted">({{ d.members.length }})</span></h3>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Ban reason (optional)</mat-label>
                <input matInput maxlength="300" [ngModel]="banReason()" (ngModelChange)="banReason.set($event)" placeholder="Used with the next Ban action" />
              </mat-form-field>
              <ul class="plain-list">
                @for (member of d.members; track member.id) {
                  <li>
                    <span class="member-main">
                      <strong>{{ member.name }}</strong>
                      <span class="muted">@{{ member.username || 'member' }} · {{ member.role }}</span>
                    </span>
                    @if (member.role !== 'admin') {
                      <button mat-button color="warn" type="button" (click)="banMember(member.id)" [disabled]="busy() === 'ban:' + member.id">
                        Ban
                      </button>
                    }
                  </li>
                }
              </ul>
            </section>

            <section class="dp-card side-card">
              <h3>Banned <span class="muted">({{ d.bans.length }})</span></h3>
              @if (d.bans.length === 0) {
                <p class="empty">Nobody is banned.</p>
              } @else {
                <ul class="plain-list">
                  @for (ban of d.bans; track ban.partnerId) {
                    <li>
                      <span class="member-main">
                        <strong>{{ ban.name || 'Former member' }}</strong>
                        <span class="muted">{{ ban.reason || 'No reason given' }}</span>
                      </span>
                      <button mat-button type="button" (click)="unban(ban.partnerId)" [disabled]="busy() === 'unban:' + ban.partnerId">Unban</button>
                    </li>
                  }
                </ul>
              }
            </section>

            <section class="dp-card side-card">
              <h3>Reported messages <span class="muted">({{ d.reports.length }})</span></h3>
              @if (d.reports.length === 0) {
                <p class="empty">No open reports.</p>
              } @else {
                <ul class="report-list">
                  @for (report of d.reports; track report.id) {
                    <li>
                      <p class="muted">{{ report.reason || 'No reason given' }}</p>
                      <p>{{ report.message?.body || '(message removed)' }}</p>
                      <span class="report-actions">
                        <button mat-button type="button" (click)="decideReport(report.id, 'dismiss')" [disabled]="busy() === 'report:' + report.id">Dismiss</button>
                        <button mat-button color="warn" type="button" (click)="decideReport(report.id, 'remove')" [disabled]="busy() === 'report:' + report.id">Remove</button>
                        <button mat-button color="warn" type="button" (click)="decideReport(report.id, 'remove', true)" [disabled]="busy() === 'report:' + report.id">Remove + ban</button>
                      </span>
                    </li>
                  }
                </ul>
              }
            </section>
          </aside>
        </div>
      }
    </section>
  `,
  styles: [`
    .detail-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1em; flex-wrap: wrap; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.3em 0 0; max-width: 52em; color: var(--ms-text-muted); line-height: 1.55; }
    .chips { display: flex; flex-wrap: wrap; gap: 0.35em; margin-top: 0.6em; }
    .head-actions { display: flex; align-items: center; gap: 0.4em; flex-wrap: wrap; }
    .head-actions a, .head-actions button { min-height: 44px; }
    .detail-layout { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr); gap: 1em; align-items: start; }
    .chat-card { display: flex; flex-direction: column; min-height: 520px; overflow: hidden; }
    .card-head { display: flex; justify-content: space-between; gap: 0.6em; flex-wrap: wrap; padding: 0.9em 1em; border-bottom: 1px solid var(--ms-line); background: var(--ms-canvas); }
    .message-list { display: flex; flex-direction: column; gap: 0.75em; padding: 1em; max-height: 520px; overflow-y: auto; }
    .message-row { display: flex; align-items: flex-start; gap: 0.6em; padding-bottom: 0.7em; border-bottom: 1px solid var(--ms-line); }
    .message-row:last-child { border-bottom: none; padding-bottom: 0; }
    .message-main { flex: 1; min-width: 0; }
    .message-main p { margin: 0.3em 0 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.55; }
    .message-meta { display: flex; align-items: center; gap: 0.45em; flex-wrap: wrap; }
    .mini-badge { border-radius: 999px; padding: 0.05em 0.45em; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.66em; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
    .mini-badge.pinned { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .composer { display: flex; align-items: flex-end; gap: 0.6em; padding: 0.8em 1em; border-top: 1px solid var(--ms-line); background: var(--ms-canvas); }
    .composer mat-form-field { flex: 1; }
    .composer button { min-height: 44px; margin-bottom: 0.2em; }
    .side { display: flex; flex-direction: column; gap: 1em; min-width: 0; }
    .side-card { padding: 1em; display: flex; flex-direction: column; gap: 0.7em; }
    .side-card h3 { margin: 0; }
    .side-card mat-form-field { width: 100%; }
    .plain-list, .report-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6em; max-height: 260px; overflow-y: auto; }
    .plain-list li, .report-list li { display: flex; align-items: flex-start; gap: 0.5em; border-top: 1px solid var(--ms-line); padding-top: 0.55em; }
    .plain-list li:first-child, .report-list li:first-child { border-top: none; padding-top: 0; }
    .member-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1em; }
    .member-main strong, .member-main span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .report-list li { flex-direction: column; }
    .report-list p { margin: 0; overflow-wrap: anywhere; }
    .report-actions { display: flex; gap: 0.25em; flex-wrap: wrap; }
    .report-actions button { min-height: 40px; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .empty { color: var(--ms-text-muted); margin: 0; }
    .notice { margin: 0; color: var(--ms-success); font-weight: 600; }
    .error { margin: 0; color: var(--ms-error); }
    @media (max-width: 900px) {
      .detail-layout { grid-template-columns: 1fr; }
    }
    @media (prefers-reduced-motion: reduce) {
      * { scroll-behavior: auto !important; }
    }
  `],
})
export class AdminRankGroupDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(AdminRankGroupsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rank = signal<RankGroupRank | null>(null);
  protected readonly detail = signal<RankGroupDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly draft = signal('');
  protected readonly pinnedDraft = signal('');
  protected readonly banReason = signal('');
  protected readonly messages = computed(() => [...(this.detail()?.messages ?? [])].reverse());

  ngOnInit(): void {
    const value = String(this.route.snapshot.paramMap.get('rank') ?? '');
    if (!isRank(value)) {
      this.loading.set(false);
      this.error.set('Unknown rank group.');
      return;
    }
    this.rank.set(value);
    this.load();
  }

  protected load(): void {
    const rank = this.rank();
    if (!rank) return;
    this.loading.set(true);
    this.error.set(null);
    this.service
      .get(rank)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const data = res.data ?? null;
          this.detail.set(data);
          this.pinnedDraft.set(data?.pinnedMessage?.body ?? '');
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  protected send(): void {
    const rank = this.rank();
    const body = this.draft().trim();
    if (!rank || !body || this.busy()) return;
    this.busy.set('send');
    this.error.set(null);
    this.notice.set(null);
    this.service
      .send(rank, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.draft.set('');
          this.busy.set(null);
          this.notice.set('Message sent.');
          this.load();
        },
        error: (err: ApiError) => {
          this.busy.set(null);
          this.error.set(userError(err));
        },
      });
  }

  protected removeMessage(messageId: string): void {
    const rank = this.rank();
    if (!rank) return;
    this.busy.set(`message:${messageId}`);
    this.error.set(null);
    this.service
      .removeMessage(rank, messageId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.notice.set('Message removed.');
          this.load();
        },
        error: (err: ApiError) => {
          this.busy.set(null);
          this.error.set(userError(err));
        },
      });
  }

  protected savePinned(): void {
    const rank = this.rank();
    const body = this.pinnedDraft().trim();
    if (!rank || !body) return;
    this.busy.set('pinned');
    this.error.set(null);
    this.service
      .setPinned(rank, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.notice.set('Pinned welcome updated.');
          this.load();
        },
        error: (err: ApiError) => {
          this.busy.set(null);
          this.error.set(userError(err));
        },
      });
  }

  protected banMember(memberId: string): void {
    const rank = this.rank();
    if (!rank) return;
    this.busy.set(`ban:${memberId}`);
    this.error.set(null);
    this.service
      .ban(rank, memberId, this.banReason().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.banReason.set('');
          this.notice.set('Member banned. They were removed from the group.');
          this.load();
        },
        error: (err: ApiError) => {
          this.busy.set(null);
          this.error.set(userError(err));
        },
      });
  }

  protected unban(memberId: string): void {
    const rank = this.rank();
    if (!rank) return;
    this.busy.set(`unban:${memberId}`);
    this.error.set(null);
    this.service
      .unban(rank, memberId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.notice.set('Member unbanned. They will rejoin automatically when their level matches.');
          this.load();
        },
        error: (err: ApiError) => {
          this.busy.set(null);
          this.error.set(userError(err));
        },
      });
  }

  protected decideReport(reportId: string, decision: 'dismiss' | 'remove', banMember = false): void {
    const rank = this.rank();
    if (!rank) return;
    this.busy.set(`report:${reportId}`);
    this.error.set(null);
    this.service
      .decideReport(rank, reportId, decision, banMember)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.notice.set(decision === 'dismiss' ? 'Report dismissed.' : 'Report resolved.');
          this.load();
        },
        error: (err: ApiError) => {
          this.busy.set(null);
          this.error.set(userError(err));
        },
      });
  }

  protected groupUrl(groupId: string): string {
    return `${environment.platformUrl}/dashboard/messages?group=${encodeURIComponent(groupId)}`;
  }
}
