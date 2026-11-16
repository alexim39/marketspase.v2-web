import { inject, Injectable, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

const CAMPAIGN_KEY = 'ms_campaign';
const REF_KEY = 'ms_ref';
const LEAD_KEY = 'ms_lead';

/** Shared campaign / referral capture for the Join landing. */
@Injectable()
export class JoinLandingFacade {
  private readonly route = inject(ActivatedRoute);

  readonly campaign = signal<string | null>(null);
  readonly referrer = signal<string | null>(null);
  readonly lead = signal<string | null>(null);

  constructor() {
    const fromQuery = String(this.route.snapshot.queryParamMap.get('campaign') ?? '').trim();
    let fromStore = '';
    try { fromStore = localStorage.getItem(CAMPAIGN_KEY) ?? ''; } catch { /* private mode */ }
    const code = fromQuery || fromStore;
    if (code) {
      this.campaign.set(code);
      try { localStorage.setItem(CAMPAIGN_KEY, code); } catch { /* ignore */ }
    }

    const refQuery = String(this.route.snapshot.queryParamMap.get('ref') ?? '').trim();
    const refStore = readKey(REF_KEY);
    const ref = refQuery || refStore;
    if (ref) {
      const clean = ref.replace(/^@/, '');
      this.referrer.set(clean);
      try { localStorage.setItem(REF_KEY, clean); } catch { /* ignore */ }
    }

    const leadQuery = String(this.route.snapshot.queryParamMap.get('lead') ?? '').trim();
    const leadStore = readKey(LEAD_KEY);
    const lead = leadQuery || leadStore;
    if (/^[a-fA-F0-9]{24}$/.test(lead)) {
      this.lead.set(lead);
      try { localStorage.setItem(LEAD_KEY, lead); } catch { /* ignore */ }
    }
  }

  signupParams(): Record<string, string> {
    return {
      ...(this.campaign() ? { campaign: this.campaign()! } : {}),
      ...(this.referrer() ? { ref: this.referrer()! } : {}),
      ...(this.lead() ? { lead: this.lead()! } : {}),
    };
  }
}

function readKey(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
