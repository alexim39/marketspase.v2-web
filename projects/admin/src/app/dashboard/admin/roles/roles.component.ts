import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../../core/admin/admin.service';
import { ManagedPartner, PlatformStats } from '../../../core/admin/admin.models';
import { ApiError, userError } from '../../../core/http/api-error';
import { UserRole } from '../../../core/auth/auth.models';
import { MatDialog } from '@angular/material/dialog';
import { Member360DialogComponent } from './member-360-dialog.component';
import { AvatarComponent } from '../../../_common/avatar.component';
import { ErrorStateComponent } from '@marketspase/shared/ui/error-state/error-state.component';
import { PageHeaderComponent } from '@marketspase/shared/ui/page-header/page-header.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { StatePanelComponent } from '@marketspase/shared/ui/state-panel/state-panel.component';

const ROLE_META: Record<UserRole, { label: string; color: string; text: string }> = {
  user: { label: 'Partner', color: '#e0e0e0', text: '#424242' },
  leader: { label: 'Leader', color: '#bbdefb', text: '#0d47a1' },
  admin: { label: 'Admin', color: '#ffccbc', text: '#bf360c' },
};

/**
 * @title Manage roles — admin console.
 *
 * Server is authoritative: every action hits `/v1/admin/*` (requireRole
 * enforced in the API). Self-edits are rejected with 403, last-admin
 * demotion with 409 — both surfaced inline from the `ApiError` envelope.
 */
