import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

/**
 * Inline field guidance. Put it immediately after a Material form field and
 * pass the matching control. It only appears after the user has interacted,
 * names the exact problem, and tells them how to fix it.
 */
@Component({
  selector: 'async-field-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    @if (visible()) {
      <p class="ms-field-error" role="alert">
        <mat-icon aria-hidden="true">error_outline</mat-icon>
        <span>{{ message() }}</span>
      </p>
    }
  `,
  styles: [`
    .ms-field-error {
      display: flex;
      align-items: flex-start;
      gap: 5px;
      margin: -10px 0 10px;
      padding: 0 4px;
      color: var(--ms-error);
      font-size: 0.78rem;
      font-weight: 600;
      line-height: 1.4;
    }
    .ms-field-error mat-icon { flex: none; width: 15px; height: 15px; font-size: 15px; margin-top: 1px; }
  `],
})
export class FieldErrorComponent {
  readonly control = input<AbstractControl | null>(null);
  readonly label = input<string>('field');

  private readonly version = signal(0);

  constructor() {
    effect((onCleanup) => {
      const control = this.control();
      if (!control) return;
      const sub = control.events.subscribe(() => this.version.update((n) => n + 1));
      onCleanup(() => sub.unsubscribe());
    });
  }

  protected readonly visible = computed(() => {
    this.version();
    const control = this.control();
    return !!control && control.invalid && (control.touched || control.dirty);
  });

  protected readonly message = computed(() => {
    this.version();
    const control = this.control();
    const errors = control?.errors ?? {};
    const name = this.label().toLowerCase();
    if (errors['required']) return `Enter your ${name}.`;
    if (errors['email']) return `Use a valid email address, like ada@example.com.`;
    if (errors['minlength']) {
      const need = Number(errors['minlength'].requiredLength ?? 0);
      return `Use at least ${need} characters for your ${name}.`;
    }
    if (errors['maxlength']) {
      const max = Number(errors['maxlength'].requiredLength ?? 0);
      return `Keep your ${name} to ${max} characters or fewer.`;
    }
    if (errors['min']) return `The ${name} must be at least ${errors['min'].min}.`;
    if (errors['max']) return `The ${name} must be ${errors['max'].max} or less.`;
    if (errors['pattern']) return `Check the format of your ${name} and try again.`;
    return `Check your ${name} and correct it before continuing.`;
  });
}
