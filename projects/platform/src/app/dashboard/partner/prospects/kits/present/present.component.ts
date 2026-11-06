import { ChangeDetectionStrategy, Component, DestroyRef, effect, ElementRef, HostListener, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Location } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Kit, KitService } from '../../../../../core/kits/kit.service';
import { LeadPipelineService } from '../../lead-pipeline/lead-pipeline.service';
import { ProspectLead, ProspectStage } from '../../lead-pipeline/lead.models';
import { AuthService } from '../../../../../core/auth/auth.service';
import { PartnerService } from '../../../../../_common/services/partner.service';
import { userError } from '../../../../../core/http/api-error';
import * as pdfjsLib from 'pdfjs-dist';

// Worker pinned to the installed pdfjs-dist — bump together on upgrade.
// CDN (not bundled): keeps the app bundle lean and cannot break `ng build`.
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

/**
 * In-app canvas preview needs a modern runtime (pdf.js uses `Promise.try`,
 * missing on older devices). Unsupported browsers get the native path
 * instead — outcome logging works identically either way.
 */
const PDF_PREVIEW_SUPPORTED =
  typeof (Promise as unknown as { try?: unknown }).try === 'function';

const OUTCOMES = ['Connected', 'No answer', 'Booked session', 'Follow-up set', 'Closed-lost'] as const;
const STAGES: ProspectStage[] = ['New', 'Contacted', 'Interested', 'In Negotiation', 'Converted', 'Closed'];

/**
 * @title Present mode — walk a prospect through the deck, then log it.
 *
 * Fullscreen slide viewer (notes on demand, progress). Ending opens the
 * outcome sheet: outcome + interest + optional follow-up date log a
 * `presentation` touch (reminders feed automatically), with an optional
 * stage advance. With `?prospect=` (+`owner=` for support attribution) the
 * touch lands on the pipeline; without it this is rehearsal-only. OnPush.
 */
