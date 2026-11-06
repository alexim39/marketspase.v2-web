import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { UserRole } from '../auth/auth.models';
import { ManagedPartner, PartnerDirectoryEnvelope, AuditEnvelope, PlatformStatsEnvelope } from './admin.models';
import { ApiEnvelope } from '../auth/auth.models';

/**
 * Admin console data access → backend `/v1/admin/*`
 * (requireAuth + requireRole('admin') enforced server-side).
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiClient);

  directory(params: { q?: string; role?: string; suspended?: string; login?: string; limit?: number; skip?: number } = {}): Observable<PartnerDirectoryEnvelope> {
    const query = new URLSearchParams({
      q: params.q ?? '',
      role: params.role ?? 'all',
      suspended: params.suspended ?? 'all',
      login: params.login ?? 'all',
      limit: String(params.limit ?? 25),
      skip: String(params.skip ?? 0),
    });
    return this.api.get<PartnerDirectoryEnvelope>(`v1/admin/partners?${query.toString()}`);
  }

  setRole(partnerId: string, role: UserRole): Observable<{ data: ManagedPartner }> {
    return this.api.patch<{ data: ManagedPartner }>(`v1/admin/partners/${partnerId}/role`, { role });
  }

  setPermissions(partnerId: string, permissions: string[]): Observable<{ data: ManagedPartner }> {
    return this.api.patch<{ data: ManagedPartner }>(`v1/admin/partners/${partnerId}/permissions`, {
      permissions,
    });
  }

  setSuspended(partnerId: string, suspended: boolean, reason?: string): Observable<{ data: ManagedPartner }> {
    return this.api.patch<{ data: ManagedPartner }>(`v1/admin/partners/${partnerId}/suspend`, {
      suspended,
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
    });
  }

  stats(): Observable<PlatformStatsEnvelope> {
    return this.api.get<PlatformStatsEnvelope>('v1/admin/stats');
  }

  forceSignOut(partnerId: string): Observable<ApiEnvelope<{ revoked: boolean }>> {
    return this.api.post<ApiEnvelope<{ revoked: boolean }>>(`v1/admin/partners/${partnerId}/signout`, {});
  }

  resetOnBehalf(partnerId: string): Observable<ApiEnvelope<unknown>> {
    return this.api.post<ApiEnvelope<unknown>>(`v1/admin/partners/${partnerId}/reset-password`, {});
  }

  erase(partnerId: string): Observable<ApiEnvelope<{ erased: ManagedPartner; removed: Record<string, number> }>> {
    return this.api.delete<ApiEnvelope<{ erased: ManagedPartner; removed: Record<string, number> }>>(`v1/admin/partners/${partnerId}`);
  }

  reassignUpline(partnerId: string, newUplineUsername: string): Observable<ApiEnvelope<ManagedPartner>> {
    return this.api.patch<ApiEnvelope<ManagedPartner>>(`v1/admin/partners/${partnerId}/upline`, { newUplineUsername });
  }

  /** Member 360 — the admin's single read for "who is this member". */
  member360(partnerId: string): Observable<ApiEnvelope<import('./admin.models').Member360>> {
    return this.api.get(`v1/admin/members/${partnerId}/360`);
  }

  audit(params: { action?: string; actorId?: string; limit?: number; skip?: number } = {}): Observable<AuditEnvelope> {    const query = new URLSearchParams({
      ...(params.action ? { action: params.action } : {}),
      ...(params.actorId ? { actorId: params.actorId } : {}),
      limit: String(params.limit ?? 50),
      skip: String(params.skip ?? 0),
    });
    return this.api.get<AuditEnvelope>(`v1/admin/audit?${query.toString()}`);
  }
}
