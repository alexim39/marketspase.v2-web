import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { BonusCampaign, BonusCampaignPayload, BonusService } from '../../../core/bonuses/bonus.service';
import { UiFeedbackService } from '../../../core/ui/ui-feedback.service';
import { ApiError } from '../../../core/http/api-error';

type CampaignRow = BonusCampaign & { claims: number };
type CampaignStatus = 'active' | 'disabled';

/**
 * @title Bonus campaigns — admin desk.
 *
 * Configurable wallet bonuses: create, edit every field, enable/disable and
 * delete. Members claim once per campaign from the dashboard banner; credits
 * land via the shared wallet core and are audited. OnPush + signals, typed.
 */
@Component({
  selector: 'async-admin-bonuses',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, DatePipe, FormsModule, ReactiveFormsModule, MatButtonModule, MatIconModule,
    MatInputModule, MatProgressBarModule, MatSelectModule, MatTableModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>Admin</span> &gt;
        <span>Bonuses</span>
      </div>
    </section>

    <section class="queue-page">
      <div class="page-head">
        <div>
          <h2>Bonus campaigns</h2>
          <p class="subtitle">Welcome bonuses members claim into their wallets — one claim per member per campaign.</p>
        </div>
        <button mat-button (click)="toggleForm()">{{ formOpen() ? 'Cancel' : 'New campaign' }}</button>
      </div>

      @if (formOpen()) {
        <form class="dp-card bonus-form" [formGroup]="form" (ngSubmit)="save()">
          <div class="form-head">
            <strong>{{ editingId() ? 'Edit campaign' : 'New campaign' }}</strong>
            <span class="muted">
              {{ editingId()
                ? 'Changes apply to future claims; existing claims keep the amount they were paid.'
                : 'Create a wallet bonus members can claim once.' }}
            </span>
          </div>
          <mat-form-field appearance="outline">
            <mat-label>Title</mat-label>
            <input matInput formControlName="title" maxlength="120" placeholder="e.g. Welcome bonus" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Banner message</mat-label>
            <input matInput formControlName="message" maxlength="500" placeholder="What members see on the banner" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Amount (₦)</mat-label>
            <input matInput type="number" min="1" max="1000000" formControlName="amountNgn" />
          </mat-form-field>
          @if (editingId()) {
            <mat-form-field appearance="outline">
              <mat-label>Status</mat-label>
              <mat-select formControlName="status">
                <mat-option value="active">Active</mat-option>
                <mat-option value="disabled">Disabled</mat-option>
              </mat-select>
            </mat-form-field>
          }
          <mat-form-field appearance="outline">
            <mat-label>Starts</mat-label>
            <input matInput type="date" formControlName="startsAt" />
            <mat-hint>Leave blank to start immediately.</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Ends</mat-label>
            <input matInput type="date" formControlName="endsAt" />
            <mat-hint>Leave blank for no end date.</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Eligible after</mat-label>
            <input matInput type="date" formControlName="eligibleAfter" />
            <mat-hint>Optional: only members who joined after this date qualify.</mat-hint>
          </mat-form-field>
          <div class="form-actions">
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
              {{ saving() ? 'Saving…' : (editingId() ? 'Save changes' : 'Create campaign') }}
            </button>
            <button mat-button type="button" (click)="cancelEdit()" [disabled]="saving()">Cancel</button>
            @if (formError(); as err) {
              <span class="error" role="alert">{{ err }}</span>
            }
          </div>
        </form>
      }

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (notice(); as note) {
        <p class="notice" role="status">{{ note }}</p>
      }

      @if (rows().length > 0) {
        <div class="table-wrap">
          <table mat-table [dataSource]="rows()" class="mat-elevation-z2">
            <ng-container matColumnDef="title">
              <th mat-header-cell *matHeaderCellDef>Campaign</th>
              <td mat-cell *matCellDef="let row">
                <strong>{{ row.title }}</strong>
                <div class="muted">{{ row.message || '—' }}</div>
                @if (row.startsAt || row.endsAt) {
                  <div class="muted window">
                    {{ row.startsAt ? (row.startsAt | date: 'mediumDate') : 'Now' }}
                    →
                    {{ row.endsAt ? (row.endsAt | date: 'mediumDate') : 'No end' }}
                  </div>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef>Amount</th>
              <td mat-cell *matCellDef="let row">₦{{ row.amountNgn | number }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                <span class="dp-status {{ row.status === 'active' ? 'dp-status--ok' : 'dp-status--neutral' }}">{{ row.status }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="claims">
              <th mat-header-cell *matHeaderCellDef>Claims</th>
              <td mat-cell *matCellDef="let row">{{ row.claims | number }}</td>
            </ng-container>
            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef>Action</th>
              <td mat-cell *matCellDef="let row">
                <button mat-button (click)="startEdit(row)" [disabled]="actingId() === row.id">Edit</button>
                <button mat-button (click)="toggle(row)" [disabled]="actingId() === row.id">
                  {{ row.status === 'active' ? 'Disable' : 'Enable' }}
                </button>
                <button mat-button color="warn" (click)="remove(row)" [disabled]="actingId() === row.id">
                  {{ actingId() === row.id ? 'Working…' : 'Delete' }}
                </button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>
        </div>
      } @else if (!loading() && !error()) {
        <p class="empty">No campaigns yet — create the first one above.</p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .queue-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 52em; }
    .bonus-form { padding: 1em; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75em; }
    .form-head { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 0.2em; }
    .form-head strong { font-size: 1.02rem; }
    .form-actions { display: flex; align-items: center; gap: 0.75em; grid-column: 1 / -1; flex-wrap: wrap; }
    .form-actions button { min-height: 44px; }
    .table-wrap { overflow-x: auto; border-radius: 8px; }
    table { width: 100%; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .window { margin-top: 0.2em; }
    .error { color: var(--ms-error); }
    .notice { color: var(--ms-success); }
    .empty { color: var(--ms-text-muted); }
  `],
})
export class AdminBonusesComponent implements OnInit {
  private readonly bonuses = inject(BonusService);
  private readonly ui = inject(UiFeedbackService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly actingId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly showForm = signal(false);
  protected readonly rows = signal<CampaignRow[]>([]);
  protected readonly editingId = signal<string | null>(null);

  protected readonly displayedColumns = ['title', 'amount', 'status', 'claims', 'action'];

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    message: ['', Validators.maxLength(500)],
    amountNgn: [2500, [Validators.required, Validators.min(1), Validators.max(1000000)]],
    status: ['active' as CampaignStatus, Validators.required],
    startsAt: [''],
    endsAt: [''],
    eligibleAfter: [''],
  });

  ngOnInit(): void {
    this.reload();
  }

  protected formOpen(): boolean {
    return this.showForm() || this.editingId() !== null;
  }

  protected toggleForm(): void {
    if (this.formOpen()) {
      this.cancelEdit();
      return;
    }
    this.showForm.set(true);
    this.resetForm();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.bonuses
      .campaigns()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: { data: { items: CampaignRow[] } }) => {
          this.rows.set(res.data?.items ?? []);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.formError.set(null);
    this.notice.set(null);
    const v = this.form.getRawValue();
    const common = {
      title: v.title.trim(),
      message: v.message.trim(),
      amountNgn: Number(v.amountNgn),
    };
    const editing = this.editingId();
    const request = editing
      ? this.bonuses.updateCampaign(editing, {
          ...common,
          status: v.status,
          startsAt: v.startsAt || null,
          endsAt: v.endsAt || null,
          eligibleAfter: v.eligibleAfter || null,
        } satisfies Partial<BonusCampaignPayload>)
      : this.bonuses.createCampaign({
          ...common,
          ...(v.startsAt ? { startsAt: v.startsAt } : {}),
          ...(v.endsAt ? { endsAt: v.endsAt } : {}),
          ...(v.eligibleAfter ? { eligibleAfter: v.eligibleAfter } : {}),
        } satisfies BonusCampaignPayload);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        const wasEditing = !!editing;
        this.saving.set(false);
        this.cancelEdit();
        this.notice.set(wasEditing ? 'Campaign updated — future claims use the new details.' : 'Campaign created and live for eligible members.');
        this.reload();
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        this.formError.set(err.message);
      },
    });
  }

  protected startEdit(row: CampaignRow): void {
    this.editingId.set(row.id);
    this.showForm.set(true);
    this.form.patchValue({
      title: row.title,
      message: row.message ?? '',
      amountNgn: row.amountNgn,
      status: row.status === 'disabled' ? 'disabled' : 'active',
      startsAt: this.dateInput(row.startsAt),
      endsAt: this.dateInput(row.endsAt),
      eligibleAfter: this.dateInput(row.eligibleAfter),
    });
    this.notice.set(null);
    this.error.set(null);
    this.formError.set(null);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.showForm.set(false);
    this.resetForm();
  }

  protected async remove(row: CampaignRow): Promise<void> {
    if (this.actingId()) return;
    const ok = await this.ui.confirm({
      title: 'Delete bonus campaign?',
      message: `"${row.title}" will be removed. ${row.claims > 0
        ? `${row.claims} existing claim${row.claims === 1 ? '' : 's'} stay in wallet history.`
        : 'This campaign has no claims.'}`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'error',
      icon: 'delete',
    });
    if (!ok) return;

    this.actingId.set(row.id);
    this.notice.set(null);
    this.error.set(null);
    this.bonuses.deleteCampaign(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.actingId.set(null);
        if (this.editingId() === row.id) this.cancelEdit();
        this.notice.set(`"${row.title}" deleted.`);
        this.reload();
      },
      error: (err: ApiError) => {
        this.actingId.set(null);
        this.error.set(err.message);
      },
    });
  }

  protected toggle(row: CampaignRow): void {
    if (this.actingId()) return;
    this.actingId.set(row.id);
    this.notice.set(null);
    this.error.set(null);
    this.bonuses
      .updateCampaign(row.id, { status: row.status === 'active' ? 'disabled' : 'active' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.notice.set(row.status === 'active' ? 'Campaign disabled — banners hidden.' : 'Campaign enabled.');
          this.reload();
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(err.message);
        },
      });
  }

  private resetForm(): void {
    this.form.reset({
      title: '',
      message: '',
      amountNgn: 2500,
      status: 'active',
      startsAt: '',
      endsAt: '',
      eligibleAfter: '',
    });
    this.formError.set(null);
  }

  private dateInput(value?: string | null): string {
    const raw = String(value ?? '').trim();
    return raw ? raw.slice(0, 10) : '';
  }
}
