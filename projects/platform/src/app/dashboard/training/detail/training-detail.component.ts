import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { TrainingService } from '../../../core/training/training.service';
import { CourseDetail } from '../../../core/training/training.models';
import { ApiError, userError } from '../../../core/http/api-error';

/**
 * @title Course detail — read lessons, complete them, earn the certificate.
 *
 * Completing the final lesson mints the certificate and records the linked
 * IPO/QSG/SMO training automatically in the same request. OnPush + signals.
 */
@Component({
  selector: 'async-training-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, FormsModule, MatButtonModule, MatIconModule, MatProgressBarModule, MatRadioModule, PageSkeletonComponent, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/training/courses">Training Center</a> &gt;
        <span>{{ course()?.title ?? 'Course' }}</span>
      </div>
    </section>

    <section class="course-page">
      @if (loading()) {
        <async-page-skeleton layout="product" label="course" [showHeader]="false" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (notice(); as note) {
        <p class="notice" role="status">{{ note }}</p>
      }

      @if (course(); as c) {
        <div class="course-head">
          <div>
            <h2>{{ c.title }}</h2>
            <p class="subtitle">{{ c.tagline }}</p>
          </div>
          @if (c.certified) {
            <p class="certified"><mat-icon>verified</mat-icon> Certified</p>
          } @else {
            <p class="muted">{{ c.done }}/{{ c.total }} lessons</p>
          }
        </div>
        <mat-progress-bar mode="determinate" [value]="c.percent" aria-label="Progress" />

        <ol class="lessons">
          @for (lesson of c.lessons; track lesson.id) {
            <li class="dp-card lesson" [class.lesson--done]="isDone(lesson.id)">
              <div class="lesson-top">
                <strong>{{ lesson.title }}</strong>
                @if (isDone(lesson.id)) {
                  <mat-icon class="done-icon">check_circle</mat-icon>
                } @else {
                  <button mat-button (click)="openQuiz(lesson.id)" [disabled]="completing() !== null">
                    {{ openLessonId() === lesson.id ? 'Hide quiz' : 'Take quiz' }}
                  </button>
                }
              </div>
              @if (!isDone(lesson.id) && lesson.videoUrl) {
                <div class="video-wrap">
                  <video
                    [src]="lesson.videoUrl"
                    [poster]="lesson.posterUrl ?? undefined"
                    controls
                    controlslist="nodownload"
                    disablepictureinpicture
                    playsinline
                    preload="metadata"
                    (loadedmetadata)="onLoadedMetadata(lesson.id, $event)"
                    (timeupdate)="onVideoProgress(lesson.id, $event)"
                    (seeking)="onSeeking(lesson.id, $event)"
                    (ratechange)="onRateChange(lesson.id, $event)"
                    (ended)="onVideoEnded(lesson.id)"
                    (error)="onVideoError(lesson.id)"
                  >
                    @if (lesson.captionsUrl) {
                      <track kind="captions" srclang="en" label="English" [src]="lesson.captionsUrl ?? ''" default />
                    }
                    Sorry, your browser can't play this video.
                  </video>
                  @if (videoError()[lesson.id]) {
                    <p class="error" role="alert">
                      Video failed to load. Check your connection and reload.
                      <button mat-button (click)="reload()">Retry</button>
                    </p>
                  }
                  <div class="video-progress">
                    <mat-progress-bar mode="determinate" [value]="watchPercent(lesson.id)" aria-label="Progress" />
                    <span class="muted">{{ watchPercent(lesson.id) | number:'1.0-0' }}% watched</span>
                    @if (!watchedEnough(lesson.id)) {
                      <span class="muted"> · watch to 90% to unlock completion (rewind anytime — forward skip is locked)</span>
                    }
                    @if (seekNote()[lesson.id]) {
                      <span class="muted"> · forward skip locked — keep watching</span>
                    }
                  </div>
                  <p class="muted audio-hint">No sound? Turn up your device volume and check the player's volume icon — if the track uses an unsupported codec your browser may play video silently. Transcript below covers the key points.</p>
                  @if (lesson.transcript) {
                    <details class="transcript">
                      <summary>Read transcript</summary>
                      <p>{{ lesson.transcript }}</p>
                    </details>
                  }
                </div>
              } @else if (lesson.videoUrl) {
                <div class="video-wrap">
                  <video [src]="lesson.videoUrl" [poster]="lesson.posterUrl ?? undefined" controls playsinline preload="metadata"></video>
                  @if (lesson.transcript) {
                    <details class="transcript">
                      <summary>Read transcript</summary>
                      <p>{{ lesson.transcript }}</p>
                    </details>
                  }
                </div>
              }
              <div class="lesson-body">
                @for (para of paras(lesson.body); track $index) {
                  <p>{{ para }}</p>
                }
              </div>
              @if (lesson.takeaways.length > 0) {
                <ul class="takeaways">
                  @for (point of lesson.takeaways; track point) {
                    <li>{{ point }}</li>
                  }
                </ul>
              }
              @if (isDone(lesson.id) && lesson.quiz?.length) {
                <button mat-button (click)="toggleReview(lesson.id)">
                  {{ reviewId() === lesson.id ? 'Hide results' : 'Review answers' }}
                </button>
                @if (reviewId() === lesson.id) {
                  <div class="review">
                    <p class="muted">{{ scoreLine(lesson) }}</p>
                    @for (q of lesson.quiz; track q.q) {
                      <div class="review-q">
                        <strong>{{ q.q }}</strong>
                        <ul>
                          @for (opt of q.options; track opt; let oi = $index) {
                            <li [class.opt-correct]="oi === q.answer" [class.opt-picked]="oi === pickedFor(lesson.id, q.q)">
                              <mat-icon>{{ oi === q.answer ? 'check_circle' : oi === pickedFor(lesson.id, q.q) ? 'cancel' : 'radio_button_unchecked' }}</mat-icon>
                              <span>{{ opt }}</span>
                              @if (oi === q.answer) {
                                <em class="tag">Correct answer</em>
                              } @else if (oi === pickedFor(lesson.id, q.q)) {
                                <em class="tag">Your answer</em>
                              }
                            </li>
                          }
                        </ul>
                      </div>
                    }
                  </div>
                }
              }
              @if (!isDone(lesson.id) && (watchedEnough(lesson.id) || !lesson.videoUrl)) {
                @if (openLessonId() === lesson.id && lesson.quiz?.length) {
                  <div class="quiz">
                    @for (q of lesson.quiz; track q.q; let qi = $index) {
                      <div class="quiz-q">
                        <strong>{{ q.q }}</strong>
                        <mat-radio-group [attr.aria-label]="q.q" [value]="answerFor(lesson.id, q.q)" (change)="pickAnswer(lesson.id, q.q, $event.value)">
                          @for (opt of q.options; track opt) {
                            <mat-radio-button [value]="q.options.indexOf(opt)">{{ opt }}</mat-radio-button>
                          }
                        </mat-radio-group>
                      </div>
                    }
                    @if (quizError(); as err) {
                      <p class="error" role="alert">{{ err }}</p>
                    }
                    <button mat-flat-button color="primary" (click)="complete(lesson.id)" [disabled]="completing() !== null || !canSubmit(lesson)">
                      {{ completing() === lesson.id ? 'Saving…' : 'Submit & mark complete' }}
                    </button>
                  </div>
                }
                @if (openLessonId() === lesson.id && !lesson.quiz?.length) {
                  <button mat-button (click)="complete(lesson.id)" [disabled]="completing() !== null">
                    {{ completing() === lesson.id ? 'Saving…' : 'Mark complete' }}
                  </button>
                }
                @if (openLessonId() !== lesson.id && !lesson.quiz?.length) {
                  <button mat-button (click)="complete(lesson.id)" [disabled]="completing() !== null">
                    {{ completing() === lesson.id ? 'Saving…' : 'Mark complete' }}
                  </button>
                }
              }
            </li>
          }
        </ol>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .course-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .course-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1em; flex-wrap: wrap; }
    .course-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); }
    .certified { display: flex; align-items: center; gap: 0.3em; color: var(--ms-success); font-weight: 600; margin: 0; }
    .lessons { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75em; counter-reset: lesson; }
    .lesson { padding: 1em; }
    .lesson p { margin: 0.5em 0; line-height: 1.6; }
    .lesson-body { display: flex; flex-direction: column; gap: 0.75em; margin: 0.75em 0; }
    .lesson-body p { margin: 0; line-height: 1.7; }
    .lesson-top { display: flex; justify-content: space-between; align-items: center; gap: 0.75em; flex-wrap: wrap; }
    .lesson-top button, .quiz button { min-height: 44px; }
    .done-icon { color: var(--ms-success); }
    .video-wrap { margin: 0.75em 0; display: flex; flex-direction: column; gap: 0.5em; }
    .video-wrap video { width: 100%; max-height: 420px; border-radius: 8px; background: #000; }
    .video-progress { display: flex; align-items: center; gap: 0.5em; }
    .video-progress mat-progress-bar { flex: 1; }
    .audio-hint { margin: 0; }
    .transcript { border: 1px solid var(--ms-line); border-radius: 8px; padding: 0.6em 0.8em; background: var(--ms-canvas); }
    .transcript summary { cursor: pointer; font-weight: 600; min-height: 44px; display: flex; align-items: center; }
    .transcript p { margin: 0.5em 0 0; line-height: 1.6; }
    .quiz { margin-top: 0.75em; display: flex; flex-direction: column; gap: 0.75em; background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: 8px; padding: 0.9em; }
    .quiz-q { display: flex; flex-direction: column; gap: 0.35em; }
    .quiz-q mat-radio-group { display: flex; flex-direction: column; gap: 0.15em; }
    .review { margin-top: 0.75em; display: flex; flex-direction: column; gap: 0.75em; background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: 8px; padding: 0.9em; }
    .review-q ul { list-style: none; margin: 0.35em 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.2em; }
    .review-q li { display: flex; align-items: center; gap: 0.5em; padding: 0.3em 0.5em; border-radius: 6px; }
    .review-q li mat-icon { font-size: 18px; height: 18px; width: 18px; color: var(--ms-text-muted); }
    .review-q li.opt-correct { background: var(--ms-success-soft); }
    .review-q li.opt-correct mat-icon { color: var(--ms-success); }
    .review-q li.opt-picked:not(.opt-correct) mat-icon { color: var(--ms-error); }
    .review-q .tag { font-style: normal; font-size: 0.75em; font-weight: 700; color: var(--ms-text-muted); margin-left: auto; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .notice { color: var(--ms-success); }
  `],
})
export class TrainingDetailComponent implements OnInit {
  private readonly training = inject(TrainingService);
  private readonly routes = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly completing = signal<string | null>(null);
  protected readonly openLessonId = signal<string | null>(null);
  protected readonly quizError = signal<string | null>(null);
  private readonly answers = new Map<string, Map<string, number>>();
  private readonly lastWatchSent = new Map<string, number>();
  private readonly lastWatchAt = new Map<string, number>();
  private pendingReview: string | null = null;
  protected readonly reviewId = signal<string | null>(null);
  protected readonly videoProgress = signal<Record<string, number>>({});
  protected readonly videoError = signal<Record<string, boolean>>({});
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly course = signal<CourseDetail | null>(null);

  ngOnInit(): void {
    this.routes.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params.get('courseId');
        if (id) this.load(id);
      });
  }

  protected courseId(): string {
    return this.routes.snapshot.paramMap.get('courseId') ?? '';
  }

  /** Split lesson body into readable paragraphs (blank-line separated). */
  protected paras(text: unknown): string[] {
    return String(text ?? '')
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  protected watchPercent(lessonId: string): number {
    return this.videoProgress()[lessonId] ?? this.loadWatchPercent(lessonId);
  }

  protected watchedEnough(lessonId: string): boolean {
    return this.watchPercent(lessonId) >= 90;
  }

  /**
   * Anti-cheat: rewind is free, forward skip is locked. `maxTime` is the
   * furthest genuinely-watched second (normal 1× playback deltas only);
   * all progress + heartbeats derive from it, never from currentTime.
   */
  private readonly maxTime = new Map<string, number>();
  private readonly lastTime = new Map<string, number>();
  protected readonly seekNote = signal<Record<string, boolean>>({});

  protected onLoadedMetadata(lessonId: string, event: Event): void {
    const el = event.target as HTMLVideoElement;
    const dur = Number(el?.duration) || 0;
    const storedSecs = this.loadWatchSecs(lessonId);
    const fromPct = (this.loadWatchPercent(lessonId) / 100) * dur;
    const prev = this.maxTime.get(lessonId) ?? storedSecs ?? fromPct;
    this.maxTime.set(lessonId, dur > 0 ? Math.min(prev, dur) : prev);
    this.lastTime.set(lessonId, Number(el?.currentTime) || 0);
    if (el && el.playbackRate !== 1) el.playbackRate = 1;
  }

  protected onSeeking(lessonId: string, event: Event): void {
    const el = event.target as HTMLVideoElement;
    if (!el) return;
    const max = this.maxTime.get(lessonId) ?? 0;
    if (el.currentTime > max + 2) {
      el.currentTime = max;
      this.lastTime.set(lessonId, max);
      this.seekNote.update((m) => ({ ...m, [lessonId]: true }));
      setTimeout(() => this.seekNote.update((m) => ({ ...m, [lessonId]: false })), 3000);
    }
  }

  protected onRateChange(lessonId: string, event: Event): void {
    const el = event.target as HTMLVideoElement;
    // Speedup cheat: force 1× (rewind + replay stays allowed).
    if (el && el.playbackRate !== 1) el.playbackRate = 1;
    this.lastTime.set(lessonId, Number(el?.currentTime) || 0);
  }

  protected onVideoProgress(lessonId: string, event: Event): void {
    const el = event.target as HTMLVideoElement;
    if (!el?.duration) return;
    if (el.playbackRate !== 1) el.playbackRate = 1;
    const last = this.lastTime.get(lessonId) ?? el.currentTime;
    const delta = el.currentTime - last;
    this.lastTime.set(lessonId, el.currentTime);
    // Genuine playback only: small forward deltas at 1× while playing.
    // Seeks, rate tricks and background jumps produce large/negative deltas.
    if (delta > 0 && delta <= 1.5 && !el.paused && !el.seeking) {
      const max = Math.max(this.maxTime.get(lessonId) ?? 0, el.currentTime);
      this.maxTime.set(lessonId, Math.min(max, el.duration));
    }
    const pct = Math.min(100, Math.round(((this.maxTime.get(lessonId) ?? 0) / el.duration) * 100));
    const prev = this.watchPercent(lessonId);
    if (pct > prev) {
      this.saveWatchPercent(lessonId, pct);
      this.saveWatchSecs(lessonId, Math.floor(this.maxTime.get(lessonId) ?? 0));
      this.videoProgress.update((m) => ({ ...m, [lessonId]: pct }));
    }
    // Throttled server heartbeat: every new 10% step or 10s, whichever first.
    // Sends furthest-watched percent + seconds (never raw currentTime).
    const now = Date.now();
    const sent = this.lastWatchSent.get(lessonId) ?? -10;
    const at = this.lastWatchAt.get(lessonId) ?? 0;
    if (pct >= sent + 10 || now - at > 10000) {
      this.lastWatchSent.set(lessonId, pct);
      this.lastWatchAt.set(lessonId, now);
      this.training.watch(this.courseId(), lessonId, pct, Math.floor(this.maxTime.get(lessonId) ?? 0)).subscribe({
        next: (res) => {
          const serverPct = res.data?.percent ?? pct;
          if (serverPct > this.watchPercent(lessonId)) {
            this.saveWatchPercent(lessonId, serverPct);
            this.videoProgress.update((m) => ({ ...m, [lessonId]: serverPct }));
          }
        },
        error: () => {},
      });
    }
  }

  protected onVideoError(lessonId: string): void {
    this.videoError.update((m) => ({ ...m, [lessonId]: true }));
  }

  protected onVideoEnded(lessonId: string): void {
    // With forward-skip locked, reaching the end is genuine — record full.
    this.saveWatchPercent(lessonId, 100);
    this.videoProgress.update((m) => ({ ...m, [lessonId]: 100 }));
    this.training.watch(this.courseId(), lessonId, 100, Math.floor(this.maxTime.get(lessonId) ?? 0)).subscribe({ error: () => {} });
    const c = this.course();
    const lesson = c?.lessons.find((l) => l.id === lessonId) as { quiz?: Array<unknown> } | undefined;
    if (!lesson?.quiz?.length && !this.isDone(lessonId)) {
      this.complete(lessonId);
    }
  }

  private watchKey(lessonId: string): string {
    return `dp-training-watched:${this.courseId()}:${lessonId}`;
  }

  private loadWatchPercent(lessonId: string): number {
    try {
      const v = Number(localStorage.getItem(this.watchKey(lessonId)));
      return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;
    } catch { return 0; }
  }

  private saveWatchPercent(lessonId: string, pct: number): void {
    try { localStorage.setItem(this.watchKey(lessonId), String(Math.round(pct))); } catch {}
  }

  private watchSecsKey(lessonId: string): string {
    return `dp-training-watched-secs:${this.courseId()}:${lessonId}`;
  }

  private loadWatchSecs(lessonId: string): number | null {
    try {
      const v = Number(localStorage.getItem(this.watchSecsKey(lessonId)));
      return Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
    } catch { return null; }
  }

  private saveWatchSecs(lessonId: string, secs: number): void {
    try { localStorage.setItem(this.watchSecsKey(lessonId), String(Math.floor(secs))); } catch {}
  }

  protected isDone(lessonId: string): boolean {
    return this.course()?.completedIds?.includes(lessonId) ?? false;
  }

  protected openQuiz(lessonId: string): void {
    this.openLessonId.set(this.openLessonId() === lessonId ? null : lessonId);
    this.quizError.set(null);
  }

  protected toggleReview(lessonId: string): void {
    this.reviewId.set(this.reviewId() === lessonId ? null : lessonId);
  }

  protected pickedFor(lessonId: string, question: string): number | null {
    const live = this.answerFor(lessonId, question);
    if (live !== null) return live;
    return this.loadPick(lessonId, question);
  }

  protected scoreLine(lesson: { id: string; quiz?: Array<{ q: string; answer?: number }> }): string {
    const quiz = lesson.quiz ?? [];
    if (quiz.length === 0) return '';
    let known = 0;
    let right = 0;
    for (const q of quiz) {
      const picked = this.pickedFor(lesson.id, q.q);
      if (picked === null || q.answer === undefined) continue;
      known += 1;
      if (picked === q.answer) right += 1;
    }
    if (known === 0) return 'Correct answers shown — your picks were not saved on this device.';
    return `You got ${right} of ${quiz.length} right.`;
  }

  private answerKey(lessonId: string): string {
    return `dp-training-answers:${this.courseId()}:${lessonId}`;
  }

  private loadPick(lessonId: string, question: string): number | null {
    try {
      const raw = localStorage.getItem(this.answerKey(lessonId));
      if (!raw) return null;
      const v = (JSON.parse(raw) as Record<string, unknown>)[question];
      return typeof v === 'number' && Number.isInteger(v) ? v : null;
    } catch { return null; }
  }

  private savePick(lessonId: string, question: string, value: number): void {
    try {
      const raw = localStorage.getItem(this.answerKey(lessonId));
      const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      map[question] = value;
      localStorage.setItem(this.answerKey(lessonId), JSON.stringify(map));
    } catch { /* private mode: in-memory picks still work for this visit */ }
  }

  protected pickAnswer(lessonId: string, question: string, value: number): void {
    if (!this.answers.has(lessonId)) this.answers.set(lessonId, new Map());
    this.answers.get(lessonId)?.set(question, Number(value));
    this.savePick(lessonId, question, Number(value));
    this.quizError.set(null);
  }

  protected answerFor(lessonId: string, question: string): number | null {
    return this.answers.get(lessonId)?.get(question) ?? null;
  }

  protected canSubmit(lesson: { quiz?: Array<{ q: string }>; videoUrl?: string | null }): boolean {
    const quiz = (lesson as { quiz?: Array<{ q: string }> }).quiz ?? [];
    if (lesson.videoUrl && !this.watchedEnough((lesson as { id?: string }).id ?? '')) return false;
    if (quiz.length === 0) return true;
    const lessonId = (lesson as unknown as { id?: string })?.id ?? '';
    const map = this.answers.get(lessonId);
    return quiz.every((q) => map?.has(q.q) ?? false);
  }

  protected load(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.training
      .course(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const data = res.data ?? null;
          this.course.set(data);
          // Merge server watch attestation with device cache — take the max
          // so progress survives across devices and can't be rewound.
          const restored: Record<string, number> = {};
          const serverWatch = (data as { watch?: Record<string, { percent?: number }> } | null)?.watch ?? {};
          for (const lesson of data?.lessons ?? []) {
            const id = (lesson as { id?: string }).id;
            if (id) {
              const pct = Math.max(this.loadWatchPercent(id), Math.round(Number(serverWatch[id]?.percent) || 0));
              if (pct > 0) {
                restored[id] = pct;
                this.saveWatchPercent(id, pct);
              }
            }
          }
          this.videoProgress.set(restored);
          // Restore saved quiz picks (review + retry continuity on this device).
          for (const lesson of data?.lessons ?? []) {
            const lid = (lesson as { id?: string }).id;
            const quiz = (lesson as { quiz?: Array<{ q: string }> }).quiz ?? [];
            if (!lid || quiz.length === 0 || this.answers.has(lid)) continue;
            const map = new Map<string, number>();
            for (const q of quiz) {
              const v = this.loadPick(lid, q.q);
              if (v !== null) map.set(q.q, v);
            }
            if (map.size > 0) this.answers.set(lid, map);
          }
          // Freshly completed lesson opens its results automatically.
          if (this.pendingReview && this.isDone(this.pendingReview)) {
            this.reviewId.set(this.pendingReview);
          }
          this.pendingReview = null;
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected reload(): void {
    const id = this.courseId();
    if (id) this.load(id);
  }

  protected complete(lessonId: string): void {
    const id = this.courseId();
    if (!id) return;
    const course = this.course();
    const target = course?.lessons.find((l) => l.id === lessonId) as unknown as { quiz?: Array<{ q: string; options: string[]; answer: number }>; videoUrl?: string | null } | undefined;
    const quizList = (target as { quiz?: Array<{ q: string; options: string[]; answer: number }> } | undefined)?.quiz ?? [] as Array<{ q: string; options: string[]; answer: number }>;
    // Client-side pre-check — server re-validates (never trust the client alone).
    if (target?.videoUrl && !this.watchedEnough(lessonId)) {
      this.quizError.set('Watch the video before submitting.');
      return;
    }
    if (quizList.length > 0) {
      const map = this.answers.get(lessonId);
      if (!quizList.every((q) => map?.has(q.q) ?? false)) {
        this.quizError.set('Answer every question before submitting.');
        return;
      }
    }
    this.completing.set(lessonId);
    this.notice.set(null);
    this.error.set(null);
    this.quizError.set(null);
    const answers = quizList.length > 0
      ? quizList.map((q) => Number(this.answers.get(lessonId)?.get(q.q) ?? -1))
      : undefined;
    this.training
      .completeLesson(id, lessonId, answers)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.completing.set(null);
          this.pendingReview = lessonId;
          if (res.data?.certified) {
            this.notice.set(
              res.data.milestoneChecked
                ? `Certified — your ${res.data.milestoneChecked.toUpperCase()} training is recorded and your progress updated automatically.`
                : 'Certified — well done.',
            );
          }
          this.reload();
        },
        error: (err: ApiError) => {
          this.completing.set(null);
          // Submission failures belong inline at the quiz (wrong answers,
          // watch race) — page-level only for lessons without a quiz form.
          if (quizList.length > 0) this.quizError.set(err.message);
          else this.error.set(err.message);
        },
      });
  }
}
