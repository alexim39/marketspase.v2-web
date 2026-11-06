import { inject, Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { CertificatesEnvelope, CompleteEnvelope, CourseEnvelope, CoursesEnvelope, NudgeEnvelope, PathsEnvelope, ReadinessEnvelope, TeamComplianceEnvelope, TeamMemberDetailEnvelope, WatchState } from './training.models';
import { ApiEnvelope } from '../../core/auth/auth.models';

/** Training Center → backend `/v1/training/*`. Fully typed. */
@Injectable({ providedIn: 'root' })
export class TrainingService {
  private readonly api = inject(ApiClient);

  courses(): Observable<CoursesEnvelope> {
    return this.api.get<CoursesEnvelope>('v1/training/courses');
  }

  course(courseId: string): Observable<CourseEnvelope> {
    return this.api.get<CourseEnvelope>(`v1/training/courses/${courseId}`);
  }

  completeLesson(courseId: string, lessonId: string, answers?: number[]): Observable<CompleteEnvelope> {
    return this.api.post<CompleteEnvelope>(`v1/training/courses/${courseId}/lessons/${lessonId}/complete`, answers ? { answers } : {});
  }

  /** Monotonic watch heartbeat — fire at most every ~10% or 10s; server keeps the max. */
  watch(courseId: string, lessonId: string, percent: number, seconds: number): Observable<ApiEnvelope<WatchState>> {
    return this.api.post<ApiEnvelope<WatchState>>(`v1/training/courses/${courseId}/lessons/${lessonId}/watch`, {
      percent: Math.min(100, Math.max(0, Math.round(percent))),
      seconds: Math.max(0, Math.round(seconds)),
    });
  }

  teamCompliance(limit = 200): Observable<TeamComplianceEnvelope> {
    const params = new HttpParams().set('limit', String(limit));
    return this.api.get<TeamComplianceEnvelope>('v1/training/team/compliance', params);
  }

  teamMember(partnerId: string): Observable<TeamMemberDetailEnvelope> {
    return this.api.get<TeamMemberDetailEnvelope>(`v1/training/team/compliance/${partnerId}`);
  }

  nudge(partnerId: string, note = ''): Observable<NudgeEnvelope> {
    return this.api.post<NudgeEnvelope>('v1/training/team/nudge', { partnerId, note });
  }

  certificates(): Observable<CertificatesEnvelope> {
    return this.api.get<CertificatesEnvelope>('v1/training/mine/certificates');
  }

  readiness(): Observable<ReadinessEnvelope> {
    return this.api.get<ReadinessEnvelope>('v1/training/readiness');
  }

  paths(): Observable<PathsEnvelope> {
    return this.api.get<PathsEnvelope>('v1/training/paths');
  }
}
