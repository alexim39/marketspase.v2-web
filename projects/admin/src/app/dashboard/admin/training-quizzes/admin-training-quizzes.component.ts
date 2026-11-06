import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { AdminTrainingService, AdminQuizCatalog, AdminQuizRow, AdminTrainingMediaService } from './admin-training.service';
import { ApiError } from '../../../core/http/api-error';

interface EditQuestion {
  q: string;
  options: string[];
  answer: number;
}

/**
 * @title Training quizzes — admin editor.
 *
 * Each lesson's quiz (1–4 questions, 2–6 options) lives in Mongo as an
 * override over the code catalog — learners never see the code fallback
 * after the first admin save. OnPush + signals.
 */
@Component({
  selector: 'async-admin-training-quizzes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule, MatDividerModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule, MatSelectModule, MatTableModule, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Admin</a> &gt;
        <span>Training quizzes</span>
      </div>
    </section>

    <section class="queue-page">
      <div class="page-head">
        <div>
          <h2>Training quizzes</h2>
          <p class="subtitle">One quiz per lesson — set questions, options and the correct answer. Learners answer these to mark a lesson complete.</p>
        </div>
      </div>

      @if (notice(); as note) {
        <p class="notice" role="status"><mat-icon>check_circle</mat-icon> {{ note }}</p>
      }

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      <div class="toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Course</mat-label>
          <mat-select [value]="courseId()" (selectionChange)="courseId.set($event.value); lessonId.set(''); editQuiz.set([])">
            @for (c of catalog(); track c.id) {
              <mat-option [value]="c.id">{{ c.title }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Lesson</mat-label>
          <mat-select [value]="lessonId()" (selectionChange)="lessonId.set($event.value); loadLesson()">
            @for (l of lessons(); track l.id) {
              <mat-option [value]="l.id">{{ l.title }}{{ l.videoUrl ? ' · video' : '' }}{{ l.mediaOverridden ? ' · override' : '' }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      @if (courseId() && lessonId()) {
        <div class="dp-card edit-card">
          <h3>Quiz for {{ lessonTitle() }}</h3>
          @if (loadingQuiz()) {
            <mat-progress-bar mode="indeterminate" aria-label="Loading" />
          }
          @for (q of editQuiz(); track q.q; let qi = $index) {
            <div class="question">
              <mat-form-field appearance="outline">
                <mat-label>Question</mat-label>
                <input matInput [value]="q.q" (input)="setQuestion(qi, $any($event.target).value)" maxlength="500" />
              </mat-form-field>
              @for (opt of q.options; track opt; let oi = $index) {
                <mat-form-field appearance="outline">
                  <mat-label>Option {{ oi + 1 }}</mat-label>
                  <input matInput [value]="opt" (input)="setOption(qi, oi, $any($event.target).value)" maxlength="200" />
                </mat-form-field>
              }
              <div class="quiz-actions">
                <button mat-button (click)="addOption(qi)" [disabled]="q.options.length >= 6">Add option</button>
                <button mat-button color="warn" (click)="removeOption(qi, q.options.length - 1)" [disabled]="q.options.length <= 2">Remove option</button>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Correct option (1-based)</mat-label>
                  <input matInput type="number" [value]="q.answer + 1" (input)="setAnswer(qi, $any($event.target).valueAsNumber - 1)" [min]="1" [max]="q.options.length" />
                </mat-form-field>
                <button mat-icon-button color="warn" (click)="removeQuestion(qi)" [disabled]="editQuiz().length <= 1" title="Remove question"><mat-icon>delete</mat-icon></button>
              </div>
            </div>
            <mat-divider></mat-divider>
          }
            <div class="edit-actions">
              <button mat-button (click)="addQuestion()" [disabled]="editQuiz().length >= 15">Add question</button>
              <span class="muted">Up to 15 questions</span>
            <span class="spacer"></span>
            <button mat-flat-button color="primary" (click)="save()" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save quiz' }}</button>
          </div>
          @if (saveError(); as err) {
            <p class="error" role="alert">{{ err }}</p>
          }
        </div>
      }

      <p class="muted">Overrides layer over the code catalog — existing lessons keep working before the first save; certificates only gate future completions.</p>

      @if (courseId() && lessonId()) {
        <div class="dp-card edit-card">
          <h3>Media for {{ lessonTitle() }}</h3>
          <p class="muted">https URL (e.g. Cloudinary) or site path (e.g. /courses/ipo/lesson.mp4). Empty fields fall back to the code catalog.@if (mediaOverridden()) { Currently overridden. }</p>
          <mat-form-field appearance="outline">
            <mat-label>Video URL</mat-label>
            <input matInput [value]="editMedia().videoUrl" (input)="setMedia('videoUrl', $any($event.target).value)" maxlength="500" placeholder="/courses/ipo/lesson.mp4" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Poster image URL (optional)</mat-label>
            <input matInput [value]="editMedia().posterUrl" (input)="setMedia('posterUrl', $any($event.target).value)" maxlength="500" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Captions URL (.vtt, optional)</mat-label>
            <input matInput [value]="editMedia().captionsUrl" (input)="setMedia('captionsUrl', $any($event.target).value)" maxlength="500" placeholder="/courses/ipo/lesson.vtt" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Duration (seconds, optional)</mat-label>
            <input matInput type="number" [value]="editMedia().durationSec ?? ''" (input)="setMediaDuration($any($event.target).valueAsNumber)" min="0" max="86400" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Transcript (optional)</mat-label>
            <textarea matInput rows="4" [value]="editMedia().transcript" (input)="setMedia('transcript', $any($event.target).value)" maxlength="8000"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Lesson study text (optional — blank falls back to catalog)</mat-label>
            <textarea matInput rows="8" [value]="editMedia().body" (input)="setMedia('body', $any($event.target).value)" maxlength="20000" placeholder="Study lesson, blank line between paragraphs…"></textarea>
            <mat-hint>Shown on the course page as spaced paragraphs@if (mediaBodyOverridden()) { · currently overridden}</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Key takeaways (optional — one per line, max 10)</mat-label>
            <textarea matInput rows="3" [value]="editMedia().takeawaysText" (input)="setMedia('takeawaysText', $any($event.target).value)" placeholder="One takeaway per line…"></textarea>
          </mat-form-field>
          <div class="edit-actions">
            <span class="spacer"></span>
            @if (mediaOverridden()) {
              <button mat-button color="warn" (click)="resetMedia()" [disabled]="savingMedia()">Reset to catalog</button>
            }
            <button mat-flat-button color="primary" (click)="saveMedia()" [disabled]="savingMedia()">{{ savingMedia() ? 'Saving…' : 'Save media' }}</button>
          </div>
          @if (mediaError(); as err) {
            <p class="error" role="alert">{{ err }}</p>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .queue-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
    .notice { display: flex; align-items: center; gap: 0.5em; background: var(--ms-success-soft); color: var(--ms-success); border-radius: 8px; padding: 0.7em 1em; margin: 0; }
    html[data-theme='dark'] .notice { color: #9ccc9f; }
    .toolbar { display: flex; gap: 0.75em; align-items: center; flex-wrap: wrap; }
    .edit-card { padding: 1em; display: flex; flex-direction: column; gap: 0.75em; }
    .edit-card h3 { margin: 0 0 0.25em; }
    .question { display: flex; flex-direction: column; gap: 0.5em; padding: 0.75em 0; }
    .quiz-actions { display: flex; gap: 0.5em; align-items: center; flex-wrap: wrap; }
    .edit-actions { display: flex; align-items: center; gap: 0.5em; }
    .edit-actions .spacer { flex: 1; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    html[data-theme='dark'] .error { color: #e89a9a; }
    button { min-height: 44px; }
  `],
})
export class AdminTrainingQuizzesComponent implements OnInit {
  private readonly admin = inject(AdminTrainingService);
  private readonly media = inject(AdminTrainingMediaService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly loadingQuiz = signal(false);
  protected readonly saving = signal(false);
  protected readonly savingMedia = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly mediaError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly catalog = signal<AdminQuizCatalog[]>([]);
  protected readonly courseId = signal('');
  protected readonly lessonId = signal('');
  protected readonly editQuiz = signal<EditQuestion[]>([]);
  protected readonly editMedia = signal<{ videoUrl: string; posterUrl: string; captionsUrl: string; transcript: string; durationSec: number | null; body: string; takeawaysText: string }>({
    videoUrl: '', posterUrl: '', captionsUrl: '', transcript: '', durationSec: null, body: '', takeawaysText: '',
  });

  protected readonly lessons = computed(() => {
    const cid = this.courseId();
    return this.catalog().find((c) => c.id === cid)?.lessons ?? [];
  });

  protected lessonTitle(): string {
    return this.lessons().find((l) => l.id === this.lessonId())?.title ?? '—';
  }

  protected mediaOverridden(): boolean {
    return this.lessons().find((l) => l.id === this.lessonId())?.mediaOverridden ?? false;
  }

  protected mediaBodyOverridden(): boolean {
    return this.lessons().find((l) => l.id === this.lessonId())?.bodyOverridden ?? false;
  }

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.admin
      .catalog()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.catalog.set(res.data ?? []);
          if (!this.courseId() && this.catalog().length > 0) {
            this.courseId.set(this.catalog()[0].id);
            const first = this.catalog()[0].lessons[0];
            if (first) {
              this.lessonId.set(first.id);
              this.loadLesson();
            }
          }
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected loadLesson(): void {
    const cid = this.courseId();
    const lid = this.lessonId();
    if (!cid || !lid) return;
    this.loadingQuiz.set(true);
    this.saveError.set(null);
    this.mediaError.set(null);
    this.admin
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const row = (res.data ?? []).find((r) => r.courseId === cid && r.lessonId === lid);
          if (row) {
            this.editQuiz.set(row.quiz.map((q) => ({ q: q.q, options: [...q.options], answer: q.answer })));
          } else {
            // Seed from catalog fallback — learner sees code questions until first save.
            this.editQuiz.set([{ q: '', options: ['', ''], answer: 0 }]);
          }
          this.loadingQuiz.set(false);
        },
        error: (err: ApiError) => {
          this.saveError.set(err.message);
          this.loadingQuiz.set(false);
        },
      });
    // Media override if present, else seed from the effective catalog values.
    this.media
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const row = (res.data ?? []).find((r) => r.courseId === cid && r.lessonId === lid);
          const lesson = this.lessons().find((l) => l.id === lid);
          this.editMedia.set({
            videoUrl: row?.videoUrl ?? lesson?.videoUrl ?? '',
            posterUrl: row?.posterUrl ?? lesson?.posterUrl ?? '',
            captionsUrl: row?.captionsUrl ?? lesson?.captionsUrl ?? '',
            transcript: row?.transcript ?? '',
            durationSec: row?.durationSec ?? lesson?.durationSec ?? null,
            body: row?.body ?? lesson?.body ?? '',
            takeawaysText: (row?.takeaways?.length ? row.takeaways : (lesson?.takeaways ?? [])).join('\n'),
          });
        },
        error: (err: ApiError) => {
          this.mediaError.set(err.message);
        },
      });
  }

  protected setQuestion(i: number, value: string): void {
    this.editQuiz.update((qs) => { const next = [...qs]; next[i] = { ...next[i], q: value }; return next; });
  }

  protected setOption(qi: number, oi: number, value: string): void {
    this.editQuiz.update((qs) => {
      const next = [...qs];
      const opts = [...next[qi].options];
      opts[oi] = value;
      next[qi] = { ...next[qi], options: opts };
      return next;
    });
  }

  protected setAnswer(qi: number, value: number): void {
    this.editQuiz.update((qs) => { const next = [...qs]; next[qi] = { ...next[qi], answer: Number(value) }; return next; });
  }

  protected addQuestion(): void {
    this.editQuiz.update((qs) => [...qs, { q: '', options: ['', ''], answer: 0 }]);
  }

  protected removeQuestion(i: number): void {
    this.editQuiz.update((qs) => qs.filter((_, idx) => idx !== i));
  }

  protected addOption(qi: number): void {
    this.editQuiz.update((qs) => {
      const next = [...qs];
      next[qi] = { ...next[qi], options: [...next[qi].options, ''] };
      return next;
    });
  }

  protected removeOption(qi: number, oi: number): void {
    this.editQuiz.update((qs) => {
      const next = [...qs];
      next[qi] = { ...next[qi], options: next[qi].options.filter((_, idx) => idx !== oi) };
      if (next[qi].answer >= next[qi].options.length) next[qi] = { ...next[qi], answer: next[qi].options.length - 1 };
      return next;
    });
  }

  protected save(): void {    const cid = this.courseId();
    const lid = this.lessonId();
    if (!cid || !lid || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.notice.set(null);
    this.admin
      .save(cid, lid, this.editQuiz())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.notice.set('Quiz saved — learners now answer these questions.');
        },
        error: (err: ApiError) => {
          this.saving.set(false);
          this.saveError.set(err.message);
        },
      });
  }

  protected setMedia(field: 'videoUrl' | 'posterUrl' | 'captionsUrl' | 'transcript' | 'body' | 'takeawaysText', value: string): void {
    this.editMedia.update((m) => ({ ...m, [field]: value }));
  }

  protected setMediaDuration(value: number): void {
    this.editMedia.update((m) => ({ ...m, durationSec: Number.isFinite(value) ? Math.round(value) : null }));
  }

  protected saveMedia(): void {
    const cid = this.courseId();
    const lid = this.lessonId();
    if (!cid || !lid || this.savingMedia()) return;
    this.savingMedia.set(true);
    this.mediaError.set(null);
    this.notice.set(null);
    const m = this.editMedia();
    this.media
      .save(cid, lid, {
        videoUrl: m.videoUrl.trim() || null,
        posterUrl: m.posterUrl.trim() || null,
        captionsUrl: m.captionsUrl.trim() || null,
        transcript: m.transcript.trim() || null,
        durationSec: m.durationSec,
        body: m.body.trim() || null,
        takeaways: m.takeawaysText.split(/\r?\n/).map((t) => t.trim()).filter(Boolean).slice(0, 10),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingMedia.set(false);
          this.notice.set('Media saved — learners see it on next load.');
          this.reload();
          this.loadLesson();
        },
        error: (err: ApiError) => {
          this.savingMedia.set(false);
          this.mediaError.set(err.message);
        },
      });
  }

  protected resetMedia(): void {
    const cid = this.courseId();
    const lid = this.lessonId();
    if (!cid || !lid || this.savingMedia()) return;
    if (!window.confirm('Reset this lesson\u2019s media to the code catalog?')) return;
    this.savingMedia.set(true);
    this.mediaError.set(null);
    this.notice.set(null);
    this.media
      .reset(cid, lid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingMedia.set(false);
          this.notice.set('Media reset — catalog values are live again.');
          this.reload();
          this.loadLesson();
        },
        error: (err: ApiError) => {
          this.savingMedia.set(false);
          this.mediaError.set(err.message);
        },
      });
  }
}
