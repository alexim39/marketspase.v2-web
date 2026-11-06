import { ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterModule } from '@angular/router';
import { catchError, debounceTime, EMPTY, map, of, Subject, switchMap } from 'rxjs';
import { SearchHit, SearchResults, SearchService } from '../../core/search/search.service';
import { ThemeTogglerService } from '../../_common/services/theme-toggler.service';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error';

interface PaletteRow {
  section: string;
  icon: string;
  label: string;
  sub: string;
  link?: string;
  run?: () => void;
}

interface IndexedRow extends PaletteRow {
  index: number;
}

interface PaletteSection {
  name: string;
  icon: string;
  more?: string;
  rows: IndexedRow[];
}

const SECTION_META: Record<string, { icon: string; more?: string }> = {
  Commands: { icon: 'bolt' },
  Suggested: { icon: 'bolt' },
  Recent: { icon: 'history' },
  Members: { icon: 'group', more: '/dashboard/mentorship/partners/my-partners' },
  Prospects: { icon: 'person_search', more: '/dashboard/prospects/pipeline' },
  Courses: { icon: 'school', more: '/dashboard/training/courses' },
  Posts: { icon: 'forum', more: '/dashboard/community' },
};

const RECENTS_KEY = 'dp-search-recents';
const RECENT_LIMIT = 5;

function readRecents(): PaletteRow[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]') as Array<Partial<PaletteRow>>;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((r) => typeof r?.link === 'string' && typeof r?.label === 'string')
      .slice(0, RECENT_LIMIT)
      .map((r) => ({ section: 'Recent', icon: r.icon ?? 'history', label: String(r.label), sub: String(r.sub ?? ''), link: String(r.link) }));
  } catch {
    return [];
  }
}

function pushRecent(row: PaletteRow): void {
  if (!row.link) return;
  try {
    const rest = readRecents().filter((r) => r.link !== row.link);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(
      [{ section: 'Recent', icon: row.icon, label: row.label, sub: row.sub, link: row.link }, ...rest].slice(0, RECENT_LIMIT),
    ));
  } catch { /* private mode — recents simply don't persist */ }
}

/**
 * @title Search palette — command center (⌘K across actions + everything).
 *
 * Standard command-palette UX: icon-coded grouped sections, a `>` command
 * mode (page jumps, theme, sign out), recents when idle, deep links where
 * hit ids allow, matched-text highlighting and active-row scroll-into-view.
 * Links respect the same visibility the API enforces. OnPush + signals.
 */
