import { inject, Injectable } from '@angular/core';
import { ApiClient } from '../http/api-client.service';

/**
 * Lightweight product-event beacon. Events are deliberately fire-and-forget:
 * analytics must never block the user action that produced them.
 */
@Injectable({ providedIn: 'root' })
export class FeatureEventsService {
  private readonly api = inject(ApiClient);

  track(event: string, feature: string, meta: Record<string, unknown> = {}): void {
    this.api.post('v1/analytics/events', { events: [{ event, feature, meta }] })
      .subscribe({ error: () => { /* telemetry never blocks the UI */ } });
  }
}
