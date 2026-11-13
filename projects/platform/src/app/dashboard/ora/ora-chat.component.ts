import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, effect, inject,
  input, output, signal, viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { OraService } from '../../core/ora/ora.service';
import { OraAction, OraContext, OraConversationSummary, OraMessage, OraUsage, actionPlanItems } from '../../core/ora/ora.models';
import { ApiError } from '../../core/http/api-error';

/** Minimal safe markdown: escape first, then bold/code/bullets/breaks. */
const renderMarkdown = (raw: string): string => {
  const escaped = String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const inline = escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const lines = inline.split('\n');
  let html = '';
  let inList = false;
  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${bullet[1]}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (line.trim()) html += `<p>${line}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html || '<p></p>';
};

interface ChatMsg extends OraMessage {
  actions?: OraAction[];
}

/**
 * @title Ora chat — reusable conversation surface.
 *
 * Owns the whole chat experience (context boot, messages, starters,
 * action cards, history with search + pin, composer). The floating
 * widget and the full Ora page both embed this — one implementation.
 * OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-ora-chat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule, MatChipsModule, MatIconModule, MatProgressBarModule, PageSkeletonComponent, RouterModule],
  template: `
    <div class="ora-chat">
      <header class="ora-head">
        <span class="ora-avatar" aria-hidden="true">O</span>
        <div class="ora-head-text">
          <strong>Ora</strong>
        </div>
        <span class="spacer"></span>
        <button mat-icon-button (click)="toggleHistory()" aria-label="Conversation history" [title]="view() === 'history' ? 'Back to chat' : 'Conversation history'">
          <mat-icon>{{ view() === 'history' ? 'chat' : 'history' }}</mat-icon>
        </button>
        <button mat-icon-button (click)="newChat()" aria-label="New conversation" title="New conversation">
          <mat-icon>add</mat-icon>
        </button>
        <a mat-icon-button routerLink="/dashboard/ora" aria-label="Open full Ora page" title="Open full Ora page">
          <mat-icon>open_in_full</mat-icon>
        </a>
        @if (showClose()) {
          <button mat-icon-button (click)="closed.emit()" aria-label="Close Ora">
            <mat-icon>close</mat-icon>
          </button>
        }
      </header>

      @if (booting()) {
        <async-page-skeleton layout="inbox" [rows]="5" label="Ora" [showHeader]="false" />
      }

      @if (view() === 'history') {
        <form class="ora-search" (ngSubmit)="search()">
          <input
            name="ora-search"
            [(ngModel)]="searchDraft"
            placeholder="Search conversations…"
            aria-label="Search conversations"
            maxlength="80"
            autocomplete="off"
          />
          <button mat-icon-button type="submit" aria-label="Search">
            <mat-icon>search</mat-icon>
          </button>
          @if (searchDraft().trim()) {
            <button mat-icon-button type="button" (click)="clearSearch()" aria-label="Clear search">
              <mat-icon>close</mat-icon>
            </button>
          }
        </form>
        <div class="ora-history">
          @if (history().length > 0) {
            <ul>
              @for (c of history(); track c.id) {
                <li>
                  @if (c.pinned) {
                    <mat-icon class="pin-mark" aria-label="Pinned">bookmark</mat-icon>
                  }
                  <button class="history-row" (click)="openConversation(c.id)">
                    <span class="history-title">{{ c.title }}</span>
                  </button>
                  <button mat-icon-button (click)="togglePin(c)" [attr.aria-label]="c.pinned ? 'Unpin conversation' : 'Pin conversation'" [title]="c.pinned ? 'Unpin' : 'Pin'">
                    <mat-icon>{{ c.pinned ? 'bookmark' : 'bookmark_border' }}</mat-icon>
                  </button>
                  <button mat-icon-button (click)="removeConversation(c.id)" aria-label="Delete conversation">
                    <mat-icon>delete</mat-icon>
                  </button>
                </li>
              }
            </ul>
          } @else {
            <p class="empty">{{ searchDraft().trim() ? 'No conversations match.' : 'No past conversations yet.' }}</p>
          }
        </div>
      } @else {
        <div class="ora-messages" #scroll>
          @if (context(); as ctx) {
            @if (messages().length === 0) {
              <div class="bubble assistant"><div [innerHTML]="render(ctx.greeting)"></div></div>
              <div class="starters">
                @for (s of ctx.starters; track s) {
                  <button mat-button class="starter" (click)="ask(s)">{{ s }}</button>
                }
              </div>
            }
          }
          @for (m of messages(); track $index) {
            <div class="bubble" [class.user]="m.role === 'user'" [class.assistant]="m.role === 'assistant'">
              <div [innerHTML]="render(m.content)"></div>
              @if (m.actions?.length) {
                <div class="actions">
                  @for (a of m.actions; track a.id ?? a.link ?? a.label) {
                    @if (a.requiresApproval) {
                      <div class="action-card approval"
                        [class.done]="a.status === 'executed'"
                        [class.failed]="a.status === 'failed'">
                        <div class="action-copy">
                          <strong>{{ a.label }}</strong>
                          @if (a.payload?.subject) {
                            <small class="draft-subject">{{ a.payload?.subject }}</small>
                          }
                          @if (a.type === 'send_followup' && a.payload?.channel) {
                            <small class="channel-pill">Send via {{ a.payload?.channel === 'sms' ? 'SMS' : 'email' }} after approval</small>
                          }
                          @if (a.payload?.body) {
                            <small class="draft">{{ a.payload?.body }}</small>
                          }
                          @if (a.type === 'save_daily_plan' && planItems(a).length) {
                            <small class="draft plan-preview">
                              @for (item of planItems(a); track item.title) {
                                <span class="plan-item">
                                  <strong>{{ item.title }}</strong>
                                  @if (item.detail) { - {{ item.detail }} }
                                </span>
                              }
                            </small>
                          }
                          <small>{{ actionNote(a) }}</small>
                        </div>
                        <div class="action-buttons">
                          @if (!a.status || a.status === 'proposed') {
                            <button mat-flat-button color="primary" type="button"
                              (click)="approveAction(a)" [disabled]="actingId() === a.id">
                              {{ actingId() === a.id ? 'Working…' : 'Approve' }}
                            </button>
                            <button mat-stroked-button type="button"
                              (click)="skipAction(a)" [disabled]="actingId() === a.id">Skip</button>
                          }
                          @if (a.link) {
                            <a mat-button [routerLink]="a.link">Open</a>
                          }
                        </div>
                      </div>
                    } @else if (a.link) {
                      <a mat-button class="action-card" [routerLink]="a.link">{{ a.label }}</a>
                    }
                  }
                </div>
              }
            </div>
          }
          @if (sending()) {
            <div class="bubble assistant thinking"><em>Ora is thinking…</em></div>
          }
          @if (error(); as err) {
            <p class="error" role="alert">
              {{ err }}
              @if (canRetry()) {
                <button mat-button (click)="retry()">Retry</button>
              }
            </p>
          }
        </div>

        @if (usage(); as u) {
          <div class="ora-usage" [class.limit-reached]="u.remaining === 0">
            <div class="usage-copy">
              <span><strong>{{ u.used }}</strong> of {{ u.limit }} messages today</span>
              <span class="muted">{{ u.remaining === 0 ? 'Resets tomorrow' : u.remaining + ' left' }}</span>
            </div>
            <div class="usage-bar" role="progressbar" [attr.aria-valuenow]="u.used" aria-valuemin="0" [attr.aria-valuemax]="u.limit" aria-label="Ora daily usage">
              <span [style.width.%]="usagePercent(u)"></span>
            </div>
          </div>
        }

        <form class="ora-input" (ngSubmit)="send()">
          <input
            name="ora-input"
            [(ngModel)]="draft"
            [placeholder]="usage()?.remaining === 0 ? 'Daily limit reached - resets tomorrow' : 'Ask Ora anything…'"
            aria-label="Message Ora"
            maxlength="2000"
            autocomplete="off"
            [disabled]="usage()?.remaining === 0"
          />
          <button mat-icon-button color="primary" type="submit" [disabled]="!draft().trim() || sending() || usage()?.remaining === 0" aria-label="Send">
            <mat-icon>send</mat-icon>
          </button>
        </form>
      }
    </div>
  `,
  styles: [`
    .ora-chat { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .ora-head { display: flex; align-items: center; gap: 0.6em; padding: 0.6em 0.6em 0.6em 0.9em; border-bottom: 1px solid var(--ms-line); background: var(--ms-ink); color: var(--ms-ink-text); }
    .ora-avatar { flex: none; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; color: var(--ms-ink); background: var(--ms-ink-icon); }
    .ora-head-text { display: flex; flex-direction: column; line-height: 1.2; }
    .ora-head-text .muted { color: var(--ms-ink-text); opacity: 0.75; font-size: 0.78em; }
    .spacer { flex: 1; }
    .ora-head button { color: var(--ms-ink-text); }
    .ora-search { display: flex; align-items: center; gap: 0.25em; padding: 0.5em 0.6em; border-bottom: 1px solid var(--ms-line); }
    .ora-search input { flex: 1; min-height: 44px; border: 1px solid var(--ms-line); border-radius: 999px; padding: 0 1em; background: var(--ms-canvas); color: inherit; font: inherit; }
    .ora-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.6em; padding: 0.9em; min-height: 0; }
    .bubble { max-width: 88%; padding: 0.6em 0.85em; border-radius: 14px; font-size: 0.9em; line-height: 1.5; }
    .bubble p { margin: 0 0 0.4em; }
    .bubble p:last-child { margin-bottom: 0; }
    .bubble ul { margin: 0 0 0.4em; padding-left: 1.2em; }
    .bubble code { background: var(--ms-primary-soft); border-radius: 4px; padding: 0 0.3em; font-size: 0.9em; }
    .bubble.assistant { align-self: flex-start; background: var(--ms-canvas); border: 1px solid var(--ms-line); border-bottom-left-radius: 4px; }
    .bubble.user { align-self: flex-end; background: var(--ms-primary-soft); border: 1px solid var(--ms-primary); border-bottom-right-radius: 4px; }
    .thinking { opacity: 0.75; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.35em; margin-top: 0.5em; }
    .action-card { min-height: 44px; border: 1px solid var(--ms-primary); border-radius: 999px; text-transform: none; font-weight: 600; text-decoration: none; }
    .action-card.approval { display: flex; align-items: center; justify-content: space-between; gap: 0.6em; width: 100%; border-radius: 12px; padding: 0.55em 0.65em; background: var(--ms-primary-soft); flex-wrap: wrap; }
    .action-card.approval.done { border-color: var(--ms-success); }
    .action-card.approval.failed { border-color: var(--ms-error); background: var(--ms-canvas); }
    .action-copy { display: flex; flex-direction: column; gap: 0.15em; min-width: 0; flex: 1 1 180px; }
    .action-copy strong { font-size: 0.92em; }
    .action-copy small { color: var(--ms-text-muted); line-height: 1.35; }
    .action-copy .draft-subject { color: inherit; font-weight: 700; }
    .action-copy .channel-pill { display: inline-block; width: fit-content; padding: 2px 8px; border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.68em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .action-copy .draft { white-space: pre-wrap; max-height: 7.5em; overflow-y: auto; padding: 0.35em 0.45em; border-left: 2px solid var(--ms-primary); background: var(--ms-surface); border-radius: 4px; }
    .action-copy .plan-preview { display: grid; gap: 0.2em; white-space: normal; }
    .action-copy .plan-item { display: block; }
    .action-copy .plan-item strong { color: var(--ms-text); }
    .action-buttons { display: flex; align-items: center; gap: 0.25em; flex-wrap: wrap; }
    .action-buttons button, .action-buttons a { min-height: 44px; }
    .starters { display: flex; flex-wrap: wrap; gap: 0.4em; }
    .starter { min-height: 44px; border: 1px solid var(--ms-line); border-radius: 999px; text-transform: none; font-weight: 500; }
    .ora-usage { padding: 0.45em 0.9em 0.15em; border-top: 1px solid var(--ms-line); background: var(--ms-surface); }
    .ora-usage .usage-copy { display: flex; align-items: center; justify-content: space-between; gap: 0.5em; font-size: 0.76em; margin-bottom: 0.3em; }
    .ora-usage .usage-bar { height: 4px; border-radius: 999px; background: var(--ms-line); overflow: hidden; }
    .ora-usage .usage-bar span { display: block; height: 100%; background: var(--ms-primary); transition: width 180ms ease; }
    .ora-usage.limit-reached .usage-copy { color: var(--ms-error); }
    .ora-usage.limit-reached .usage-bar span { background: var(--ms-error); }
    .ora-input { display: flex; align-items: center; gap: 0.4em; padding: 0.6em 0.6em 0.6em 0.9em; border-top: 1px solid var(--ms-line); }
    .ora-input input { flex: 1; min-height: 44px; border: 1px solid var(--ms-line); border-radius: 999px; padding: 0 1em; background: var(--ms-canvas); color: inherit; font: inherit; }
    .ora-history { flex: 1; overflow-y: auto; padding: 0.6em; min-height: 0; }
    .ora-history ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .ora-history li { display: flex; align-items: center; border-bottom: 1px solid var(--ms-line); }
    .pin-mark { color: var(--ms-primary); font-size: 18px; height: 18px; width: 18px; flex: none; }
    .history-row { flex: 1; text-align: left; background: none; border: none; color: inherit; font: inherit; padding: 0.8em 0.5em; cursor: pointer; min-width: 0; }
    .history-title { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .error { color: var(--ms-error); font-size: 0.85em; display: flex; align-items: center; gap: 0.5em; }
    .empty { color: var(--ms-text-muted); padding: 1em; text-align: center; }
  `],
})
export class OraChatComponent implements OnInit {
  private readonly ora = inject(OraService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scrollBox = viewChild<ElementRef<HTMLElement>>('scroll');

  readonly showClose = input(false);
  readonly closed = output<void>();

  protected readonly view = signal<'chat' | 'history'>('chat');
  protected readonly booting = signal(false);
  protected readonly context = signal<OraContext | null>(null);
  protected readonly messages = signal<ChatMsg[]>([]);
  protected readonly conversationId = signal<string | null>(null);
  protected readonly history = signal<OraConversationSummary[]>([]);
  protected readonly searchDraft = signal('');
  protected readonly draft = signal('');
  protected readonly sending = signal(false);
  protected readonly actingId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly canRetry = signal(false);
  protected readonly usage = signal<OraUsage | null>(null);
  protected readonly planItems = actionPlanItems;

  private lastFailed: string | null = null;

  constructor() {
    effect(() => {
      this.messages();
      this.sending();
      queueMicrotask(() => {
        const el = this.scrollBox()?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }

  ngOnInit(): void {
    this.boot();
  }

  protected render(text: string): string {
    return renderMarkdown(text);
  }

  protected usagePercent(u: OraUsage): number {
    if (!u || u.limit <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round((u.used / u.limit) * 100)));
  }

  protected newChat(): void {
    this.conversationId.set(null);
    this.messages.set([]);
    this.error.set(null);
    this.canRetry.set(false);
    this.lastFailed = null;
    this.view.set('chat');
  }

  protected toggleHistory(): void {
    if (this.view() === 'history') {
      this.view.set('chat');
      return;
    }
    this.view.set('history');
    this.loadHistory();
  }

  protected search(): void {
    this.loadHistory(this.searchDraft().trim());
  }

  protected clearSearch(): void {
    this.searchDraft.set('');
    this.loadHistory();
  }

  protected togglePin(c: OraConversationSummary): void {
    this.ora
      .pinConversation(c.id, !c.pinned)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadHistory(this.searchDraft().trim()),
        error: (err: ApiError) => this.error.set(err.message),
      });
  }

  protected openConversation(id: string): void {
    this.ora
      .conversation(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.conversationId.set(res.data?.id ?? id);
          this.messages.set((res.data?.messages ?? []).map((m) => ({ ...m })));
          this.error.set(null);
          this.view.set('chat');
        },
        error: (err: ApiError) => this.error.set(err.message),
      });
  }

  protected removeConversation(id: string): void {
    this.ora
      .deleteConversation(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.history.set(this.history().filter((c) => c.id !== id));
          if (this.conversationId() === id) this.newChat();
        },
        error: (err: ApiError) => this.error.set(err.message),
      });
  }

  protected ask(prompt: string): void {
    this.draft.set(prompt);
    this.send();
  }

  protected actionNote(a: OraAction): string {
    if (a.status === 'proposed' || !a.status) {
      const base = a.summary || 'Waiting for your approval.';
      return base;
    }
    if (a.status === 'executing') return 'Working…';
    if (a.status === 'skipped') return 'Skipped.';
    if (a.status === 'failed') return a.error || 'Could not complete this action.';
    if (a.status === 'executed') {
      const result = (a.result ?? {}) as Record<string, unknown>;
      if (result['channel']) return `Sent via ${result['channel'] === 'sms' ? 'SMS' : 'email'}.`;
      if (result['sent'] !== undefined) return `Sent ${result['sent']} of ${result['total']}.`;
      if (result['dateKey']) return 'Plan saved.';
      if (result['followUpDate']) return 'Follow-up scheduled.';
      if (result['stage']) return `Moved to ${result['stage']}.`;
      return 'Done.';
    }
    return a.summary || '';
  }

  protected approveAction(a: OraAction): void {
    if (!a.id || this.actingId()) return;
    this.actingId.set(a.id);
    this.ora
      .approveAction(a.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.patchAction(a.id as string, res.data ?? { status: 'executed' });
          this.actingId.set(null);
        },
        error: (err: ApiError) => {
          this.patchAction(a.id as string, { status: 'failed', error: err.message });
          this.actingId.set(null);
        },
      });
  }

  protected skipAction(a: OraAction): void {
    if (!a.id || this.actingId()) return;
    this.actingId.set(a.id);
    this.ora
      .skipAction(a.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.patchAction(a.id as string, res.data ?? { status: 'skipped' });
          this.actingId.set(null);
        },
        error: (err: ApiError) => {
          this.patchAction(a.id as string, { status: 'failed', error: err.message });
          this.actingId.set(null);
        },
      });
  }

  private patchAction(id: string, patch: Partial<OraAction>): void {
    this.messages.update((messages) => messages.map((message) => (
      message.actions
        ? { ...message, actions: message.actions.map((action) => (action.id === id ? { ...action, ...patch } : action)) }
        : message
    )));
  }

  protected retry(): void {
    if (this.lastFailed) {
      this.draft.set(this.lastFailed);
      this.send();
    }
  }

  protected send(): void {
    const text = this.draft().trim();
    if (!text || this.sending()) return;
    if (this.usage()?.remaining === 0) {
      this.error.set('Daily Ora limit reached — it resets tomorrow.');
      return;
    }
    this.draft.set('');
    this.error.set(null);
    this.canRetry.set(false);
    this.lastFailed = text;
    this.messages.set([...this.messages(), { role: 'user', content: text, at: null }]);
    this.sending.set(true);
    this.ora
      .chat(text, this.conversationId() ?? undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.conversationId.set(res.data?.conversationId ?? this.conversationId());
          this.messages.set([
            ...this.messages(),
            { role: 'assistant', content: res.data?.reply ?? '', at: null, actions: res.data?.actions ?? [] },
          ]);
          if (res.data?.usage) this.usage.set(res.data.usage);
          else this.loadUsage();
          this.sending.set(false);
          this.lastFailed = null;
        },
        error: (err: ApiError) => {
          this.sending.set(false);
          this.error.set(err.message);
          const limitUsage = (err.details as { usage?: OraUsage } | undefined)?.usage;
          if (limitUsage) this.usage.set(limitUsage);
          else if (err.code === 'ORA_RATE_LIMITED') this.loadUsage();
          this.canRetry.set(err.code !== 'ORA_RATE_LIMITED');
        },
      });
  }

  private loadUsage(): void {
    this.ora
      .usage()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.usage.set(res.data ?? null),
        error: () => { /* the indicator is optional; never block the chat */ },
      });
  }

  private loadHistory(q = ''): void {
    this.ora
      .conversations(20, q)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.history.set(res.data?.items ?? []),
        error: () => this.history.set([]),
      });
  }

  private boot(): void {
    this.booting.set(true);
    this.loadUsage();
    this.ora
      .context()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.context.set(res.data ?? null);
          this.booting.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.booting.set(false);
        },
      });
  }
}
