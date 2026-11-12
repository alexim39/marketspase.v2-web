import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { AvatarComponent } from '../../../../_common/avatar.component';
import { MentorHandoffService } from '../../../../core/mentor-handoff/mentor-handoff.service';
import {
  MentorHandoffListMeta,
  MentorHandoffTask,
  MentorHandoffTemplate,
} from '../../../../core/mentor-handoff/mentor-handoff.models';
import { PresenceService, PresenceStatus } from '../../../../core/presence/presence.service';
import { ApiError, userError } from '../../../../core/http/api-error';

@Component({
  selector: 'async-mentor-handoffs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    AvatarComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    RouterModule,
  ],
  template: `
    <section class="handoffs-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Team · Onboarding</p>
          <h1>New member tasks</h1>
          <p class="subtitle">Welcome each new partner, send an approved intro, and follow the 24-hour playbook.</p>
        </div>
        <a mat-stroked-button routerLink="/dashboard/team">Back to team</a>
      </header>

      <div class="task-toolbar">
        <div class="filter-group" role="group" aria-label="Filter tasks">
          @for (filter of filters; track filter.value) {
            <button
              type="button"
              class="filter-btn"
              [class.filter-btn--active]="statusFilter() === filter.value"
              [attr.aria-pressed]="statusFilter() === filter.value"
              (click)="setFilter(filter.value)">
              {{ filter.label }}
            </button>
          }
        </div>
        @if (meta(); as m) {
          <span class="muted small">{{ m.total }} {{ m.total === 1 ? 'task' : 'tasks' }}</span>
        }
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading mentor tasks" />
      }

      @if (error(); as err) {
        <div class="alert" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>{{ err }}</p>
          <button mat-button type="button" (click)="load()">Retry</button>
        </div>
      }

      @if (notice(); as note) {
        <div class="notice" role="status"><mat-icon>check_circle</mat-icon><p>{{ note }}</p></div>
      }

      @if (!loading() && tasks().length === 0) {
        <div class="empty">
          <mat-icon>group_add</mat-icon>
          <h2>{{ statusFilter() ? 'No tasks in this view' : 'No new member tasks yet' }}</h2>
          <p>{{ statusFilter()
            ? 'Try another filter or check back after the next referral or allocation.'
            : 'When someone joins your team through a referral or campaign allocation, their welcome task appears here.' }}</p>
        </div>
      }

      <div class="task-list">
        @for (task of tasks(); track task.id) {
          <article class="task-card">
            <div class="task-head">
              <div class="task-member">
                <async-avatar
                  [photo]="task.member?.profileImage"
                  [name]="task.member?.name ?? 'New team member'"
                  size="sm"
                  [presence]="presenceOf(task.partnerId)" />
                <div class="task-member-copy">
                  <h2>{{ task.member?.name ?? 'New team member' }}</h2>
                  <p class="muted">
                    @{{ task.member?.username || 'member' }} · joined {{ task.joinedAt | date:'mediumDate' }}
                  </p>
                </div>
              </div>
              <div class="chips">
                <span class="chip">{{ sourceLabel(task.source) }}</span>
                <span
                  class="chip"
                  [class.chip--pending]="task.status === 'pending'"
                  [class.chip--ok]="task.status === 'contacted'">
                  {{ statusLabel(task.status) }}
                </span>
              </div>
            </div>

            <div class="task-meta">
              <span><mat-icon>support_agent</mat-icon> {{ task.preferenceLabel }}</span>
              <span><mat-icon>school</mat-icon> {{ task.memberActivatedAt || task.member?.activatedAt ? 'Activated' : 'Not activated yet' }}</span>
              @if (task.sentAt) {
                <span><mat-icon>send</mat-icon> Sent {{ task.sentAt | date:'medium' }}</span>
              }
            </div>

            @if (task.preference === 'prefer_not_now') {
              <div class="notice notice--muted" role="status">
                <mat-icon>do_not_disturb_on</mat-icon>
                <p>This member asked not to be contacted yet. Respect the preference and wait for them to opt in.</p>
              </div>
            } @else {
              <div class="compose-row">
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Approved message</mat-label>
                  <mat-select [value]="selectedTemplate(task.id)" (selectionChange)="selectTemplate(task.id, $event.value)">
                    @for (template of templates(); track template.key) {
                      <mat-option [value]="template.key">{{ template.label }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <div class="compose-actions">
                  <button
                    mat-flat-button
                    color="primary"
                    type="button"
                    [disabled]="sending() === task.id || !selectedTemplate(task.id)"
                    (click)="send(task)">
                    <mat-icon>send</mat-icon>
                    {{ sending() === task.id ? 'Sending…' : 'Send welcome' }}
                  </button>
                  <button mat-button type="button" (click)="chat(task)">
                    <mat-icon>chat</mat-icon> Chat
                  </button>
                </div>
              </div>

              @if (preview(task); as text) {
                <div class="preview" role="note">
                  <span class="preview-label">Preview</span>
                  <p>{{ text }}</p>
                  <small class="muted">MarketSpase sends this by email and SMS. Replies open in Chat.</small>
                </div>
              }

              <div class="direct-actions">
                @if (task.preference === 'email' && task.contact.email) {
                  <a mat-button [href]="'mailto:' + task.contact.email"><mat-icon>mail</mat-icon> Email</a>
                }
                @if (task.preference === 'phone' && task.contact.phone) {
                  <a mat-button [href]="'tel:' + task.contact.phone"><mat-icon>call</mat-icon> Call</a>
                }
                @if (task.preference === 'whatsapp' && task.contact.phone) {
                  <a mat-button [href]="whatsapp(task.contact.phone)" target="_blank" rel="noopener"><mat-icon>forum</mat-icon> WhatsApp</a>
                }
                <button mat-button type="button" (click)="markContacted(task)">
                  <mat-icon>task_alt</mat-icon> Mark contacted
                </button>
              </div>
            }
          </article>
        }
      </div>

      @if (tasks().length > 0) {
        <div class="list-footer">
          <span class="muted small">
            Showing {{ tasks().length }} of {{ meta()?.total ?? tasks().length }}
          </span>
          @if (meta()?.hasMore) {
            <button mat-stroked-button type="button" (click)="loadMore()" [disabled]="loadingMore()">
              <mat-icon>{{ loadingMore() ? 'hourglass_top' : 'expand_more' }}</mat-icon>
              {{ loadingMore() ? 'Loading more…' : 'Load more' }}
            </button>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .handoffs-page { max-width: 980px; margin: 0 auto; padding: 20px 0 48px; display: grid; gap: 16px; }
    .page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .page-head h1 { margin: 2px 0 4px; }
    .subtitle { margin: 0; color: var(--ms-text-muted); max-width: 54em; }
    .eyebrow { margin: 0; color: var(--ms-text-muted); text-transform: uppercase; letter-spacing: .08em; font-size: .72rem; font-weight: 800; }
    .alert, .notice, .empty { display: flex; gap: 10px; align-items: flex-start; padding: 14px 16px; border: 1px solid var(--ms-line); border-radius: 12px; background: var(--ms-surface); }
    .alert { border-color: var(--ms-danger); }
    .notice { border-color: var(--ms-success); }
    .notice--muted { border-color: var(--ms-line); background: var(--ms-canvas); }
    .alert p, .notice p, .empty p { margin: 0; }
    .empty { display: grid; justify-items: center; text-align: center; padding: 38px 16px; gap: 6px; }
    .empty h2 { margin: 4px 0 0; }
    .task-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .filter-group { display: inline-flex; gap: 3px; padding: 3px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 999px; }
    .filter-btn { border: 0; background: transparent; border-radius: 999px; padding: 6px 12px; color: var(--ms-text-muted); font: inherit; font-size: .8rem; font-weight: 700; cursor: pointer; }
    .filter-btn:hover { color: var(--ms-text); }
    .filter-btn--active { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .task-list { display: grid; gap: 12px; }
    .task-card { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 14px; padding: 16px; display: grid; gap: 12px; }
    .task-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .task-member { display: flex; align-items: center; gap: 10px; flex: 1 1 240px; min-width: 0; }
    .task-member-copy { min-width: 0; }
    .task-member-copy h2 { margin: 0 0 2px; font-size: 1.08rem; overflow-wrap: anywhere; }
    .muted { color: var(--ms-text-muted); }
    .small { font-size: .8rem; }
    .chips { display: flex; align-items: center; align-self: flex-start; flex: 0 0 auto; gap: 6px; flex-wrap: wrap; }
    .chip {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--ms-line);
      border-radius: 999px;
      padding: 4px 10px;
      background: var(--ms-canvas);
      color: var(--ms-text-muted);
      font-size: .72rem;
      font-weight: 700;
      line-height: 1.2;
      white-space: nowrap;
    }
    .chip--pending {
      border-color: color-mix(in srgb, var(--ms-warning) 30%, var(--ms-line));
      background: var(--ms-warning-soft);
      color: var(--ms-warning);
    }
    .chip--ok {
      border-color: color-mix(in srgb, var(--ms-success) 30%, var(--ms-line));
      background: var(--ms-success-soft);
      color: var(--ms-success);
    }
    .task-meta { display: flex; gap: 14px; flex-wrap: wrap; color: var(--ms-text-muted); font-size: .85rem; }
    .task-meta span { display: inline-flex; align-items: center; gap: 4px; }
    .task-meta mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .compose-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .compose-row mat-form-field { min-width: 260px; flex: 1; }
    .compose-actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .preview { background: var(--ms-canvas); border: 1px dashed var(--ms-line); border-radius: 10px; padding: 10px 12px; }
    .preview-label { font-size: .7rem; font-weight: 800; text-transform: uppercase; letter-spacing: .07em; color: var(--ms-text-muted); }
    .preview p { margin: 5px 0; white-space: pre-wrap; }
    .direct-actions { display: flex; gap: 6px; flex-wrap: wrap; border-top: 1px solid var(--ms-line); padding-top: 10px; }
    .list-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 4px 2px 0; }
    @media (max-width: 640px) {
      .compose-row mat-form-field { min-width: 100%; }
      .task-member { flex-basis: 100%; }
    }
  `],
})
export class MentorHandoffsComponent implements OnInit {
  private static readonly PAGE_SIZE = 20;

