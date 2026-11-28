import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import {
  Tutorial,
  TutorialArea,
  TutorialGroup,
  TutorialService,
  tutorialViewsLabel,
} from '../../../../core/tutorials/tutorial.service';
import { ApiError, userError } from '../../../../core/http/api-error';

type AreaFilter = 'All' | TutorialArea;

/**
 * Platform tutorials — native mobile library.
 *
 * A short-form video feed for the app: search and area chips, a featured
 * player, and a scannable list with per-video view counts. Views are recorded
 * when playback starts and de-duplicated per partner server-side.
 */
@Component({
  selector: 'async-training-tutorials-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatIconModule, PageSkeletonComponent, RouterModule],
  templateUrl: './tutorials.component.html',
  styleUrls: ['./tutorials.component.scss'],
})
export class TutorialsMobileComponent implements OnInit {
  private readonly tutorials = inject(TutorialService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly playerAnchor = viewChild<ElementRef<HTMLElement>>('playerAnchor');

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly groups = signal<TutorialGroup[]>([]);
  protected readonly query = signal('');
  protected readonly areaFilter = signal<AreaFilter>('All');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly playing = signal(false);
  private readonly viewsTracked = new Set<string>();

  protected readonly videos = computed(() => this.groups().flatMap((group) => group.items));
  protected readonly areas = computed(() =>
    this.groups()
      .map((group) => ({ area: group.area, count: group.items.length }))
      .filter((group) => group.count > 0),
  );
  protected readonly filtered = computed(() => {
    const needle = this.query().trim().toLowerCase();
    const area = this.areaFilter();
    return this.videos().filter((video) => {
      if (area !== 'All' && video.area !== area) return false;
      if (!needle) return true;
      return `${video.title} ${video.description} ${video.area}`.toLowerCase().includes(needle);
    });
  });
  protected readonly selected = computed<Tutorial | null>(() => {
    const list = this.filtered();
    if (list.length === 0) return null;
    return list.find((video) => video.id === this.selectedId()) ?? list[0];
  });
  protected readonly selectedIndex = computed(() => {
    const current = this.selected();
    return current ? this.filtered().findIndex((video) => video.id === current.id) : -1;
  });
  protected readonly totalViews = computed(() =>
    this.videos().reduce((sum, video) => sum + Math.max(0, Number(video.viewCount ?? 0) || 0), 0),
  );

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.tutorials.list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.groups.set(response.data?.groups ?? []);
          this.syncSelection();
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.syncSelection();
  }

  protected setArea(area: AreaFilter): void {
    this.areaFilter.set(area);
    this.syncSelection();
  }

  protected clearSearch(): void {
    this.query.set('');
    this.syncSelection();
  }

  protected resetFilters(): void {
    this.query.set('');
    this.areaFilter.set('All');
    this.syncSelection();
  }

  protected startFirst(): void {
    const startVideos = this.videos().filter((video) => video.area === 'Start');
    const first = startVideos[0] ?? this.videos()[0];
    if (!first) return;
    this.query.set('');
    this.areaFilter.set(startVideos.length > 0 ? 'Start' : 'All');
    this.selectVideo(first);
  }

  protected playSelected(): void {
    const video = this.selected();
    if (!video) return;
    this.playing.set(true);
    this.recordView(video);
    this.scrollToPlayer();
  }

  protected selectVideo(video: Tutorial): void {
    this.selectedId.set(video.id);
    this.playing.set(true);
    this.recordView(video);
    this.scrollToPlayer();
  }

  protected nextVideo(): void {
    const list = this.filtered();
    if (list.length < 2) return;
    const current = this.selectedIndex();
    this.selectVideo(list[(current + 1) % list.length]);
  }

  protected previousVideo(): void {
    const list = this.filtered();
    if (list.length < 2) return;
    const current = this.selectedIndex();
    this.selectVideo(list[(current - 1 + list.length) % list.length]);
  }

  protected embedUrl(youtubeId: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?rel=0&modestbranding=1&autoplay=1`,
    );
  }

  protected thumbUrl(youtubeId: string): string {
    return `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/mqdefault.jpg`;
  }

  protected youtubeUrl(youtubeId: string): string {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`;
  }

  protected viewsLabel(video: Tutorial): string {
    return tutorialViewsLabel(video.viewCount);
  }

  private recordView(video: Tutorial): void {
    if (this.viewsTracked.has(video.id)) return;
    this.viewsTracked.add(video.id);
    this.tutorials.recordView(video.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.applyViewCount(video.id, response.data?.viewCount),
        error: () => { /* Playback must never depend on analytics. */ },
      });
  }

  private applyViewCount(videoId: string, count: number | undefined): void {
    if (typeof count !== 'number') return;
    const viewCount = Math.max(0, Math.floor(count));
    this.groups.update((groups) => groups.map((group) => ({
      ...group,
      items: group.items.map((video) => (video.id === videoId ? { ...video, viewCount } : video)),
    })));
  }

  private syncSelection(): void {
    const list = this.filtered();
    if (!list.some((video) => video.id === this.selectedId())) {
      this.selectedId.set(list[0]?.id ?? null);
    }
    this.playing.set(false);
  }

  private scrollToPlayer(): void {
    setTimeout(() => {
      this.playerAnchor()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }
}
