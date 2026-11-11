import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule } from '@angular/router';
import { YouTubeApiService } from '@marketspase/shared/core/youtube/youtube-api.service';
import { ApiError, userError } from '../../../core/http/api-error';
import { environment } from '../../../../environments/environment';
import {
  AdminTrainingCourse,
  AdminTrainingCourseDetail,
  AdminTrainingLesson,
  AdminTrainingMilestone,
  AdminTrainingQuizQuestion,
  AdminTrainingService,
  AdminTrainingStatus,
} from './admin-training.service';

type LessonTab = 'video' | 'content' | 'quiz';

const extractYouTubeId = (input: string): string | null => {
  const raw = String(input ?? '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0] ?? '';
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v') ?? '';
        return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
      }
      for (const prefix of ['/embed/', '/shorts/', '/live/', '/v/']) {
        if (url.pathname.startsWith(prefix)) {
          const id = url.pathname.slice(prefix.length).split('/')[0].split('?')[0] ?? '';
          return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
        }
      }
    }
  } catch { /* not a URL */ }
  return null;
};

const thumbUrl = (id: string): string => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;

/**
 * @title Training Studio — admin course and lesson authoring.
 *
 * Admin creates the whole Academy: courses, YouTube lessons, notes and quizzes.
 * Publishing a course requires at least one published video lesson. A course
 * can optionally award one rank milestone; electives award certificates only.
 */
@Component({
  selector: 'async-admin-training-quizzes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    RouterModule,
  ],
  templateUrl: './admin-training-quizzes.component.html',
  styleUrls: ['./admin-training-quizzes.component.scss'],
})
export class AdminTrainingQuizzesComponent implements OnInit, OnDestroy {
  private readonly admin = inject(AdminTrainingService);
  private readonly youtube = inject(YouTubeApiService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('previewHost') private previewHost?: ElementRef<HTMLElement>;
  @ViewChild('lessonWorkspace') private lessonWorkspace?: ElementRef<HTMLElement>;

  protected readonly loading = signal(true);
  protected readonly loadingCourse = signal(false);
  protected readonly savingCourse = signal(false);
  protected readonly savingLesson = signal(false);
  protected readonly detecting = signal(false);
  protected readonly previewReady = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly courseError = signal<string | null>(null);
  protected readonly lessonError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly courses = signal<AdminTrainingCourse[]>([]);
  protected readonly selectedCourseId = signal<string | null>(null);
  protected readonly course = signal<AdminTrainingCourseDetail | null>(null);
  protected readonly selectedLessonId = signal<string | null>(null);
  protected readonly lesson = signal<AdminTrainingLesson | null>(null);
  protected readonly tab = signal<LessonTab>('video');
  protected readonly creatingCourse = signal(false);

  protected readonly courseTitle = signal('');
  protected readonly courseTagline = signal('');
  protected readonly courseDescription = signal('');
  protected readonly courseMilestone = signal<AdminTrainingMilestone>(null);
  protected readonly courseCover = signal('');

  protected readonly newTitle = signal('');
  protected readonly newTagline = signal('');
  protected readonly newMilestone = signal<AdminTrainingMilestone>(null);
  protected readonly newError = signal<string | null>(null);
  protected readonly creating = signal(false);

  protected readonly lessonTitle = signal('');
  protected readonly lessonSummary = signal('');
  protected readonly lessonBody = signal('');
  protected readonly lessonTakeaways = signal('');
  protected readonly lessonTranscript = signal('');
  protected readonly lessonYoutube = signal('');
  protected readonly lessonDuration = signal(0);
  protected readonly lessonStatus = signal<AdminTrainingStatus>('draft');
  protected readonly quiz = signal<AdminTrainingQuizQuestion[]>([]);
  protected readonly previewId = signal<string | null>(null);

  protected readonly lessons = computed(() => this.course()?.lessons ?? []);
  protected readonly selectedLesson = computed(() => {
    const id = this.selectedLessonId();
    return this.lessons().find((item) => item.id === id) ?? null;
  });
  protected readonly platformUrl = environment.platformUrl;
  protected readonly publishedLessons = computed(() =>
    this.lessons().filter((item) => item.status === 'published').length);
  protected readonly totalMinutes = computed(() =>
    Math.round(this.lessons().filter((item) => item.status === 'published')
      .reduce((total, item) => total + (Number(item.durationSec) || 0), 0) / 60));
  protected readonly courseWarnings = computed(() => this.course()?.warnings ?? []);
  protected readonly needsVideoHelp = computed(() =>
    this.lessons().length === 0 || this.lessons().every((lesson) => !lesson.youtubeId));
  protected readonly canPublishCourse = computed(() => this.publishedLessons() > 0);
  protected readonly quizValid = computed(() => this.quiz().every((question) =>
    question.q.trim().length >= 3
    && question.options.length >= 2
    && question.options.every((option) => option.trim().length > 0)
    && question.answer >= 0
    && question.answer < question.options.length));
  protected readonly youtubeThumb = computed(() => {
    const id = this.previewId();
    return id ? thumbUrl(id) : null;
  });

  private player: any = null;

  ngOnInit(): void {
    this.reloadCourses();
  }

  ngOnDestroy(): void {
    this.destroyPlayer();
  }

  protected reloadCourses(selectId: string | null = this.selectedCourseId(), lessonId: string | null = this.selectedLessonId()): void {
    this.loading.set(true);
    this.error.set(null);
    this.admin.courses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const courses = response.data ?? [];
          this.courses.set(courses);
          this.loading.set(false);
          const preferred = courses.find((course) => course.id === selectId)?.id ?? courses[0]?.id ?? null;
          if (preferred) this.loadCourse(preferred, lessonId);
          else {
            this.selectedCourseId.set(null);
            this.course.set(null);
            this.clearLesson();
          }
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  protected loadCourse(courseId: string, lessonId: string | null = null): void {
    this.loadingCourse.set(true);
    this.courseError.set(null);
    this.admin.course(courseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const detail = response.data;
          if (!detail) {
            this.loadingCourse.set(false);
            return;
          }
          this.selectedCourseId.set(detail.id);
          this.applyCourse(detail);
          const preferred = lessonId && detail.lessons.some((item) => item.id === lessonId)
            ? lessonId
            : detail.lessons[0]?.id ?? null;
          if (preferred) this.selectLesson(detail.lessons.find((item) => item.id === preferred) ?? null);
          else this.clearLesson();
          this.loadingCourse.set(false);
        },
        error: (err: ApiError) => {
          this.courseError.set(userError(err));
          this.loadingCourse.set(false);
        },
      });
  }

