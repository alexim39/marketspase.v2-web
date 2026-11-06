import { ApiError, toApiError } from '../http/api-error';
import type { StateKind } from '../../ui/state-panel/state-panel.component';

export interface StateCopy {
  kind: StateKind;
  icon: string;
  title: string;
  message: string;
  reason: string;
  fix: string;
}

/**
 * Turns a normalized API/network failure into plain language:
 * what happened, whose side it is on, and the next action.
 */
export function describeError(error: unknown, context = 'this page'): StateCopy {
  const api = normalize(error);
  const message = api.message;

  if (api.status === 0 || api.code === 'NETWORK_ERROR') {
    return {
      kind: 'offline',
      icon: 'cloud_off',
      title: 'You appear to be offline',
      message: `We could not load ${context}. Cached pages remain available.`,
      reason: 'Your connection dropped before the request reached MarketSpase.',
      fix: 'Reconnect, then retry. Browsing saved pages still works while offline.',
    };
  }
  if (api.status === 401 || /session|expired|unauthenticated/i.test(api.code + ' ' + message)) {
    return {
      kind: 'session',
      icon: 'schedule',
      title: 'Your session expired',
      message: 'We saved the work on this page before ending the session.',
      reason: 'Your secure sign-in window ended, or you signed in on another device.',
      fix: 'Sign in again to return to this page; we will restore your saved work.',
    };
  }
  if (api.status === 403 || /forbidden|permission/i.test(api.code + ' ' + message)) {
    return {
      kind: 'permission',
      icon: 'lock',
      title: 'You do not have access to this',
      message: message || 'Your account is signed in, but this action needs a different role.',
      reason: 'Your current role does not include this permission. This is an access rule, not a system failure.',
      fix: 'Go back to your dashboard, or ask a MarketSpase admin to grant the role you need.',
    };
  }
  if (api.status === 404) {
    return {
      kind: 'search',
      icon: 'search_off',
      title: 'We could not find that',
      message: message || `The item or ${context} may have been moved or removed.`,
      reason: 'The address is valid, but the record no longer exists or is not visible to you.',
      fix: 'Check the spelling or reference, then search again or return to the list.',
    };
  }
  if (api.status === 409) {
    return {
      kind: 'error',
      icon: 'sync_problem',
      title: 'That changed while you were working',
      message: message || 'Another action updated this record first.',
      reason: 'Two changes overlapped, so MarketSpase protected the newer data.',
      fix: 'Refresh this page, review the latest version, then apply your change again.',
    };
  }
  if (api.status === 429) {
    return {
      kind: 'slow',
      icon: 'timer',
      title: 'Please give us a moment',
      message: message || 'Too many attempts arrived at once.',
      reason: 'A safety limit slowed the request to protect your account.',
      fix: 'Wait a minute, then retry once. Do not keep pressing the button.',
    };
  }
  if (api.status >= 500) {
    return {
      kind: 'error',
      icon: 'cloud_off',
      title: 'MarketSpase had a problem',
      message: message || `We could not load ${context}.`,
      reason: 'This is on our side, not yours. The server did not complete the request.',
      fix: 'Retry in a moment. If it keeps happening, contact support with the time this occurred.',
    };
  }
  if (api.status === 400 || api.status === 422) {
    return {
      kind: 'error',
      icon: 'edit_note',
      title: 'Check the details and try again',
      message,
      reason: 'One or more fields did not pass the server check, so nothing was saved.',
      fix: 'Review the highlighted field or message, correct it, then submit again.',
    };
  }
  return {
    kind: 'error',
    icon: 'error_outline',
    title: 'Something did not go through',
    message: message || `We could not complete ${context}.`,
    reason: 'The request ended before MarketSpase could confirm it.',
    fix: 'Retry once. If it still fails, contact support and mention what you were doing.',
  };
}

function normalize(error: unknown): ApiError {
  if (error && typeof error === 'object' && typeof (error as ApiError).status === 'number') {
    return error as ApiError;
  }
  return toApiError(error);
}
