import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { Kit, KitArea, KitSlide, KitService, KitStats } from '../../../core/kits/kit.service';
import { userError } from '../../../core/http/api-error';

const AREAS: KitArea[] = ['Opportunity', 'Product', 'Invite', 'Team'];
const blankSlide = (): KitSlide => ({ title: '', body: '', imageUrl: '', note: '' });

/**
 * @title Presentation kits — deck admin desk.
 *
 * Table of decks (activate/deactivate/delete) plus an inline editor with a
 * slide list (add/remove/reorder-lite). Slides validate server-side; the
 * desk surfaces those messages inline. OnPush + signals.
 */
@Component({
  selector: 'async-admin-kits',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressBarModule, MatSelectModule, MatSlideToggleModule, MatSnackBarModule,
    MatTableModule, MatTooltipModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Admin</a> &gt;
        <span>Presentations</span>
      </div>
    </section>

    <section class="kits-page">
      <div class="page-head">
        <div>
          <h2>Presentation kits</h2>
          <p class="subtitle">One canonical deck per selling moment — partners present from these, never from stray PDFs.</p>
        </div>
        <button mat-flat-button color="primary" (click)="startCreate()"><mat-icon>add</mat-icon>New deck</button>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (editing()) {
        <div class="dp-card editor" aria-label="Deck editor">
          <h3>{{ editingId() ? 'Edit deck' : 'New deck' }}</h3>
          <div class="grid">
            <mat-form-field appearance="outline">
              <mat-label>Title</mat-label>
              <input matInput [ngModel]="draft().title" (ngModelChange)="patch({ title: $event })" maxlength="120" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Area</mat-label>
              <mat-select [value]="draft().area" (selectionChange)="patch({ area: $event.value })">
                @for (a of areas; track a) {
                  <mat-option [value]="a">{{ a }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline" class="full">
            <mat-label>Description</mat-label>
            <textarea matInput rows="2" maxlength="500" [ngModel]="draft().description" (ngModelChange)="patch({ description: $event })"></textarea>
          </mat-form-field>
          <div class="grid">
            <mat-form-field appearance="outline">
              <mat-label>Minutes</mat-label>
              <input matInput type="number" min="1" max="120" [ngModel]="draft().durationMin" (ngModelChange)="patch({ durationMin: +$event || 10 })" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Order</mat-label>
              <input matInput type="number" min="0" max="10000" [ngModel]="draft().order" (ngModelChange)="patch({ order: +$event || 0 })" />
            </mat-form-field>
          </div>
          <mat-slide-toggle [checked]="draft().active" (change)="patch({ active: $event.checked })">Active</mat-slide-toggle>

          <mat-form-field appearance="outline">
            <mat-label>Deck source</mat-label>
            <mat-select [value]="draft().source" (selectionChange)="patch({ source: $event.value })">
              <mat-option value="manual">Hand-built slides</mat-option>
              <mat-option value="file">PDF upload</mat-option>
            </mat-select>
          </mat-form-field>

          @if (draft().source === 'file') {
            <div class="dp-card upload-card">
              <p class="muted">In PowerPoint: File → Export → Create PDF, then upload the PDF here (max 25MB).</p>
              @if (draft().fileUrl) {
                <p class="linked"><mat-icon>check_circle</mat-icon>PDF linked — partners will present from it.</p>
                <div class="actions">
                  <button mat-stroked-button (click)="fileInput.click()" [disabled]="uploading()">Replace PDF</button>
                  <button mat-button (click)="clearFile()">Remove</button>
                </div>
              } @else {
                <button mat-stroked-button (click)="fileInput.click()" [disabled]="uploading()">
                  <mat-icon>upload</mat-icon>{{ uploading() ? 'Uploading…' : 'Upload PDF' }}
                </button>
              }
              <input #fileInput type="file" accept="application/pdf,.pdf" hidden (change)="onDeckFile($event)" />
            </div>
          } @else {
          <h4>Slides ({{ draft().slides.length }})</h4>
          @for (s of draft().slides; track $index) {
            <div class="dp-card slide">
              <div class="slide-head">
                <strong>Slide {{ $index + 1 }}</strong>
                <span class="spacer"></span>
                <button mat-icon-button (click)="moveSlide($index, -1)" [disabled]="$index === 0" aria-label="Move up"><mat-icon>arrow_upward</mat-icon></button>
                <button mat-icon-button (click)="moveSlide($index, 1)" [disabled]="$index === draft().slides.length - 1" aria-label="Move down"><mat-icon>arrow_downward</mat-icon></button>
                <button mat-icon-button color="warn" (click)="removeSlide($index)" aria-label="Remove slide"><mat-icon>delete</mat-icon></button>
              </div>
              <mat-form-field appearance="outline" class="full">
                <mat-label>Headline</mat-label>
                <input matInput maxlength="120" [ngModel]="s.title" (ngModelChange)="patchSlide($index, { title: $event })" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="full">
                <mat-label>Body</mat-label>
                <textarea matInput rows="3" maxlength="2000" [ngModel]="s.body" (ngModelChange)="patchSlide($index, { body: $event })"></textarea>
              </mat-form-field>
              <div class="grid">
                <mat-form-field appearance="outline">
                  <mat-label>Image URL (optional)</mat-label>
                  <input matInput maxlength="500" [ngModel]="s.imageUrl" (ngModelChange)="patchSlide($index, { imageUrl: $event })" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Presenter note (optional)</mat-label>
                  <input matInput maxlength="1000" [ngModel]="s.note" (ngModelChange)="patchSlide($index, { note: $event })" />
                </mat-form-field>
              </div>
            </div>
          }
          }
          <div class="actions">
            @if (draft().source === 'manual') {
              <button mat-stroked-button (click)="addSlide()"><mat-icon>add</mat-icon>Add slide</button>
            }
            <span class="spacer"></span>
            <button mat-button (click)="cancelEdit()">Cancel</button>
            <button mat-flat-button color="primary" (click)="save()" [disabled]="saving() || !canSave()">
              {{ saving() ? 'Saving…' : (editingId() ? 'Save deck' : 'Create deck') }}
            </button>
          </div>
        </div>
      }

      @if (rows().length > 0) {
        <div class="table-wrap">
          <table mat-table [dataSource]="rows()" class="mat-elevation-z2">
            <ng-container matColumnDef="title">
              <th mat-header-cell *matHeaderCellDef>Deck</th>
              <td mat-cell *matCellDef="let row" class="name-cell">
                {{ row.title }}
                @if (row.source === 'file') {
                  <span class="muted">PDF deck · ~{{ row.durationMin }} min</span>
                } @else {
                  <span class="muted">{{ row.slideCount }} slides · ~{{ row.durationMin }} min</span>
                }
                @if (statFor(row.id); as stat) {
                  <span class="muted stat-line">{{ stat }} (all partners)</span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="area">
              <th mat-header-cell *matHeaderCellDef>Area</th>
              <td mat-cell *matCellDef="let row">{{ row.area }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                <span class="dp-status {{ row.active ? 'dp-status--ok' : 'dp-status--neutral' }}">{{ row.active ? 'Active' : 'Hidden' }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef>Action</th>
              <td mat-cell *matCellDef="let row">
                <button mat-button (click)="startEdit(row)">Edit</button>
                <button mat-button (click)="toggleActive(row)" [disabled]="actingId() === row.id">
                  {{ row.active ? 'Hide' : 'Show' }}
                </button>
                @if (deletingId() === row.id) {
                  <button mat-flat-button color="warn" (click)="remove(row)" [disabled]="actingId() === row.id">
                    {{ actingId() === row.id ? 'Deleting…' : 'Confirm?' }}
                  </button>
                  <button mat-button (click)="deletingId.set(null)">Cancel</button>
                } @else {
                  <button mat-button color="warn" (click)="deletingId.set(row.id)">Delete</button>
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>
        </div>
      } @else if (!loading() && !error()) {
        <p class="empty">No decks yet — create the Opportunity story first.</p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .kits-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 46em; }
    .editor { padding: 1.1em; display: flex; flex-direction: column; gap: 0.8em; }
    .editor h3, .editor h4 { margin: 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8em; }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
    .full { width: 100%; }
    .slide { padding: 0.9em; display: flex; flex-direction: column; gap: 0.7em; background: var(--ms-canvas); }
    .slide-head { display: flex; align-items: center; gap: 0.3em; }
    .upload-card { padding: 0.9em; display: flex; flex-direction: column; gap: 0.6em; background: var(--ms-canvas); }
    .upload-card p { margin: 0; }
    .linked { display: flex; align-items: center; gap: 0.4em; color: var(--ms-success); font-weight: 600; }
    .spacer { flex: 1; }
    .actions { display: flex; gap: 0.6em; align-items: center; flex-wrap: wrap; }
    .actions button { min-height: 44px; }
    .table-wrap { overflow-x: auto; border-radius: 8px; }
    table { width: 100%; }
    .name-cell { font-weight: 600; }
    .name-cell .muted { display: block; font-weight: 400; }
    .stat-line { color: var(--ms-primary-strong); }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .empty { color: var(--ms-text-muted); }
    button { min-height: 44px; }
  `],
})
export class AdminKitsComponent implements OnInit {
  private readonly kits = inject(KitService);
  private readonly snack = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly areas = AREAS;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<Kit[]>([]);
  protected readonly stats = signal<KitStats | null>(null);
  protected readonly actingId = signal<string | null>(null);
  protected readonly deletingId = signal<string | null>(null);
  protected readonly editing = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly draft = signal<{ title: string; description: string; area: KitArea; source: 'manual' | 'file'; fileUrl: string; slides: KitSlide[]; durationMin: number; order: number; active: boolean }>({
    title: '', description: '', area: 'Opportunity', source: 'manual', fileUrl: '', slides: [], durationMin: 10, order: 0, active: true,
  });

  protected readonly displayedColumns = ['title', 'area', 'status', 'action'];

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.kits
      .adminList()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.rows.set(res.data?.items ?? []);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(userError(err) || 'Could not load decks.');
          this.loading.set(false);
        },
      });
    // Platform stats ride separately and fail soft.
    this.kits
      .adminStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.stats.set(res.data ?? null),
        error: () => undefined,
      });
  }

  protected statFor(kitId: string): string | null {
    const row = this.stats()?.byKit?.[kitId];
    if (!row || row.presented === 0) return null;
    const bits = [`${row.presented} presented`];
    if (row.booked > 0) bits.push(`${row.booked} booked`);
    if (row.converted > 0) bits.push(`${row.converted} converted`);
    return bits.join(' · ');
  }

  protected startCreate(): void {
    this.editingId.set(null);
    this.draft.set({ title: '', description: '', area: 'Opportunity', source: 'manual', fileUrl: '', slides: [blankSlide()], durationMin: 10, order: 0, active: true });
    this.editing.set(true);
  }

  protected startEdit(row: Kit): void {
    this.editingId.set(row.id);
    const source = row.source === 'file' ? 'file' as const : 'manual' as const;
    this.draft.set({
      title: row.title, description: row.description ?? '', area: row.area, source,
      fileUrl: row.fileUrl ?? '',
      slides: source === 'file' ? [] : row.slides.map((s) => ({ ...s })), durationMin: row.durationMin,
      order: row.order, active: row.active,
    });
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
    this.editingId.set(null);
  }

  protected patch(part: Partial<{ title: string; description: string; area: KitArea; source: 'manual' | 'file'; fileUrl: string; durationMin: number; order: number; active: boolean }>): void {
    this.draft.update((d) => {
      const next = { ...d, ...part };
      // Switching kinds resets the other side so a deck is never both.
      if (part.source === 'file') {
        next.slides = [];
        if (next.fileUrl === undefined) next.fileUrl = '';
      }
      if (part.source === 'manual' && next.slides.length === 0) {
        next.slides = [blankSlide()];
        next.fileUrl = '';
      }
      return next;
    });
  }

  protected addSlide(): void {
    this.draft.update((d) => ({ ...d, slides: [...d.slides, blankSlide()] }));
  }

  protected removeSlide(i: number): void {
    this.draft.update((d) => ({ ...d, slides: d.slides.filter((_, j) => j !== i) }));
  }

  protected moveSlide(i: number, dir: -1 | 1): void {
    this.draft.update((d) => {
      const slides = [...d.slides];
      const j = i + dir;
      if (j < 0 || j >= slides.length) return d;
      [slides[i], slides[j]] = [slides[j], slides[i]];
      return { ...d, slides };
    });
  }

  protected patchSlide(i: number, part: Partial<KitSlide>): void {
    this.draft.update((d) => ({
      ...d,
      slides: d.slides.map((s, j) => (j === i ? { ...s, ...part } : s)),
    }));
  }

  protected canSave(): boolean {
    const d = this.draft();
    if (d.title.trim().length < 3) return false;
    if (d.source === 'file') return /^https?:\/\//i.test(d.fileUrl.trim());
    return d.slides.length > 0
      && d.slides.every((s) => s.title.trim() && s.body.trim());
  }

  protected onDeckFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      this.snack.open('Only PDF decks — in PowerPoint: File → Export → Create PDF.', 'Close', { duration: 5000 });
      return;
    }
    this.uploading.set(true);
    this.kits.uploadDeck(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.uploading.set(false);
          const url = res.data?.fileUrl ?? '';
          if (!url) {
            this.snack.open('Upload returned no URL — try again.', 'Close', { duration: 4000 });
            return;
          }
          this.patch({ fileUrl: url });
          this.snack.open('Deck PDF uploaded.', 'Close', { duration: 3000 });
        },
        error: (err: unknown) => {
          this.uploading.set(false);
          this.snack.open(userError(err) || 'Upload failed — try again.', 'Close', { duration: 4000 });
        },
      });
  }

  protected clearFile(): void {
    this.patch({ fileUrl: '' });
  }

  protected save(): void {
    if (this.saving() || !this.canSave()) return;
    const d = this.draft();
    const payload: {
      title: string; description: string; area: KitArea; source: 'manual' | 'file';
      slides?: Array<{ title: string; body: string; imageUrl?: string; note?: string }>;
      fileUrl?: string; durationMin: number; order: number; active: boolean;
    } = {
      title: d.title.trim(),
      description: d.description.trim(),
      area: d.area,
      source: d.source,
      durationMin: d.durationMin,
      order: d.order,
      active: d.active,
    };
    if (d.source === 'file') {
      payload.fileUrl = d.fileUrl.trim();
    } else {
      payload.slides = d.slides.map((s) => ({
        title: s.title.trim(),
        body: s.body.trim(),
        ...(s.imageUrl?.trim() ? { imageUrl: s.imageUrl.trim() } : {}),
        ...(s.note?.trim() ? { note: s.note.trim() } : {}),
      }));
    }
    this.saving.set(true);
    const id = this.editingId();
    const call = id ? this.kits.update(id, payload) : this.kits.create(payload);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.cancelEdit();
        this.snack.open(id ? 'Deck updated.' : 'Deck created.', 'Close', { duration: 3500 });
        this.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snack.open(userError(err) || 'Save failed — try again.', 'Close', { duration: 4000 });
      },
    });
  }

  protected toggleActive(row: Kit): void {
    if (this.actingId()) return;
    this.actingId.set(row.id);
    this.kits.update(row.id, { active: !row.active })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.snack.open(row.active ? 'Deck hidden from partners.' : 'Deck visible to partners.', 'Close', { duration: 3500 });
          this.reload();
        },
        error: (err: unknown) => {
          this.actingId.set(null);
          this.snack.open(userError(err) || 'Update failed.', 'Close', { duration: 4000 });
        },
      });
  }

  protected remove(row: Kit): void {
    if (this.actingId()) return;
    this.actingId.set(row.id);
    this.kits.remove(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.deletingId.set(null);
          this.snack.open(`Deck "${row.title}" deleted.`, 'Close', { duration: 3500 });
          this.reload();
        },
        error: (err: unknown) => {
          this.actingId.set(null);
          this.deletingId.set(null);
          this.snack.open(userError(err) || 'Delete failed.', 'Close', { duration: 4000 });
        },
      });
  }
}
