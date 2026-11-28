import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { ProgressionService } from '../../../core/progression/progression.service';
import {
  APP_RANKS,
  AppRank,
  Journey,
  TRAINING_TRACK,
  appRankIndex,
} from '../../../core/progression/progression.models';
import { TrainingService } from '../../../core/training/training.service';
import { LearningPath } from '../../../core/training/training.models';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError, userError } from '../../../core/http/api-error';

/**
 * My progress — native mobile journey.
 *
 * The current rank and completion ring lead, followed by a vertical rank
 * roadmap, the next gate checklist, the automatic training record and live
 * team momentum. Every requirement is visible in one scrollable story.
 */
@Component({
  selector: 'async-progress-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatIconModule, PageSkeletonComponent, RouterModule],
  templateUrl: './progress.component.html',
  styleUrls: ['./progress.component.scss'],
})
export class ProgressMobileComponent implements OnInit {
  private readonly progress = inject(ProgressionService);
  private readonly trainingApi = inject(TrainingService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly ranks = APP_RANKS;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly journey = signal<Journey | null>(null);
  protected readonly paths = signal<LearningPath[]>([]);

  protected readonly training = computed(() => {
    const requirements = this.paths().flatMap((path) => path.requirements);
    return TRAINING_TRACK.map((track) => {
      const requirement = requirements.find((item) => item.key === track.key);
      return {
        ...track,
        courseId: requirement?.courseId ?? null,
        courseTitle: requirement?.courseTitle ?? track.label,
      };
    });
  });

  protected readonly currentRank = computed<AppRank>(() =>
    ((this.journey()?.levelLabel ?? this.auth.currentUser()?.commissionRank) as AppRank | undefined) ?? 'Partner',
  );
  protected readonly rankIndex = computed(() => appRankIndex(this.currentRank()));
  protected readonly currentDefinition = computed(() => APP_RANKS[this.rankIndex()] ?? APP_RANKS[0]);
  protected readonly nextRank = computed(() => {
    const label = this.journey()?.nextLabel as AppRank | null | undefined;
    if (label) return APP_RANKS.find((r) => r.rank === label) ?? null;
    return APP_RANKS[this.rankIndex() + 1] ?? null;
  });

  protected readonly journeyPercent = computed(() =>
    Math.max(0, Math.min(100, Math.round(Number(this.journey()?.percent ?? 0)))),
  );
  protected readonly rings = computed(() => {
    const pct = this.journeyPercent();
    return `conic-gradient(#c7d2fe 0 ${pct}%, rgba(255, 255, 255, 0.14) ${pct}% 100%)`;
  });

  private readonly milestones = computed(() => {
    const raw = (this.journey()?.milestones ?? {}) as Record<string, {
      done?: boolean; at?: string | null; confirmedAt?: string | null;
    }>;
    return raw;
  });

  protected readonly trainingCount = computed(() =>
    this.training().filter((track) => this.trainingDone(track.key)).length,
  );
  protected readonly trainingPercent = computed(() => {
    const total = this.training().length;
    return total === 0 ? 0 : Math.round((this.trainingCount() / total) * 100);
  });
  protected readonly missing = computed(() => this.journey()?.missing ?? []);
  protected readonly forecast = computed(() => this.journey()?.forecast ?? null);
  protected readonly signals = computed(() =>
    this.journey()?.signals ?? { recruits: 0, activeDownline: 0, maintenanceOk: false },
  );
  protected readonly promoted = computed(() => this.journey()?.promoted ?? null);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.progress.mine()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.journey.set(res.data ?? null);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
    this.trainingApi.paths()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.paths.set(res.data ?? []),
        error: () => this.paths.set([]),
      });
  }

  protected trainingDone(key: string): boolean {
    return this.milestones()[key]?.done === true;
  }

  protected trainingDate(key: string): string | null {
    const stamp = this.milestones()[key];
    return stamp?.confirmedAt ?? stamp?.at ?? null;
  }
}
