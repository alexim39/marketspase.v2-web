import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { TrainingService } from '../../../core/training/training.service';
import { CourseDetail, Lesson } from '../../../core/training/training.models';
import { TrainingPlayerComponent } from '../player/training-player.component';
import { AuthService } from '../../../core/auth/auth.service';
import { certNumber, downloadCert } from '../../../core/training/cert';
import { ApiError, userError } from '../../../core/http/api-error';

const REQUIRED_PERCENT = 90;

/**
 * @title Course learning page — one lesson at a time.
 *
 * Video first, 90% verified watch, then the quiz. Completing the final lesson
 * mints the certificate and records the optional rank milestone server-side.
 */
@Component({
  selector: 'async-training-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatRadioModule,
    PageSkeletonComponent,
    RouterModule,
    TrainingPlayerComponent,
  ],
  templateUrl: './training-detail.component.html',
  styleUrls: ['./training-detail.component.scss'],
})
export class TrainingDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly training = inject(TrainingService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly course = signal<CourseDetail | null>(null);
  protected readonly activeLessonId = signal<string | null>(null);
  protected readonly answers = signal<number[]>([]);
  protected readonly submitting = signal(false);
  protected readonly quizError = signal<string | null>(null);
  protected readonly quizNotice = signal<string | null>(null);
  protected readonly heartbeatError = signal<string | null>(null);
  protected readonly certificateNotice = signal<string | null>(null);
  protected readonly contentTab = signal<'lesson' | 'transcript'>('lesson');
  protected readonly requiredPercent = REQUIRED_PERCENT;
  protected readonly certNumber = certNumber;

  protected readonly lessons = computed(() => this.course()?.lessons ?? []);
  protected readonly activeLesson = computed(() => {
    const id = this.activeLessonId();
    return this.lessons().find((lesson) => lesson.id === id) ?? this.lessons()[0] ?? null;
  });
  protected readonly activeIndex = computed(() => {
    const id = this.activeLesson()?.id;
    return this.lessons().findIndex((lesson) => lesson.id === id);
  });
  protected readonly previousLesson = computed(() => {
    const index = this.activeIndex();
    return index > 0 ? this.lessons()[index - 1] : null;
  });
  protected readonly nextLesson = computed(() => {
    const index = this.activeIndex();
    return index >= 0 ? this.lessons()[index + 1] ?? null : null;
  });
  protected readonly verifiedPercent = computed(() => this.activeLesson()?.watchPercent ?? 0);
  protected readonly remainingPercent = computed(() => Math.max(0, REQUIRED_PERCENT - this.verifiedPercent()));
  protected readonly quizUnlocked = computed(() => {
    const lesson = this.activeLesson();
    return Boolean(lesson?.completed || this.verifiedPercent() >= REQUIRED_PERCENT);
  });
  protected readonly lessonComplete = computed(() => Boolean(this.activeLesson()?.completed));
  protected readonly coursePercent = computed(() => this.course()?.percent ?? 0);
  protected readonly milestoneLabel = computed(() => {
    const milestone = this.course()?.milestone;
    return milestone ? milestone.toUpperCase() : 'Elective';
  });
  protected readonly courseCertified = computed(() => Boolean(this.course()?.certified));
  protected readonly answeredAll = computed(() => {
    const quiz = this.activeLesson()?.quiz ?? [];
    return quiz.length === 0 || this.answers().every((answer) => answer >= 0);
  });
  protected readonly answeredCount = computed(() => this.answers().filter((answer) => answer >= 0).length);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const courseId = params.get('courseId');
        if (!courseId) return;
        const lessonId = params.get('lessonId') ?? this.route.snapshot.queryParamMap.get('lesson');
        if (this.course()?.id === courseId) {
          this.setActive(lessonId);
          return;
        }
        this.load(courseId, lessonId);
      });
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        if (!this.course()) return;
        const id = params.get('lesson');
        if (id) this.setActive(id);
      });
  }

  protected load(courseId: string, lessonId: string | null): void {
    this.loading.set(true);
    this.error.set(null);
    this.quizError.set(null);
    this.quizNotice.set(null);
    this.certificateNotice.set(null);
    this.heartbeatError.set(null);
    this.training.course(courseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const course = response.data ?? null;
          this.course.set(course);
          if (course) this.markRecent(course.id);
          const requested = lessonId && course?.lessons.some((lesson) => lesson.id === lessonId)
            ? lessonId
            : null;
          this.setActive(requested ?? course?.resumeLessonId ?? course?.lessons[0]?.id ?? null);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  protected retry(): void {
    const courseId = this.route.snapshot.paramMap.get('courseId');
    if (courseId) this.load(courseId, this.route.snapshot.paramMap.get('lessonId'));
  }

  protected selectLesson(lesson: Lesson): void {
    if (!lesson?.id || lesson.id === this.activeLessonId()) return;
    this.setActive(lesson.id);
    const courseId = this.course()?.id;
    if (!courseId) return;
    const hasParam = Boolean(this.route.snapshot.paramMap.get('lessonId'));
    if (hasParam) {
      void this.router.navigate(['/dashboard/training/courses', courseId, 'lessons', lesson.id]);
    } else {
      void this.router.navigate(['/dashboard/training/courses', courseId], {
        queryParams: { lesson: lesson.id },
        replaceUrl: true,
      });
    }
  }

  protected goPrevious(): void {
    const lesson = this.previousLesson();
    if (lesson) this.selectLesson(lesson);
  }

  protected goNext(): void {
    const lesson = this.nextLesson();
    if (lesson) this.selectLesson(lesson);
  }

  protected selectAnswer(questionIndex: number, optionIndex: number): void {
    this.answers.update((current) => {
      const next = [...current];
      while (next.length < (this.activeLesson()?.quiz.length ?? 0)) next.push(-1);
      next[questionIndex] = optionIndex;
      return next;
    });
    this.quizError.set(null);
  }

  protected verifyWatch(event: { percent: number; seconds: number; ended: boolean }): void {
    const course = this.course();
    const lesson = this.activeLesson();
    if (!course || !lesson || lesson.completed) return;
    this.training.watch(course.id, lesson.id, event.percent, event.seconds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const watch = response.data;
          if (!watch) return;
          this.heartbeatError.set(null);
          this.course.update((current) => {
            if (!current) return current;
            return {
              ...current,
              watch: { ...(current.watch ?? {}), [lesson.id]: watch },
              lessons: current.lessons.map((item) => item.id === lesson.id
                ? {
                  ...item,
                  watchPercent: watch.percent,
                  watchSeconds: watch.seconds,
                }
                : item),
            };
          });
        },
        error: () => {
          this.heartbeatError.set('Watch progress could not be saved. Check your connection and keep watching.');
        },
      });
  }

  protected completeLesson(): void {
    const course = this.course();
    const lesson = this.activeLesson();
    if (!course || !lesson || this.submitting()) return;
    const quiz = lesson.quiz ?? [];
    if (quiz.length > 0 && !this.answeredAll()) {
      this.quizError.set('Answer every quiz question before submitting.');
      return;
    }
    if (!this.quizUnlocked()) {
      this.quizError.set(`Watch at least ${REQUIRED_PERCENT}% of the video to unlock the quiz.`);
      return;
    }
    this.submitting.set(true);
    this.quizError.set(null);
    this.quizNotice.set(null);
    const payload = quiz.length > 0 ? this.answers().slice(0, quiz.length) : undefined;
    this.training.completeLesson(course.id, lesson.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const result = response.data;
          this.submitting.set(false);
          if (!result) return;
          this.course.update((current) => {
            if (!current) return current;
            const completed = new Set(result.progress.completedIds);
            return {
              ...current,
              done: result.progress.done,
              percent: result.progress.percent,
              certified: result.progress.certified,
              certificateAt: result.certificateAt ?? current.certificateAt,
              nextLessonId: result.progress.nextLessonId,
              lessons: current.lessons.map((item) => completed.has(item.id)
                ? { ...item, completed: true }
                : item),
            };
          });
          this.quizNotice.set(result.certified
            ? 'Course complete. Your certificate is ready.'
            : 'Lesson complete. Your progress is saved.');
          if (result.certified) {
            this.certificateNotice.set(result.milestoneChecked
              ? `Your ${result.milestoneChecked.toUpperCase()} rank training is recorded.`
              : result.milestoneAlreadyRecorded
                ? 'Your certificate is ready. This rank milestone was already recorded from another course.'
                : 'Your certificate is ready. This elective course does not change your rank roadmap.');
          }
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          this.quizError.set(userError(err));
        },
      });
  }

  protected download(): void {
    const course = this.course();
    if (!course) return;
    const user = this.auth.currentUser();
    const name = [user?.name, user?.surname].filter(Boolean).join(' ') || user?.username || 'Partner';
    downloadCert({
      courseId: course.id,
      title: course.title,
      at: course.certificateAt ?? new Date().toISOString(),
    }, name);
  }

  protected paragraphs(body: string): string[] {
    return String(body ?? '')
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  }

  protected formatDuration(seconds: number): string {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    if (total >= 3600) {
      const hours = Math.floor(total / 3600);
      const minutes = Math.round((total % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
    return `${Math.max(1, Math.round(total / 60))} min`;
  }

  protected isCorrect(questionIndex: number, optionIndex: number): boolean {
    const question = this.activeLesson()?.quiz?.[questionIndex];
    return this.lessonComplete() && Number(question?.answer) === optionIndex;
  }

  protected isWrongSelection(questionIndex: number, optionIndex: number): boolean {
    if (!this.lessonComplete()) return false;
    const question = this.activeLesson()?.quiz?.[questionIndex];
    return Number(question?.answer) !== optionIndex && this.answers()[questionIndex] === optionIndex;
  }

  protected progressStyle(percent: number): string {
    const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    return `conic-gradient(var(--ms-primary) ${value * 3.6}deg, var(--ms-surface-3) 0deg)`;
  }

  private setActive(lessonId: string | null): void {
    const course = this.course();
    if (!course) return;
    const lesson = course.lessons.find((item) => item.id === lessonId)
      ?? course.lessons.find((item) => item.id === course.resumeLessonId)
      ?? course.lessons[0]
      ?? null;
    this.activeLessonId.set(lesson?.id ?? null);
    this.quizError.set(null);
    this.quizNotice.set(null);
    this.contentTab.set('lesson');
    this.answers.set(Array.from({ length: lesson?.quiz?.length ?? 0 }, () => -1));
  }

  private markRecent(courseId: string): void {
    try {
      const raw = localStorage.getItem('dp-library-recent');
      const ids = raw ? JSON.parse(raw) as unknown : [];
      const list = Array.isArray(ids) ? ids.map(String).filter((id) => id !== courseId) : [];
      localStorage.setItem('dp-library-recent', JSON.stringify([courseId, ...list].slice(0, 10)));
    } catch { /* storage may be disabled */ }
  }
}