@Component({
  selector: 'async-search-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, MatButtonModule, MatDialogModule, MatIconModule,
    MatProgressBarModule, RouterModule,
  ],
  template: `
    <div class="palette" role="dialog" aria-label="Search and commands">
      <div class="palette-head">
        <mat-icon aria-hidden="true">search</mat-icon>
        <input
          #box
          class="palette-input"
          [(ngModel)]="query"
          (ngModelChange)="push($event)"
          (keydown)="onKey($event)"
          placeholder="Search or type > for commands…"
          aria-label="Search, or type > for commands"
          autocomplete="off"
          spellcheck="false"
        />
        @if (query()) {
          <button class="palette-clear" (click)="push('')" aria-label="Clear search">
            <mat-icon aria-hidden="true">close</mat-icon>
          </button>
        }
        <kbd>esc</kbd>
      </div>

      @if (searching()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">{{ err }}</p>
      }

      @if (sections().length > 0) {
        <div class="results" role="listbox" aria-label="Results" #resultsBox>
          @for (sec of sections(); track sec.name) {
            <p class="sec-head" aria-hidden="true">
              <mat-icon aria-hidden="true">{{ sec.icon }}</mat-icon>{{ sec.name }}
              @if (sec.more) {
                <a [routerLink]="sec.more" (click)="close()"><span>View all</span><mat-icon aria-hidden="true">arrow_forward</mat-icon></a>
              }
            </p>
            @for (row of sec.rows; track row.index) {
              <div
                role="option"
                class="row"
                [class.active]="row.index === active()"
                [attr.aria-selected]="row.index === active()"
                [attr.data-active]="row.index === active()"
                (mouseenter)="setActive(row)"
              >
                @if (row.link) {
                  <a [routerLink]="row.link" (click)="activate(row)">
                    <mat-icon aria-hidden="true">{{ row.icon }}</mat-icon>
                    <span class="row-body">
                      <strong>@for (part of highlight(row.label); track $index) { @if (part.hit) { <mark>{{ part.text }}</mark> } @else { {{ part.text }} } }</strong>
                      @if (row.sub) { <span class="muted">{{ row.sub }}</span> }
                    </span>
                    <mat-icon class="go" aria-hidden="true">arrow_forward</mat-icon>
                  </a>
                } @else {
                  <button type="button" (click)="activate(row)">
                    <mat-icon aria-hidden="true">{{ row.icon }}</mat-icon>
                    <span class="row-body">
                      <strong>@for (part of highlight(row.label); track $index) { @if (part.hit) { <mark>{{ part.text }}</mark> } @else { {{ part.text }} } }</strong>
                      @if (row.sub) { <span class="muted">{{ row.sub }}</span> }
                    </span>
                    <mat-icon class="go" aria-hidden="true">arrow_forward</mat-icon>
                  </button>
                }
              </div>
            }
          }
        </div>
      } @else if (touched() && !searching() && !error()) {
        <div class="empty">
          <mat-icon aria-hidden="true">search_off</mat-icon>
          <p>No matches for “{{ query() }}” — try a name, stage, or course title.</p>
        </div>
      } @else if (!touched()) {
        <div class="empty idle">
          <mat-icon aria-hidden="true">keyboard_command_key</mat-icon>
          <p>Type to search the workspace — or <strong>&gt;</strong> for commands.</p>
        </div>
      }

      <p class="hint">
        <span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span>
        <span class="spacer"></span><span>{{ flat().length }} result{{ flat().length === 1 ? '' : 's' }}</span>
      </p>
    </div>
  `,
  styles: [`
    .palette {
      display: flex; flex-direction: column; gap: 0;
      width: min(720px, 94vw); max-height: min(78vh, 720px);
      background: var(--ms-surface); color: var(--ms-text);
      border: 1px solid var(--ms-line); border-radius: 14px;
      overflow: hidden;
    }
    .palette-head {
      display: flex; align-items: center; gap: 0.6em;
      padding: 0.9em 1em;
      border-bottom: 1px solid var(--ms-line);
      background: var(--ms-ink); color: var(--ms-ink-text);
    }
    .palette-head > mat-icon { color: var(--ms-ink-icon); flex: none; }
    .palette-input {
      flex: 1; min-width: 0;
      background: transparent; border: none; outline: none;
      color: inherit; font: inherit; font-size: 1.05em;
    }
    .palette-input::placeholder { color: var(--ms-ink-text); opacity: 0.55; }
    .palette-clear {
      background: transparent; border: none; cursor: pointer;
      color: inherit; opacity: 0.7; display: inline-flex;
      min-width: 44px; min-height: 44px;
      align-items: center; justify-content: center;
    }
    kbd {
      font: inherit; font-size: 0.72em; font-weight: 700;
      border: 1px solid var(--ms-line); border-bottom-width: 2px; border-radius: 6px;
      padding: 0.15em 0.45em; color: var(--ms-text-muted); background: var(--ms-canvas);
      flex: none;
    }
    .palette-head kbd { border-color: rgba(217, 179, 106, 0.4); color: var(--ms-ink-icon); background: transparent; }
    .results {
      display: flex; flex-direction: column;
      overflow-y: auto;
      min-height: 120px; padding: 0.4em 0.5em 0.6em;
    }
    .sec-head {
      display: flex; align-items: center; gap: 0.45em;
      margin: 0.7em 0.2em 0.15em;
      font-size: 0.72em; font-weight: 800; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--ms-primary-strong);
    }
    .sec-head mat-icon { font-size: 16px; height: 16px; width: 16px; }
    .sec-head a {
      margin-left: auto; display: inline-flex; align-items: center; gap: 0.2em;
      font-size: 1em; letter-spacing: 0; text-transform: none; font-weight: 600;
      color: var(--ms-text-muted); text-decoration: none;
    }
    .sec-head a mat-icon { font-size: 15px; height: 15px; width: 15px; }
    .row a, .row button {
      display: flex; gap: 0.7em; align-items: center; width: 100%;
      padding: 0.55em 0.7em; border-radius: 10px; border: none;
      background: transparent; color: inherit; font: inherit; text-align: left;
      text-decoration: none; cursor: pointer; min-height: 52px;
    }
    .row.active a, .row.active button, .row a:hover, .row button:hover { background: var(--ms-primary-soft); }
    .row mat-icon { color: var(--ms-primary-strong); flex: none; font-size: 20px; height: 20px; width: 20px; }
    .row .go { opacity: 0; transform: translateX(-4px); margin-left: auto; }
    .row.active .go { opacity: 1; transform: none; }
    .row-body { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .row-body strong { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
    .row-body mark { background: transparent; color: inherit; font-weight: 800; text-decoration: underline; text-decoration-color: var(--ms-primary); text-underline-offset: 2px; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); margin: 0.5em 1em; }
    .empty {
      display: flex; flex-direction: column; align-items: center; gap: 0.4em;
      padding: 2em 1.5em; text-align: center; color: var(--ms-text-muted);
    }
    .empty mat-icon { font-size: 32px; height: 32px; width: 32px; opacity: 0.5; }
    .empty p { margin: 0; max-width: 30em; }
    .hint {
      display: flex; gap: 1em; align-items: center;
      margin: 0; padding: 0.6em 1em;
      font-size: 0.78em; color: var(--ms-text-muted);
      border-top: 1px solid var(--ms-line);
    }
    .hint span { display: inline-flex; align-items: center; gap: 0.3em; }
    .hint .spacer { flex: 1; }
  `],
})
export class SearchPaletteComponent {
  private readonly search = inject(SearchService);
  private readonly router = inject(Router);
  private readonly dialogRef = inject(MatDialogRef<SearchPaletteComponent>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef);
  private readonly themes = inject(ThemeTogglerService);
  private readonly auth = inject(AuthService);
  private readonly terms = new Subject<{ value: string; gen: number }>();
  /** Only the newest query may publish results (short/command queries cancel). */
  private searchGeneration = 0;

