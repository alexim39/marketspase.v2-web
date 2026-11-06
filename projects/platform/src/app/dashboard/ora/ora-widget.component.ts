import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { OraChatComponent } from './ora-chat.component';

/**
 * @title Ora — floating AI mentor.
 *
 * Bottom-right FAB + panel (full sheet on phones), shell-level so it
 * floats over every dashboard page. The conversation surface itself is
 * `OraChatComponent` (shared with the full Ora page); this wrapper only
 * owns open state, so context boots lazily on first open — zero cost for
 * members who never chat. OnPush + signals.
 */
@Component({
  selector: 'async-ora-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, OraChatComponent],
  template: `
    <div class="ora-root">
      @if (open()) {
        <section class="ora-panel" role="dialog" aria-label="Chat with Ora">
          <async-ora-chat [showClose]="true" (closed)="open.set(false)" />
        </section>
      }
      <button
        mat-fab
        color="primary"
        class="ora-fab"
        (click)="open.update((v) => !v)"
        [attr.aria-expanded]="open()"
        aria-label="Chat with Ora"
        title="Chat with Ora"
      >
        <mat-icon>{{ open() ? 'close' : 'smart_toy' }}</mat-icon>
      </button>
    </div>
  `,
  styles: [`
    .ora-root { position: fixed; right: 1.25em; bottom: 1.25em; z-index: 1000; display: flex; flex-direction: column; align-items: flex-end; gap: 0.75em; }
    .ora-fab { min-height: 56px; }
    .ora-panel {
      width: min(380px, calc(100vw - 2.5em)); height: min(560px, calc(100dvh - 8em));
      overflow: hidden;
      background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.22);
    }
    @media (max-width: 640px) {
      .ora-root { right: 0.75em; bottom: 5.5em; }
      .ora-panel { width: calc(100vw - 1.5em); height: calc(100dvh - 9em); }
    }
  `],
})
export class OraWidgetComponent {
  protected readonly open = signal(false);
}
