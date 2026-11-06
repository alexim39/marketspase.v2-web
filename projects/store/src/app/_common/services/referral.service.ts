import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';

export interface ReferralPartner {
  username: string;
  name?: string;
  surname?: string;
  ts?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ReferralService {
  private readonly storageKey = 'dp-referral';
  private readonly legacyKey = 'username';
  private readonly ttlMs = 30 * 24 * 60 * 60 * 1000;
  private readonly isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  remember(partner: ReferralPartner): void {
    if (!this.isBrowser || !partner?.username || partner.username === 'business') return;
    const payload: ReferralPartner = {
      username: partner.username.trim(),
      name: partner.name?.trim() ?? '',
      surname: partner.surname?.trim() ?? '',
      ts: Date.now(),
    };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(payload));
      localStorage.setItem(this.legacyKey, payload.username);
    } catch {
    }
  }

  getPartner(): ReferralPartner | null {
    if (!this.isBrowser) return null;
    const stored = this.readStored();
    if (stored) return stored;

    const legacy = this.readLegacy();
    if (!legacy) return null;

    this.remember({ username: legacy });
    return this.readStored();
  }

  clear(): void {
    if (!this.isBrowser) return;
    try {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.legacyKey);
    } catch {
    }
  }

  private readStored(): ReferralPartner | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ReferralPartner;
      if (!parsed?.username || parsed.username === 'business') return null;
      if (!parsed.ts || Date.now() - parsed.ts > this.ttlMs) {
        this.clear();
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private readLegacy(): string | null {
    try {
      const username = (localStorage.getItem(this.legacyKey) ?? '').trim();
      return username && username !== 'business' ? username : null;
    } catch {
      return null;
    }
  }
}