  protected selectCourse(course: AdminTrainingCourse): void {
    if (course.id === this.selectedCourseId() && this.course()) return;
    this.creatingCourse.set(false);
    this.notice.set(null);
    this.loadCourse(course.id);
  }

  protected startNewCourse(): void {
    this.creatingCourse.set(true);
    this.newTitle.set('');
    this.newTagline.set('');
    this.newMilestone.set(null);
    this.newError.set(null);
    this.notice.set(null);
  }

  protected cancelNewCourse(): void {
    this.creatingCourse.set(false);
    this.newError.set(null);
  }

  protected createCourse(): void {
    if (this.creating()) return;
    const title = this.newTitle().trim();
    if (title.length < 3) {
      this.newError.set('Give the course a title of at least 3 characters.');
      return;
    }
    this.creating.set(true);
    this.newError.set(null);
    this.admin.createCourse({
      title,
      tagline: this.newTagline().trim(),
      milestone: this.newMilestone(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.creating.set(false);
          this.creatingCourse.set(false);
          const detail = response.data;
          if (!detail) return;
          this.notice.set('Course created as a draft. Add a YouTube lesson, then publish.');
          this.selectedCourseId.set(detail.id);
          this.applyCourse(detail);
          this.clearLesson();
          this.reloadCourses(detail.id);
        },
        error: (err: ApiError) => {
          this.creating.set(false);
          this.newError.set(userError(err));
        },
      });
  }

