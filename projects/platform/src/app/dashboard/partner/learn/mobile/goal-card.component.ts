import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { GOAL_KIND_LABELS, Goal } from '../../../../core/goals/goal.models';

/** Compact goal progress card for the mobile learn hub. */
@Component({
  selector: 'async-learn-goal-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatIconModule, RouterModule],
  template: `
    <a
      class="goal-card"
      routerLink="/dashboard/goals"
      [attr.aria-label]="goal().title + ', ' + (goal().progress.onTrack ? 'on track' : 'behind')">
      <span class="goal-icon" aria-hidden="true"><mat-icon>flag</mat-icon></span>
      <span class="goal-copy">
        <span class="goal-top">
          <strong>{{ goal().title }}</strong>
          <span class="goal-state" [class.is-behind]="!goal().progress.onTrack">
            {{ goal().progress.onTrack ? 'On track' : 'Behind' }}
          </span>
        </span>
        <span class="goal-kind">{{ kindLabel() }}</span>
        <span class="goal-bar" aria-hidden="true">
          <span [class.is-behind]="!goal().progress.onTrack" [style.width.%]="goal().progress.percent"></span>
        </span>
        <span class="goal-meta">{{ goal().progress.current | number }} / {{ goal().target | number }} · {{ daysLabel() }}</span>
      </span>
      <mat-icon class="goal-chev" aria-hidden="true">chevron_right</mat-icon>
    </a>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .goal-card { display: flex; align-items: flex-start; gap: 10px; padding: 10px; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); color: var(--ms-text); text-decoration: none; box-shadow: 0 4px 12px rgba(20, 18, 43, 0.04); }
    .goal-card:active { transform: scale(0.995); }
    .goal-icon { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 10px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .goal-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .goal-copy { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .goal-top { display: flex; align-items: flex-start; gap: 6px; }
    .goal-top strong { overflow: hidden; flex: 1; font-size: 0.84rem; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
    .goal-state { flex: none; padding: 2px 7px; border-radius: 999px; background: var(--ms-success-soft); color: var(--ms-success); font-size: 0.59rem; font-weight: 800; white-space: nowrap; }
    .goal-state.is-behind { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .goal-kind { overflow: hidden; color: var(--ms-text-muted); font-size: 0.66rem; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
    .goal-bar { display: block; height: 5px; margin-top: 2px; overflow: hidden; border-radius: 999px; background: var(--ms-line); }
    .goal-bar > span { display: block; height: 100%; border-radius: inherit; background: var(--ms-success); transition: width 200ms ease; }
    .goal-bar > span.is-behind { background: var(--ms-warning); }
    .goal-meta { color: var(--ms-text-muted); font-size: 0.63rem; line-height: 1.35; }
    .goal-chev { flex: none; margin-top: 8px; color: var(--ms-text-muted); font-size: 18px; width: 18px; height: 18px; }
  `],
})
export class LearnGoalCardComponent {
  readonly goal = input.required<Goal>();

  protected readonly kindLabel = computed(() => GOAL_KIND_LABELS[this.goal().kind] ?? 'Goal');

  protected readonly daysLabel = computed(() => {
    const days = this.goal().progress.daysLeft;
    if (days > 0) return `${days} day${days === 1 ? '' : 's'} left`;
    if (days === 0) return 'Last day';
    const overdue = Math.abs(days);
    return `${overdue} day${overdue === 1 ? '' : 's'} overdue`;
  });
}
