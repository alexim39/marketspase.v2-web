import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { environment } from '../../../../environments/environment';
import { AdminStoreService } from '../../../core/store-admin/admin-store.service';
import { AdminStoreSummary } from '../../../core/store-admin/admin-store.models';
import { ApiError, userError } from '../../../core/http/api-error';
import { UiFeedbackService } from '../../../core/ui/ui-feedback.service';
import { EmptyStateComponent } from '@marketspase/shared/ui/empty-state/empty-state.component';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'async-admin-stores',
  templateUrl: './admin-stores.component.html',
  styleUrls: ['./admin-stores.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    EmptyStateComponent,
    PageSkeletonComponent,
    RouterModule,
  ],
})
export class AdminStoresComponent implements OnInit {
  private readonly storeApi = inject(AdminStoreService);
  private readonly ui = inject(UiFeedbackService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly stores = signal<AdminStoreSummary[]>([]);
  protected readonly busyId = signal<string | null>(null);
  protected readonly status = signal<'all' | 'published' | 'draft' | 'suspended'>('all');
  protected query = '';
  protected readonly storeUrl = environment.storeUrl;

  protected readonly counts = computed(() => {
    const all = this.stores();
    return {
      total: all.length,
      published: all.filter((store) => store.status === 'published').length,
      suspended: all.filter((store) => store.status === 'suspended').length,
      products: all.reduce((sum, store) => sum + store.publishedCount, 0),
    };
  });

  ngOnInit(): void {
    this.load();
  }

  protected search(): void {
    this.load();
  }

  protected setStatus(status: 'all' | 'published' | 'draft' | 'suspended'): void {
    this.status.set(status);
    this.load();
  }

  protected changeStatus(store: AdminStoreSummary, status: AdminStoreSummary['status']): void {
    if (this.busyId()) return;
    let reason = '';
    if (status === 'suspended') {
      const answer = window.prompt(`Why is ${store.name} being suspended?`, '');
      if (answer === null) return;
      reason = answer.trim();
      if (!reason) {
        this.ui.info('Add a short reason before suspending a store.');
        return;
      }
    }
    this.busyId.set(store.id);
    this.error.set(null);
    this.storeApi.setStatus(store.id, status, reason)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: (response) => {
          this.stores.update((stores) => stores.map((item) => (
            item.id === response.data.id ? response.data : item
          )));
          this.ui.success(`Store set to ${status}`);
        },
        error: (err: ApiError) => this.error.set(userError(err)),
      });
  }

  protected statusLabel(status: string): string {
    return status === 'published' ? 'Live' : status === 'suspended' ? 'Suspended' : 'Draft';
  }

  protected initials(store: AdminStoreSummary): string {
    return (store.name || store.slug || 'S').slice(0, 1).toUpperCase();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.storeApi.stores({ q: this.query, status: this.status() === 'all' ? undefined : this.status() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => this.stores.set(response.data ?? []),
        error: (err: ApiError) => this.error.set(userError(err)),
      });
  }
}