  protected saveCourse(): void {
    const course = this.course();
    if (!course || this.savingCourse()) return;
    const title = this.courseTitle().trim();
    if (title.length < 3) {
      this.courseError.set('Course title must be at least 3 characters.');
      return;
    }
    this.savingCourse.set(true);
    this.courseError.set(null);
    this.notice.set(null);
    this.admin.updateCourse(course.id, {
      title,
      tagline: this.courseTagline().trim(),
      description: this.courseDescription().trim(),
      milestone: this.courseMilestone(),
      coverUrl: this.courseCover().trim() || null,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.savingCourse.set(false);
          if (response.data) this.applyCourse(response.data);
          this.notice.set('Course details saved.');
          this.reloadCourses(course.id, this.selectedLessonId());
        },
        error: (err: ApiError) => {
          this.savingCourse.set(false);
          this.courseError.set(userError(err));
        },
      });
  }

  protected setCourseStatus(status: AdminTrainingStatus): void {
    const course = this.course();
    if (!course || this.savingCourse()) return;
    if (status === 'archived' && !window.confirm('Archive this course? It disappears from the Academy; learner progress stays recorded.')) return;
    this.savingCourse.set(true);
    this.courseError.set(null);
    this.notice.set(null);
    this.admin.setCourseStatus(course.id, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.savingCourse.set(false);
          if (response.data) this.applyCourse(response.data);
          this.notice.set(status === 'published'
            ? 'Course published. It is now live in the Academy.'
            : status === 'archived'
              ? 'Course archived.'
              : 'Course moved back to draft.');
          this.reloadCourses(course.id, this.selectedLessonId());
        },
        error: (err: ApiError) => {
          this.savingCourse.set(false);
          this.courseError.set(userError(err));
        },
      });
  }

  protected async moveCourse(direction: -1 | 1): Promise<void> {
    const current = this.selectedCourseId();
    if (!current || this.courses().length < 2) return;
    const ids = this.courses().map((course) => course.id);
    const index = ids.indexOf(current);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.admin.reorderCourses(ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.reloadCourses(current, this.selectedLessonId()),
        error: (err: ApiError) => this.courseError.set(userError(err)),
      });
  }

  protected selectLesson(lesson: AdminTrainingLesson | null): void {
    if (!lesson) {
      this.clearLesson();
      return;
    }
    this.destroyPlayer();
    this.previewReady.set(false);
    this.selectedLessonId.set(lesson.id);
    this.lesson.set(lesson);
    this.lessonTitle.set(lesson.title);
    this.lessonSummary.set(lesson.summary ?? '');
    this.lessonBody.set(lesson.body ?? '');
    this.lessonTakeaways.set((lesson.takeaways ?? []).join('\n'));
    this.lessonTranscript.set(lesson.transcript ?? '');
    this.lessonYoutube.set(lesson.youtubeUrl ?? '');
    this.lessonDuration.set(Number(lesson.durationSec) || 0);
    this.lessonStatus.set(lesson.status);
    this.quiz.set((lesson.quiz ?? []).map((question) => ({
      q: question.q,
      options: [...question.options],
      answer: Number(question.answer) || 0,
    })));
    this.previewId.set(lesson.youtubeId ?? extractYouTubeId(lesson.youtubeUrl ?? ''));
    this.tab.set('video');
    this.lessonError.set(null);
  }

  protected addLesson(): void {
    const course = this.course();
    if (!course) return;
    this.savingLesson.set(true);
    this.lessonError.set(null);
    this.admin.createLesson(course.id, { title: 'Untitled lesson', status: 'draft' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.savingLesson.set(false);
          const lesson = response.data;
          if (!lesson) return;
          this.notice.set('Lesson added. Scroll to the Video tab, paste the YouTube link and detect the duration.');
          this.loadCourse(course.id, lesson.id);
          window.setTimeout(() => {
            this.lessonWorkspace?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 250);
        },
        error: (err: ApiError) => {
          this.savingLesson.set(false);
          this.lessonError.set(userError(err));
        },
      });
  }

  protected saveLesson(statusOverride?: AdminTrainingStatus): void {
    const course = this.course();
    const lesson = this.lesson();
    if (!course || !lesson || this.savingLesson()) return;
    const title = this.lessonTitle().trim();
    if (title.length < 3) {
      this.lessonError.set('Lesson title must be at least 3 characters.');
      this.tab.set('content');
      return;
    }
    if (!this.quizValid()) {
      this.lessonError.set('Complete every quiz question and choose the correct option.');
      this.tab.set('quiz');
      return;
    }
    this.savingLesson.set(true);
    this.lessonError.set(null);
    this.notice.set(null);
    this.admin.updateLesson(course.id, lesson.id, {
      title,
      summary: this.lessonSummary().trim(),
      body: this.lessonBody().trim(),
      takeaways: this.lessonTakeaways().split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 12),
      transcript: this.lessonTranscript().trim(),
      youtubeUrl: this.lessonYoutube().trim() || null,
      durationSec: Math.max(0, Math.round(Number(this.lessonDuration()) || 0)),
      quiz: this.quiz(),
      status: statusOverride ?? this.lessonStatus(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.savingLesson.set(false);
          const saved = response.data;
          if (saved) {
            this.lesson.set(saved);
            this.lessonStatus.set(saved.status);
            this.applyLessonToCourse(saved);
          }
          this.notice.set(saved?.status === 'published'
            ? 'Lesson published. Learners can now watch it.'
            : 'Lesson saved.');
          this.reloadCourses(course.id, lesson.id);
        },
        error: (err: ApiError) => {
          this.savingLesson.set(false);
          this.lessonError.set(userError(err));
        },
      });
  }

  protected deleteLesson(): void {
    const course = this.course();
    const lesson = this.lesson();
    if (!course || !lesson || this.savingLesson()) return;
    if (!window.confirm(`Delete "${lesson.title}"? This cannot be undone.`)) return;
    this.savingLesson.set(true);
    this.lessonError.set(null);
    this.admin.deleteLesson(course.id, lesson.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingLesson.set(false);
          this.notice.set('Lesson deleted.');
          this.loadCourse(course.id);
          this.reloadCourses(course.id);
        },
        error: (err: ApiError) => {
          this.savingLesson.set(false);
          this.lessonError.set(userError(err));
        },
      });
  }

  protected moveLesson(direction: -1 | 1): void {
    const course = this.course();
    const current = this.selectedLessonId();
    if (!course || !current) return;
    const ids = this.lessons().map((lesson) => lesson.id);
    const index = ids.indexOf(current);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.admin.reorderLessons(course.id, ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.course.update((detail) => detail ? { ...detail, lessons: response.data ?? detail.lessons } : detail);
          this.notice.set('Lesson order updated.');
        },
        error: (err: ApiError) => this.lessonError.set(userError(err)),
      });
  }

  protected setLessonYoutube(value: string): void {
    this.lessonYoutube.set(value);
    this.previewId.set(extractYouTubeId(value));
    this.previewReady.set(false);
    this.destroyPlayer();
  }

  protected previewVideo(): void {
    const id = extractYouTubeId(this.lessonYoutube()) ?? this.previewId();
    if (!id) {
      this.lessonError.set('Paste a valid YouTube link before previewing.');
      return;
    }
    this.previewId.set(id);
    this.detecting.set(true);
    this.lessonError.set(null);
    this.destroyPlayer();
    this.previewReady.set(false);
    window.setTimeout(() => this.mountPreview(id), 0);
  }

  protected useDetectedDuration(): void {
    const duration = Math.round(Number(this.player?.getDuration?.()) || 0);
    if (duration > 0) this.lessonDuration.set(duration);
  }

  protected setDuration(value: string): void {
    const seconds = Math.round(Number(value) || 0);
    this.lessonDuration.set(Math.max(0, Math.min(43200, seconds)));
  }

  protected tabLabel(tab: LessonTab): string {
    const lesson = this.lesson();
    if (tab === 'video') return lesson?.youtubeId ? 'Video ready' : 'Video needed';
    if (tab === 'quiz') return `${this.quiz().length} questions`;
    return 'Lesson notes';
  }

  protected statusLabel(status: AdminTrainingStatus): string {
    return status === 'published' ? 'Published' : status === 'archived' ? 'Archived' : 'Draft';
  }

  protected trackLabel(milestone: AdminTrainingMilestone): string {
    return milestone ? milestone.toUpperCase() : 'Elective';
  }

  protected formatDuration(seconds: number): string {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
  }

  protected addQuestion(): void {
    if (this.quiz().length >= 15) return;
    this.quiz.update((questions) => [...questions, { q: '', options: ['', ''], answer: 0 }]);
    this.tab.set('quiz');
  }

  protected setTab(tab: LessonTab): void {
    if (tab !== 'video' && this.tab() === 'video') {
      this.destroyPlayer();
      this.previewReady.set(false);
    }
    this.tab.set(tab);
  }

  protected previewUrl(courseId: string): string {
    return `${this.platformUrl}/dashboard/training/courses/${encodeURIComponent(courseId)}`;
  }

  protected courseIndex(courseId: string): number {
    return this.courses().findIndex((course) => course.id === courseId);
  }

  protected lessonIndex(lessonId: string): number {
    return this.lessons().findIndex((lesson) => lesson.id === lessonId);
  }

  protected removeQuestion(index: number): void {
    this.quiz.update((questions) => questions.filter((_, i) => i !== index));
  }

  protected setQuestion(index: number, value: string): void {
    this.quiz.update((questions) => questions.map((question, i) => i === index ? { ...question, q: value } : question));
  }

  protected setOption(questionIndex: number, optionIndex: number, value: string): void {
    this.quiz.update((questions) => questions.map((question, i) => {
      if (i !== questionIndex) return question;
      const options = [...question.options];
      options[optionIndex] = value;
      return { ...question, options };
    }));
  }

  protected setAnswer(questionIndex: number, optionIndex: number): void {
    this.quiz.update((questions) => questions.map((question, i) => i === questionIndex
      ? { ...question, answer: optionIndex }
      : question));
  }

  protected addOption(questionIndex: number): void {
    this.quiz.update((questions) => questions.map((question, i) => {
      if (i !== questionIndex || question.options.length >= 6) return question;
      return { ...question, options: [...question.options, ''] };
    }));
  }

  protected removeOption(questionIndex: number): void {
    this.quiz.update((questions) => questions.map((question, i) => {
      if (i !== questionIndex || question.options.length <= 2) return question;
      const options = question.options.slice(0, -1);
      return { ...question, options, answer: Math.min(question.answer, options.length - 1) };
    }));
  }

  private applyCourse(detail: AdminTrainingCourseDetail): void {
    this.course.set(detail);
    this.courseTitle.set(detail.title);
    this.courseTagline.set(detail.tagline ?? '');
    this.courseDescription.set(detail.description ?? '');
    this.courseMilestone.set(detail.milestone);
    this.courseCover.set(detail.coverUrl ?? '');
  }

  private applyLessonToCourse(lesson: AdminTrainingLesson): void {
    this.course.update((detail) => detail ? {
      ...detail,
      lessons: detail.lessons.map((item) => item.id === lesson.id ? lesson : item),
    } : detail);
  }

  private clearLesson(): void {
    this.destroyPlayer();
    this.selectedLessonId.set(null);
    this.lesson.set(null);
    this.previewId.set(null);
    this.previewReady.set(false);
    this.lessonError.set(null);
    this.quiz.set([]);
  }

  private mountPreview(id: string): void {
    const host = this.previewHost?.nativeElement;
    if (!host) {
      this.detecting.set(false);
      this.lessonError.set('The preview is not ready yet. Try again.');
      return;
    }
    host.innerHTML = '';
    const mount = document.createElement('div');
    mount.style.width = '100%';
    mount.style.height = '100%';
    host.appendChild(mount);
    void this.youtube.createPlayer(mount, {
      videoId: id,
      width: '100%',
      height: '100%',
      playerVars: {
        controls: 1,
        rel: 0,
        playsinline: 1,
        modestbranding: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: (event: any) => {
          this.player = event.target;
          const duration = Math.round(Number(event.target.getDuration?.()) || 0);
          if (duration > 0) this.lessonDuration.set(duration);
          const data = event.target.getVideoData?.() ?? {};
          if (data.title && (!this.lessonTitle().trim() || this.lessonTitle().trim() === 'Untitled lesson')) {
            this.lessonTitle.set(String(data.title).slice(0, 140));
          }
          this.detecting.set(false);
          this.previewReady.set(true);
        },
        onError: () => {
          this.detecting.set(false);
          this.previewReady.set(false);
          this.lessonError.set('YouTube could not load this video. Check that embedding is allowed, then enter the duration manually.');
        },
      },
    }).catch((error) => {
      this.detecting.set(false);
      this.previewReady.set(false);
      this.lessonError.set(error instanceof Error ? error.message : 'Could not load the YouTube preview.');
    });
  }

  private destroyPlayer(): void {
    try {
      this.player?.destroy?.();
    } catch { /* already gone */ }
    this.player = null;
  }
}
