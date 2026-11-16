import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { MyStoreFacade } from '../state/my-store.facade';

@Component({
  selector: 'async-my-store-mobile',
  templateUrl: './my-store.component.html',
  styleUrls: ['./my-store.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    PageSkeletonComponent,
    RouterModule,
  ],
})
export class MyStoreMobileComponent implements OnInit {
  private readonly facade = inject(MyStoreFacade);

  protected readonly loading = this.facade.loading;
  protected readonly saving = this.facade.saving;
  protected readonly uploadingKind = this.facade.uploadingKind;
  protected readonly busyId = this.facade.busyId;
  protected readonly error = this.facade.error;
  protected readonly store = this.facade.store;
  protected readonly counts = this.facade.counts;
  protected readonly products = this.facade.products;
  protected readonly receipts = this.facade.receipts;
  protected readonly form = this.facade.form;
  protected readonly priceDrafts = this.facade.priceDrafts;
  protected readonly tab = this.facade.tab;
  protected readonly isPartner = this.facade.isPartner;
  protected readonly kycReady = this.facade.kycReady;
  protected readonly storeUrl = this.facade.storeUrl;
  protected readonly leadPageUrl = this.facade.leadPageUrl;
  protected readonly readiness = this.facade.readiness;

  ngOnInit(): void { this.facade.ensureLoaded(); }
  protected setTab(tab: Parameters<MyStoreFacade['setTab']>[0]): void { this.facade.setTab(tab); }
  protected setForm(field: Parameters<MyStoreFacade['setForm']>[0], value: unknown): void { this.facade.setForm(field, value); }
  protected setPrice(id: string, value: unknown): void { this.facade.setPrice(id, value); }
  protected priceFor(product: Parameters<MyStoreFacade['priceFor']>[0]): string { return this.facade.priceFor(product); }
  protected imageUrl(image: string): string { return this.facade.imageUrl(image); }
  protected copyStoreLink(): void { this.facade.copyStoreLink(); }
  protected copyLeadPageLink(): void { this.facade.copyLeadPageLink(); }
  protected saveSettings(): void { this.facade.saveSettings(); }
  protected publishStore(): void { this.facade.publishStore(); }
  protected uploadImage(event: Event, kind: 'logo' | 'banner'): void { this.facade.uploadImage(event, kind); }
  protected removeImage(kind: 'logo' | 'banner'): void { this.facade.removeImage(kind); }
  protected setStoreStatus(status: 'draft' | 'published'): void { this.facade.setStoreStatus(status); }
  protected saveListing(product: Parameters<MyStoreFacade['saveListing']>[0]): void { this.facade.saveListing(product); }
  protected toggleListing(product: Parameters<MyStoreFacade['toggleListing']>[0]): void { this.facade.toggleListing(product); }
  protected confirmReceipt(receipt: Parameters<MyStoreFacade['confirmReceipt']>[0]): void { this.facade.confirmReceipt(receipt); }
  protected statusLabel(status: string): string { return this.facade.statusLabel(status); }
  protected receiptUnits(receipt: Parameters<MyStoreFacade['receiptUnits']>[0]): number { return this.facade.receiptUnits(receipt); }
}
