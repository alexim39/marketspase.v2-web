import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { KitGroup, KitService, KitStats } from '../../../../core/kits/kit.service';
import { ApiError } from '../../../../core/http/api-error';

/**
 * @title Presentation kits — one canonical deck per selling moment.
 *
 * Admin-curated opportunity decks grouped by area. Expand a deck to preview
 * its slides; presenting (tracked share + present mode) lands in phase two.
 * OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-kits',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/prospects/pipeline">Prospects</a> &gt;
        <span>Presentations</span>
      </div>
    </section>

    <section class="kits-page">
      <div class="page-head">
        <div>
          <h2>Presentations</h2>
          <p class="subtitle">One professional story per selling moment — preview a deck, then present it.</p>
        </div>
        <a mat-button routerLink="/dashboard/prospects/pipeline">Pipeline</a>
      </div>

      @if (forProspectId()) {
        <div class="dp-card for-banner" role="note">
          <mat-icon>present_to_all</mat-icon>
          @if (forProspectName()) {
            <p>Pick a deck to present to {{ forProspectName() }} — the outcome logs to their timeline.</p>
          } @else {
            <p>Pick a deck to present — the outcome logs to their timeline.</p>
          }
        </div>
      }

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading presentations" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (groups().length > 0) {
        @for (group of groups(); track group.area) {
          <div class="dp-card area-card">
            <h3>{{ group.area }}</h3>
            @for (kit of group.items; track kit.id) {
              <article class="kit">
                <div class="kit-row">
                  <button type="button" class="kit-head" (click)="toggle(kit.id)" [attr.aria-expanded]="isOpen(kit.id)">
                  <span class="kit-id">
                    <strong>{{ kit.title }}</strong>
                    <span class="muted">
                      @if (kit.source === 'file') {
                        <span class="dp-status dp-status--info pdf-chip">PDF</span>
                      } @else {
                        {{ kit.slideCount }} slide{{ kit.slideCount === 1 ? '' : 's' }}
                      }
                      · ~{{ kit.durationMin }} min</span>
                    @if (statFor(kit.id); as stat) {
                      <span class="muted stat-line">{{ stat }}</span>
                    }
                  </span>
                    @if (kit.description) {
                      <span class="muted">{{ kit.description }}</span>
                    }
                    <mat-icon>{{ isOpen(kit.id) ? 'expand_less' : 'expand_more' }}</mat-icon>
                  </button>
                  <button mat-stroked-button type="button" (click)="present(kit.id)" [matTooltip]="forProspectId() ? 'Present with outcome logging' : 'Rehearse this deck'">
                    <mat-icon>play_arrow</mat-icon>Present
                  </button>
                </div>
                @if (isOpen(kit.id)) {
                  <ol class="slides">
                    @for (s of kit.slides; track s.title) {
                      <li>
                        <strong>{{ s.title }}</strong>
                        <p>{{ s.body }}</p>
                      </li>
                    }
                  </ol>
                }
              </article>
            }
          </div>
        }
      } @else if (!loading() && !error()) {
        <p class="empty">No decks yet — check back soon.</p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .kits-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); }
    .area-card { padding: 1em; display: flex; flex-direction: column; gap: 0.75em; }
    .area-card h3 { margin: 0; font-size: 1em; }
    .kit { border-top: 1px solid var(--ms-line); padding: 0.6em 0; }
    .kit-row { display: flex; align-items: center; gap: 0.7em; }
    .kit-row > .kit-head { flex: 1; width: auto; min-width: 0; }
    .for-banner { padding: 0.8em 1em; display: flex; gap: 0.6em; align-items: center; border-left: 4px solid var(--ms-primary); }
    .for-banner mat-icon { color: var(--ms-primary-strong); flex: none; }
    .for-banner p { margin: 0; }
    .kit-head { width: 100%; display: flex; align-items: center; gap: 0.75em; background: transparent; border: none; cursor: pointer; color: inherit; font: inherit; text-align: left; padding: 0.2em 0; }
    .kit-id { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .stat-line { color: var(--ms-primary-strong); }
    .pdf-chip { font-size: 0.75em; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .slides { margin: 0.6em 0 0; padding-left: 1.4em; display: flex; flex-direction: column; gap: 0.6em; }
    .slides strong { display: block; }
    .slides p { margin: 0.15em 0 0; color: var(--ms-text-muted); font-size: 0.92em; line-height: 1.55; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .empty { color: var(--ms-text-muted); }
  `],
})
export class KitsComponent implements OnInit {
  private readonly kits = inject(KitService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly groups = signal<KitGroup[]>([]);
  protected readonly open = signal<Record<string, boolean>>({});
  protected readonly stats = signal<KitStats | null>(null);
  /** Present-for context (?for=&forName=[&owner=]) from a prospect page. */
  protected readonly forProspectId = signal<string | null>(null);
  protected readonly forProspectName = signal<string | null>(null);
  protected readonly forOwnerId = signal<string | null>(null);

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    this.forProspectId.set(qp.get('for'));
    this.forProspectName.set(qp.get('forName'));
    this.forOwnerId.set(qp.get('owner'));
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.kits
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.groups.set(res.data?.groups ?? []);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
    // Stats ride separately and fail soft — the library works without them.
    this.kits
      .myStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.stats.set(res.data ?? null),
        error: () => undefined,
      });
  }

  protected statFor(kitId: string): string | null {
    const row = this.stats()?.byKit?.[kitId];
    if (!row || row.presented === 0) return null;
    const bits = [`${row.presented} presented`];
    if (row.booked > 0) bits.push(`${row.booked} booked`);
    if (row.converted > 0) bits.push(`${row.converted} converted`);
    return bits.join(' · ');
  }

  protected isOpen(id: string): boolean {
    return this.open()[id] === true;
  }

  protected toggle(id: string): void {
    this.open.update((m) => ({ ...m, [id]: !m[id] }));
  }

  protected present(kitId: string): void {
    const query: Record<string, string> = {};
    if (this.forProspectId()) {
      query['prospect'] = String(this.forProspectId());
      if (this.forProspectName()) query['prospectName'] = String(this.forProspectName());
      if (this.forOwnerId()) query['owner'] = String(this.forOwnerId());
    }
    this.router.navigate(
      ['/dashboard/prospects/kits', kitId, 'present'],
      Object.keys(query).length ? { queryParams: query } : undefined,
    ).catch(() => undefined);
  }
}