@Component({
  selector: 'async-manage-roles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, FormsModule, MatTableModule, MatChipsModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule, RouterModule,
    AvatarComponent, ErrorStateComponent, PageHeaderComponent, PageSkeletonComponent, StatePanelComponent,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Admin</a> &gt;
        <span>Manage Roles</span>
      </div>
    </section>

    <section class="roles-page">
      <async-page-header
        eyebrow="People · Access control"
        title="Manage roles."
        subtitle="Promote partners to leaders, grant or revoke admin access."
      />

      @if (notice(); as note) {
        <p class="notice" role="status">{{ note }}</p>
      }

      <div class="toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Search partners</mat-label>
          <input matInput type="search" placeholder="Name, username, email or phone" [value]="searchText()" (input)="onSearch($event)" />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Role</mat-label>
          <mat-select [value]="roleFilter()" (selectionChange)="roleFilter.set($event.value); skip.set(0); reload()">
            <mat-option value="all">All roles</mat-option>
            <mat-option value="user">Partner</mat-option>
            <mat-option value="leader">Leader</mat-option>
            <mat-option value="admin">Admin</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Status</mat-label>
          <mat-select [value]="statusFilter()" (selectionChange)="statusFilter.set($event.value); skip.set(0); reload()">
            <mat-option value="all">Active + suspended</mat-option>
            <mat-option value="no">Active only</mat-option>
            <mat-option value="yes">Suspended only</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Activity</mat-label>
          <mat-select [value]="loginFilter()" (selectionChange)="loginFilter.set($event.value); skip.set(0); reload()">
            <mat-option value="all">Any activity</mat-option>
            <mat-option value="online">Online now</mat-option>
            <mat-option value="active1h">Active 1h</mat-option>
            <mat-option value="dormant30">Dormant 30d+</mat-option>
            <mat-option value="new7">Joined 7d</mat-option>
          </mat-select>
        </mat-form-field>
        @if (hasFilters()) {
          <button mat-button (click)="clearFilters()">Clear</button>
        }
      </div>

      @if (stats(); as s) {
        <div class="stat-grid" role="group" aria-label="Platform totals">
          <div class="dp-card stat"><span class="stat-value">{{ s.total | number }}</span><span class="muted">Total</span></div>
          <div class="dp-card stat"><span class="stat-value">+{{ s.new7d | number }}</span><span class="muted">New 7d</span></div>
          <div class="dp-card stat"><span class="stat-value">+{{ s.new30d | number }}</span><span class="muted">New 30d</span></div>
          <div class="dp-card stat"><span class="stat-value">{{ s.roles.user | number }}</span><span class="muted">Members</span></div>
          <div class="dp-card stat"><span class="stat-value">{{ s.roles.leader | number }}</span><span class="muted">Leaders</span></div>
          <div class="dp-card stat"><span class="stat-value">{{ s.roles.admin | number }}</span><span class="muted">Admins</span></div>
        </div>
      }

      @if (error(); as err) {
        <async-error-state [message]="err" context="the partner directory">
          <button mat-stroked-button type="button" (click)="reload()">Try again</button>
          <button mat-button type="button" (click)="clearFilters()">Clear filters</button>
        </async-error-state>
      }

      @if (loading()) {
        <async-page-skeleton layout="table" [rows]="6" label="partners" [showHeader]="false" />
      }

      @if (rows().length > 0 && !loading()) {
        <div class="table-wrap">
          <table mat-table [dataSource]="rows()" class="mat-elevation-z2">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Partner</th>
            <td mat-cell *matCellDef="let row" class="name-cell">
              <async-avatar [photo]="row.profileImage" [name]="displayName(row)" size="sm" />
              <span class="name-text">
                <button mat-button (click)="open360(row)" [matTooltip]="'Open member 360 for ' + displayName(row)">{{ displayName(row) }}</button>
                <div class="muted handle">@{{ row.username || '—' }}</div>
              </span>
            </td>
            </ng-container>
            <ng-container matColumnDef="contact">
              <th mat-header-cell *matHeaderCellDef>Contact</th>
              <td mat-cell *matCellDef="let row">
                <div>{{ row.email }}</div>
                <div class="muted">{{ row.phone || '—' }}</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="login">
              <th mat-header-cell *matHeaderCellDef>Last login</th>
              <td mat-cell *matCellDef="let row">
                @if (presenceOf(row) === 'online') {
                  <span class="dp-status dp-status--ok presence-pulse">Online</span>
                } @else if (presenceOf(row) === 'recent') {
                  <span class="dp-status dp-status--info">Active 1h</span>
                }
                {{ loginLabel(row) }}
                @if (isDormant(row)) {
                  <span class="dp-status dp-status--warn">dormant</span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="role">
              <th mat-header-cell *matHeaderCellDef>Role</th>
              <td mat-cell *matCellDef="let row">
                <span [class]="roleClass(row.role)">
                  {{ meta(row.role).label }}
                </span>
                @if (row.suspended) {
                  <span class="dp-status dp-status--bad" [matTooltip]="row.suspendReason || 'Suspended'">Suspended</span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="plan">
              <th mat-header-cell *matHeaderCellDef>Plan</th>
              <td mat-cell *matCellDef="let row">{{ row.subscription?.plan ?? '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef>Action</th>
              <td mat-cell *matCellDef="let row">
                @if (uplineId() === row.id) {
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>New upline @username</mat-label>
                    <input matInput [value]="uplineUsername()" (input)="uplineUsername.set($any($event.target).value)" placeholder="e.g. market" maxlength="80" />
                  </mat-form-field>
                  <button
                    mat-flat-button
                    color="primary"
                    (click)="applyUpline(row)"
                    [disabled]="actingId() === row.id || !uplineUsername().trim()"
                  >Confirm move?</button>
                  <button mat-button (click)="uplineId.set(null); uplineUsername.set('')">Cancel</button>
                } @else if (confirmId() === row.id) {
                  <button
                    mat-flat-button
                    color="primary"
                    (click)="applyRole(row, pendingRole())"
                    [disabled]="actingId() === row.id"
                  >Confirm {{ pendingRole() }}?</button>
                  <button mat-button (click)="confirmId.set(null)">Cancel</button>
                } @else if (suspendId() === row.id) {
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Reason (optional)</mat-label>
                    <input matInput [value]="suspendReason()" (input)="suspendReason.set($any($event.target).value)" maxlength="500" />
                  </mat-form-field>
                  <button
                    mat-flat-button
                    color="warn"
                    (click)="applySuspend(row, true)"
                    [disabled]="actingId() === row.id"
                  >Confirm suspend?</button>
                  <button mat-button (click)="suspendId.set(null)">Cancel</button>
                } @else {
                  @for (target of transitions(row.role); track target) {
                    <button
                      mat-button
                      [matTooltip]="'Change role to ' + target"
                      (click)="arm(row.id, target)"
                    >Make {{ target }}</button>
                  }
                  @if (row.suspended) {
                    <button mat-button (click)="applySuspend(row, false)" [disabled]="actingId() === row.id">Reactivate</button>
                  } @else {
                    <button mat-button color="warn" (click)="suspendId.set(row.id); suspendReason.set('')">Suspend</button>
                  }
                  <button mat-button (click)="uplineId.set(row.id); uplineUsername.set('')" [disabled]="actingId() === row.id">Change upline</button>
                  <button mat-button (click)="forceSignOut(row)" [disabled]="actingId() === row.id">Sign out</button>
                  <button mat-button (click)="resetOnBehalf(row)" [disabled]="actingId() === row.id">Reset password</button>
                  @if (eraseId() === row.id) {
                    <button mat-flat-button color="warn" (click)="erase(row)" [disabled]="actingId() === row.id">
                      {{ actingId() === row.id ? 'Erasing…' : 'Confirm erase?' }}
                    </button>
                    <button mat-button (click)="eraseId.set(null)">Cancel</button>
                  } @else {
                    <button mat-button color="warn" (click)="eraseId.set(row.id)">Erase</button>
                  }
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        </div>
        <div class="pager">
          <button mat-button (click)="page(-1)" [disabled]="skip() === 0 || loading()">Previous</button>
          <span class="muted">{{ total() }} partners</span>
          <button mat-button (click)="page(1)" [disabled]="skip() + limit() >= total() || loading()">Next</button>
        </div>
      } @else if (!loading() && !error()) {
        <async-state-panel
          kind="search"
          icon="group_off"
          title="No partners match those filters"
          message="We could not find a partner for this search."
          reason="The name may be misspelled, or the role, status or activity filter may hide the account."
          fix="Use a shorter name, check the spelling, or clear the filters."
        >
          <button mat-stroked-button type="button" (click)="clearFilters()">Clear filters</button>
        </async-state-panel>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .roles-page { display: flex; flex-direction: column; gap: 1.25em; }
    .notice { color: var(--ms-success); }
    .toolbar { display: flex; align-items: center; gap: 1em; flex-wrap: wrap; }
    .toolbar mat-form-field { flex: 1; min-width: 220px; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.6em; }
    .stat { display: flex; flex-direction: column; gap: 0.1em; padding: 0.7em 0.9em; }
    .stat-value { font-size: 1.4em; font-weight: 700; }
    .ranks-card { padding: 1em; display: flex; flex-direction: column; gap: 0.5em; }
    .ranks-card h3 { margin: 0; }
    .bar-list { display: flex; flex-direction: column; gap: 0.5em; margin-top: 0.25em; }
    .bar-row { display: grid; grid-template-columns: 160px 1fr 60px; gap: 0.6em; align-items: center; }
    .bar-label { font-size: 0.85em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bar-track { height: 14px; background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--ms-primary); min-width: 2px; }
    .bar-num { text-align: right; font-weight: 600; font-size: 0.9em; }
    @media only screen and (max-width: 600px) {
      .bar-row { grid-template-columns: 110px 1fr 48px; }
    }
    .table-wrap { overflow-x: auto; border-radius: 8px; }
    .table-wrap table { min-width: 1080px; }
    .presence-pulse { animation: presence-ping 1.8s ease-out infinite; }
    @keyframes presence-ping {
      0% { box-shadow: 0 0 0 0 rgba(46, 125, 50, 0.55); }
      70% { box-shadow: 0 0 0 7px rgba(46, 125, 50, 0); }
      100% { box-shadow: 0 0 0 0 rgba(46, 125, 50, 0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .presence-pulse { animation: none; }
    }
    table { width: 100%; }
    .table-wrap .mat-mdc-header-cell { color: var(--ms-text-muted); font-size: 0.8em; letter-spacing: 0.04em; }
    .table-wrap .mat-mdc-cell { vertical-align: middle; white-space: nowrap; }
    .name-cell .name-text { display: inline-flex; flex-direction: column; min-width: 0; vertical-align: middle; }
    .name-cell async-avatar { margin-right: 0.7em; vertical-align: middle; }
    .name-cell .name-text button {
      min-height: 44px;
      font-weight: 700;
      text-transform: capitalize;
      padding-left: 0;
      justify-content: flex-start;
    }
    .name-cell .handle { text-transform: none; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .features-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 0.2em; }
    .pager { display: flex; align-items: center; gap: 1em; }
  `],
})
export class ManageRolesComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly rows = signal<ManagedPartner[]>([]);
  protected readonly total = signal(0);
  protected readonly stats = signal<PlatformStats | null>(null);
  protected readonly limit = signal(25);
  protected readonly skip = signal(0);
  protected readonly query = signal('');
  protected readonly searchText = signal('');
  protected readonly roleFilter = signal('all');
  protected readonly statusFilter = signal('all');
  protected readonly loginFilter = signal('all');
  protected readonly actingId = signal<string | null>(null);
  protected readonly confirmId = signal<string | null>(null);
  protected readonly pendingRole = signal<UserRole>('leader');
  protected readonly suspendId = signal<string | null>(null);
  protected readonly suspendReason = signal('');
  protected readonly eraseId = signal<string | null>(null);
  protected readonly uplineId = signal<string | null>(null);
  protected readonly uplineUsername = signal('');

  protected readonly displayedColumns = ['name', 'contact', 'login', 'role', 'plan', 'action'];

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.reload();
    this.refreshStats();
  }

  protected refreshStats(): void {
    this.admin
      .stats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.stats.set(res.data ?? null),
        error: () => this.stats.set(null),
      });
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchText.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.query.set(value.trim());
      this.skip.set(0);
      this.reload();
    }, 300);
  }

  protected hasFilters(): boolean {
    return this.query().trim() !== '' || this.roleFilter() !== 'all' || this.statusFilter() !== 'all' || this.loginFilter() !== 'all';
  }

  protected clearFilters(): void {
    this.query.set('');
    this.searchText.set('');
    this.roleFilter.set('all');
    this.statusFilter.set('all');
    this.loginFilter.set('all');
    this.skip.set(0);
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.admin
      .directory({ q: this.query(), role: this.roleFilter(), suspended: this.statusFilter(), login: this.loginFilter(), limit: this.limit(), skip: this.skip() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.rows.set(res.data?.items ?? []);
          this.total.set(res.data?.total ?? 0);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  protected page(direction: 1 | -1): void {
    this.skip.set(Math.max(0, this.skip() + direction * this.limit()));
    this.reload();
  }

  protected meta(role: UserRole | string): { label: string; color: string; text: string } {
    const key = String(role ?? '').toLowerCase() === 'g8' ? 'leader' : String(role ?? '').toLowerCase();
    return ROLE_META[key as UserRole] ?? ROLE_META.user;
  }

  /** Plain-span role pill — mat-chip repaints internals from theme tokens. */
  protected roleClass(role: UserRole | string): string {
    const key = String(role ?? '').toLowerCase() === 'g8' ? 'leader' : String(role ?? '').toLowerCase();
    if (key === 'leader') return 'dp-status dp-status--info';
    if (key === 'admin') return 'dp-status dp-status--warn';
    return 'dp-status dp-status--neutral';
  }

  protected displayName(row: ManagedPartner): string {
    return `${row.name ?? ''} ${row.surname ?? ''}`.trim() || row.username;
  }

  /** Directory login cell: never-seen vs relative age from the telemetry. */
  protected loginLabel(row: ManagedPartner): string {
    const at = row.lastLoginAt ? new Date(row.lastLoginAt).getTime() : NaN;
    if (!Number.isFinite(at)) return 'never';
    const days = Math.floor((Date.now() - at) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }

  protected isDormant(row: ManagedPartner): boolean {
    const at = row.lastLoginAt ? new Date(row.lastLoginAt).getTime() : NaN;
    if (!Number.isFinite(at)) return true;
    return Date.now() - at >= 30 * 86400000;
  }

  /**
   * Presence from the heartbeat (`lastSeenAt`): online ≤5 min, recent ≤60.
   * Null when never seen with the app open — the login label carries it.
   */
  protected presenceOf(row: ManagedPartner): 'online' | 'recent' | null {
    const at = row.lastSeenAt ? new Date(row.lastSeenAt).getTime() : NaN;
    if (!Number.isFinite(at)) return null;
    const mins = (Date.now() - at) / 60000;
    if (mins <= 5) return 'online';
    if (mins <= 60) return 'recent';
    return null;
  }

  /** Row → 360 dialog; dialog actions drive the row's own handlers. */
  protected open360(row: ManagedPartner): void {
    this.dialog.open(Member360DialogComponent, {
      data: {
        partnerId: row.id,
        onAction: (kind: 'reset' | 'signout' | 'suspend') => {
          if (kind === 'reset') this.resetOnBehalf(row);
          else if (kind === 'signout') this.forceSignOut(row);
          else this.applySuspend(row, !row.suspended);
        },
      },
    });
  }

  /** Valid transitions from a role (same-role excluded). */
  protected transitions(role: UserRole): UserRole[] {
    return (['user', 'leader', 'admin'] as UserRole[]).filter((r) => r !== role);
  }

  protected arm(partnerId: string, role: UserRole): void {
    this.confirmId.set(partnerId);
    this.suspendId.set(null);
    this.pendingRole.set(role);
  }

  protected applyRole(row: ManagedPartner, role: UserRole): void {
    this.actingId.set(row.id);
    this.admin
      .setRole(row.id, role)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.actingId.set(null);
          this.confirmId.set(null);
          this.rows.set(this.rows().map((r) => (r.id === row.id ? res.data : r)));
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.confirmId.set(null);
          this.error.set(userError(err));
        },
      });
  }

  protected applySuspend(row: ManagedPartner, suspended: boolean): void {
    this.actingId.set(row.id);
    this.admin
      .setSuspended(row.id, suspended, this.suspendReason())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.actingId.set(null);
          this.suspendId.set(null);
          this.suspendReason.set('');
          this.rows.set(this.rows().map((r) => (r.id === row.id ? res.data : r)));
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.suspendId.set(null);
          this.error.set(userError(err));
        },
      });
  }

  protected forceSignOut(row: ManagedPartner): void {
    if (!window.confirm(`Revoke all live sessions for ${this.displayName(row)}? They sign in again with their password.`)) return;
    this.actingId.set(row.id);
    this.admin
      .forceSignOut(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.notice.set(`Sessions revoked for ${this.displayName(row)}.`);
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(userError(err));
        },
      });
  }

  protected resetOnBehalf(row: ManagedPartner): void {
    if (!window.confirm(`Send a password-reset link to ${row.email}? You will not see their password.`)) return;
    this.actingId.set(row.id);
    this.admin
      .resetOnBehalf(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.actingId.set(null);
          this.notice.set(res.message ?? 'Reset link sent to the member email.');
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(userError(err));
        },
      });
  }

  protected applyUpline(row: ManagedPartner): void {
    const username = this.uplineUsername().trim().replace(/^@/, '');
    if (!username) {
      this.error.set('Enter a new upline @username');
      return;
    }
    if (!window.confirm(`Move ${this.displayName(row)} (@${row.username}) under @${username}? This rewires their team and commissions.`)) return;
    this.actingId.set(row.id);
    this.admin
      .reassignUpline(row.id, username)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.actingId.set(null);
          this.uplineId.set(null);
          this.uplineUsername.set('');
          this.notice.set(res.message ?? `Upline moved to @${username}.`);
          this.reload();
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(userError(err));
        },
      });
  }

  protected erase(row: ManagedPartner): void {
    if (!window.confirm(
      `PERMANENTLY erase ${this.displayName(row)} (${row.email})?\n\nProfile is anonymized, their prospects, tickets and codes are deleted. Ledger, orders and posts are kept for records. Direct downline moves up to their upline automatically.`,
    )) return;
    this.actingId.set(row.id);
    this.admin
      .erase(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.actingId.set(null);
          this.eraseId.set(null);
          const removed = res.data?.removed;
          const bits = removed ? Object.entries(removed).map(([k, v]) => `${v} ${k}`).join(', ') : '';
          this.notice.set(`Account erased.${bits ? ` Removed: ${bits}.` : ''} Ledger, orders and posts retained.`);
          this.reload();
          this.refreshStats();
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.eraseId.set(null);
          const msg = userError(err);
          this.error.set(msg);
          // Downline guard: turn the dead-end 409 into the inline
          // "Change upline" editor instead of sending the admin to a
          // route that does not exist in the standalone admin app.
          const downline = /reassign (\d+) downline/i.exec(`${err.message ?? ''} ${msg}`);
          if (err.status === 409 && downline) {
            const n = downline[1];
            this.error.set(
              `${msg} Reassign the ${n} downline member${n === '1' ? '' : 's'} first using “Change upline” on this row.`,
            );
            this.uplineId.set(row.id);
            this.uplineUsername.set('');
          }
        },
      });
  }
}
