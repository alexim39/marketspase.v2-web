import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';

export type MobileSheetActionTone = 'default' | 'danger';

export interface MobileSheetAction {
  id: string;
  label: string;
  icon?: string;
  detail?: string;
  tone?: MobileSheetActionTone;
  disabled?: boolean;
}

export interface MobileActionSheetData {
  title: string;
  description?: string;
  actions: MobileSheetAction[];
  cancelLabel?: string;
}

/**
 * Reusable bottom-sheet body.
 *
 * Open it with `MatBottomSheet.open(MobileActionSheetComponent, { data })` or
 * embed it directly and bind the inputs. When opened as a sheet it closes with
 * the selected action id.
 */
@Component({
  selector: 'async-mobile-action-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="ms-mobile-sheet" role="dialog" aria-modal="true" [attr.aria-label]="sheetTitle()">
      <span class="ms-mobile-sheet-handle" aria-hidden="true"></span>

      <header class="ms-mobile-sheet-head">
        <h2>{{ sheetTitle() }}</h2>
        @if (sheetDescription()) {
          <p>{{ sheetDescription() }}</p>
        }
      </header>

      <div class="ms-mobile-sheet-actions">
        @for (action of sheetActions(); track action.id) {
          <button
            type="button"
            class="ms-mobile-sheet-action"
            [class.is-danger]="action.tone === 'danger'"
            [disabled]="action.disabled"
            (click)="select(action)"
          >
            @if (action.icon) {
              <mat-icon aria-hidden="true">{{ action.icon }}</mat-icon>
            }
            <span class="ms-mobile-sheet-action-copy">
              <strong>{{ action.label }}</strong>
              @if (action.detail) {
                <small>{{ action.detail }}</small>
              }
            </span>
          </button>
        }
      </div>

      <button type="button" class="ms-mobile-sheet-cancel" (click)="cancel()">
        {{ sheetCancelLabel() }}
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .ms-mobile-sheet {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 8px 16px calc(16px + var(--ms-safe-bottom));
      background: var(--ms-surface);
      color: var(--ms-text);
    }

    .ms-mobile-sheet-handle {
      width: 40px;
      height: 4px;
      margin: 2px auto 4px;
      border-radius: var(--ms-radius-pill);
      background: var(--ms-line-strong);
    }

    .ms-mobile-sheet-head h2 {
      margin: 0;
      font-size: 1.1rem;
      letter-spacing: -0.02em;
    }

    .ms-mobile-sheet-head p {
      margin: 4px 0 0;
      color: var(--ms-text-muted);
      font-size: 0.82rem;
      line-height: 1.5;
    }

    .ms-mobile-sheet-actions {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .ms-mobile-sheet-action {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      min-height: 52px;
      padding: 8px 10px;
      border: 0;
      border-radius: var(--ms-radius-lg);
      background: transparent;
      color: var(--ms-text);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    .ms-mobile-sheet-action:hover,
    .ms-mobile-sheet-action:focus-visible {
      background: var(--ms-primary-soft);
    }

    .ms-mobile-sheet-action.is-danger {
      color: var(--ms-error);
    }

    .ms-mobile-sheet-action.is-danger:hover,
    .ms-mobile-sheet-action.is-danger:focus-visible {
      background: var(--ms-error-soft);
    }

    .ms-mobile-sheet-action:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .ms-mobile-sheet-action mat-icon {
      flex: none;
      color: currentColor;
    }

    .ms-mobile-sheet-action-copy {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }

    .ms-mobile-sheet-action-copy strong {
      font-size: 0.9rem;
      font-weight: 650;
    }

    .ms-mobile-sheet-action-copy small {
      color: var(--ms-text-muted);
      font-size: 0.75rem;
      line-height: 1.35;
    }

    .ms-mobile-sheet-cancel {
      min-height: 48px;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-lg);
      background: var(--ms-surface-2);
      color: var(--ms-text);
      font: inherit;
      font-weight: 650;
      cursor: pointer;
    }
  `],
})
export class MobileActionSheetComponent {
  private readonly sheetRef = inject<MatBottomSheetRef<unknown, string | null>>(MatBottomSheetRef, {
    optional: true,
  });
  private readonly data = inject<MobileActionSheetData | null>(MAT_BOTTOM_SHEET_DATA, {
    optional: true,
  });

  readonly title = input('');
  readonly description = input('');
  readonly actions = input<MobileSheetAction[]>([]);
  readonly cancelLabel = input('');

  readonly sheetTitle = computed(() => this.title() || this.data?.title || 'Actions');
  readonly sheetDescription = computed(() => this.description() || this.data?.description || '');
  readonly sheetActions = computed(() => {
    const bound = this.actions();
    return bound.length > 0 ? bound : (this.data?.actions ?? []);
  });
  readonly sheetCancelLabel = computed(() => this.cancelLabel() || this.data?.cancelLabel || 'Cancel');

  readonly actionSelected = output<string>();
  readonly closed = output<void>();

  protected select(action: MobileSheetAction): void {
    if (action.disabled) return;
    this.actionSelected.emit(action.id);
    this.sheetRef?.dismiss(action.id);
  }

  protected cancel(): void {
    this.closed.emit();
    this.sheetRef?.dismiss(null);
  }
}
