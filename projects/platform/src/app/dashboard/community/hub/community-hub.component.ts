import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CommunityService } from '../../../core/community/community.service';
import { FeedPost } from '../../../core/community/community.models';
import { EventService } from '../../../core/events/event.service';
import { CommunityEvent } from '../../../core/events/event.models';
import { MessageService } from '../../../core/messaging/message.service';
import { Message } from '../../../core/messaging/message.models';
import { ApiError, userError } from '../../../core/http/api-error';

/** Community hub — latest feed, upcoming events and unread messages. */
@Component({
  selector: 'async-community-hub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    RouterModule,
  ],
  template: `
    <section class="community-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Community · Belonging and momentum</p>
          <h1>Talk, meet and message</h1>
          <p class="muted">Team updates, events and private messages in one place.</p>
        </div>
        <div class="head-actions">
          <a mat-flat-button color="primary" routerLink="community/feed">Open feed</a>
          <a mat-stroked-button routerLink="messages">Messages</a>
        </div>
      </header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }

      @if (error(); as err) {
        <div class="alert" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>{{ err }}</p>
          <button mat-button type="button" (click)="reload()">Retry</button>
        </div>
      }

      <div class="metrics">
        <div class="metric">
          <span>Unread messages</span>
          <strong>{{ unread() }}</strong>
          <a routerLink="messages">Open inbox</a>
        </div>
        <div class="metric">
          <span>Upcoming events</span>
          <strong>{{ upcomingEvents().length }}</strong>
          <a routerLink="community/events">View events</a>
        </div>
        <div class="metric">
          <span>Latest posts</span>
          <strong>{{ posts().length }}</strong>
          <a routerLink="community/feed">Read feed</a>
        </div>
        <div class="metric metric--accent">
          <span>Ask Ora</span>
          <strong class="metric-text">AI coach</strong>
          <a routerLink="ora">Start a chat</a>
        </div>
      </div>

      <div class="columns">
        <div class="panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Feed</p>
              <h2>Latest from the team</h2>
            </div>
            <a mat-button routerLink="community/feed">See all</a>
          </div>

          @if (posts().length === 0) {
            <div class="empty">
              <mat-icon>forum</mat-icon>
              <p>Quiet here. Be the first to share an update or recognition.</p>
              <a mat-flat-button color="primary" routerLink="community/feed">Open feed</a>
            </div>
          } @else {
            <ul class="post-list">
              @for (post of posts(); track post.id) {
                <li>
                  <div class="post-avatar">{{ initials(post.author?.name) }}</div>
                  <div class="post-main">
                    <div class="post-top">
                      <strong>{{ post.author?.name ?? 'Teammate' }}</strong>
                      <span class="muted">{{ post.createdAt | date: 'mediumDate' }}</span>
                    </div>
                    @if (post.title) { <strong class="post-title">{{ post.title }}</strong> }
                    <p class="muted">{{ preview(post.body) }}</p>
                    <span class="post-meta">{{ post.likeCount }} likes · {{ post.commentCount }} comments</span>
                  </div>
                </li>
              }
            </ul>
          }
        </div>

        <aside class="side">
          <div class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Calendar</p>
                <h2>Upcoming events</h2>
              </div>
              <a mat-button routerLink="community/events">All</a>
            </div>
            @if (upcomingEvents().length === 0) {
              <p class="muted empty-line">No upcoming events yet. Check back soon.</p>
            } @else {
              <ul class="event-list">
                @for (event of upcomingEvents(); track event.id) {
                  <li>
                    <div class="event-date">
                      <span>{{ event.startsAt | date: 'MMM' }}</span>
                      <strong>{{ event.startsAt | date: 'd' }}</strong>
                    </div>
                    <div class="event-main">
                      <strong>{{ event.title }}</strong>
                      <span class="muted">{{ event.startsAt | date: 'shortTime' }} · {{ event.location || 'Online' }}</span>
                      <span class="muted">{{ event.rsvps.going }} going</span>
                    </div>
                  </li>
                }
              </ul>
            }
          </div>

          <div class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Inbox</p>
                <h2>Recent messages</h2>
              </div>
              <a mat-button routerLink="messages">Open</a>
            </div>
            @if (recentMessages().length === 0) {
              <p class="muted empty-line">No messages yet. Start a conversation with a teammate.</p>
            } @else {
              <ul class="message-list">
                @for (message of recentMessages(); track message.id) {
                  <li>
                    <div class="msg-avatar">{{ initials(message.sender?.name) }}</div>
                    <div class="message-main">
                      <strong>{{ message.sender?.name ?? 'Teammate' }}</strong>
                      <span class="muted">{{ preview(message.body) }}</span>
                    </div>
                    <span class="msg-date muted">{{ message.createdAt | date: 'shortTime' }}</span>
                  </li>
                }
              </ul>
            }
          </div>

          <div class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Shortcuts</p>
                <h2>Jump in</h2>
              </div>
            </div>
            <div class="quick-grid">
              <a routerLink="community/feed"><mat-icon>dynamic_feed</mat-icon><span>Team feed</span></a>
              <a routerLink="community/events"><mat-icon>event</mat-icon><span>Events</span></a>
              <a routerLink="messages"><mat-icon>chat</mat-icon><span>Messages</span></a>
              <a routerLink="ora"><mat-icon>smart_toy</mat-icon><span>Ask Ora</span></a>
            </div>
          </div>
        </aside>
      </div>
    </section>
  `,
  styles: [`
    .community-page { max-width: 1180px; margin: 0 auto; padding: 24px 0 48px; display: flex; flex-direction: column; gap: 16px; }
    .page-head { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(1.7rem, 3vw, 2.4rem); line-height: 1.1; letter-spacing: -0.03em; }
    .page-head p { margin: 0; line-height: 1.55; max-width: 620px; }
    .head-actions { display: flex; gap: 8px; flex-wrap: wrap; flex: none; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
    .muted { color: var(--ms-text-muted); }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
    .metric { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; }
    .metric > span:first-child { color: var(--ms-text-muted); font-size: 0.72em; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .metric strong { font-size: 1.6em; font-variant-numeric: tabular-nums; line-height: 1.15; }
    .metric a { font-size: 0.8em; font-weight: 700; color: var(--ms-primary-strong); text-decoration: none; margin-top: 2px; }
    .metric a:hover { text-decoration: underline; }
    .metric-text { font-size: 1.15em; padding-top: 0.3em; }
    .metric--accent { border-left: 4px solid var(--ms-primary); }
    .columns { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr); gap: 16px; align-items: start; }
    .side { display: flex; flex-direction: column; gap: 16px; }
    .panel { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); padding: 18px; box-shadow: var(--ms-shadow-sm); }
    .panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .panel-head h2 { margin: 4px 0 0; font-size: 1.15rem; }
    .post-list, .event-list, .message-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .post-list li, .event-list li, .message-list li { display: flex; gap: 10px; padding: 12px 2px; border-top: 1px solid var(--ms-line); }
    .post-list li:first-child, .event-list li:first-child, .message-list li:first-child { border-top: none; }
    .post-avatar, .msg-avatar { width: 38px; height: 38px; flex: 0 0 38px; border-radius: 50%; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 800; font-size: 0.85em; }
    .post-main, .event-main, .message-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .post-top { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
    .post-main p { margin: 0; font-size: 0.88em; line-height: 1.45; }
    .post-title { font-size: 0.95em; }
    .post-meta { font-size: 0.75em; color: var(--ms-text-muted); }
    .event-date { width: 46px; flex: 0 0 46px; display: flex; flex-direction: column; align-items: center; border-radius: var(--ms-radius-sm); background: var(--ms-primary-soft); color: var(--ms-primary-strong); padding: 4px 0; height: fit-content; }
    .event-date span { font-size: 0.68em; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; }
    .event-date strong { font-size: 1.15em; line-height: 1; }
    .event-main span { font-size: 0.78em; }
    .msg-date { flex: none; font-size: 0.72em; }
    .empty { display: grid; place-items: center; gap: 8px; padding: 30px 16px; color: var(--ms-text-muted); text-align: center; }
    .empty mat-icon { font-size: 38px; width: 38px; height: 38px; }
    .empty p { margin: 0; line-height: 1.5; }
    .empty-line { margin: 0; font-size: 0.9em; }
    .quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .quick-grid a { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); color: var(--ms-text); text-decoration: none; font-size: 0.85em; font-weight: 600; min-height: 74px; }
    .quick-grid a:hover { background: var(--ms-primary-soft); }
    .quick-grid mat-icon { color: var(--ms-primary-strong); }
    .alert { display: flex; gap: 10px; align-items: center; padding: 12px 14px; border-radius: var(--ms-radius-md); background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { margin: 0; flex: 1; line-height: 1.5; }
    @media (max-width: 900px) {
      .page-head { flex-direction: column; }
      .columns { grid-template-columns: 1fr; }
    }
  `],
})
export class CommunityHubComponent implements OnInit {
  private readonly community = inject(CommunityService);
  private readonly events = inject(EventService);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly posts = signal<FeedPost[]>([]);
  protected readonly upcomingEvents = signal<CommunityEvent[]>([]);
  protected readonly recentMessages = signal<Message[]>([]);
  protected readonly unread = signal(0);

  ngOnInit(): void {
    this.reload();
  }

  protected preview(body: string): string {
    const text = String(body ?? '').replace(/\s+/g, ' ').trim();
    return text.length > 120 ? `${text.slice(0, 119)}…` : text;
  }

  protected initials(name: string | undefined): string {
    return String(name ?? '').split(/\s+/).filter(Boolean).slice(0, 2)
      .map((part) => part[0]?.toUpperCase()).join('') || 'M';
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      feed: this.community.feed(undefined, 5).pipe(catchError(() => of(null))),
      events: this.events.upcoming(3).pipe(catchError(() => of(null))),
      unread: this.messages.unreadCount().pipe(catchError(() => of(null))),
      inbox: this.messages.inbox(3).pipe(catchError(() => of(null))),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: ({ feed, events, unread, inbox }) => {
        this.posts.set(feed?.data?.items ?? []);
        this.upcomingEvents.set(events?.data?.items ?? []);
        this.unread.set(unread?.data?.unread ?? 0);
        this.recentMessages.set(inbox?.data ?? []);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }
}
