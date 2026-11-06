import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { ApiEnvelope } from '../../../core/auth/auth.models';

export interface AdminQuizCatalog {
  id: string;
  title: string;
  lessons: Array<{
    id: string;
    title: string;
    quizCount: number;
    mediaOverridden?: boolean;
    bodyOverridden?: boolean;
    videoUrl?: string | null;
    posterUrl?: string | null;
    captionsUrl?: string | null;
    hasTranscript?: boolean;
    durationSec?: number | null;
    body?: string;
    takeaways?: string[];
  }>;
}

export interface AdminQuizRow {
  courseId: string;
  lessonId: string;
  quiz: Array<{ q: string; options: string[]; answer: number }>;
}

@Injectable({ providedIn: 'root' })
export class AdminTrainingService {
  private readonly api = inject(ApiClient);

  catalog(): Observable<ApiEnvelope<AdminQuizCatalog[]>> {
    return this.api.get<ApiEnvelope<AdminQuizCatalog[]>>('v1/admin/training/catalog');
  }

  list(): Observable<ApiEnvelope<AdminQuizRow[]>> {
    return this.api.get<ApiEnvelope<AdminQuizRow[]>>('v1/admin/training/quizzes');
  }

  save(courseId: string, lessonId: string, quiz: AdminQuizRow['quiz']): Observable<ApiEnvelope<AdminQuizRow>> {
    return this.api.put<ApiEnvelope<AdminQuizRow>>(`v1/admin/training/courses/${courseId}/lessons/${lessonId}/quiz`, quiz);
  }
}

export interface AdminMedia {
  videoUrl?: string | null;
  posterUrl?: string | null;
  captionsUrl?: string | null;
  transcript?: string | null;
  durationSec?: number | null;
  body?: string | null;
  takeaways?: string[] | null;
}

export interface AdminMediaRow {
  courseId: string;
  lessonId: string;
  videoUrl: string | null;
  posterUrl: string | null;
  captionsUrl: string | null;
  transcript: string | null;
  durationSec: number | null;
  body: string | null;
  takeaways: string[];
}

@Injectable({ providedIn: 'root' })
export class AdminTrainingMediaService {
  private readonly api = inject(ApiClient);

  list(): Observable<ApiEnvelope<AdminMediaRow[]>> {
    return this.api.get<ApiEnvelope<AdminMediaRow[]>>('v1/admin/training/media');
  }

  save(courseId: string, lessonId: string, media: AdminMedia): Observable<ApiEnvelope<AdminMediaRow>> {
    return this.api.put<ApiEnvelope<AdminMediaRow>>(`v1/admin/training/courses/${courseId}/lessons/${lessonId}/media`, media);
  }

  reset(courseId: string, lessonId: string): Observable<ApiEnvelope<{ reverted: boolean }>> {
    return this.api.delete<ApiEnvelope<{ reverted: boolean }>>(`v1/admin/training/courses/${courseId}/lessons/${lessonId}/media`);
  }
}
