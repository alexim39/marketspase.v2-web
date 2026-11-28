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
} from '../../../core/tutorials/tutorial.service';
import { ApiError, userError } from '../../../core/http/api-error';

type AreaFilter = 'All' | TutorialArea;
type SortMode = 'recommended' | 'views' | 'title';

/**
 * @title Platform tutorials — desktop video workspace.
 *
 * A browse-first library, not a course: no watch gate, quiz or completion
 * state. The desktop experience pairs a full-width stage with a sticky
 * playlist, plus a library toolbar, media keyboard shortcuts and one-click
 * sharing. Mobile uses a separate native component.
 */
@Component({
  selector: 'async-tutorials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, PageSkeletonComponent, RouterModule],
  templateUrl: './tutorials.component.html',
  styleUrls: ['./tutorials.component.scss'],
  host: {
    '(document:keydown)': 'onShortcut($event)',
  },
})
export class TutorialsComponent implements OnInit {
  private readonly tutorials = inject(TutorialService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly queueList = viewChild<ElementRef<HTMLElement>>('queueList');
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly groups = signal<TutorialGroup[]>([]);
  protected readonly query = signal('');
  protected readonly areaFilter = signal<AreaFilter>('All');
  protected readonly sortMode = signal<SortMode>('recommended');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly playing = signal(false);
  protected readonly copied = signal(false);
  /** Session guard; the server also enforces one unique view per partner. */
  private readonly viewsTracked = new Set<string>();

  protected readonly videos = computed(() => this.groups().flatMap((group) => group.items));
  protected readonly areas = computed(() =>
    this.groups()
      .map((group) => ({ area: group.area, count: group.items.length }))
      .filter((group) => group.count > 0),
  );
  protected readonly totalViews = computed(() =>
    this.videos().reduce((sum, video) => sum + Math.max(0, Number(video.viewCount ?? 0) || 0), 0),
  );
  protected readonly totalViewsLabel = computed(() => tutorialViewsLabel(this.totalViews()));
  protected readonly filtered = computed(() => {
    const needle = this.query().trim().toLowerCase();
    const area = this.areaFilter();
    const sort = this.sortMode();
    const list = this.videos().filter((video) => {
      if (area !== 'All' && video.area !== area) return false;
      if (!needle) return true;
      return `${video.title} ${video.description} ${video.area}`.toLowerCase().includes(needle);
    });
    if (sort === 'views') {
      return [...list].sort((a, b) => (
        Math.max(0, Number(b.viewCount ?? 0) || 0) - Math.max(0, Number(a.viewCount ?? 0) || 0)
        || a.order - b.order
      ));
    }
    if (sort === 'title') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
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

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.copyTimer !== null) clearTimeout(this.copyTimer);
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.tutorials
      .list()
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
    this.revealOnMobile();
  }

  protected onSort(event: Event): void {
    this.sortMode.set((event.target as HTMLSelectElement).value as SortMode);
    this.syncSelection();
  }

  protected clearSearch(): void {
    this.query.set('');
    this.syncSelection();
    this.searchInput()?.nativeElement.focus();
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
    this.selectedId.set(first.id);
    this.playing.set(true);
    this.recordView(first);
    this.revealOnMobile();
    this.revealInQueue();
  }

  protected playSelected(): void {
    const video = this.selected();
    this.playing.set(true);
    if (video) this.recordView(video);
  }

  protected selectVideo(video: Tutorial): void {
    this.selectedId.set(video.id);
    this.playing.set(true);
    this.recordView(video);
    this.revealOnMobile();
    this.revealInQueue();
  }

  protected nextVideo(): void {
    const list = this.filtered();
    if (list.length < 2) return;
    const current = Math.max(0, this.selectedIndex());
    this.selectVideo(list[(current + 1) % list.length]);
  }

  protected previousVideo(): void {
    const list = this.filtered();
    if (list.length < 2) return;
    const current = Math.max(0, this.selectedIndex());
    this.selectVideo(list[(current - 1 + list.length) % list.length]);
  }

  protected copyLink(): void {
    const video = this.selected();
    if (!video || typeof navigator === 'undefined') return;
    const clipboard = navigator.clipboard;
    if (!clipboard?.writeText) return;
    clipboard.writeText(this.youtubeUrl(video.youtubeId))
      .then(() => {
        this.copied.set(true);
        if (this.copyTimer !== null) clearTimeout(this.copyTimer);
        this.copyTimer = setTimeout(() => {
          this.copied.set(false);
          this.copyTimer = null;
        }, 2200);
      })
      .catch(() => { /* Clipboard permission denied — leave the label unchanged. */ });
  }

  /** `/` focuses search, `Esc` clears it, and J/K walk the playlist. */
  protected onShortcut(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    const typing = !!target && (
      target.tagName === 'INPUT'
      || target.tagName === 'TEXTAREA'
      || target.tagName === 'SELECT'
      || target.isContentEditable
    );

    if (event.key === '/') {
      if (typing) return;
      event.preventDefault();
      this.focusSearch();
      return;
    }

    if (event.key === 'Escape') {
      const search = this.searchInput()?.nativeElement;
      if (typing && target !== search) return;
      if (this.query()) {
        this.query.set('');
        this.syncSelection();
      }
      search?.blur();
      event.preventDefault();
      return;
    }

    if (typing) return;

    const key = event.key.toLowerCase();
    if (key === 'j') {
      event.preventDefault();
      this.nextVideo();
    } else if (key === 'k') {
      event.preventDefault();
      this.previousVideo();
    }
  }

  protected embedUrl(youtubeId: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?rel=0&modestbranding=1&autoplay=1`,
    );
  }

  protected heroThumbUrl(youtubeId: string): string {
    return `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/maxresdefault.jpg`;
  }

  protected thumbUrl(youtubeId: string): string {
    return `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/mqdefault.jpg`;
  }

  protected onHeroThumbError(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (image.src.includes('/maxresdefault.jpg')) {
      image.src = image.src.replace('/maxresdefault.jpg', '/mqdefault.jpg');
    }
  }

  protected youtubeUrl(youtubeId: string): string {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`;
  }

  protected viewsLabel(video: Tutorial): string {
    return tutorialViewsLabel(video.viewCount);
  }

  private focusSearch(): void {
    const input = this.searchInput()?.nativeElement;
    input?.focus();
    input?.select();
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
    const currentId = this.selectedId();
    if (!list.some((video) => video.id === currentId)) {
      this.selectedId.set(list[0]?.id ?? null);
      this.playing.set(false);
    }
    if (list.length === 0) this.playing.set(false);
  }

  private revealInQueue(): void {
    setTimeout(() => {
      const container = this.queueList()?.nativeElement;
      const active = container?.querySelector<HTMLElement>('.queue-item.is-active');
      if (!container || !active) return;
      const top = active.offsetTop;
      const bottom = top + active.offsetHeight;
      if (top < container.scrollTop) {
        container.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' });
      } else if (bottom > container.scrollTop + container.clientHeight) {
        container.scrollTo({ top: bottom - container.clientHeight + 8, behavior: 'smooth' });
      }
    }, 0);
  }

  private revealOnMobile(): void {
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 980px)').matches) return;
    setTimeout(() => {
      document.querySelector('.stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }
}
