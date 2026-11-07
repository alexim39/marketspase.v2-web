import { Injectable, inject, signal } from '@angular/core';
import { API_BASE_URL } from '../config/api-tokens';

interface StoredField {
  key: string;
  by: 'name' | 'id';
  type: string;
  value: string;
  checked?: boolean;
}

interface SavedWork {
  path: string;
  url: string;
  at: number;
  reason: 'expired' | 'permission';
  fields: StoredField[];
}

const DRAFT_KEY = 'ms_session_draft_v1';
const NOTICE_KEY = 'ms_session_notice_v1';
const RESTORE_KEY = 'ms_session_restore_v1';

/**
 * Preserves named form fields before a session ends, then restores them when
 * the user signs back in and returns to the same page. Password and file
 * inputs are never stored.
 */
@Injectable({ providedIn: 'root' })
export class SessionRecoveryService {
  readonly restored = signal(false);
  private readonly apiBase = inject(API_BASE_URL, { optional: true }) ?? '';

  captureCurrentWork(reason: SavedWork['reason'] = 'expired'): void {
    if (typeof document === 'undefined' || typeof sessionStorage === 'undefined') return;
    const fields: StoredField[] = [];
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')
      .forEach((el) => {
        const type = (el as HTMLInputElement).type ?? '';
        const key = el.name || el.id || el.getAttribute('data-draft-key') || '';
        if (!key) return;
        const lookup = String(key).toLowerCase();
        if (type === 'password' || type === 'file') return;
        if (/(otp|token|secret|card|cvv|pin|iban|account.?number)/.test(lookup)) return;
        fields.push({
          key,
          by: el.name ? 'name' : 'id',
          type,
          value: el.value ?? '',
          ...(type === 'checkbox' || type === 'radio' ? { checked: (el as HTMLInputElement).checked } : {}),
        });
      });
    if (fields.length === 0) return;
    const draft: SavedWork = {
      path: location.pathname,
      url: location.pathname + location.search,
      at: Date.now(),
      reason,
      fields,
    };
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      sessionStorage.setItem(NOTICE_KEY, reason);
      sessionStorage.setItem(RESTORE_KEY, '1');
    } catch {
      // Private mode: still redirect safely; only the draft is lost.
    }
    void this.persistToServer(draft);
  }

  /**
   * Best-effort server copy. The local sessionStorage draft always exists;
   * this survives a browser/device switch if the session is still valid.
   */
  private async persistToServer(draft: SavedWork): Promise<void> {
    try {
      const base = String(this.apiBase ?? '').replace(/\/+$/, '');
      await fetch(`${base}/v1/settings/drafts/session-expiry`, {
        method: 'PUT',
        credentials: 'include',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          payload: { fields: draft.fields, at: draft.at, reason: draft.reason },
          path: draft.path,
        }),
      });
    } catch {
      // Offline/expired session: the local draft remains the fallback.
    }
  }

  notice(): 'expired' | 'permission' | null {
    try {
      const value = sessionStorage.getItem(NOTICE_KEY);
      return value === 'expired' || value === 'permission' ? value : null;
    } catch {
      return null;
    }
  }

  clearNotice(): void {
    try {
      sessionStorage.removeItem(NOTICE_KEY);
    } catch { /* ignore */ }
  }

  /** Waits for the returned page to render, then restores matching fields. */
  restorePending(): void {
    if (typeof document === 'undefined' || typeof sessionStorage === 'undefined') return;
    let draft: SavedWork | null = null;
    try {
      if (sessionStorage.getItem(RESTORE_KEY) !== '1') return;
      const raw = sessionStorage.getItem(DRAFT_KEY);
      draft = raw ? JSON.parse(raw) as SavedWork : null;
    } catch {
      return;
    }
    if (!draft || draft.path !== location.pathname) return;

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const applied = this.apply(draft as SavedWork);
      if (applied || attempts >= 50) {
        window.clearInterval(timer);
        if (applied) {
          this.restored.set(true);
          try {
            sessionStorage.removeItem(RESTORE_KEY);
            sessionStorage.removeItem(DRAFT_KEY);
            sessionStorage.removeItem(NOTICE_KEY);
          } catch { /* ignore */ }
        }
      }
    }, 300);
  }

  private apply(draft: SavedWork): boolean {
    let applied = false;
    for (const field of draft.fields) {
      const selector = field.by === 'name'
        ? `[name="${cssEscape(field.key)}"]`
        : `#${cssEscape(field.key)}`;
      const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector);
      if (!el) continue;
      const type = (el as HTMLInputElement).type ?? '';
      if (type === 'checkbox' || type === 'radio') {
        const input = el as HTMLInputElement;
        if (typeof field.checked === 'boolean' && input.checked !== field.checked) {
          input.checked = field.checked;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          applied = true;
        }
        continue;
      }
      if (el.value !== field.value) {
        el.value = field.value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        applied = true;
      }
    }
    return applied;
  }
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/["\\]/g, '\\$&');
}