  protected readonly query = signal('');
  protected readonly searching = signal(false);
  protected readonly touched = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly active = signal(0);
  protected readonly results = signal<SearchResults | null>(null);

  private readonly commands: Array<{ label: string; sub: string; keywords: string; run: () => void }> = [
    { label: 'Go to Pipeline', sub: 'My follow-ups', keywords: 'pipeline follow ups deals', run: () => this.go('/dashboard/prospects/pipeline') },
    { label: 'Go to Activation board', sub: 'Who needs you next', keywords: 'activation board team coach', run: () => this.go('/dashboard/mentorship/team/activation') },
    { label: 'Go to My partners', sub: 'Your direct partners', keywords: 'partners downline team members', run: () => this.go('/dashboard/mentorship/partners/my-partners') },
    { label: 'Add someone', sub: 'New contact', keywords: 'add create contact prospect new', run: () => this.go('/dashboard/tools/contacts/new') },
    { label: 'Send SMS', sub: 'Bulk message', keywords: 'send sms text message bulk', run: () => this.go('/dashboard/tools/sms/new') },
    { label: 'Send email', sub: 'Bulk mail', keywords: 'send email mail bulk', run: () => this.go('/dashboard/tools/email/new') },
    { label: 'Start a campaign', sub: 'Fund central acquisition', keywords: 'start campaign growth fund', run: () => this.go('/dashboard/campaigns') },
    { label: 'Toggle theme', sub: 'Light / dark', keywords: 'theme dark light mode display', run: () => this.themes.toggle() },
    { label: 'Sign out', sub: 'End this session', keywords: 'sign out logout exit quit', run: () => this.signOut() },
  ];

  /** Flat rows across sections (single keyboard order). */
  protected readonly flat = computed<PaletteRow[]>(() => {
    const q = this.query().trim();
    if (q.startsWith('>')) {
      const needle = q.slice(1).trim().toLowerCase();
      return this.commands
        .filter((c) => !needle || `${c.label} ${c.sub} ${c.keywords}`.toLowerCase().includes(needle))
        .map((c) => ({ section: 'Commands', icon: 'bolt', label: c.label, sub: c.sub, run: c.run }));
    }
    const out: PaletteRow[] = [];
    if (!q) {
      for (const r of readRecents()) out.push(r);
      for (const c of this.commands.slice(0, 5)) {
        out.push({ section: 'Suggested', icon: 'bolt', label: c.label, sub: c.sub, run: c.run });
      }
      return out;
    }
    const r = this.results();
    if (!r) return out;
    this.pushGroups(out, r);
    return out;
  });

  protected readonly sections = computed<PaletteSection[]>(() => {
    const groups = new Map<string, PaletteSection>();
    this.flat().forEach((row, index) => {
      const meta = SECTION_META[row.section] ?? { icon: row.icon };
      if (!groups.has(row.section)) {
        groups.set(row.section, { name: row.section, icon: meta.icon, more: meta.more, rows: [] });
      }
      groups.get(row.section)!.rows.push({ ...row, index });
    });
    return [...groups.values()];
  });

