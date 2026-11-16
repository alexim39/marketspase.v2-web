import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { MentorHandoffService } from '../../../../../core/mentor-handoff/mentor-handoff.service';
import {
  MentorHandoffListMeta,
  MentorHandoffTask,
  MentorHandoffTemplate,
} from '../../../../../core/mentor-handoff/mentor-handoff.models';
import { PresenceService, PresenceStatus } from '../../../../../core/presence/presence.service';
import { ApiError, userError } from '../../../../../core/http/api-error';

const PAGE_SIZE = 20;

/** Shared new-member onboarding queue, templates and outreach actions. */
@Injectable()
export class MentorHandoffsFacade {
  private readonly handoffs = inject(MentorHandoffService);
  private readonly presence = inject(PresenceService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly tasks = signal<MentorHandoffTask[]>([]);
  readonly templates = signal<MentorHandoffTemplate[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly sending = signal<string | null>(null);
  readonly selected = signal<Record<string, string>>({});
  readonly statusFilter = signal<'' | 'pending' | 'contacted'>('');
  readonly meta = signal<MentorHandoffListMeta | null>(null);
  readonly presenceMap = signal<Record<string, string | null>>({});
  readonly templateMap = computed(() => new Map(this.templates().map((t) => [t.key, t])));
  readonly filters = [
    { label: 'All tasks', value: '' as const },
    { label: 'Needs welcome', value: 'pending' as const },
    { label: 'Contacted', value: 'contacted' as const },
  ];
  private started = false;

  ensureLoaded(): void {
    if (this.started) return;
    this.started = true;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.tasks.set([]);
    this.meta.set(null);
    forkJoin({
      tasks: this.handoffs.list({
        status: this.statusFilter() || undefined,
        page: 1,
        limit: PAGE_SIZE,
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

  loadMore(): void {
    const current = this.meta();
    if (!current?.hasMore || this.loading() || this.loadingMore()) return;
    this.loadingMore.set(true);
    this.error.set(null);
    this.handoffs.list({
      status: this.statusFilter() || undefined,
      page: current.page + 1,
      limit: PAGE_SIZE,
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

  setFilter(value: '' | 'pending' | 'contacted'): void {
    if (this.statusFilter() === value) return;
    this.statusFilter.set(value);
    this.selected.set({});
    this.load();
  }

  presenceOf(partnerId: string | null | undefined): PresenceStatus {
    return this.presence.statusOf(this.presenceMap()[String(partnerId ?? '')] ?? null);
  }

  selectedTemplate(taskId: string): string {
    return this.selected()[taskId] ?? '';
  }

  selectTemplate(taskId: string, key: string): void {
    this.selected.update((current) => ({ ...current, [taskId]: key }));
  }

  preview(task: MentorHandoffTask): string {
    const key = this.selectedTemplate(task.id);
    if (!key) return '';
    const template = this.templateMap().get(key);
    if (!template) return '';
    return template.body
      .replace(/\{\{memberName\}\}/g, task.member?.name ?? 'there')
      .replace(/\{\{mentorName\}\}/g, 'you');
  }

  send(task: MentorHandoffTask): void {
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
        if (updated) this.applyUpdated(updated);
        const channels = res.data?.channels;
        this.notice.set(channels?.email && channels?.sms
          ? 'Welcome sent by email, SMS and Chat.'
          : 'Welcome sent. Check the delivery channels on the task.');
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  markContacted(task: MentorHandoffTask): void {
    this.handoffs.markContacted(task.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.data) this.applyUpdated(res.data);
        this.notice.set('Task marked as contacted.');
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  chat(task: MentorHandoffTask): void {
    void this.router.navigate(['/dashboard/messages'], {
      queryParams: { chat: task.partnerId, chatName: task.member?.name ?? 'Team member' },
    });
  }

  whatsapp(phone: string): string {
    const digits = String(phone ?? '').replace(/\D/g, '');
    const intl = digits.startsWith('0') ? `234${digits.slice(1)}` : digits;
    return `https://wa.me/${intl}`;
  }

  sourceLabel(source: string): string {
    if (source === 'allocation') return 'System allocation';
    if (source === 'override') return 'Admin placement';
    return 'Referral';
  }

  statusLabel(status: string): string {
    if (status === 'contacted') return 'Contacted';
    if (status === 'closed') return 'Closed';
    return 'Needs welcome';
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
}
