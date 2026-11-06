import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { StatePanelComponent } from '../state-panel/state-panel.component';
import type { StateCopy } from '@marketspase/shared/core/ui/error-copy';

/**
 * Rich inline error for a page or panel: what failed, whose side it is on,
 * and the next action. Project retry/back buttons into the action slot.
 */
@Component({
  selector: 'async-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatePanelComponent],
  template: `
    <async-state-panel
      [kind]="copy().kind"
      [icon]="copy().icon"
      [title]="copy().title"
      [message]="copy().message"
      [reason]="copy().reason"
      [fix]="copy().fix"
      [compact]="compact()"
    >
      <ng-content />
    </async-state-panel>
  `,
})
export class ErrorStateComponent {
  readonly message = input<string>('');
  readonly context = input<string>('this page');
  readonly compact = input<boolean>(false);

  protected readonly copy = computed<StateCopy>(() => describeErrorText(this.message(), this.context()));
}

function describeErrorText(message: string, context: string): StateCopy {
  const text = String(message ?? '').toLowerCase();
  if (/offline|cannot reach|network|failed to fetch|connection/.test(text)) {
    return {
      kind: 'offline',
      icon: 'cloud_off',
      title: 'You appear to be offline',
      message: `We could not reach MarketSpase to load ${context}.`,
      reason: 'Your connection dropped before the request completed.',
      fix: 'Reconnect and retry. Cached pages stay available while you wait.',
    };
  }
  if (/session|expired|unauthor|sign in again|unauthenticated/.test(text)) {
    return {
      kind: 'session',
      icon: 'schedule',
      title: 'Your session expired',
      message: 'We saved the work on this page before the session ended.',
      reason: 'Your secure sign-in window ended.',
      fix: 'Sign in again to return here; we will restore your saved work.',
    };
  }
  if (/permission|forbidden|admin access|not allowed|insufficient/.test(text)) {
    return {
      kind: 'permission',
      icon: 'lock',
      title: 'This action needs different access',
      message: message || 'Your account is signed in, but this action is protected.',
      reason: 'Your current role does not include the required permission.',
      fix: 'Go back to your dashboard, or ask a MarketSpase admin for the role you need.',
    };
  }
  if (/too many|rate limit|slow down/.test(text)) {
    return {
      kind: 'slow',
      icon: 'timer',
      title: 'Please give us a moment',
      message: message || 'Too many attempts arrived at once.',
      reason: 'A safety limit slowed the request to protect your account.',
      fix: 'Wait a minute, then retry once.',
    };
  }
  if (/not found|removed|no longer/.test(text)) {
    return {
      kind: 'search',
      icon: 'search_off',
      title: 'We could not find that',
      message: message || `The item or ${context} may have moved.`,
      reason: 'The record is no longer available or visible to your account.',
      fix: 'Check the spelling or reference, then search again or return to the list.',
    };
  }
  return {
    kind: 'error',
    icon: 'error_outline',
    title: 'This page did not load fully',
    message: message || `We could not load ${context}.`,
    reason: 'The request ended before MarketSpase could confirm the result.',
    fix: 'Try again once. If it keeps failing, contact support with the time this happened.',
  };
}
