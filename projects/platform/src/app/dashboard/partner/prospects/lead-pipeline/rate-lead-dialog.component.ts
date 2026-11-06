import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FormsModule } from '@angular/forms';
import { LeadPipelineService } from './lead-pipeline.service';
import { ApiError, userError } from '../../../../core/http/api-error';

export interface RateLeadData {
  prospectId: string;
  leadName: string;
  context: 'converted' | 'released' | 'expired';
}

const CONTEXT_COPY: Record<RateLeadData['context'], { title: string; hint: string }> = {
  converted: { title: 'How good was this lead?', hint: 'You converted them — help the pool learn what great looks like.' },
  released: { title: 'Rate before it goes back?', hint: 'Quick vote — it sharpens which leads surface next.' },
  expired: { title: 'Why didn\u2019t this one work?', hint: 'Your vote keeps weak leads from topping the pool.' },
};

/**
 * @title Lead quality vote — 1–5 stars feed pool prioritization.
 * Fired after convert/release/expiry; skippable, never blocking.
 */
@Component({
  selector: 'async-rate-lead-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [LeadPipelineService],
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>{{ copy().title }}</h2>
    <div mat-dialog-content class="rate-body">
      <p class="muted">{{ copy().hint }}</p>
      <p class="lead-name">{{ data.leadName }}</p>
      <div class="stars" role="radiogroup" aria-label="Lead quality in stars">
        @for (s of [1, 2, 3, 4, 5]; track s) {
          <button mat-icon-button (click)="score.set(s)" [color]="score() >= s ? 'primary' : undefined" [attr.aria-label]="s + ' stars'">
            <mat-icon>{{ score() >= s ? 'star' : 'star_border' }}</mat-icon>
          </button>
        }
      </div>
      <mat-form-field appearance="outline">
        <mat-label>Note (optional)</mat-label>
        <input matInput [(ngModel)]="note" maxlength="500" placeholder="What made them strong or weak?" />
      </mat-form-field>
      @if (sending()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }
      @if (error(); as err) {
        <p class="error" role="alert">{{ err }}</p>
      }
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="sending()">Skip</button>
      <button mat-flat-button color="primary" (click)="submit()" [disabled]="!score() || sending()">Submit vote</button>
    </div>
  `,
  styles: [`
    .rate-body { display: flex; flex-direction: column; gap: 0.6em; min-width: min(360px, 80vw); }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; margin: 0; }
    .lead-name { font-weight: 700; margin: 0; }
    .stars { display: flex; gap: 0.1em; }
    .stars button { min-height: 44px; min-width: 44px; }
    .error { color: var(--ms-error); }
    button, a[mat-flat-button] { min-height: 44px; }
  `],
})
export class RateLeadDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<RateLeadDialogComponent>);
  protected readonly data = inject<RateLeadData>(MAT_DIALOG_DATA);
  private readonly leads = inject(LeadPipelineService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly score = signal(0);
  protected note = '';
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected copy(): { title: string; hint: string } {
    return CONTEXT_COPY[this.data.context] ?? CONTEXT_COPY['released'];
  }

  protected submit(): void {
    if (!this.score() || this.sending()) return;
    this.sending.set(true);
    this.error.set(null);
    this.leads
      .rateLead(this.data.prospectId, this.score(), this.note.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (err: ApiError) => {
          this.sending.set(false);
          this.error.set(userError(err));
        },
      });
  }
}
