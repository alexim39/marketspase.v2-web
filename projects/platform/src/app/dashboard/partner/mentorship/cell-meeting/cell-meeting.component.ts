import { Component, Input, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { PartnerInterface } from '../../../../_common/services/partner.service';
import { CellMeetingService } from './cell-meeting.service';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../../environments/environment';

@Component({
    selector: 'async-cell-meeting',
    imports: [MatButtonModule, RouterModule],
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
          <p class="subtitle">Join the live session — your attendance is recorded automatically.</p>
        </div>
      </div>

      <div class="dp-card join-card">
        <p>
          Click the button below to join the Cell Meeting
        </p>
        <button mat-flat-button color="primary" (click)="onJoinMeeting()">Join Meeting</button>
      </div>
    </section>
  `,
    changeDetection: ChangeDetectionStrategy.Eager,
    styles: [`
  .breadcrumb-wrapper { margin-bottom: 1em; }
  .breadcrumb a { text-decoration: none; }
  .meeting-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
  .page-head h2 { margin: 0; }
  .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); }
  .join-card { padding: 1em; display: flex; flex-direction: column; gap: 0.75em; align-items: flex-start; }
  .join-card p { margin: 0; }
  .join-card button { min-height: 44px; }
  `]
})
export class CellMeetingComponent implements OnInit, OnDestroy {
  meetingUrl: string = environment.cellMeetingUrl;
  meetingWindow: Window | null = null;
  checkInterval: any;
  @Input() partner!: PartnerInterface;

  constructor(
    private cellMeetingService: CellMeetingService,
  ) {}

  
    ngOnInit(): void {

    }
  
    onJoinMeeting() {
        const startTime = new Date().getTime();
        localStorage.setItem('meetingStartTime', startTime.toString());

        // Single open path (previously href + window.open fired together).
        // noopener for safety; the reference enables attendance tracking.
        this.meetingWindow = window.open(this.meetingUrl, '_blank', 'noopener');

        // Start checking periodically if the window is closed
        this.checkInterval = setInterval(() => this.checkMeetingWindow(), 1000);
    }
    
    checkMeetingWindow() {
    if (this.meetingWindow && this.meetingWindow.closed) {
        this.onMeetingEnd();
    }
    }
    
    private onMeetingEnd() {
        const endTime = new Date().getTime();
        const startTime = parseInt(localStorage.getItem('meetingStartTime') || '0', 10);
    
        if (startTime) {
            const timeSpent = endTime - startTime; // Time in milliseconds

            // Convert timeSpent to hours, minutes, and seconds
            const hours = Math.floor(timeSpent / (1000 * 60 * 60));
            const minutes = Math.floor((timeSpent % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeSpent % (1000 * 60)) / 1000);
        
            const formattedTimeSpent = `${hours}h ${minutes}m ${seconds}s`;

          // Record the attendance and time spent
          this.cellMeetingService.recordAttendance(formattedTimeSpent, this.partner);
        }
    
        // Clean up
        clearInterval(this.checkInterval);
        localStorage.removeItem('meetingStartTime');
        this.meetingWindow = null;
    }
    
    ngOnDestroy() {
        // Ensure the interval is cleared if the component is destroyed
        if (this.checkInterval) {
          clearInterval(this.checkInterval);
        }
    }
    
}
