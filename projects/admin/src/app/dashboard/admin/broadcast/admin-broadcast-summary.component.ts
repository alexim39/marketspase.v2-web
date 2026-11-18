import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AdminBroadcastService, BroadcastSummary } from './admin-broadcast.service';
import { ApiError, userError } from '../../../core/http/api-error';

/**
 * Delivery performance across recent broadcasts. The composer and history
 * remain below; this gives the platform operator the campaign result at a glance.
 */
@Component({
  selector: 'async-admin-broadcast-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatIconModule, MatProgressBarModule],
  template: `
    <section class="broadcast-summary" aria-labelledby="broadcast-summary-title">
      <header class="summary-head">
        <div>
          <p class="eyebrow">Delivery results</p>
          <h2 id="broadcast-summary-title">Recent campaign performance</h2>
          <p>Last {{ summary()?.windowDays ?? 30 }} days across every audience.</p>
        </div>
        @if (summary(); as data) {
          <span class="campaigns">{{ data.campaigns }} campaign{{ data.campaigns === 1 ? '' : 's' }}</span>
        }
      </header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading broadcast delivery results" />
      } @else if (error(); as err) {
        <p class="error" role="alert">{{ err }}</p>
      } @else if (summary(); as data) {
        <div class="summary-grid">
          <div class="channels">
            @for (channel of channels(); track channel.key) {
              <div class="channel">
                <div class="channel-head">
                  <span>{{ channel.label }}</span>
                  <strong>{{ channel.sent | number }}</strong>
                </div>
                <div class="track" aria-hidden="true">
                  <i [style.width.%]="success(channel)"></i>
                </div>
                <small>{{ channel.failed | number }} failed · {{ success(channel) | number: '1.0-0' }}% delivered</small>
              </div>
            }
          </div>

          <div class="side">
            <div class="side-row"><span>SMS spend</span><strong>₦{{ data.smsSpend | number: '1.0-0' }}</strong></div>
            <div class="side-row"><span>Audience</span><strong>{{ data.audiences.platform }} platform · {{ data.audiences.customers }} customers</strong></div>
            <div class="side-row"><span>Activation</span><strong>{{ data.activation.members }} member{{ data.activation.members === 1 ? '' : 's' }} · {{ data.activation.partners }} partner{{ data.activation.partners === 1 ? '' : 's' }}</strong></div>
            <div class="side-row"><span>Status</span><strong>{{ data.status.sent }} sent · {{ data.status.failed }} failed</strong></div>
          </div>
        </div>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }

    .broadcast-summary {
      padding: 20px 22px;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-xl);
      background:
        radial-gradient(360px 180px at 100% 0%, color-mix(in srgb, var(--ms-primary-soft) 62%, transparent), transparent 70%),
        var(--ms-surface);
      box-shadow: var(--ms-shadow-sm);
    }

    .summary-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
    .summary-head h2 { margin: 4px 0 4px; font-size: 1.08rem; letter-spacing: -0.02em; }
    .summary-head p { margin: 0; color: var(--ms-text-muted); font-size: 0.78rem; line-height: 1.45; }
    .campaigns { flex: none; padding: 5px 10px; border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.7rem; font-weight: 800; }

    .summary-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(250px, 0.8fr);
      gap: 18px;
      align-items: start;
    }
    .channels { display: flex; flex-direction: column; gap: 12px; }
    .channel { display: flex; flex-direction: column; gap: 4px; }
    .channel-head { display: flex; justify-content: space-between; gap: 10px; font-size: 0.78rem; }
    .channel-head span { font-weight: 650; }
    .channel-head strong { font-variant-numeric: tabular-nums; }
    .track { height: 9px; border-radius: 999px; background: var(--ms-canvas); overflow: hidden; }
    .track i { display: block; height: 100%; min-width: 2px; border-radius: inherit; background: var(--ms-primary); }
    .channel small { color: var(--ms-text-muted); font-size: 0.66rem; }

    .side { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-canvas); }
    .side-row { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-top: 1px solid var(--ms-line); font-size: 0.72rem; }
    .side-row:first-child { border-top: 0; }
    .side-row span { color: var(--ms-text-muted); }
    .side-row strong { text-align: right; font-variant-numeric: tabular-nums; }
    .error { margin: 0; color: var(--ms-error); font-size: 0.8rem; }

    @media (max-width: 900px) {
      .summary-grid { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 600px) {
      .broadcast-summary { padding: 16px; }
      .side-row { flex-direction: column; gap: 2px; }
      .side-row strong { text-align: left; }
    }
  `],
})
export class AdminBroadcastSummaryComponent implements OnInit {
  private readonly broadcasts = inject(AdminBroadcastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly summary = signal<BroadcastSummary | null>(null);

  protected readonly channels = computed(() => {
    const delivery = this.summary()?.delivery;
    if (!delivery) return [];
    return [
      { key: 'inApp', label: 'App inbox', ...delivery.inApp },
      { key: 'email', label: 'Email', ...delivery.email },
      { key: 'sms', label: 'SMS', ...delivery.sms },
    ];
  });

  ngOnInit(): void {
    this.broadcasts.summary(30)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.summary.set(res.data ?? null);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  protected success(channel: { sent: number; failed: number }): number {
    const total = Number(channel.sent) + Number(channel.failed);
    return total > 0 ? (Number(channel.sent) / total) * 100 : 0;
  }
}