@Component({
  selector: 'async-present',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, MatButtonModule, MatDatepickerModule, MatNativeDateModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule,
    MatSelectModule, MatSnackBarModule, MatTooltipModule, MatMenuModule, RouterModule,
  ],
  template: `
    <section class="present-page" [class.present-mode]="presenting()">
      @if (presenting()) {
        <button mat-fab class="mode-exit" (click)="exitPresent()" aria-label="Exit presentation mode">
          <mat-icon>close_fullscreen</mat-icon>
        </button>
      }
      <div class="dp-card topbar slim">
        <button mat-icon-button (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
        <div class="who">
          <strong>{{ kit()?.title ?? 'Deck' }}</strong>
          <span class="dp-muted">
            @if (prospectName()) { presenting to {{ prospectName() }} · }
            @if (isFile()) { page {{ index() + 1 }} of {{ pdfPages() || '…' }} }
            @else { slide {{ index() + 1 }} of {{ kit()?.slides?.length ?? 0 }} }
          </span>
        </div>
        <span class="spacer"></span>
        @if (presenting() || sessionActive()) {
          <span class="dp-status dp-status--warn live-dot" role="status" aria-label="Recording now">
            <span class="dot"></span>{{ elapsedLabel() }}
          </span>
        }
        @if (!isFile()) {
          <button mat-icon-button (click)="showNotes.set(!showNotes())" [matTooltip]="showNotes() ? 'Hide notes' : 'Presenter notes'" aria-label="Toggle notes">
            <mat-icon>sticky_note_2</mat-icon>
          </button>
        }
        <button mat-flat-button color="primary" (click)="finish()" [disabled]="!hasContent()" title="Finish and log the outcome">
          <mat-icon>flag</mat-icon>End &amp; log
        </button>
        <button mat-icon-button [matMenuTriggerFor]="overflowMenu" aria-label="More actions"><mat-icon>more_vert</mat-icon></button>
        <button mat-icon-button (click)="presenting() ? exitPresent() : enterPresent()" [disabled]="!hasContent()" [matTooltip]="presenting() ? 'Exit presentation mode' : 'Presentation mode'" aria-label="Toggle presentation mode">
          <mat-icon>{{ presenting() ? 'close_fullscreen' : 'present_to_all' }}</mat-icon>
        </button>
      </div>
      <mat-menu #overflowMenu="matMenu">
        <a mat-menu-item [href]="presentUrl()" target="_blank" rel="noopener"><mat-icon>open_in_new</mat-icon>Open in new tab</a>
        <button mat-menu-item (click)="presentInNewWindow()"><mat-icon>present_to_all</mat-icon>Present in new window</button>
        <button mat-menu-item (click)="copyLink()"><mat-icon>content_copy</mat-icon>Copy presentation link</button>
      </mat-menu>
      @if (hasContent() && !loading()) {
        <mat-progress-bar class="thin" mode="determinate" [value]="progress()" aria-label="Deck progress" />
      }

      @if (loading()) {
        @if (pdfLoadProgress() !== null) {
          <mat-progress-bar mode="determinate" [value]="(pdfLoadProgress() ?? 0) * 100" aria-label="Loading PDF" />
          <p class="dp-muted">Loading deck… {{ ((pdfLoadProgress() ?? 0) * 100).toFixed(0) }}%</p>
        } @else {
          <mat-progress-bar mode="indeterminate" aria-label="Loading deck" />
        }
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="back()">Back</button>
        </p>
      }

      @if (hasContent() && !loading()) {
        <aside class="filmstrip" aria-label="Deck outline">
          @if (isFile()) {
            @for (n of pageNumbers(); track n) {
              <button type="button" class="film-btn" [class.active]="n - 1 === index()" (click)="goTo(n - 1)" [attr.aria-label]="'Go to page ' + n">{{ n }}</button>
            }
          } @else {
            @for (s of kit()?.slides ?? []; track s.title) {
              <button type="button" class="film-btn wide" [class.active]="s.title === slide()?.title" (click)="goToTitle(s.title)" [attr.aria-label]="'Go to ' + s.title" [matTooltip]="s.title">{{ s.title }}</button>
            }
          }
        </aside>
      }
      <div class="stage-wrap">
      @if (isFile()) {
        @if (pdfPreview()) {
        <div #viewerWrap class="dp-card pdf-wrap">
          @if (pdfBusy()) {
            <mat-progress-bar mode="indeterminate" aria-label="Rendering page" />
          }
          @if (pdfError(); as pdfErr) {
            <p class="error" role="alert">{{ pdfErr }}</p>
          }
          <canvas #pdfCanvas class="pdf-canvas"></canvas>
        </div>
        } @else if (kit()?.fileUrl) {
        @if (safeFileUrl(); as src) {
          <div class="dp-card pdf-embed">
            <iframe [src]="src" title="Deck preview" loading="lazy"></iframe>
          </div>
        }
        <div class="dp-card pdf-native" role="note">
          <mat-icon>picture_as_pdf</mat-icon>
          <div>
            <p><strong>Your browser can't preview PDFs in-app</strong> — open the deck directly instead (your built-in viewer handles it).</p>
            <div class="actions">
              <a mat-flat-button color="primary" [href]="kit()!.fileUrl" target="_blank" rel="noopener">Open PDF</a>
              <button mat-stroked-button (click)="finish()">Log outcome</button>
            </div>
          </div>
        </div>
        }
      } @else if (slide(); as s) {
        <div #viewerWrap class="dp-card slide">
          @if (s.imageUrl) {
            <img [src]="s.imageUrl" [alt]="s.title" loading="lazy" />
          }
          <h2>{{ s.title }}</h2>
          <p>{{ s.body }}</p>
        </div>
      }

      @if (showNotes() && !isFile()) {
        @if (slide()?.note; as snote) {
          <aside class="note-overlay" role="note">
            <mat-icon>sticky_note_2</mat-icon>
            <p>{{ snote }}</p>
          </aside>
        }
      }

        @if (hasContent() && !loading()) {
          <button type="button" class="edge edge-left" (click)="prev()" [disabled]="index() === 0" aria-label="Previous">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <button type="button" class="edge edge-right" (click)="atEnd() ? finish() : next()" [attr.aria-label]="atEnd() ? 'Finish and log' : 'Next'">
            <mat-icon>{{ atEnd() ? 'flag' : 'chevron_right' }}</mat-icon>
          </button>
        }
      </div>

      @if (done()) {
        <div class="scrim" (click)="done.set(false)"></div>
        <section class="sheet dp-card" role="dialog" aria-label="Log outcome">
          <div class="sheet-head">
            <h3>How did it land?</h3>
            <button mat-icon-button (click)="done.set(false)" aria-label="Close"><mat-icon>close</mat-icon></button>
          </div>
          @if (sessionSummary()) {
            <p class="dp-muted session-line"><mat-icon>timer</mat-icon>This session: {{ sessionSummary() }}</p>
          }
          @if (!prospectId()) {
            <p class="dp-muted">Rehearsal has no prospect attached — attach one to log this presentation to their timeline.</p>
            <div class="actions">
              <button mat-stroked-button (click)="openPicker()">{{ picking() ? 'Close picker' : 'Attach a prospect…' }}</button>
            </div>
            @if (picking()) {
              <mat-form-field appearance="outline">
                <mat-label>Search your pipeline</mat-label>
                <input matInput type="search" [ngModel]="pickQuery()" (ngModelChange)="pickQuery.set($event)" placeholder="Name or phone" />
              </mat-form-field>
              @if (pickLoading()) {
                <mat-progress-bar mode="indeterminate" aria-label="Loading prospects" />
              } @else if (pickMatches().length > 0) {
                <ul class="pick-list">
                  @for (p of pickMatches(); track p.id) {
                    <li>
                      <button mat-button (click)="pickProspect(p)">
                        {{ p.prospectName }} {{ p.prospectSurname ?? '' }} · {{ p.prospectPhone }}
                      </button>
                    </li>
                  }
                </ul>
              } @else {
                <p class="dp-muted">No matches — try another search.</p>
              }
            }
          } @else {
            <div class="grid">
              <mat-form-field appearance="outline">
                <mat-label>Outcome</mat-label>
                <mat-select [(value)]="outcome">
                  @for (o of outcomes; track o) {
                    <mat-option [value]="o">{{ o }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Interest</mat-label>
                <mat-select [(value)]="interest">
                  <mat-option value="hot">Hot</mat-option>
                  <mat-option value="warm">Warm</mat-option>
                  <mat-option value="cold">Cold</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
            <mat-form-field appearance="outline">
              <mat-label>Note (optional)</mat-label>
              <input matInput maxlength="500" [(ngModel)]="note" placeholder="e.g. loved the product story, worried about price" />
            </mat-form-field>
            <div class="grid">
              <mat-form-field appearance="outline">
                <mat-label>Follow-up date (optional)</mat-label>
                <input matInput [matDatepicker]="followPicker" [(ngModel)]="followUpDate" [min]="minDate" placeholder="Pick a date" />
                <mat-datepicker-toggle matSuffix [for]="followPicker" />
                <mat-datepicker #followPicker />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Move stage (optional)</mat-label>
                <mat-select [(value)]="stage">
                  <mat-option value="">No move</mat-option>
                  @for (s of stages; track s) {
                    <mat-option [value]="s">{{ s }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
            @if (isSupport()) {
              <p class="dp-muted">Logged as support — the owner sees this touch with your name on it.</p>
            }
            <div class="actions">
              <button mat-button (click)="done.set(false)">Back to deck</button>
              <button mat-flat-button color="primary" (click)="save()" [disabled]="saving() || !outcome()">
                {{ saving() ? 'Saving…' : 'Log presentation' }}
              </button>
            </div>
          }
        </section>
      }
    </section>
  `,
  styles: [`
    .present-page { display: flex; flex-direction: column; gap: 0.8em; padding-bottom: 2em; max-width: 860px; margin: 0 auto; width: 100%; }
    .topbar { padding: 0.6em 0.8em; display: flex; align-items: center; gap: 0.5em; position: sticky; top: 0; z-index: 5; }
    .who { display: flex; flex-direction: column; min-width: 0; }
    .spacer { flex: 1; }
    .thin { height: 3px; border-radius: 2px; }
    .stage-wrap { position: relative; }
    .edge { position: absolute; top: 0; bottom: 0; width: 72px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer; color: var(--ms-text-muted); opacity: 0; transition: opacity 0.2s; z-index: 2; padding: 0; }
    .edge mat-icon { font-size: 2.2rem; width: auto; height: auto; }
    .edge-left { left: 0; }
    .edge-right { right: 0; }
    .stage-wrap:hover .edge, .edge:focus-visible { opacity: 1; }
    @media (hover: none) { .edge { opacity: 0.85; } }
    .edge:disabled { visibility: hidden; }
    .scrim { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); z-index: 900; }
    .sheet { position: fixed; left: 50%; transform: translateX(-50%); bottom: 0; width: min(94vw, 640px); max-height: 82vh; overflow-y: auto; z-index: 901; border-radius: 14px 14px 0 0; padding: 1.1em; display: flex; flex-direction: column; gap: 0.8em; }
    .sheet-head { display: flex; align-items: center; justify-content: space-between; }
    .sheet-head h3 { margin: 0; }
    .slide { padding: 1.6em 1.4em; min-height: 40vh; display: flex; flex-direction: column; gap: 0.6em; }
    .slide img { max-width: 100%; border-radius: 8px; border: 1px solid var(--ms-line); }
    .slide h2 { margin: 0; font-size: 1.5rem; line-height: 1.3; }
    .slide p { margin: 0; line-height: 1.65; font-size: 1.05rem; }
    .note mat-icon { flex: none; }
    .filmstrip { display: flex; gap: 0.4em; overflow-x: auto; padding: 0.2em 0.1em 0.5em; }
    .film-btn { flex: none; min-width: 2.8em; min-height: 44px; border: 1px solid var(--ms-line); background: var(--ms-surface); color: inherit; border-radius: 8px; font: inherit; font-size: 0.85rem; cursor: pointer; }
    .film-btn.wide { max-width: 12em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 0.8em; }
    .film-btn.active { border-color: var(--ms-primary); background: var(--ms-primary-soft); font-weight: 700; }
    .note-overlay { position: absolute; left: 0.8em; right: 0.8em; bottom: 0.8em; z-index: 1; display: flex; gap: 0.5em; align-items: flex-start; background: var(--ms-primary-soft); color: var(--ms-primary-strong); border-radius: 8px; padding: 0.7em 0.9em; }
    .note-overlay mat-icon { flex: none; }
    .note-overlay p { margin: 0; line-height: 1.55; font-size: 0.95rem; }
    .pdf-wrap { padding: 1em; display: flex; flex-direction: column; gap: 0.6em; align-items: center; overflow-x: auto; }
    .pdf-wrap:fullscreen { border-radius: 0; max-height: 100vh; overflow: auto; }
    .pdf-canvas { max-width: 100%; border: 1px solid var(--ms-line); border-radius: 8px; }
    .present-mode { position: fixed; inset: 0; z-index: 950; max-width: none; margin: 0; padding: 0.6em 0.9em 1.2em; overflow-y: auto; background: var(--ms-ink); }
    .present-mode .topbar { position: sticky; top: 0; z-index: 5; background: transparent; border-color: transparent; padding-top: 0.2em; padding-bottom: 0.2em; color: var(--ms-ink-text); }
    .present-mode .topbar .dp-muted { color: var(--ms-ink-text); opacity: 0.75; }
    .present-mode .topbar .who strong { color: var(--ms-ink-text); }
    .present-mode .slide { min-height: 0; font-size: 1.12em; }
    .present-mode .pdf-wrap { max-height: none; }
    .present-mode .pdf-embed iframe { height: calc(100dvh - 230px); min-height: 50vh; }
    .present-mode .edge { color: #fff; }
    .present-mode .thin { opacity: 0.85; }
    .present-mode .empty, .present-mode .error { color: var(--ms-ink-text); }
    .live-dot { gap: 0.4em; font-variant-numeric: tabular-nums; }
    .live-dot .dot { width: 0.55em; height: 0.55em; border-radius: 50%; background: currentColor; animation: live-blink 1.2s ease-in-out infinite; }
    @keyframes live-blink { 50% { opacity: 0.35; } }
    @media (prefers-reduced-motion: reduce) { .live-dot .dot { animation: none; } }
    .mode-exit { position: fixed; top: 0.8em; right: 0.8em; z-index: 1001; }
    .session-line { display: flex; align-items: center; gap: 0.4em; }
    .pick-list { list-style: none; margin: 0.4em 0 0; padding: 0; display: flex; flex-direction: column; }
    .pick-list li { border-top: 1px solid var(--ms-line); }
    .pick-list button { width: 100%; justify-content: flex-start; min-height: 44px; }
    .pdf-native { padding: 1em; display: flex; gap: 0.7em; align-items: flex-start; }
    .pdf-native mat-icon { color: var(--ms-error); font-size: 2rem; width: auto; height: auto; flex: none; }
    .pdf-native p { margin: 0 0 0.7em; }
    .pdf-native .actions { display: flex; gap: 0.6em; flex-wrap: wrap; }
    .pdf-native .actions a, .pdf-native .actions button { min-height: 44px; }
    .pdf-embed { padding: 0.6em; overflow: hidden; }
    .pdf-embed iframe { width: 100%; height: 62vh; border: 1px solid var(--ms-line); border-radius: 8px; background: var(--ms-surface); }
    .present-mode .pdf-embed iframe { height: 76vh; }
    .outcome { padding: 1.1em; display: flex; flex-direction: column; gap: 0.8em; }
    .outcome h3 { margin: 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8em; }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
    .actions { display: flex; gap: 0.6em; justify-content: flex-end; flex-wrap: wrap; }
    .actions button { min-height: 44px; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    button { min-height: 44px; }
  `],
})
export class PresentComponent implements OnInit {
  private readonly kits = inject(KitService);
  private readonly leads = inject(LeadPipelineService);
  private readonly auth = inject(AuthService);
  private readonly partners = inject(PartnerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly snack = inject(MatSnackBar);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly outcomes = OUTCOMES;
  protected readonly stages = STAGES;
  protected readonly minDate: Date = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly kit = signal<Kit | null>(null);
  protected readonly index = signal(0);
  protected readonly showNotes = signal(false);
  protected readonly done = signal(false);
  protected readonly saving = signal(false);
  /** PDF-deck state (file source only). */
  protected readonly pdfPages = signal(0);
  protected readonly pdfBusy = signal(false);
  protected readonly pdfError = signal<string | null>(null);
  /** In-app canvas preview availability (older devices use the native path). */
  protected readonly pdfPreview = signal(PDF_PREVIEW_SUPPORTED);
  /** 0–1 while the file streams in; null when size unknown or settled. */
  protected readonly pdfLoadProgress = signal<number | null>(null);
  /** Presentation mode — immersive, app-controlled (never the Fullscreen API). */
  protected readonly presenting = signal(false);
  protected readonly elapsedSec = signal(0);
  protected readonly sessionActive = signal(false);
  /** Auto-attached session record (duration · coverage), reset on entry. */
  protected readonly sessionSummary = signal('');
  private readonly viewerWrap = viewChild<ElementRef<HTMLElement>>('viewerWrap');
  private readonly pdfCanvas = viewChild<ElementRef<HTMLCanvasElement>>('pdfCanvas');
  private pdfDoc: { numPages: number; getPage(n: number): Promise<unknown> } | null = null;
  private renderSeq = 0;

  protected readonly prospectId = signal<string | null>(null);
  protected readonly prospectName = signal<string | null>(null);
  protected readonly ownerId = signal<string | null>(null);
  /** Rehearsal attach-a-prospect picker state. */
  protected readonly picking = signal(false);
  protected readonly pickQuery = signal('');
  protected readonly pickRows = signal<ProspectLead[]>([]);
  protected readonly pickLoading = signal(false);
  private sessionStart: number | null = null;
  private pageEnterAt: number | null = null;
  private readonly pageDwell = new Map<number, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  protected readonly outcome = signal<string>('');
  protected readonly interest = signal<'hot' | 'warm' | 'cold'>('warm');
  protected readonly note = signal('');
  protected readonly followUpDate = signal<Date | null>(null);
  protected readonly stage = signal<'' | ProspectStage>('');

  private myId: string | null = null;
  private myName = '';
  /** One-shot: `?present=1` auto-enters presentation mode once content is ready. */
  private autoPresent = false;

  constructor() {
    // Auto-start the recording session once prospect context + content are
    // both ready — presenting with a prospect always records. Runs once per
    // session (sessionStart guards re-entry; finish() clears it to close).
    effect(() => {
      const pid = this.prospectId();
      const ready = !!pid && this.hasContent() && !this.loading() && !this.done();
      if (ready && this.sessionStart == null) {
        this.startSession();
      }
    }, { allowSignalWrites: true });
  }

  protected readonly slide = () => this.kit()?.slides?.[this.index()] ?? null;
  /** Total steps — slides for manual decks, pages for PDF decks. */
  protected readonly totalSteps = () => this.isFile() ? this.pdfPages() : (this.kit()?.slides?.length ?? 0);
  protected readonly progress = () => {
    const total = this.totalSteps();
    return total ? ((this.index() + 1) / total) * 100 : 0;
  };

  /** File deck with a linked PDF (server guarantees the url for file source). */
  protected readonly isFile = () => this.kit()?.source === 'file' && !!this.kit()?.fileUrl;

  /** Deck has something to present — otherwise the viewer would sit blank. */
  protected readonly hasContent = () =>
    (this.kit()?.slides?.length ?? 0) > 0 || this.isFile();

  /** Sanitized deck URL for the embedded native viewer (old-browser path). */
  protected readonly safeFileUrl = computed((): SafeResourceUrl | null => {
    const u = this.kit()?.fileUrl;
    return u ? this.sanitizer.bypassSecurityTrustResourceUrl(u) : null;
  });

  /** Support mode: presenting someone else's prospect — touch carries attribution. */
  protected readonly isSupport = () => {
    const owner = this.ownerId();
    return !!this.prospectId() && !!owner && !!this.myId && owner !== this.myId;
  };

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    this.prospectId.set(qp.get('prospect'));
    this.prospectName.set(qp.get('prospectName'));
    this.ownerId.set(qp.get('owner'));
    this.autoPresent = qp.get('present') === '1';
    this.myId = this.auth.currentUser()?.id ?? null;
    this.partners.getSharedPartnerData$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (p) => {
          const me = p as { name?: string; surname?: string } | null;
          this.myName = `${me?.name ?? ''} ${me?.surname ?? ''}`.trim();
        },
      });

    const kitId = String(this.route.snapshot.paramMap.get('kitId') ?? '').trim();
    if (!kitId) {
      this.error.set('No deck selected.');
      this.loading.set(false);
      return;
    }
    this.destroyRef.onDestroy(() => {
      this.stopTimer();
      document.body.style.overflow = '';
    });
    this.kits
      .get(kitId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.kit.set(res.data ?? null);
          if (!res.data) {
            this.error.set('Deck not found.');
            this.loading.set(false);
            return;
          }
          const content = (res.data.slides?.length ?? 0) > 0
            || (res.data.source === 'file' && !!res.data.fileUrl);
          if (!content) {
            this.error.set('This deck has no content yet — add slides or upload its PDF in Admin → Kits.');
            this.loading.set(false);
            return;
          }
          if (res.data.source === 'file' && res.data.fileUrl) {
            if (PDF_PREVIEW_SUPPORTED) {
              void this.openPdf(res.data.fileUrl);
            } else {
              // Older runtime: skip the canvas viewer entirely (its worker
              // needs modern JS) — the native viewer + outcome sheet below
              // cover the full presenting job.
              // eslint-disable-next-line no-console
              console.debug('[present] pdf.js unsupported here, using native viewer');
              this.loading.set(false);
            }
          } else {
            this.loading.set(false);
          }
          if (this.autoPresent) {
            this.autoPresent = false;
            // Defer a tick so the stage mounts before the takeover applies.
            setTimeout(() => this.enterPresent(), 0);
          }
        },
        error: (err: unknown) => {
          this.error.set(userError(err) || 'Deck could not be loaded.');
          this.loading.set(false);
        },
      });
  }

  protected presentUrl(): string {
    return this.router.url;
  }

  /** Open a popup already in presentation mode (same session, auto-enter). */
  protected presentInNewWindow(): void {
    const base = `${window.location.origin}${window.location.pathname}`;
    const params = new URLSearchParams(window.location.search);
    params.set('present', '1');
    const url = `${base}?${params.toString()}`;
    const popup = window.open(url, '_blank', 'width=1280,height=800,menubar=no,toolbar=no,location=yes,status=no');
    if (!popup) {
      // Popup blocked: say so and fall back to same-window mode so the
      // click still presents instead of silently doing nothing.
      this.snack.open('Popup blocked — allow popups for presenting, or use this window instead.', 'Close', { duration: 5000 });
      this.enterPresent();
    }
  }

  /** Enter presentation mode: immersive takeover + session recorder on. */
  protected enterPresent(): void {
    if (this.presenting() || !this.hasContent()) return;
    this.sessionStart = Date.now();
    this.pageEnterAt = Date.now();
    this.pageDwell.clear();
    this.sessionSummary.set('');
    this.elapsedSec.set(0);
    this.presenting.set(true);
    document.body.style.overflow = 'hidden';
    this.stopTimer();
    this.timer = setInterval(() => {
      if (this.sessionStart != null) {
        this.elapsedSec.set(Math.floor((Date.now() - this.sessionStart) / 1000));
      }
    }, 1000);
  }

  /** Exit presentation mode: finalize the current page's dwell time. */
  protected exitPresent(): void {
    this.trackPageLeave();
    this.stopTimer();
    this.presenting.set(false);
    document.body.style.overflow = '';
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Start the recording session (auto-started with prospect context). */
  private startSession(): void {
    this.sessionStart = Date.now();
    this.pageEnterAt = Date.now();
    this.pageDwell.clear();
    this.sessionSummary.set('');
    this.elapsedSec.set(0);
    this.sessionActive.set(true);
    this.stopTimer();
    this.timer = setInterval(() => {
      if (this.sessionStart != null) {
        this.elapsedSec.set(Math.floor((Date.now() - this.sessionStart) / 1000));
      }
    }, 1000);
  }

  elapsedLabel(): string {
    const s = this.elapsedSec();
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  private trackPageLeave(): void {
    if (this.sessionStart == null || this.pageEnterAt == null) return;
    const spent = Date.now() - this.pageEnterAt;
    if (spent > 0) {
      this.pageDwell.set(this.index(), (this.pageDwell.get(this.index()) ?? 0) + spent);
    }
    this.pageEnterAt = Date.now();
  }

  /** "4m05s · 5/7 pages" — auto-attached to the logged touch. */
  private buildSessionSummary(): string {
    if (this.sessionStart == null) return '';
    const totalMs = Date.now() - this.sessionStart;
    const totalSec = Math.max(1, Math.round(totalMs / 1000));
    const viewed = this.pageDwell.size;
    const total = this.totalSteps();
    const mm = Math.floor(totalSec / 60);
    const ss = String(totalSec % 60).padStart(2, '0');
    const when = mm > 0 ? `${mm}m${ss}s` : `${ss}s`;
    return total > 0 ? `${when} · ${viewed}/${total} pages` : when;
  }

  /** Rehearsal path: attach a prospect so the outcome can log. */
  protected openPicker(): void {
    if (this.picking()) {
      this.picking.set(false);
      return;
    }
    this.picking.set(true);
    this.pickRows.set([]);
    const me = this.auth.currentUser()?.id;
    if (!me) return;
    this.pickLoading.set(true);
    this.leads
      .listByPartner(me, { limit: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.pickRows.set(res.data ?? []);
          this.pickLoading.set(false);
        },
        error: () => this.pickLoading.set(false),
      });
  }

  protected pickMatches(): ProspectLead[] {
    const q = this.pickQuery().trim().toLowerCase();
    const rows = this.pickRows();
    if (!q) return rows.slice(0, 6);
    return rows
      .filter((p) => `${p.prospectName ?? ''} ${p.prospectSurname ?? ''} ${p.prospectPhone ?? ''}`.toLowerCase().includes(q))
      .slice(0, 6);
  }

  protected pickProspect(p: ProspectLead): void {
    const id = String(p.id ?? (p as unknown as { _id?: unknown })._id ?? '').trim();
    if (!id) return;
    this.prospectId.set(id);
    this.prospectName.set(`${p.prospectName ?? ''} ${p.prospectSurname ?? ''}`.trim() || null);
    this.ownerId.set(p.partnerId ? String(p.partnerId) : null);
    this.picking.set(false);
    this.pickQuery.set('');
  }

  private async openPdf(url: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.debug('[present] opening PDF', { url });
    // Stall watchdog: the 30s budget resets on every byte received, so big
    // files on slow links show progress instead of timing out. An absolute
    // 120s cap guarantees this method always settles — no eternal spinner.
    let stalled = false;
    const startedAt = Date.now();
    const ABSOLUTE_CAP = 120000;
    try {
      const task = pdfjsLib.getDocument({ url });
      let lastByteAt = Date.now();
      task.onProgress = (p: { loaded: number; total: number }) => {
        lastByteAt = Date.now();
        this.pdfLoadProgress.set(p.total > 0 ? Math.min(p.loaded / p.total, 1) : null);
        // eslint-disable-next-line no-console
        console.debug('[present] pdf bytes', { loaded: p.loaded, total: p.total });
      };
      const watchdog = setInterval(() => {
        if (Date.now() - lastByteAt > 30000 || Date.now() - startedAt > ABSOLUTE_CAP) {
          stalled = Date.now() - lastByteAt > 30000;
          void task.destroy();
        }
      }, 5000);
      try {
        const doc = await task.promise as unknown as {
          numPages: number; getPage(n: number): Promise<unknown>;
        };
        clearInterval(watchdog);
        // eslint-disable-next-line no-console
        console.debug('[present] pdf opened', { pages: doc.numPages });
        this.pdfLoadProgress.set(null);
        this.pdfDoc = doc;
        this.pdfPages.set(doc.numPages);
        await this.renderPdfPage(1);
      } finally {
        clearInterval(watchdog);
      }
    } catch (error) {
      this.pdfLoadProgress.set(null);
      this.pdfError.set(stalled
        ? 'The PDF stalled — zero bytes arrived for 30 seconds. Check your connection, or re-upload a smaller export.'
        : Date.now() - startedAt >= ABSOLUTE_CAP
          ? 'The PDF did not finish loading within 2 minutes — re-upload a smaller export.'
          : this.describePdfFailure(error, url));
    } finally {
      this.loading.set(false);
    }
  }

  /** Classify the failure so the message (and console) names the real cause. */
  private describePdfFailure(error: unknown, url: string): string {
    const name = (error as { name?: unknown })?.name;
    const message = error instanceof Error ? error.message : String(error ?? '');
    // eslint-disable-next-line no-console
    console.error('[present] PDF load failed', { url, name, message });
    if (/timed out/i.test(message)) {
      return 'The PDF is taking too long to load — check your connection or try again.';
    }
    if (name === 'MissingPDFException' || /missing pdf|unexpected response|failed to fetch|networkerror|load failed/i.test(`${name} ${message}`)) {
      return 'The PDF file could not be reached — it may have been deleted or its sharing settings block loading. Re-upload it in Admin → Kits.';
    }
    if (name === 'InvalidPDFException' || name === 'PasswordException') {
      return name === 'PasswordException'
        ? 'This PDF is password-protected — upload an unprotected export instead.'
        : 'This file is not a valid PDF — re-export it from PowerPoint and re-upload.';
    }
    return 'This PDF could not be loaded — check the link or try again.';
  }

  private async renderPdfPage(n: number): Promise<void> {
    const seq = ++this.renderSeq;
    const doc = this.pdfDoc;
    if (!doc) return;
    // The canvas mounts on change detection — wait for it instead of bailing
    // silently (which used to leave a blank viewer with zero errors).
    let canvas: HTMLCanvasElement | null = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      canvas = this.pdfCanvas()?.nativeElement ?? null;
      if (canvas) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!canvas) {
      if (seq === this.renderSeq) this.pdfError.set('The viewer could not start — reload the page.');
      return;
    }
    // eslint-disable-next-line no-console
    console.debug('[present] rendering page', { n });
    this.pdfBusy.set(true);
    try {
      const page = await doc.getPage(n) as {
        getViewport(o: { scale: number }): { width: number; height: number };
        render(o: unknown): { promise: Promise<void> };
      };
      if (seq !== this.renderSeq) return;
      const wrapWidth = canvas.parentElement?.clientWidth ?? 800;
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(wrapWidth, 900) / Math.max(base.width, 1);
      const viewport = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${Math.min(wrapWidth, 900)}px`;
      canvas.style.height = 'auto';
      await Promise.race([
        page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Page render timed out')), 60000)),
      ]);
      if (seq !== this.renderSeq) return;
      // eslint-disable-next-line no-console
      console.debug('[present] page rendered', { n });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[present] page render failed', { n, error });
      if (seq === this.renderSeq) this.pdfError.set('This page could not be rendered.');
    } finally {
      if (seq === this.renderSeq) this.pdfBusy.set(false);
    }
  }

  protected prev(): void {
    this.trackPageLeave();
    this.index.update((i) => Math.max(0, i - 1));
    if (this.isFile()) void this.renderPdfPage(this.index() + 1);
  }

  protected next(): void {
    const total = this.totalSteps();
    this.trackPageLeave();
    this.index.update((i) => Math.min(Math.max(total - 1, 0), i + 1));
    if (this.isFile()) void this.renderPdfPage(this.index() + 1);
  }

  protected goTo(i: number): void {
    const total = this.totalSteps();
    this.trackPageLeave();
    this.index.set(Math.min(Math.max(total - 1, 0), Math.max(0, i)));
    if (this.isFile()) void this.renderPdfPage(this.index() + 1);
  }

  protected goToTitle(title: string): void {
    const i = (this.kit()?.slides ?? []).findIndex((s) => s.title === title);
    if (i >= 0) this.goTo(i);
  }

  protected pageNumbers(): number[] {
    const total = this.pdfPages();
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  protected finish(): void {
    // Presenting ends here — finalize the record, then log it.
    this.exitPresent();
    this.sessionSummary.set(this.buildSessionSummary());
    this.sessionStart = null;
    this.sessionActive.set(false);
    this.stopTimer();
    this.done.set(true);
  }

  protected atEnd(): boolean {
    return this.index() + 1 >= this.totalSteps();
  }

  protected copyLink(): void {
    const url = `${window.location.origin}${this.router.url}`;
    navigator.clipboard.writeText(url).then(() => {
      this.snack.open('Presentation link copied.', 'Close', { duration: 2500 });
    }).catch(() => {
      this.snack.open('Could not copy — long-press the address bar instead.', 'Close', { duration: 4000 });
    });
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable || t.tagName === 'SELECT');
    if (e.key === 'Escape') {
      if (this.done()) this.done.set(false);
      else if (this.presenting()) this.exitPresent();
      return;
    }
    if (typing || this.done() || !this.hasContent() || this.loading()) return;
    if (e.key === 'ArrowRight') {
      if (this.atEnd()) this.finish();
      else this.next();
    } else if (e.key === 'ArrowLeft') {
      this.prev();
    }
  }

  protected save(): void {
    const prospectId = this.prospectId();
    const kit = this.kit();
    const outcome = this.outcome().trim();
    if (!prospectId || !kit || !outcome || this.saving()) return;
    const note = this.note().trim();
    const support = this.isSupport();
    const session = this.sessionSummary().trim();
    const extent = this.isFile()
      ? `${this.pdfPages() || '?'} pages`
      : `${kit.slides.length} slide${kit.slides.length === 1 ? '' : 's'}`;
    this.saving.set(true);
    this.leads
      .logCommunication(prospectId, {
        type: 'presentation',
        interestLevel: this.interest(),
        description: `Presented "${kit.title}" (${extent})${session ? ` — ${session}` : ''}${note ? ` — ${note}` : ''}`,
        outcome: outcome as 'Connected' | 'No answer' | 'Booked session' | 'Follow-up set' | 'Closed-lost',
        ...(this.followUpDate() ? { followUpDate: this.followUpDate()!.toISOString() } : {}),
        documentsShared: [`kit:${kit.id}`],
        ...(support && this.myId ? { createdBy: this.myId, ...(this.myName ? { createdByName: this.myName } : {}) } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const stage = this.stage();
          if (!stage) return this.finishSave(`Presentation logged${this.followUpDate() ? ' — follow-up set' : ''}.`);
          const author = support && this.myId ? { by: this.myId, ...(this.myName ? { byName: this.myName } : {}) } : undefined;
          this.leads.advanceStage(prospectId, stage, author)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => this.finishSave(`Presentation logged and moved to ${stage}.`),
              error: (err: unknown) => {
                this.saving.set(false);
                this.snack.open(`Touch logged, but the stage move failed — ${userError(err) || 'try again'}.`, 'Close', { duration: 5000 });
              },
            });
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.snack.open(userError(err) || 'Could not log the presentation.', 'Close', { duration: 4000 });
        },
      });
  }

  private finishSave(message: string): void {
    this.saving.set(false);
    this.snack.open(message, 'Close', { duration: 4000 });
    this.back();
  }

  protected back(): void {
    if (window.history.length > 1) window.history.back();
    else this.router.navigateByUrl('dashboard/prospects/pipeline').catch(() => undefined);
  }
}