  constructor() {
    this.terms
      .pipe(
        debounceTime(300),
        switchMap(({ value, gen }) => {
          const q = value.trim();
          if (q.length < 2 || q.startsWith('>')) return EMPTY;
          this.searching.set(true);
          return this.search.query(value).pipe(
            map((res) => ({ gen, res })),
            catchError((err: ApiError) => of({ gen, err })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result.gen !== this.searchGeneration) return;
        this.searching.set(false);
        if ('err' in result) {
          this.error.set(result.err.message);
          this.results.set(null);
          return;
        }
        this.results.set(result.res.data ?? null);
      });
  }

  private pushGroups(out: PaletteRow[], r: SearchResults): void {
    const take = (section: string, hits: SearchHit[], toRow: (h: SearchHit) => { label: string; sub: string; link?: string }) => {
      const icon = SECTION_META[section]?.icon ?? 'search';
      for (const h of hits.slice(0, 6)) out.push({ section, icon, ...toRow(h) });
    };
    take('Members', r.members, (h) => ({
      label: h.name || `@${h.username ?? ''}`,
      sub: `@${h.username ?? ''}`,
      link: h.id ? `/dashboard/mentorship/partners/my-partners/detail/${h.id}` : '/dashboard/mentorship/partners/my-partners',
    }));
    take('Prospects', r.prospects, (h) => ({
      label: h.name || 'Unnamed',
      sub: h.stage ?? '',
      link: h.id ? `/dashboard/prospects/detail/${h.id}` : '/dashboard/prospects/pipeline',
    }));
    take('Courses', r.courses, (h) => ({
      label: h.title || '',
      sub: h.tagline ?? '',
      link: h.id ? `/dashboard/training/courses/${h.id}` : '/dashboard/training/courses',
    }));
    take('Posts', r.posts, (h) => ({
      label: h.title || '',
      sub: h.kind ?? '',
      link: '/dashboard/community',
    }));
  }

  protected setActive(row: IndexedRow): void {
    this.active.set(row.index);
    this.scrollActiveIntoView();
  }

  protected highlight(label: string): Array<{ text: string; hit: boolean }> {
    const q = this.query().trim().replace(/^>/, '').trim().toLowerCase();
    if (!q) return [{ text: label, hit: false }];
    const lower = label.toLowerCase();
    const out: Array<{ text: string; hit: boolean }> = [];
    let i = 0;
    for (;;) {
      const at = lower.indexOf(q, i);
      if (at < 0) break;
      if (at > i) out.push({ text: label.slice(i, at), hit: false });
      out.push({ text: label.slice(at, at + q.length), hit: true });
      i = at + q.length;
    }
    if (i < label.length) out.push({ text: label.slice(i), hit: false });
    if (out.length === 0) out.push({ text: label, hit: false });
    return out;
  }

  private scrollActiveIntoView(): void {
    requestAnimationFrame(() => {
      this.host.nativeElement
        ?.querySelector?.('[data-active="true"]')
        ?.scrollIntoView?.({ block: 'nearest' });
    });
  }

  private go(link: string): void {
    this.close();
    void this.router.navigateByUrl(link);
  }

  private signOut(): void {
    this.auth.signOut().subscribe({
      next: () => this.finishSignOut(),
      error: () => this.finishSignOut(),
    });
  }

  private finishSignOut(): void {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch { /* storage may be unavailable */ }
    this.close();
    void this.router.navigate(['/'], { replaceUrl: true });
  }

  /** One entry point for click, hover-commit and Enter: links record recents. */
  protected activate(row: PaletteRow): void {
    if (row.link) {
      pushRecent(row);
      this.go(row.link);
    } else {
      row.run?.();
      this.close();
    }
  }

  protected push(value: string): void {
    this.query.set(value);
    this.active.set(0);
    const gen = ++this.searchGeneration;
    const t = value.trim();
    const searching = t.length >= 2 && !t.startsWith('>');
    this.error.set(null);
    this.touched.set(searching || t.length > 0);
    if (!searching) {
      this.results.set(null);
      this.searching.set(false);
    }
    this.terms.next({ value, gen });
  }

  protected onKey(event: KeyboardEvent): void {
    const rows = this.flat();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (rows.length > 0) {
        this.active.set((this.active() + 1) % rows.length);
        this.scrollActiveIntoView();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (rows.length > 0) {
        this.active.set((this.active() - 1 + rows.length) % rows.length);
        this.scrollActiveIntoView();
      }
    } else if (event.key === 'Enter') {
      const row = rows[this.active()];
      if (row) {
        event.preventDefault();
        this.activate(row);
      }
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
