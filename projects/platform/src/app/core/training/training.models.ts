import { ApiEnvelope } from '../../core/auth/auth.models';

export type TrainingMilestone = 'ipo' | 'qsg' | 'smo' | 'leadership';

export interface CourseSummary {
  id: string;
  title: string;
  tagline: string;
  description: string;
  milestone: TrainingMilestone | null;
  coverUrl: string | null;
  lessons: number;
  done: number;
  total: number;
  percent: number;
  certified: boolean;
  certificateAt: string | null;
  estimatedMinutes: number;
  nextLessonId: string | null;
  publishedAt: string | null;
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  body: string;
  takeaways: string[];
  transcript: string;
  quiz: Array<{ q: string; options: string[]; answer?: number }>;
  youtubeId: string | null;
  youtubeUrl: string | null;
  thumbnailUrl: string | null;
  durationSec: number;
  quizCount: number;
  completed: boolean;
  watchPercent: number;
  watchSeconds: number;
  sortOrder: number;
}

export interface WatchState {
  lessonId: string;
  percent: number;
  seconds: number;
  updatedAt: string | null;
}

export interface TeamComplianceRow {
  partnerId: string;
  depth: number;
  member: { username: string; name: string } | null;
  courses: Array<{
    courseId: string;
    title: string;
    milestone?: TrainingMilestone | null;
    done: number;
    total: number;
    percent: number;
    certified: boolean;
  }>;
  overallPercent: number;
  certifiedCount: number;
}

export interface TeamComplianceEnvelope extends ApiEnvelope<{
  members: TeamComplianceRow[];
  total: number;
  capped: boolean;
  summary: { notStarted: number; inProgress: number; fullyCertified: number };
}> {
  data: {
    members: TeamComplianceRow[];
    total: number;
    capped: boolean;
    summary: { notStarted: number; inProgress: number; fullyCertified: number };
  };
}

export interface TeamMemberLesson {
  lessonId: string;
  title: string;
  done: boolean;
  hasVideo: boolean;
}

export interface TeamMemberCourse {
  courseId: string;
  title: string;
  done: number;
  total: number;
  percent: number;
  certified: boolean;
  lessons: TeamMemberLesson[];
}

export interface TeamMemberDetail {
  partnerId: string;
  depth: number | null;
  member: { username: string; name: string } | null;
  courses: TeamMemberCourse[];
  overallPercent: number;
  certifiedCount: number;
}

export interface TeamMemberDetailEnvelope extends ApiEnvelope<TeamMemberDetail> {
  data: TeamMemberDetail;
}

export interface NudgeResult {
  status: 'notified' | 'skipped';
  reason?: string;
  deduped?: boolean;
  overallPercent?: number;
  nextCourseId?: string | null;
}

export interface NudgeEnvelope extends ApiEnvelope<NudgeResult> {
  data: NudgeResult;
}

export interface CourseDetail extends Omit<CourseSummary, 'lessons'> {
  lessons: Lesson[];
  completedIds: string[];
  watch?: Record<string, WatchState>;
  resumeLessonId: string;
}

export interface CoursesEnvelope extends ApiEnvelope<CourseSummary[]> {
  data: CourseSummary[];
}

export interface CourseEnvelope extends ApiEnvelope<CourseDetail> {
  data: CourseDetail;
}

export interface CompleteResult {
  courseId: string;
  progress: {
    done: number;
    total: number;
    percent: number;
    certified: boolean;
    nextLessonId: string | null;
    completedIds: string[];
  };
  certificateAt: string | null;
  certified: boolean;
  milestoneChecked: TrainingMilestone | null;
  milestoneAlreadyRecorded: boolean;
  courseCompleted: boolean;
}

export interface CompleteEnvelope extends ApiEnvelope<CompleteResult> {
  data: CompleteResult;
}

export interface Certificate {
  courseId: string;
  title: string;
  at: string;
  number?: string;
}

export interface LearningPath {
  level: string;
  title: string;
  tagline: string;
  unlocked: boolean;
  progress: { done: number; total: number; percent: number };
  requirements: Array<{
    key: string;
    label: string;
    action: string;
    met: boolean;
    courseId: string | null;
    courseTitle?: string | null;
  }>;
  courses: Array<{
    courseId: string;
    title?: string | null;
    done: number;
    total?: number;
    percent?: number;
    certified: boolean;
  }>;
}

export interface PathsEnvelope extends ApiEnvelope<LearningPath[]> {
  data: LearningPath[];
}

export interface Readiness {
  level: string;
  levelLabel: string;
  next: string | null;
  nextLabel: string | null;
  percent: number;
  score: number;
  label: string;
  done: number;
  total: number;
  missing: Array<{ key: string; label: string; action: string }>;
  remainingActions: string[];
}

export interface ReadinessEnvelope extends ApiEnvelope<Readiness> {
  data: Readiness;
}

export interface CertificatesEnvelope extends ApiEnvelope<Certificate[]> {
  data: Certificate[];
}
