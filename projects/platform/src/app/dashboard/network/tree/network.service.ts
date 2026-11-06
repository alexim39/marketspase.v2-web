import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { NetworkChain, NetworkTreeEnvelope, UplineEnvelope } from './network.models';

/** Network read-model access → backend `/v1/network/*`. Fully typed. */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  private readonly api = inject(ApiClient);

  tree(partnerId: string, depth = 4, chain: NetworkChain = 'all'): Observable<NetworkTreeEnvelope> {
    return this.api.get<NetworkTreeEnvelope>(
      `v1/network/${partnerId}/tree?depth=${depth}&chain=${chain}`,
    );
  }

  upline(partnerId: string, chain: NetworkChain = 'all'): Observable<UplineEnvelope> {
    return this.api.get<UplineEnvelope>(`v1/network/${partnerId}/upline?chain=${chain}`);
  }

  /** Downline member 360 (self, upline or admin) — read-only profile shape. */
  member360(partnerId: string): Observable<unknown> {
    return this.api.get(`v1/network/${partnerId}/member360`);
  }

  displayName(node: { name: string; surname: string; username: string }): string {
    const full = `${node.name ?? ''} ${node.surname ?? ''}`.trim();
    return full || node.username;
  }
}
