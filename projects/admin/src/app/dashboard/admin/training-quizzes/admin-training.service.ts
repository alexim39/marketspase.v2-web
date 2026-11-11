import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { ApiEnvelope } from '../../../core/auth/auth.models';

export type AdminTrainingStatus = 'draft' | 'published' | 'archived';
export type AdminTrainingMilestone = 'ipo' | 'qsg' | 'smo' | 'leadership' | null;

export interface AdminTrainingWarning {
  code: string;
  message: string;
  courseId?: string;
  courseTitle?: string;
}

export interface AdminTrainingCourse {
  id: string;
  title: string;
  tagline: string;
  description: string;
  milestone: AdminTrainingMilestone;
  coverUrl: string | null;
  status: AdminTrainingStatus;
  sortOrder: number;
  lessonCount: number;
  publishedLessonCount: number;
  estimatedMinutes: number;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  warnings: AdminTrainingWarning[];
}

export interface AdminTrainingQuizQuestion {
  q: string;
  options: string[];
  answer: number;
}

export interface AdminTrainingLesson {
  id: string;
  courseId: string;
  title: string;
  summary: string;
  body: string;
  takeaways: string[];
  transcript: string;
  youtubeId: string | null;
  youtubeUrl: string | null;
  thumbnailUrl: string | null;
  durationSec: number;
  quiz: AdminTrainingQuizQuestion[];
  status: AdminTrainingStatus;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
  isReady: boolean;
}

export interface AdminTrainingCourseDetail extends AdminTrainingCourse {
  lessons: AdminTrainingLesson[];
}

export interface AdminCoursePayload {
  title?: string;
  tagline?: string;
  description?: string;
  milestone?: AdminTrainingMilestone;
  coverUrl?: string | null;
  status?: AdminTrainingStatus;
}

export interface AdminLessonPayload {
  title?: string;
  summary?: string;
  body?: string;
  takeaways?: string[];
  transcript?: string;
  youtubeUrl?: string | null;
  durationSec?: number;
  quiz?: AdminTrainingQuizQuestion[];
  status?: AdminTrainingStatus;
}

/** Admin Training Studio API. */
@Injectable({ providedIn: 'root' })
export class AdminTrainingService {
  private readonly api = inject(ApiClient);

  courses(): Observable<ApiEnvelope<AdminTrainingCourse[]>> {
    return this.api.get<ApiEnvelope<AdminTrainingCourse[]>>('v1/admin/training/courses');
  }

  course(courseId: string): Observable<ApiEnvelope<AdminTrainingCourseDetail>> {
    return this.api.get<ApiEnvelope<AdminTrainingCourseDetail>>(`v1/admin/training/courses/${encodeURIComponent(courseId)}`);
  }

  createCourse(body: AdminCoursePayload): Observable<ApiEnvelope<AdminTrainingCourseDetail>> {
    return this.api.post<ApiEnvelope<AdminTrainingCourseDetail>>('v1/admin/training/courses', body);
  }

  updateCourse(courseId: string, body: AdminCoursePayload): Observable<ApiEnvelope<AdminTrainingCourseDetail>> {
    return this.api.patch<ApiEnvelope<AdminTrainingCourseDetail>>(`v1/admin/training/courses/${encodeURIComponent(courseId)}`, body);
  }

  setCourseStatus(courseId: string, status: AdminTrainingStatus): Observable<ApiEnvelope<AdminTrainingCourseDetail>> {
    return this.api.patch<ApiEnvelope<AdminTrainingCourseDetail>>(`v1/admin/training/courses/${encodeURIComponent(courseId)}/status`, { status });
  }

  archiveCourse(courseId: string): Observable<ApiEnvelope<AdminTrainingCourse>> {
    return this.api.delete<ApiEnvelope<AdminTrainingCourse>>(`v1/admin/training/courses/${encodeURIComponent(courseId)}`);
  }

  reorderCourses(ids: string[]): Observable<ApiEnvelope<Array<{ id: string; title: string; status: AdminTrainingStatus; sortOrder: number }>>> {
    return this.api.put<ApiEnvelope<Array<{ id: string; title: string; status: AdminTrainingStatus; sortOrder: number }>>>('v1/admin/training/courses/order', { ids });
  }

  createLesson(courseId: string, body: AdminLessonPayload): Observable<ApiEnvelope<AdminTrainingLesson>> {
    return this.api.post<ApiEnvelope<AdminTrainingLesson>>(`v1/admin/training/courses/${encodeURIComponent(courseId)}/lessons`, body);
  }

  updateLesson(courseId: string, lessonId: string, body: AdminLessonPayload): Observable<ApiEnvelope<AdminTrainingLesson>> {
    return this.api.patch<ApiEnvelope<AdminTrainingLesson>>(
      `v1/admin/training/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`,
      body,
    );
  }

  deleteLesson(courseId: string, lessonId: string): Observable<ApiEnvelope<{ deleted: boolean }>> {
    return this.api.delete<ApiEnvelope<{ deleted: boolean }>>(
      `v1/admin/training/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`,
    );
  }

  reorderLessons(courseId: string, ids: string[]): Observable<ApiEnvelope<AdminTrainingLesson[]>> {
    return this.api.put<ApiEnvelope<AdminTrainingLesson[]>>(
      `v1/admin/training/courses/${encodeURIComponent(courseId)}/lessons/order`,
      { ids },
    );
  }
}
