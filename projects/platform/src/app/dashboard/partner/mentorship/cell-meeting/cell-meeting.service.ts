import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export interface CellMeetingRow {
  id: string;
  meetingDate: string;
  durationSeconds: number;
  minutes: number;
  sessions: number;
  firstJoinedAt: string | null;
  lastJoinedAt: string | null;
  partnerId?: string;
  name?: string;
  username?: string;
}

export interface CellMeetingSummary {
  totalMinutes: number;
  sessions: number;
  rows: CellMeetingRow[];
}

interface CellMeetingEnvelope<T> {
  message: string;
  data: T;
  success: boolean;
}

@Injectable()
export class CellMeetingService {
  apiURL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  httpOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
  };

  /** Record one completed meeting session for the signed-in member. */
  recordAttendance(durationSeconds: number): Observable<CellMeetingEnvelope<CellMeetingRow>> {
    return this.http.post<CellMeetingEnvelope<CellMeetingRow>>(
      `${this.apiURL}/v1/mentorship/cell-meeting`,
      { durationSeconds },
      { withCredentials: true },
    );
  }

  myAttendance(): Observable<CellMeetingEnvelope<CellMeetingSummary>> {
    return this.http.get<CellMeetingEnvelope<CellMeetingSummary>>(
      `${this.apiURL}/v1/mentorship/cell-meeting/mine`,
      { withCredentials: true },
    );
  }

  teamAttendance(): Observable<CellMeetingEnvelope<CellMeetingRow[]>> {
    return this.http.get<CellMeetingEnvelope<CellMeetingRow[]>>(
      `${this.apiURL}/v1/mentorship/cell-meeting/team`,
      { withCredentials: true },
    );
  }
}
