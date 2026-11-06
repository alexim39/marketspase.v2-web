import { ApiEnvelope } from '../../core/auth/auth.models';

export interface CourseSummary {
  id: string;
  title: string;
  tagline: string;
  milestone: string | null;
  lessons: number;
  done: number;
  total: number;
  percent: number;
  certified: boolean;
  certificateAt: string | null;
}

export interface Lesson {
  id: string;
  title: string;
  body: string;
  takeaways: string[];
  quiz?: Array<{ q: string; options: string[]; answer?: number }>;
  videoUrl?: string | null;
  posterUrl?: string | null;
  captionsUrl?: string | null;
  transcript?: string | null;
  durationSec?: number | null;
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
  courses: Array<{ courseId: string; title: string; done: number; total: number; percent: number; certified: boolean }>;
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
}

export interface CoursesEnvelope extends ApiEnvelope<CourseSummary[]> {
  data: CourseSummary[];
}

export interface CourseEnvelope extends ApiEnvelope<CourseDetail> {
  data: CourseDetail;
}

export interface CompleteEnvelope extends ApiEnvelope<{
  progress: { done: number; total: number; percent: number; certified: boolean };
  certificateAt: string | null;
  certified: boolean;
  milestoneChecked: string | null;
}> {
  data: {
    progress: { done: number; total: number; percent: number; certified: boolean };
    certificateAt: string | null;
    certified: boolean;
    milestoneChecked: string | null;
  };
}

export interface Certificate {
  courseId: string;
  title: string;
  at: string;
  number?: string;
}

export interface PathsEnvelope extends ApiEnvelope<Array<{
  level: string; title: string; tagline: string; unlocked: boolean;
  progress: { done: number; total: number; percent: number };
  requirements: Array<{ key: string; label: string; action: string; met: boolean; courseId: string | null }>;
  courses: Array<{ courseId: string; done: number; certified: boolean }>;
}>> {
  data: Array<{
    level: string; title: string; tagline: string; unlocked: boolean;
    progress: { done: number; total: number; percent: number };
    requirements: Array<{ key: string; label: string; action: string; met: boolean; courseId: string | null }>;
    courses: Array<{ courseId: string; done: number; certified: boolean }>;
  }>;
}

export interface Readiness {
  level: string; levelLabel: string; next: string | null; nextLabel: string | null;
  percent: number; score: number; label: string; done: number; total: number;
  missing: Array<{ key: string; label: string; action: string }>;
  remainingActions: string[];
}

export interface ReadinessEnvelope extends ApiEnvelope<Readiness> {
  data: Readiness;
}

export interface CertificatesEnvelope extends ApiEnvelope<Certificate[]> {
  data: Certificate[];
}
