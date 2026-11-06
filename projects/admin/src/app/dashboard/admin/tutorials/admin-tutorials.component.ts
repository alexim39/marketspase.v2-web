import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { Tutorial, TutorialArea, TutorialService } from '../../../core/tutorials/tutorial.service';
import { ApiError } from '../../../core/http/api-error';

const AREAS: TutorialArea[] = ['Start', 'Prospects', 'Sessions', 'Wallet', 'Team', 'Grow'];

/**
 * @title Platform tutorials — paste-a-link admin desk.
 *
 * Paste any YouTube URL — the server verifies it and stores the video id,
 * so members get a working embed the moment you save. OnPush + signals.
 */
@Component({
  selector: 'async-admin-tutorials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule, MatIconModule, MatInputModule, MatProgressBarModule,
    MatSelectModule, MatTableModule, ReactiveFormsModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>Admin</span> &gt;
        <span>Tutorials</span>
      </div>
    </section>

    <section class="queue-page">
      <div class="page-head">
        <div>
          <h2>Platform tutorials</h2>
          <p class="subtitle">Paste a YouTube link, pick the app area, save — members see it instantly.</p>
        </div>
        <button mat-button (click)="showForm.set(!showForm())">{{ showForm() ? 'Cancel' : 'New tutorial' }}</button>
      </div>

      @if (showForm()) {
        <form class="dp-card tutorial-form" [formGroup]="form" (ngSubmit)="save()">
          <mat-form-field appearance="outline">
            <mat-label>YouTube link</mat-label>
            <input matInput formControlName="url" placeholder="https://www.youtube.com/watch?v=…" />
            <mat-hint>Paste watch, youtu.be, shorts or embed links — verified on save.</mat-hint>
            @if (form.get('url')?.hasError('required') && form.get('url')?.touched) {
              <mat-error>A YouTube link is required</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Title</mat-label>
            <input matInput formControlName="title" maxlength="120" placeholder="e.g. How to claim your bonus" />
            @if (form.get('title')?.hasError('required') && form.get('title')?.touched) {
              <mat-error>Give the video a title</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Description (optional)</mat-label>
            <input matInput formControlName="description" maxlength="500" placeholder="What the member will learn" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>App area</mat-label>
            <mat-select formControlName="area">
              @for (area of areas; track area) {
                <mat-option [value]="area">{{ area }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <div class="form-actions">
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
              {{ saving() ? 'Verifying…' : editingId() ? 'Save changes' : 'Add tutorial' }}
            </button>
            @if (editingId()) {
              <button mat-button type="button" (click)="cancelEdit()" [disabled]="saving()">Cancel</button>
            }
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
            <ng-container matColumnDef="video">
              <th mat-header-cell *matHeaderCellDef>Video</th>
              <td mat-cell *matCellDef="let row">
                <div class="video-cell">
                  <img [src]="thumb(row.youtubeId)" [alt]="row.title" loading="lazy" />
                  <span>
                    <strong>{{ row.title }}</strong>
                    <span class="muted">{{ row.area }} · order {{ row.order }}</span>
                  </span>
                </div>
              </td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                <span class="dp-status {{ row.active ? 'dp-status--ok' : 'dp-status--neutral' }}">{{ row.active ? 'Live' : 'Hidden' }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef>Action</th>
              <td mat-cell *matCellDef="let row">
                <button mat-button (click)="startEdit(row)" [disabled]="actingId() === row.id">Edit</button>
                <button mat-button (click)="toggle(row)" [disabled]="actingId() === row.id">
                  {{ row.active ? 'Hide' : 'Show' }}
                </button>
                @if (confirmId() === row.id) {
                  <button mat-button color="warn" (click)="remove(row)" [disabled]="actingId() === row.id">Confirm delete</button>
                  <button mat-button (click)="confirmId.set(null)">Keep</button>
                } @else {
                  <button mat-button color="warn" (click)="confirmId.set(row.id)">Delete</button>
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>
        </div>
      } @else if (!loading() && !error()) {
        <p class="empty">No tutorials yet — paste your first YouTube link above.</p>
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
    .tutorial-form { padding: 1em; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75em; }
    .form-actions { display: flex; align-items: center; gap: 0.75em; grid-column: 1 / -1; flex-wrap: wrap; }
    .form-actions button { min-height: 44px; }
    .table-wrap { overflow-x: auto; border-radius: 8px; }
    table { width: 100%; }
    .video-cell { display: flex; gap: 0.7em; align-items: center; }
    .video-cell img { width: 96px; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 8px; flex: none; }
    .video-cell span { display: flex; flex-direction: column; min-width: 0; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); }
    .notice { color: var(--ms-success); }
    .empty { color: var(--ms-text-muted); }
  `],
})
export class AdminTutorialsComponent implements OnInit {
  private readonly tutorials = inject(TutorialService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly actingId = signal<string | null>(null);
  protected readonly confirmId = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly showForm = signal(false);
  protected readonly rows = signal<Tutorial[]>([]);

  protected readonly areas = AREAS;
  protected readonly displayedColumns = ['video', 'status', 'action'];

  protected readonly form = this.fb.nonNullable.group({
    url: ['', [Validators.required, Validators.minLength(5)]],
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    description: ['', Validators.maxLength(500)],
    area: ['Start' as TutorialArea, Validators.required],
  });

  ngOnInit(): void {
    this.reload();
  }

  protected thumb(id: string): string {
    return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.tutorials
      .adminList()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: { data?: { items?: Tutorial[] } }) => {
          this.rows.set(res.data?.items ?? []);
          this.loading.set(false);
        },
        error: (err: { message: string }) => {
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
    const editing = this.editingId();
    const request = editing
      ? this.tutorials.update(editing, {
          ...(v.url.trim() ? { url: v.url.trim() } : {}),
          title: v.title.trim(),
          description: v.description.trim(),
          area: v.area,
        })
      : this.tutorials.create({
          url: v.url.trim(),
          title: v.title.trim(),
          description: v.description.trim(),
          area: v.area,
        });
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.editingId.set(null);
        this.form.reset({ url: '', title: '', description: '', area: 'Start' });
        this.notice.set(editing ? 'Tutorial updated — members see it now.' : 'Tutorial added — members see it now.');
        this.reload();
      },
      error: (err: { message: string }) => {
        this.saving.set(false);
        this.formError.set(err.message);
      },
    });
  }

  protected startEdit(row: Tutorial): void {
    this.editingId.set(row.id);
    this.form.reset({ url: '', title: row.title, description: row.description ?? '', area: row.area });
    // URL refill is deliberate blank: paste the new link only when changing video.
    this.form.get('url')?.clearValidators();
    this.form.get('url')?.updateValueAndValidity();
    this.showForm.set(true);
    this.notice.set(null);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset({ url: '', title: '', description: '', area: 'Start' });
    this.form.get('url')?.setValidators([Validators.required, Validators.minLength(5)]);
    this.showForm.set(false);
  }

  protected toggle(row: Tutorial): void {
    if (this.actingId()) return;
    this.actingId.set(row.id);
    this.notice.set(null);
    this.error.set(null);
    this.tutorials
      .update(row.id, { active: !row.active })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.notice.set(row.active ? 'Tutorial hidden from members.' : 'Tutorial live for members.');
          this.reload();
        },
        error: (err: { message: string }) => {
          this.actingId.set(null);
          this.error.set(err.message);
        },
      });
  }

  protected remove(row: Tutorial): void {
    if (this.actingId()) return;
    this.actingId.set(row.id);
    this.tutorials
      .remove(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.confirmId.set(null);
          this.notice.set('Tutorial deleted.');
          this.reload();
        },
        error: (err: { message: string }) => {
          this.actingId.set(null);
          this.error.set(err.message);
        },
      });
  }
}
