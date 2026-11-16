import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LeadPipelineService } from '../../lead-pipeline/lead-pipeline.service';
import { ReminderEntry, RemindersData } from '../../lead-pipeline/lead.models';
import { ApiError } from '../../../../../core/http/api-error';

type ReminderFilter = 'all' | 'overdue' | 'today' | 'upcoming';

interface ReminderGroup {
  key: Exclude<ReminderFilter, 'all'>;
  label: string;
  icon: string;
  items: ReminderEntry[];
  caption: (r: ReminderEntry) => string;
}

/** Shared reminder buckets, filters and counts. */
@Injectable()
export class RemindersFacade {
  private readonly reminders = inject(LeadPipelineService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<RemindersData | null>(null);
  readonly query = signal('');
  readonly filter = signal<ReminderFilter>('all');
  private started = false;

  readonly stats = computed(() => {
    const d = this.data();
    const overdue = d?.overdue ?? [];
    return {
      overdue: overdue.length,
      today: d?.today?.length ?? 0,
      upcoming: d?.upcoming?.length ?? 0,
      total: d?.total ?? 0,
      maxOverdue: overdue.reduce((max, item) => Math.max(max, Number(item.daysOverdue ?? 0)), 0),
    };
  });

  readonly focus = computed(() => {
    const d = this.data();
    if (!d) return null;
    if (d.overdue.length > 0) return { entry: d.overdue[0], bucket: 'overdue' as const };
    if (d.today.length > 0) return { entry: d.today[0], bucket: 'today' as const };
    return null;
  });

  readonly filteredGroups = computed(() => {
    const d = this.data();
    if (!d) return [];
    const q = this.query().trim().toLowerCase();
    const active = this.filter();
    return this.groups(d)
      .filter((group) => active === 'all' || group.key === active)
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !q || String(item.name ?? '').toLowerCase().includes(q)),
      }))
      .filter((group) => group.items.length > 0);
  });

  ensureLoaded(): void {
    if (this.started) return;
    this.started = true;
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.reminders.reminders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.data.set(res.data ?? null);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  groups(d: RemindersData): ReminderGroup[] {
    return [
      { key: 'overdue', label: 'Overdue', icon: 'report', items: d.overdue, caption: (r) => `${r.daysOverdue}d overdue` },
      { key: 'today', label: 'Due today', icon: 'priority_high', items: d.today, caption: () => 'due today' },
      { key: 'upcoming', label: 'Coming up', icon: 'event_note', items: d.upcoming, caption: () => 'upcoming' },
    ];
  }
}
