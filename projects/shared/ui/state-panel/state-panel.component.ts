import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type StateKind =
  | 'empty'
  | 'error'
  | 'offline'
  | 'permission'
  | 'session'
  | 'search'
  | 'slow'
  | 'success';

const DEFAULT_ICONS: Record<StateKind, string> = {
  empty: 'inbox',
  error: 'error_outline',
  offline: 'cloud_off',
  permission: 'lock',
  session: 'schedule',
  search: 'search_off',
  slow: 'network_check',
  success: 'check_circle',
};

/**
 * One state surface for every non-happy path.
 *
 * Every state answers three questions: what happened, why, and what to do
 * next. Search states can also render selectable suggestions, and callers
 * project the primary action buttons.
 */
@Component({
  selector: 'async-state-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <section class="ms-state" [class]="'ms-state--' + kind()" [class.is-compact]="compact()" [attr.role]="kind() === 'error' || kind() === 'permission' ? 'alert' : 'status'">
      <span class="state-icon" aria-hidden="true">
        <mat-icon>{{ resolvedIcon() }}</mat-icon>
      </span>
      <div class="state-copy">
        @if (eyebrow()) {
          <p class="state-eyebrow">{{ eyebrow() }}</p>
        }
        <h2>{{ title() }}</h2>
        @if (message()) {
          <p class="state-message">{{ message() }}</p>
        }
        @if (reason()) {
          <p class="state-note"><strong>Why:</strong> {{ reason() }}</p>
        }
        @if (fix()) {
          <p class="state-next"><mat-icon aria-hidden="true">arrow_forward</mat-icon><span><strong>Next step:</strong> {{ fix() }}</span></p>
        }
        @if (suggestions().length > 0) {
          <div class="state-suggestions" role="group" [attr.aria-label]="'Suggested searches'">
            @for (suggestion of suggestions(); track suggestion) {
              <button type="button" class="suggestion" (click)="suggestionSelected.emit(suggestion)">
                {{ suggestion }}
              </button>
            }
          </div>
        }
      </div>
      <div class="state-actions">
        <ng-content />
      </div>
    </section>
  `,
  styles: [`
    .ms-state {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 14px 16px;
      align-items: start;
      padding: 24px;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-lg);
      background: var(--ms-surface);
      color: var(--ms-text);
    }
    .ms-state.is-compact { padding: 16px; gap: 10px 12px; }
    .state-icon {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: var(--ms-primary-soft);
      color: var(--ms-primary-strong);
    }
    .state-icon mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .state-copy { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
    .state-eyebrow {
      margin: 0;
      color: var(--ms-primary-strong);
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: var(--ms-tracking-label);
      text-transform: uppercase;
    }
    h2 { margin: 0; font-size: clamp(1.15rem, 2vw, 1.45rem); line-height: 1.1; }
    .state-message { margin: 0; color: var(--ms-text-muted); font-size: 0.92rem; line-height: 1.6; max-width: 64em; }
    .state-note, .state-next {
      margin: 0;
      display: flex;
      gap: 7px;
      align-items: flex-start;
      padding: 9px 11px;
      border-radius: 10px;
      font-size: 0.84rem;
      line-height: 1.5;
    }
    .state-note { background: var(--ms-surface-3); color: var(--ms-text); }
    .state-next { background: var(--ms-primary-soft); color: var(--ms-text); }
    .state-next mat-icon { flex: none; width: 17px; height: 17px; font-size: 17px; color: var(--ms-primary-strong); margin-top: 1px; }
    .state-suggestions { display: flex; flex-wrap: wrap; gap: 7px; padding-top: 3px; }
    .suggestion {
      min-height: 36px;
      padding: 0 12px;
      border: 1px solid var(--ms-line);
      border-radius: 999px;
      background: var(--ms-surface);
      color: var(--ms-primary-strong);
      font: inherit;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
    }
    .suggestion:hover { background: var(--ms-primary-soft); border-color: var(--ms-primary); }
    .state-actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; padding-top: 2px; }
    .ms-state--success .state-icon { background: var(--ms-success-soft); color: var(--ms-success); }
    .ms-state--error .state-icon { background: var(--ms-error-soft); color: var(--ms-error); }
    .ms-state--permission .state-icon { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .ms-state--offline .state-icon { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .ms-state--session .state-icon { background: var(--ms-info-soft); color: var(--ms-info); }
    .ms-state--search .state-icon { background: var(--ms-surface-3); color: var(--ms-text-muted); }
    .ms-state--slow .state-icon { background: var(--ms-info-soft); color: var(--ms-info); }
    .ms-state--success { border-color: color-mix(in srgb, var(--ms-success) 32%, var(--ms-line)); }
    .ms-state--error { border-color: color-mix(in srgb, var(--ms-error) 28%, var(--ms-line)); }
    .ms-state--permission, .ms-state--offline { border-color: color-mix(in srgb, var(--ms-warning) 28%, var(--ms-line)); }
    .ms-state--session { border-color: color-mix(in srgb, var(--ms-info) 28%, var(--ms-line)); }
    .ms-state--search { border-style: dashed; }
    @media (max-width: 600px) {
      .ms-state { grid-template-columns: 1fr; padding: 18px; }
      .state-actions { grid-column: 1; }
    }
  `],
})
export class StatePanelComponent {
  readonly kind = input<StateKind>('empty');
  readonly icon = input<string>('');
  readonly eyebrow = input<string>('');
  readonly title = input.required<string>();
  readonly message = input<string>('');
  readonly reason = input<string>('');
  readonly fix = input<string>('');
  readonly compact = input<boolean>(false);
  readonly suggestions = input<string[]>([]);
  readonly suggestionSelected = output<string>();

  protected readonly resolvedIcon = computed(() => this.icon() || DEFAULT_ICONS[this.kind()]);
}
