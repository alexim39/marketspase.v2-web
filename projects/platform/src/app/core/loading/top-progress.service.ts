import { computed, Injectable, signal } from '@angular/core';

/**
 * Top progress-bar state — the single global "something is happening"
 * signal. Ref-counted (not boolean) so concurrent requests resolve
 * correctly: the bar shows while ≥1 foreground request is in flight
 * and clears only when all settle. Never blocks input — pages own
 * their inline loaders; this is ambient feedback only.
 */
@Injectable({ providedIn: 'root' })
export class TopProgressService {
  private readonly pending = signal(0);

  readonly active = computed(() => this.pending() > 0);

  show(): void {
    this.pending.update((c) => c + 1);
  }

  hide(): void {
    this.pending.update((c) => Math.max(0, c - 1));
  }
}
