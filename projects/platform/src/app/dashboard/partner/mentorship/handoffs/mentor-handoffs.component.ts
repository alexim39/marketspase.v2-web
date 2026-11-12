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
import { MentorHandoffService } from '../../../../core/mentor-handoff/mentor-handoff.service';
import {
  MentorHandoffTask,
  MentorHandoffTemplate,
} from '../../../../core/mentor-handoff/mentor-handoff.models';
import { ApiError, userError } from '../../../../core/http/api-error';

@Component({
  selector: 'async-mentor-handoffs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
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
          <h2>No new member tasks yet</h2>
          <p>When someone joins your team through a referral or campaign allocation, their welcome task appears here.</p>
        </div>
      }

      <div class="task-list">
        @for (task of tasks(); track task.id) {
          <article class="task-card">
            <div class="task-head">
              <div>
                <h2>{{ task.member?.name ?? 'New team member' }}</h2>
                <p class="muted">
                  @{{ task.member?.username || 'member' }} · joined {{ task.joinedAt | date:'mediumDate' }}
                </p>
              </div>
              <div class="chips">
                <span class="chip">{{ sourceLabel(task.source) }}</span>
                <span class="chip" [class.chip--ok]="task.status === 'contacted'">{{ statusLabel(task.status) }}</span>
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
    .task-list { display: grid; gap: 12px; }
    .task-card { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 14px; padding: 16px; display: grid; gap: 12px; }
    .task-head { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .task-head h2 { margin: 0 0 2px; font-size: 1.08rem; }
    .muted { color: var(--ms-text-muted); }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip { border: 1px solid var(--ms-line); border-radius: 999px; padding: 3px 9px; font-size: .72rem; font-weight: 700; text-transform: capitalize; }
    .chip--ok { border-color: var(--ms-success); color: var(--ms-success); }
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
    @media (max-width: 640px) { .compose-row mat-form-field { min-width: 100%; } }
  `],
})
export class MentorHandoffsComponent implements OnInit {
  private readonly handoffs = inject(MentorHandoffService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tasks = signal<MentorHandoffTask[]>([]);
  protected readonly templates = signal<MentorHandoffTemplate[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly sending = signal<string | null>(null);
  protected readonly selected = signal<Record<string, string>>({});
  protected readonly templateMap = computed(() => new Map(this.templates().map((t) => [t.key, t])));

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      tasks: this.handoffs.list(),
      templates: this.handoffs.templates(),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: ({ tasks, templates }) => {
        this.tasks.set(tasks.data ?? []);
        this.templates.set(templates.data ?? []);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
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
          this.tasks.update((rows) => rows.map((row) => row.id === updated.id ? { ...row, ...updated } : row));
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
        this.tasks.update((rows) => rows.map((row) => row.id === task.id ? { ...row, ...(res.data ?? {}) } : row));
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