  private readonly handoffs = inject(MentorHandoffService);
  private readonly presence = inject(PresenceService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tasks = signal<MentorHandoffTask[]>([]);
  protected readonly templates = signal<MentorHandoffTemplate[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly sending = signal<string | null>(null);
  protected readonly selected = signal<Record<string, string>>({});
  protected readonly statusFilter = signal<'' | 'pending' | 'contacted'>('');
  protected readonly meta = signal<MentorHandoffListMeta | null>(null);
  protected readonly presenceMap = signal<Record<string, string | null>>({});
  protected readonly templateMap = computed(() => new Map(this.templates().map((t) => [t.key, t])));
  protected readonly filters = [
    { label: 'All tasks', value: '' as const },
    { label: 'Needs welcome', value: 'pending' as const },
    { label: 'Contacted', value: 'contacted' as const },
  ];

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.tasks.set([]);
    this.meta.set(null);
    forkJoin({
      tasks: this.handoffs.list({
        status: this.statusFilter() || undefined,
        page: 1,
        limit: MentorHandoffsComponent.PAGE_SIZE,
      }),
      templates: this.handoffs.templates(),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: ({ tasks, templates }) => {
        const rows = tasks.data ?? [];
        this.tasks.set(rows);
        this.meta.set(tasks.meta ?? null);
        this.templates.set(templates.data ?? []);
        this.refreshPresence(rows);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected loadMore(): void {
    const current = this.meta();
    if (!current?.hasMore || this.loading() || this.loadingMore()) return;
    this.loadingMore.set(true);
    this.error.set(null);
    this.handoffs.list({
      status: this.statusFilter() || undefined,
      page: current.page + 1,
      limit: MentorHandoffsComponent.PAGE_SIZE,
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingMore.set(false)),
    ).subscribe({
      next: (res) => {
        const rows = res.data ?? [];
        const seen = new Set(this.tasks().map((task) => task.id));
        this.tasks.update((currentRows) => [
          ...currentRows,
          ...rows.filter((task) => !seen.has(task.id)),
        ]);
        this.meta.set(res.meta ?? current);
        this.refreshPresence(rows);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected setFilter(value: '' | 'pending' | 'contacted'): void {
    if (this.statusFilter() === value) return;
    this.statusFilter.set(value);
    this.selected.set({});
    this.load();
  }

  protected presenceOf(partnerId: string | null | undefined): PresenceStatus {
    return this.presence.statusOf(this.presenceMap()[String(partnerId ?? '')] ?? null);
  }

  private refreshPresence(rows: MentorHandoffTask[]): void {
    const ids = [...new Set(rows.map((task) => task.partnerId).filter(Boolean))];
    if (ids.length === 0) return;
    this.presence.lookup(ids).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (map) => this.presenceMap.update((current) => ({ ...current, ...map })),
    });
  }

  private applyUpdated(updated: MentorHandoffTask): void {
    if (this.statusFilter() === 'pending' && updated.status !== 'pending') {
      this.tasks.update((rows) => rows.filter((row) => row.id !== updated.id));
      this.meta.update((current) => current
        ? { ...current, total: Math.max(current.total - 1, 0) }
        : current);
      return;
    }
    this.tasks.update((rows) => rows.map((row) => (
      row.id === updated.id ? { ...row, ...updated } : row
    )));
  }

  protected selectedTemplate(taskId: string): string {
    return this.selected()[taskId] ?? '';
  }

  protected selectTemplate(taskId: string, key: string): void {
    this.selected.update((current) => ({ ...current, [taskId]: key }));
  }

  protected preview(task: MentorHandoffTask): string {
    const key = this.selectedTemplate(task.id);
    if (!key) return '';
    const template = this.templateMap().get(key);
    if (!template) return '';
    return template.body
      .replace(/\{\{memberName\}\}/g, task.member?.name ?? 'there')
      .replace(/\{\{mentorName\}\}/g, 'you');
  }

  protected send(task: MentorHandoffTask): void {
    const templateKey = this.selectedTemplate(task.id);
    if (!templateKey || this.sending()) return;
    this.sending.set(task.id);
    this.error.set(null);
    this.notice.set(null);
    this.handoffs.send(task.id, templateKey).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.sending.set(null)),
    ).subscribe({
      next: (res) => {
        const updated = res.data?.handoff;
        if (updated) {
          this.applyUpdated(updated);
        }
        const channels = res.data?.channels;
        this.notice.set(channels?.email && channels?.sms
          ? 'Welcome sent by email, SMS and Chat.'
          : 'Welcome sent. Check the delivery channels on the task.');
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected markContacted(task: MentorHandoffTask): void {
    this.handoffs.markContacted(task.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.data) this.applyUpdated(res.data);
        this.notice.set('Task marked as contacted.');
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected chat(task: MentorHandoffTask): void {
    this.router.navigate(['/dashboard/messages'], {
      queryParams: { chat: task.partnerId, chatName: task.member?.name ?? 'Team member' },
    });
  }

  protected whatsapp(phone: string): string {
    const digits = String(phone ?? '').replace(/\D/g, '');
    const intl = digits.startsWith('0') ? `234${digits.slice(1)}` : digits;
    return `https://wa.me/${intl}`;
  }

  protected sourceLabel(source: string): string {
    if (source === 'allocation') return 'System allocation';
    if (source === 'override') return 'Admin placement';
    return 'Referral';
  }

  protected statusLabel(status: string): string {
    if (status === 'contacted') return 'Contacted';
    if (status === 'closed') return 'Closed';
    return 'Needs welcome';
  }
}
