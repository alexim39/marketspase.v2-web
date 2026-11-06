import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { LeadPipelineService } from '../lead-pipeline/lead-pipeline.service';
import { ApiError, userError } from '../../../../core/http/api-error';
import { timeAgo } from '../../../../_common/date-util';

interface DialogLead {
  _id: string;
  name?: string;
  surname?: string;
  phoneNumber?: string;
  email?: string;
  ageRange?: string;
  referral?: string;
  referralCode?: string;
  socialMedia?: string[] | string;
  onlinePurchaseSchedule?: string;
  primaryOnlineBusinessMotivation?: string;
  importanceOfPassiveIncome?: string;
  employedStatus?: string;
  comfortWithTech?: string;
  onlineBusinessTimeDedication?: string;
  country?: string;
  state?: string;
  createdAt?: string | Date;
}

/**
 * @title Page-lead answers — decision dialog, not a data dump.
 *
 * MarketSpase language (avatar, dp-status chips, grouped answers, contact
 * shortcuts). Goal: help the partner decide in seconds — call/mail now or
 * Accept into My follow-ups (free, same v1 endpoint as the inbox row).
 * Closes with `{ accepted: true, id }` so the inbox drops the row.
 */
@Component({
  selector: 'async-prospect-response',
  template: `
    <h2 mat-dialog-title class="head">
      <span class="avatar">{{ initials() }}</span>
      <span class="head-text">
        <strong>{{ fullName() }}</strong>
        <small class="muted">
          @if (lead.state) { {{ lead.state }} · }
          arrived {{ arrivedAgo() }} · via your public page
        </small>
      </span>
    </h2>

    <mat-dialog-content class="body">
      @if (error(); as err) {
        <p class="error" role="alert">{{ err }}</p>
      }

      <div class="contact-row">
        @if (lead.phoneNumber) {
          <a mat-stroked-button [href]="'tel:' + lead.phoneNumber"><mat-icon>call</mat-icon> {{ lead.phoneNumber }}</a>
        }
        @if (lead.email) {
          <a mat-stroked-button [href]="'mailto:' + lead.email"><mat-icon>mail</mat-icon> <span class="mail">{{ lead.email }}</span></a>
        }
      </div>

      <div class="groups">
        <section>
          <h4>Background</h4>
          <div class="qa"><span>Age range</span><strong>{{ lead.ageRange || '—' }}</strong></div>
          <div class="qa"><span>Employment</span><strong>{{ lead.employedStatus || '—' }}</strong></div>
          <div class="qa"><span>Tech comfort</span><strong>{{ lead.comfortWithTech || '—' }}</strong></div>
          <div class="qa"><span>Hours / week</span><strong>{{ lead.onlineBusinessTimeDedication || '—' }}</strong></div>
          <div class="qa"><span>Favourite platforms</span><strong>{{ socials() }}</strong></div>
        </section>
        <section>
          <h4>Business fit</h4>
          <div class="qa"><span>Motivation</span><strong>{{ lead.primaryOnlineBusinessMotivation || '—' }}</strong></div>
          <div class="qa"><span>Passive income</span><strong>{{ lead.importanceOfPassiveIncome || '—' }}</strong></div>
          <div class="qa"><span>Buys online</span><strong>{{ lead.onlinePurchaseSchedule || '—' }}</strong></div>
          <div class="qa"><span>Heard via</span><strong>{{ lead.referral || '—' }}</strong></div>
          @if (lead.referralCode) {
            <div class="qa"><span>Referred by</span><strong>{{ lead.referralCode }}</strong></div>
          }
        </section>
        <section>
          <h4>Logistics</h4>
          <div class="qa"><span>Country</span><strong>{{ lead.country || '—' }}</strong></div>
          <div class="qa"><span>State</span><strong>{{ lead.state || '—' }}</strong></div>
          <div class="qa"><span>Submitted</span><strong>{{ lead.createdAt | date:'fullDate' }} · {{ lead.createdAt | date:'shortTime' }}</strong></div>
        </section>
      </div>
      <p class="hint muted">Accept moves this lead to My follow-ups (free). Call or mail first if they look hot.</p>
    </mat-dialog-content>

    <mat-dialog-actions class="foot">
      <button mat-button (click)="close()">Close</button>
      <span class="spacer"></span>
      <button mat-flat-button color="primary" (click)="accept()" [disabled]="accepting()">
        {{ accepting() ? 'Accepting…' : 'Accept into follow-ups' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .head { display: flex; align-items: center; gap: 0.8em; padding-bottom: 0.5em; }
    .avatar { width: 48px; height: 48px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; color: #fff; background: linear-gradient(135deg, var(--ms-primary), #6b4e12); flex: none; }
    .head-text { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
    .head-text strong { text-transform: capitalize; font-size: 1.1em; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .body { display: flex; flex-direction: column; gap: 1em; min-width: min(560px, 90vw); }
    .error { color: var(--ms-error); margin: 0; }
    .contact-row { display: flex; gap: 0.5em; flex-wrap: wrap; }
    .contact-row a { text-decoration: none; }
    .mail { word-break: break-all; }
    .groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.9em; }
    .groups section { background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: 10px; padding: 0.8em 0.9em; }
    .groups h4 { margin: 0 0 0.5em; font-size: 0.8em; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ms-primary-strong); }
    .qa { display: flex; flex-direction: column; gap: 0.1em; padding: 0.35em 0; border-top: 1px solid var(--ms-line); }
    .qa:first-of-type { border-top: none; }
    .qa span { color: var(--ms-text-muted); font-size: 0.78em; }
    .qa strong { font-weight: 600; word-break: break-word; }
    .hint { margin: 0; }
    .foot { display: flex; align-items: center; gap: 0.5em; }
    .spacer { flex: 1; }
    button { min-height: 44px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule, MatDialogTitle, MatDialogContent, MatDialogActions],
})
export class ProspectResponseComponent {
  private readonly dialogRef = inject(MatDialogRef<ProspectResponseComponent>);
  private readonly data = inject<{ prospect: DialogLead }>(MAT_DIALOG_DATA);
  private readonly leads = inject(LeadPipelineService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly accepting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected get lead(): DialogLead {
    return this.data.prospect;
  }

  protected fullName(): string {
    return `${this.lead.name ?? ''} ${this.lead.surname ?? ''}`.trim() || 'Unnamed lead';
  }

  protected initials(): string {
    const parts = this.fullName().split(/\s+/).filter(Boolean);
    if (!parts.length || this.fullName() === 'Unnamed lead') return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  protected arrivedAgo(): string {
    try {
      return this.lead.createdAt ? timeAgo(new Date(this.lead.createdAt)) : '';
    } catch {
      return '';
    }
  }

  protected socials(): string {
    const s = this.lead.socialMedia;
    if (Array.isArray(s)) return s.length ? s.join(', ') : '—';
    return String(s ?? '').trim() || '—';
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected accept(): void {
    if (this.accepting() || !this.lead._id) return;
    this.accepting.set(true);
    this.error.set(null);
    this.leads
      .acceptPageLead(this.lead._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.accepting.set(false);
          this.dialogRef.close({ accepted: true, id: this.lead._id });
        },
        error: (err: ApiError) => {
          this.accepting.set(false);
          this.error.set(userError(err));
        },
      });
  }
}
