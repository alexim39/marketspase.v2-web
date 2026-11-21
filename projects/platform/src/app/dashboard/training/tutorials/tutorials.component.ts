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
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import {
  Tutorial,
  TutorialArea,
  TutorialGroup,
  TutorialService,
} from '../../../core/tutorials/tutorial.service';
import { ApiError, userError } from '../../../core/http/api-error';

type AreaFilter = 'All' | TutorialArea;

/**
 * @title Platform tutorials — how-to videos by app area.
 *
 * A browse-first library, not a course. There is no watch gate, quiz or
 * completion state: users can jump between videos and skip anything they
 * already know. Desktop gives the featured player the stage and keeps the
 * library in a sticky rail; mobile stacks the player first and reveals the
 * list underneath, scrolling back to the player after a selection.
 */
@Component({
  selector: 'async-tutorials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, PageSkeletonComponent, RouterModule],
  template: `
    <a class="skip-link" href="#tutorial-library">Skip to tutorial list</a>

    <section class="tutorials-page">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a routerLink="/dashboard">Dashboard</a>
        <span>/</span>
        <a routerLink="/dashboard/training">Academy</a>
        <span>/</span>
        <span>Tutorials</span>
      </nav>

      <header class="tutorial-hero">
        <div class="hero-copy">
          <div class="hero-chips">
            <span class="eyebrow">Platform tutorials</span>
            <span class="chip chip--free"><mat-icon>bolt</mat-icon>No completion rules</span>
          </div>
          <h1>Learn the app. Skip what you already know.</h1>
          <p class="hero-sub">
            Short, practical walkthroughs for every part of MarketSpase. Watch in any order —
            nothing is locked, and you can jump straight to the screen you need.
          </p>
          <div class="hero-actions">
            <button
              type="button"
              class="hero-cta"
              (click)="startFirst()"
              [disabled]="videos().length === 0"
            >
              <mat-icon>play_arrow</mat-icon>
              Start with the basics
            </button>
            <a class="hero-link" routerLink="/dashboard/training">Back to Academy</a>
          </div>
        </div>

        <div class="hero-stats" aria-label="Tutorial library summary">
          <div class="stat">
            <strong>{{ videos().length }}</strong>
            <span>{{ videos().length === 1 ? 'how-to video' : 'how-to videos' }}</span>
          </div>
          <div class="stat">
            <strong>{{ areas().length }}</strong>
            <span>{{ areas().length === 1 ? 'app area' : 'app areas' }}</span>
          </div>
          <div class="hero-note">
            <mat-icon>touch_app</mat-icon>
            <span>Pick any video. No watch gate, no quiz, no certificate.</span>
          </div>
        </div>
      </header>

      @if (loading()) {
        <async-page-skeleton layout="cards" [rows]="4" label="tutorials" [showHeader]="false" />
      } @else if (error()) {
        <div class="state-card" role="alert">
          <mat-icon>error_outline</mat-icon>
          <h2>We could not load the tutorials</h2>
          <p>{{ error() }}</p>
          <div class="state-actions">
            <button mat-flat-button color="primary" type="button" (click)="reload()">
              Try again
            </button>
            <a mat-button routerLink="/dashboard/training">Back to Academy</a>
          </div>
        </div>
      } @else if (videos().length === 0) {
        <div class="state-card">
          <mat-icon>video_library</mat-icon>
          <h2>No tutorials yet</h2>
          <p>Short how-to videos will appear here as they are published. Check back soon.</p>
          <div class="state-actions">
            <a mat-stroked-button routerLink="/dashboard/training">Explore the Academy</a>
          </div>
        </div>
      } @else {
        <section class="library-toolbar" aria-label="Tutorial filters">
          <label class="search-box">
            <mat-icon aria-hidden="true">search</mat-icon>
            <input
              type="search"
              [value]="query()"
              (input)="onSearch($event)"
              placeholder="Search by topic, area or title"
              aria-label="Search tutorials"
            />
            @if (query()) {
              <button
                type="button"
                class="clear-search"
                (click)="clearSearch()"
                aria-label="Clear search"
              >
                <mat-icon>close</mat-icon>
              </button>
            }
          </label>

          <div class="area-chips" role="group" aria-label="Filter by app area">
            <button
              type="button"
              class="area-chip"
              [class.active]="areaFilter() === 'All'"
              (click)="setArea('All')"
            >
              All <span>{{ videos().length }}</span>
            </button>
            @for (area of areas(); track area.area) {
              <button
                type="button"
                class="area-chip"
                [class.active]="areaFilter() === area.area"
                (click)="setArea(area.area)"
              >
                {{ area.area }} <span>{{ area.count }}</span>
              </button>
            }
          </div>
        </section>

        @if (filtered().length === 0) {
          <div class="state-card state-card--inline">
            <mat-icon>search_off</mat-icon>
            <h2>No tutorials match this view</h2>
            <p>Try a different search or clear the filters to see the full library.</p>
            <div class="state-actions">
              <button mat-stroked-button type="button" (click)="resetFilters()">
                Clear filters
              </button>
            </div>
          </div>
        } @else {
          <div class="tutorial-stage">
            @if (selected(); as video) {
              <main class="featured-shell" #featuredShell>
                <article class="featured-card">
                  <div class="player-wrap">
                    @if (playing()) {
                      <iframe
                        [src]="embedUrl(video.youtubeId)"
                        [title]="video.title"
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowfullscreen
                        referrerpolicy="strict-origin-when-cross-origin"
                      ></iframe>
                    } @else {
                      <button
                        type="button"
                        class="poster"
                        (click)="playSelected()"
                        [attr.aria-label]="'Play ' + video.title"
                      >
                        <img [src]="thumbUrl(video.youtubeId)" [alt]="video.title" />
                        <span class="poster-scrim"></span>
                        <span class="play-orb"><mat-icon>play_arrow</mat-icon></span>
                        <span class="poster-caption">
                          <span class="poster-kicker">Ready to play</span>
                          <strong>{{ video.title }}</strong>
                        </span>
                      </button>
                    }

                    <div class="player-topline" aria-hidden="true">
                      <span class="area-pill">{{ video.area }}</span>
                      <span class="player-state">
                        <span class="dot" [class.live]="playing()"></span>
                        {{ playing() ? 'Playing' : 'Featured' }}
                      </span>
                    </div>
                  </div>

                  <div class="featured-body">
                    <div class="featured-meta">
                      <span>Tutorial {{ selectedIndex() + 1 }} of {{ filtered().length }}</span>
                      <span class="dot-sep"></span>
                      <span>Free browsing</span>
                    </div>
                    <h2>{{ video.title }}</h2>
                    @if (video.description) {
                      <p>{{ video.description }}</p>
                    } @else {
                      <p>
                        Watch this quick walkthrough, then try it in the app. Move on whenever you
                        are ready.
                      </p>
                    }
                    <div class="featured-actions">
                      <button
                        mat-stroked-button
                        type="button"
                        (click)="previousVideo()"
                        [disabled]="filtered().length < 2"
                      >
                        <mat-icon>arrow_back</mat-icon>
                        Previous
                      </button>
                      <button
                        mat-flat-button
                        color="primary"
                        type="button"
                        (click)="nextVideo()"
                        [disabled]="filtered().length < 2"
                      >
                        Next tutorial
                        <mat-icon>arrow_forward</mat-icon>
                      </button>
                      <a
                        mat-button
                        [href]="youtubeUrl(video.youtubeId)"
                        target="_blank"
                        rel="noopener"
                      >
                        Watch on YouTube
                        <mat-icon>open_in_new</mat-icon>
                      </a>
                    </div>
                  </div>
                </article>
              </main>
            }

            <aside class="tutorial-rail" id="tutorial-library" aria-label="All tutorials">
              <div class="rail-head">
                <div>
                  <p class="eyebrow">Tutorial library</p>
                  <h2>All tutorials</h2>
                </div>
                <span class="rail-count">{{ filtered().length }}</span>
              </div>
              <p class="rail-hint">Tap any video to feature it. Nothing is locked.</p>

              <div class="rail-list">
                @for (video of filtered(); track video.id; let i = $index) {
                  <button
                    type="button"
                    class="rail-item"
                    [class.active]="selected()?.id === video.id"
                    [attr.aria-current]="selected()?.id === video.id ? 'true' : null"
                    (click)="selectVideo(video)"
                  >
                    <span class="rail-thumb">
                      <img [src]="thumbUrl(video.youtubeId)" alt="" loading="lazy" />
                      <span class="rail-play"><mat-icon>play_arrow</mat-icon></span>
                    </span>
                    <span class="rail-copy">
                      <small>{{ video.area }}</small>
                      <strong>{{ video.title }}</strong>
                    </span>
                    <span class="rail-number">{{ i + 1 }}</span>
                  </button>
                }
              </div>
            </aside>
          </div>
        }
      }
    </section>

    <p class="sr-only" aria-live="polite">
      @if (selected(); as video) {
        Now featuring {{ video.title }}
      }
    </p>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .tutorials-page {
        max-width: 1280px;
        margin: 0 auto;
        padding: 18px 0 64px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .skip-link {
        position: absolute;
        left: 24px;
        top: -64px;
        z-index: 20;
        padding: 10px 16px;
        border-radius: var(--ms-radius-md);
        background: var(--ms-ink);
        color: var(--ms-ink-text);
        text-decoration: none;
        font-weight: 700;
      }
      .skip-link:focus {
        top: 12px;
      }

      .breadcrumb {
        display: flex;
        align-items: center;
        gap: 7px;
        color: var(--ms-text-muted);
        font-size: 0.8rem;
        flex-wrap: wrap;
      }
      .breadcrumb a {
        color: var(--ms-text-muted);
        text-decoration: none;
      }
      .breadcrumb a:hover {
        color: var(--ms-primary-strong);
      }

      .tutorial-hero {
        position: relative;
        overflow: hidden;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
        gap: 28px;
        align-items: center;
        padding: 30px 32px;
        border-radius: 28px;
        color: #fff;
        background:
          radial-gradient(circle at 84% 12%, rgba(245, 212, 138, 0.22), transparent 28%),
          radial-gradient(circle at 8% 92%, rgba(20, 184, 166, 0.2), transparent 30%),
          linear-gradient(135deg, #14122b 0%, #211c48 52%, #0f5132 100%);
        box-shadow: var(--ms-shadow-md);
      }
      .tutorial-hero::after {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background-image:
          linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
        background-size: 28px 28px;
        mask-image: linear-gradient(90deg, transparent, #000 55%, #000);
      }
      .hero-copy {
        position: relative;
        z-index: 1;
        min-width: 0;
      }
      .hero-chips {
        display: flex;
        align-items: center;
        gap: 9px;
        flex-wrap: wrap;
      }
      .eyebrow {
        margin: 0;
        color: var(--ms-primary-strong);
        font-size: 0.67rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .tutorial-hero .eyebrow {
        color: rgba(255, 255, 255, 0.72);
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: var(--ms-radius-pill);
        font-size: 0.72rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.9);
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.16);
      }
      .chip mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }
      .chip--free {
        background: rgba(198, 246, 213, 0.14);
        border-color: rgba(198, 246, 213, 0.24);
        color: #c6f6d5;
      }

      .tutorial-hero h1 {
        margin: 12px 0 9px;
        max-width: 760px;
        font-size: clamp(2rem, 3.7vw, 3.1rem);
        line-height: 1.04;
        letter-spacing: -0.04em;
      }
      .hero-sub {
        margin: 0;
        max-width: 680px;
        color: rgba(255, 255, 255, 0.76);
        line-height: 1.6;
        font-size: 0.95rem;
      }
      .hero-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 18px;
      }
      .hero-cta,
      .hero-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        min-height: 46px;
        padding: 0 18px;
        border-radius: var(--ms-radius-md);
        font: inherit;
        font-size: 0.86rem;
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
      }
      .hero-cta {
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: #fff;
        color: #14122b;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.16);
      }
      .hero-cta:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .hero-cta mat-icon {
        color: #4c5bd4;
      }
      .hero-link {
        color: rgba(255, 255, 255, 0.86);
        border: 1px solid rgba(255, 255, 255, 0.24);
        background: rgba(255, 255, 255, 0.06);
      }
      .hero-link:hover {
        background: rgba(255, 255, 255, 0.12);
      }

      .hero-stats {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        padding: 18px;
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.075);
        border: 1px solid rgba(255, 255, 255, 0.14);
        backdrop-filter: blur(10px);
      }
      .stat {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .stat strong {
        font-family: var(--ms-font-display);
        font-size: 2rem;
        line-height: 1;
        letter-spacing: -0.04em;
        font-variant-numeric: tabular-nums;
      }
      .stat span {
        color: rgba(255, 255, 255, 0.64);
        font-size: 0.72rem;
        font-weight: 600;
      }
      .hero-note {
        grid-column: 1 / -1;
        display: flex;
        gap: 8px;
        align-items: flex-start;
        padding-top: 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.13);
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.76rem;
        line-height: 1.45;
      }
      .hero-note mat-icon {
        font-size: 17px;
        width: 17px;
        height: 17px;
        color: #c6f6d5;
        flex: none;
      }

      .library-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border: 1px solid var(--ms-line);
        border-radius: 16px;
        background: var(--ms-surface);
        box-shadow: var(--ms-shadow-sm);
        flex-wrap: wrap;
      }
      .search-box {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1 1 280px;
        min-width: 220px;
        min-height: 44px;
        padding: 0 10px 0 13px;
        border: 1px solid var(--ms-line);
        border-radius: var(--ms-radius-pill);
        background: var(--ms-canvas);
        color: var(--ms-text-muted);
      }
      .search-box:focus-within {
        border-color: var(--ms-primary);
        box-shadow: 0 0 0 3px var(--ms-primary-soft);
      }
      .search-box mat-icon {
        font-size: 19px;
        width: 19px;
        height: 19px;
        flex: none;
      }
      .search-box input {
        flex: 1;
        min-width: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--ms-text);
        font: inherit;
        font-size: 0.84rem;
      }
      .search-box input::-webkit-search-cancel-button {
        display: none;
      }
      .clear-search {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border: 0;
        border-radius: 50%;
        background: var(--ms-surface-3);
        color: var(--ms-text-muted);
        cursor: pointer;
      }
      .clear-search mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .area-chips {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-wrap: wrap;
      }
      .area-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        min-height: 38px;
        padding: 5px 11px;
        border: 1px solid var(--ms-line);
        border-radius: var(--ms-radius-pill);
        background: transparent;
        color: var(--ms-text-muted);
        font: inherit;
        font-size: 0.74rem;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
      }
      .area-chip:hover {
        border-color: var(--ms-primary);
        color: var(--ms-text);
      }
      .area-chip.active {
        background: var(--ms-primary);
        border-color: var(--ms-primary);
        color: #fff;
      }
      .area-chip span {
        font-variant-numeric: tabular-nums;
        font-size: 0.67rem;
        opacity: 0.66;
      }
      .area-chip.active span {
        opacity: 0.85;
      }

      .tutorial-stage {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 380px;
        gap: 20px;
        align-items: start;
      }
      .featured-shell {
        min-width: 0;
        scroll-margin-top: 16px;
      }
      .featured-card {
        overflow: hidden;
        background: var(--ms-surface);
        border: 1px solid var(--ms-line);
        border-radius: 22px;
        box-shadow: var(--ms-shadow-sm);
      }
      .player-wrap {
        position: relative;
        aspect-ratio: 16 / 9;
        background: #08080d;
        overflow: hidden;
      }
      .player-wrap iframe {
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
      }
      .poster {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        padding: 0;
        border: 0;
        background: #08080d;
        color: #fff;
        text-align: left;
        cursor: pointer;
        overflow: hidden;
      }
      .poster img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 320ms var(--ms-ease);
      }
      .poster:hover img {
        transform: scale(1.035);
      }
      .poster-scrim {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(8, 8, 13, 0.05) 20%, rgba(8, 8, 13, 0.72) 100%);
      }
      .play-orb {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        display: grid;
        place-items: center;
        width: 76px;
        height: 76px;
        border-radius: 50%;
        color: #fff;
        background: rgba(255, 255, 255, 0.16);
        border: 1px solid rgba(255, 255, 255, 0.34);
        backdrop-filter: blur(10px);
        box-shadow: 0 12px 35px rgba(0, 0, 0, 0.32);
        transition:
          transform 180ms var(--ms-ease),
          background 180ms var(--ms-ease);
      }
      .poster:hover .play-orb {
        transform: translate(-50%, -50%) scale(1.06);
        background: rgba(255, 255, 255, 0.24);
      }
      .play-orb mat-icon {
        font-size: 44px;
        width: 44px;
        height: 44px;
      }
      .poster-caption {
        position: absolute;
        left: 24px;
        right: 24px;
        bottom: 22px;
        display: flex;
        flex-direction: column;
        gap: 3px;
        text-shadow: 0 2px 14px rgba(0, 0, 0, 0.5);
      }
      .poster-kicker {
        font-size: 0.67rem;
        font-weight: 800;
        letter-spacing: 0.13em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.7);
      }
      .poster-caption strong {
        font-family: var(--ms-font-display);
        font-size: clamp(1.1rem, 2vw, 1.55rem);
        line-height: 1.15;
        letter-spacing: -0.02em;
      }
      .player-topline {
        position: absolute;
        top: 12px;
        left: 12px;
        right: 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        pointer-events: none;
      }
      .area-pill,
      .player-state {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 9px;
        border-radius: var(--ms-radius-pill);
        background: rgba(8, 8, 13, 0.68);
        border: 1px solid rgba(255, 255, 255, 0.14);
        color: rgba(255, 255, 255, 0.9);
        font-size: 0.66rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        backdrop-filter: blur(6px);
      }
      .player-state .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.45);
      }
      .player-state .dot.live {
        background: #4ade80;
        box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.18);
      }

      .featured-body {
        padding: 22px 24px 24px;
        display: flex;
        flex-direction: column;
        gap: 9px;
      }
      .featured-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--ms-text-muted);
        font-size: 0.72rem;
        font-weight: 600;
      }
      .dot-sep {
        width: 3px;
        height: 3px;
        border-radius: 50%;
        background: var(--ms-line-strong);
      }
      .featured-body h2 {
        margin: 0;
        font-size: clamp(1.35rem, 2.4vw, 1.9rem);
        line-height: 1.15;
        letter-spacing: -0.03em;
      }
      .featured-body > p {
        margin: 0;
        max-width: 72ch;
        color: var(--ms-text-muted);
        line-height: 1.6;
        font-size: 0.88rem;
      }
      .featured-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        padding-top: 5px;
      }
      .featured-actions mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      .featured-actions a mat-icon {
        margin-left: 3px;
      }

      .tutorial-rail {
        position: sticky;
        top: 16px;
        display: flex;
        flex-direction: column;
        min-width: 0;
        max-height: calc(100vh - 32px);
        padding: 18px;
        border: 1px solid var(--ms-line);
        border-radius: 20px;
        background: var(--ms-surface);
        box-shadow: var(--ms-shadow-sm);
      }
      .rail-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }
      .rail-head h2 {
        margin: 4px 0 0;
        font-size: 1.15rem;
        letter-spacing: -0.02em;
      }
      .rail-count {
        display: inline-grid;
        place-items: center;
        min-width: 32px;
        height: 28px;
        padding: 0 8px;
        border-radius: var(--ms-radius-pill);
        background: var(--ms-primary-soft);
        color: var(--ms-primary-strong);
        font-size: 0.72rem;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
      }
      .rail-hint {
        margin: 6px 0 12px;
        color: var(--ms-text-muted);
        font-size: 0.78rem;
        line-height: 1.45;
      }
      .rail-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-height: 0;
        overflow-y: auto;
        padding-right: 4px;
        scrollbar-width: thin;
      }
      .rail-item {
        display: grid;
        grid-template-columns: 108px minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-height: 76px;
        padding: 7px;
        border: 1px solid transparent;
        border-radius: 14px;
        background: transparent;
        color: inherit;
        text-align: left;
        font: inherit;
        cursor: pointer;
        transition:
          background 160ms var(--ms-ease),
          border-color 160ms var(--ms-ease);
      }
      .rail-item:hover {
        background: var(--ms-canvas);
        border-color: var(--ms-line);
      }
      .rail-item.active {
        background: var(--ms-primary-soft);
        border-color: color-mix(in srgb, var(--ms-primary) 38%, var(--ms-line));
        box-shadow: inset 3px 0 0 var(--ms-primary);
      }
      .rail-thumb {
        position: relative;
        width: 108px;
        aspect-ratio: 16 / 9;
        border-radius: 10px;
        overflow: hidden;
        background: #08080d;
      }
      .rail-thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .rail-play {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: rgba(8, 8, 13, 0.18);
      }
      .rail-play mat-icon {
        font-size: 27px;
        width: 27px;
        height: 27px;
        color: #fff;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.55);
      }
      .rail-copy {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .rail-copy small {
        color: var(--ms-primary-strong);
        font-size: 0.62rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .rail-copy strong {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        font-size: 0.8rem;
        line-height: 1.32;
      }
      .rail-number {
        color: var(--ms-text-muted);
        font-family: var(--ms-font-mono);
        font-size: 0.68rem;
        font-variant-numeric: tabular-nums;
      }
      .rail-item.active .rail-number {
        color: var(--ms-primary-strong);
      }

      .state-card {
        display: grid;
        place-items: center;
        gap: 8px;
        padding: 54px 20px;
        border: 1px dashed var(--ms-line);
        border-radius: 20px;
        text-align: center;
        background: var(--ms-surface);
      }
      .state-card mat-icon {
        font-size: 42px;
        width: 42px;
        height: 42px;
        color: var(--ms-text-muted);
      }
      .state-card h2 {
        margin: 0;
      }
      .state-card p {
        margin: 0;
        max-width: 38em;
        color: var(--ms-text-muted);
        line-height: 1.55;
      }
      .state-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: center;
        margin-top: 4px;
      }
      .state-card--inline {
        padding: 38px 20px;
      }

      button:focus-visible,
      a:focus-visible {
        outline: 2px solid var(--ms-primary);
        outline-offset: 2px;
      }
      .search-box input:focus-visible {
        outline: none;
      }

      @media (max-width: 1180px) {
        .tutorial-stage {
          grid-template-columns: minmax(0, 1fr) 330px;
        }
        .rail-item {
          grid-template-columns: 92px minmax(0, 1fr) auto;
        }
        .rail-thumb {
          width: 92px;
        }
      }

      @media (max-width: 980px) {
        .tutorials-page {
          padding-top: 10px;
        }
        .tutorial-hero {
          grid-template-columns: minmax(0, 1fr);
          gap: 18px;
          padding: 26px;
          border-radius: 22px;
        }
        .hero-stats {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          padding: 14px 16px;
        }
        .hero-note {
          grid-column: auto;
          border-top: 0;
          padding-top: 0;
          align-items: center;
          border-left: 1px solid rgba(255, 255, 255, 0.13);
          padding-left: 14px;
        }
        .tutorial-stage {
          grid-template-columns: minmax(0, 1fr);
          gap: 14px;
        }
        .tutorial-rail {
          position: static;
          max-height: none;
          padding: 16px;
        }
        .rail-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          overflow: visible;
          padding-right: 0;
        }
        .rail-item {
          grid-template-columns: 96px minmax(0, 1fr) auto;
        }
        .rail-thumb {
          width: 96px;
        }
      }

      @media (max-width: 700px) {
        .tutorials-page {
          padding-bottom: 42px;
        }
        .tutorial-hero {
          padding: 22px 18px;
          border-radius: 20px;
        }
        .tutorial-hero h1 {
          font-size: clamp(1.8rem, 8vw, 2.35rem);
        }
        .hero-sub {
          font-size: 0.88rem;
        }
        .hero-actions {
          flex-direction: column;
          align-items: stretch;
        }
        .hero-cta,
        .hero-link {
          width: 100%;
        }
        .hero-stats {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .hero-note {
          grid-column: 1 / -1;
          border-left: 0;
          border-top: 1px solid rgba(255, 255, 255, 0.13);
          padding-left: 0;
          padding-top: 10px;
        }
        .library-toolbar {
          flex-direction: column;
          align-items: stretch;
          gap: 9px;
          padding: 10px;
        }
        .search-box {
          flex-basis: auto;
          width: 100%;
        }
        .area-chips {
          flex-wrap: nowrap;
          overflow-x: auto;
          padding: 1px 1px 4px;
          scrollbar-width: none;
        }
        .area-chips::-webkit-scrollbar {
          display: none;
        }
        .tutorial-stage {
          gap: 12px;
        }
        .featured-card {
          border-radius: 18px;
        }
        .poster-caption {
          left: 16px;
          right: 16px;
          bottom: 16px;
        }
        .play-orb {
          width: 62px;
          height: 62px;
        }
        .play-orb mat-icon {
          font-size: 36px;
          width: 36px;
          height: 36px;
        }
        .player-topline {
          top: 8px;
          left: 8px;
          right: 8px;
        }
        .area-pill,
        .player-state {
          padding: 4px 7px;
          font-size: 0.6rem;
        }
        .featured-body {
          padding: 16px;
        }
        .featured-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .featured-actions a {
          grid-column: 1 / -1;
        }
        .rail-list {
          grid-template-columns: minmax(0, 1fr);
        }
        .rail-item {
          grid-template-columns: 92px minmax(0, 1fr) auto;
          min-height: 70px;
        }
        .rail-thumb {
          width: 92px;
        }
      }

      @media (max-width: 420px) {
        .featured-actions {
          grid-template-columns: minmax(0, 1fr);
        }
        .featured-actions a {
          grid-column: auto;
        }
        .rail-number {
          display: none;
        }
        .rail-item {
          grid-template-columns: 86px minmax(0, 1fr);
        }
        .rail-thumb {
          width: 86px;
        }
      }
    `,
  ],
})
export class TutorialsComponent implements OnInit {
  private readonly tutorials = inject(TutorialService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly featuredShell = viewChild<ElementRef<HTMLElement>>('featuredShell');

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly groups = signal<TutorialGroup[]>([]);
  protected readonly query = signal('');
  protected readonly areaFilter = signal<AreaFilter>('All');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly playing = signal(false);

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
    this.selectedId.set(first.id);
    this.playing.set(true);
    this.revealOnMobile();
  }

  protected playSelected(): void {
    this.playing.set(true);
  }

  protected selectVideo(video: Tutorial): void {
    this.selectedId.set(video.id);
    this.playing.set(true);
    this.revealOnMobile();
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
    return `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`;
  }

  protected youtubeUrl(youtubeId: string): string {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`;
  }

  private syncSelection(): void {
    const list = this.filtered();
    if (!list.some((video) => video.id === this.selectedId())) {
      this.selectedId.set(list[0]?.id ?? null);
    }
    this.playing.set(false);
  }

  private revealOnMobile(): void {
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 980px)').matches) return;
    setTimeout(() => {
      this.featuredShell()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }
}
