import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PartnerInterface } from '../../../../_common/services/partner.service';
import { CellMeetingService, CellMeetingRow, CellMeetingSummary } from './cell-meeting.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { ApiError, userError } from '../../../../core/http/api-error';

@Component({
  selector: 'async-cell-meeting',
  imports: [DatePipe, MatButtonModule, MatIconModule, RouterModule],
  providers: [CellMeetingService],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>Cell Meeting</span>
      </div>
    </section>

    <section class="meeting-page">
      <div class="page-head">
        <div>
          <h2>Cell Meeting</h2>
          <p class="subtitle">Join the live session — attendance and time in the room are recorded automatically.</p>
        </div>
      </div>

      <div class="dp-card join-card">
        <div>
          <strong>Weekly cell meeting</strong>
          <p>Open the meeting room, then close this tab when you leave. Only time in the room is counted.</p>
        </div>
        <button mat-flat-button color="primary" (click)="onJoinMeeting()">Join meeting</button>
      </div>

      @if (error(); as err) {
        <p class="error" role="alert">{{ err }}</p>
      }

      <div class="summary-grid">
        <div class="dp-card stat">
          <mat-icon>event_available</mat-icon>
          <strong>{{ summary()?.sessions ?? 0 }}</strong>
          <span>sessions recorded</span>
        </div>
        <div class="dp-card stat">
          <mat-icon>schedule</mat-icon>
          <strong>{{ summary()?.totalMinutes ?? 0 }}</strong>
          <span>minutes in meetings</span>
        </div>
        <div class="dp-card stat">
          <mat-icon>calendar_today</mat-icon>
          <strong>{{ summary()?.rows?.[0]?.meetingDate ?? '—' }}</strong>
          <span>last attendance</span>
        </div>
      </div>

      <div class="dp-card history">
        <h3>Recent attendance</h3>
        @if ((summary()?.rows ?? []).length === 0) {
          <p class="muted">No attendance recorded yet. Join a meeting to start your record.</p>
        } @else {
          <table>
            <thead><tr><th>Date</th><th>Sessions</th><th>Minutes</th><th>Last joined</th></tr></thead>
            <tbody>
              @for (row of summary()?.rows ?? []; track row.id) {
                <tr>
                  <td>{{ row.meetingDate }}</td>
                  <td>{{ row.sessions }}</td>
                  <td>{{ row.minutes }}</td>
                  <td>{{ row.lastJoinedAt | date:'shortTime' }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>

      @if (team().length > 0) {
        <div class="dp-card history">
          <h3>Team attendance</h3>
          <table>
            <thead><tr><th>Member</th><th>Date</th><th>Minutes</th></tr></thead>
            <tbody>
              @for (row of team(); track row.id) {
                <tr>
                  <td>{{ row.name || row.username }}</td>
                  <td>{{ row.meetingDate }}</td>
                  <td>{{ row.minutes }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .meeting-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); }
    .join-card { padding: 1em; display: flex; justify-content: space-between; align-items: center; gap: 1em; flex-wrap: wrap; }
    .join-card p { margin: 0.25em 0 0; color: var(--ms-text-muted); font-size: 0.88em; }
    .join-card button { min-height: 44px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75em; }
    .stat { padding: 1em; display: flex; flex-direction: column; gap: 0.15em; }
    .stat mat-icon { color: var(--ms-primary-strong); }
    .stat strong { font-size: 1.35em; }
    .stat span { color: var(--ms-text-muted); font-size: 0.8em; }
    .history { padding: 1em; overflow-x: auto; }
    .history h3 { margin: 0 0 0.6em; font-size: 1em; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88em; }
    th, td { text-align: left; padding: 0.5em 0.4em; border-bottom: 1px solid var(--ms-line); }
    th { color: var(--ms-text-muted); font-weight: 700; font-size: 0.78em; text-transform: uppercase; letter-spacing: 0.05em; }
    .muted { color: var(--ms-text-muted); }
    .error { color: var(--ms-error); }
    button { min-height: 44px; }
  `],
})
export class CellMeetingComponent implements OnInit, OnDestroy {
  meetingUrl: string = environment.cellMeetingUrl;
  meetingWindow: Window | null = null;
  checkInterval: ReturnType<typeof setInterval> | null = null;
  @Input() partner!: PartnerInterface;

  private readonly cellMeetingService = inject(CellMeetingService);
  protected readonly summary = signal<CellMeetingSummary | null>(null);
  protected readonly team = signal<CellMeetingRow[]>([]);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.cellMeetingService.myAttendance().subscribe({
      next: (res) => this.summary.set(res.data),
      error: (err: ApiError) => this.error.set(userError(err)),
    });
    this.cellMeetingService.teamAttendance().subscribe({
      next: (res) => this.team.set(res.data ?? []),
      error: () => { /* team view is optional for a member with no downline */ },
    });
  }

  onJoinMeeting(): void {
    const startTime = Date.now();
    localStorage.setItem('meetingStartTime', String(startTime));

    this.meetingWindow = window.open(this.meetingUrl, '_blank');
    if (this.meetingWindow) this.meetingWindow.opener = null;

    this.checkInterval = setInterval(() => this.checkMeetingWindow(), 1000);
  }

  checkMeetingWindow(): void {
    if (this.meetingWindow?.closed) this.onMeetingEnd();
  }

  private onMeetingEnd(): void {
    const startTime = parseInt(localStorage.getItem('meetingStartTime') || '0', 10);
    if (startTime) {
      const seconds = Math.round((Date.now() - startTime) / 1000);
      if (seconds >= 60) {
        this.cellMeetingService.recordAttendance(seconds).subscribe({
          next: () => this.load(),
          error: (err: ApiError) => this.error.set(userError(err)),
        });
      }
    }

    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkInterval = null;
    localStorage.removeItem('meetingStartTime');
    this.meetingWindow = null;
  }

  ngOnDestroy(): void {
    if (this.checkInterval) clearInterval(this.checkInterval);
  }
}
