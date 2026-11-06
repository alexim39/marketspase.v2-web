import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { finalize } from 'rxjs';
import { AdminStoreService } from '../../../core/store-admin/admin-store.service';
import { ApiError, userError } from '../../../core/http/api-error';
import { UiFeedbackService } from '../../../core/ui/ui-feedback.service';

@Component({
  selector: 'async-admin-settings',
  templateUrl: './admin-settings.component.html',
  styleUrls: ['./admin-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule],
})
export class AdminSettingsComponent implements OnInit {
  private readonly storeApi = inject(AdminStoreService);
  private readonly ui = inject(UiFeedbackService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected serviceFeePercent = 2;
  protected escrowHoldDays = 7;

  ngOnInit(): void {
    this.load();
  }

  protected save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.storeApi.updateSettings({
      serviceFeePercent: Number(this.serviceFeePercent),
      escrowHoldDays: Number(this.escrowHoldDays),
    }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (response) => {
        this.serviceFeePercent = response.data.serviceFeePercent;
        this.escrowHoldDays = response.data.escrowHoldDays;
        this.ui.success('Store settings updated');
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.storeApi.settings().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (response) => {
        this.serviceFeePercent = response.data.serviceFeePercent;
        this.escrowHoldDays = response.data.escrowHoldDays;
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }
}
