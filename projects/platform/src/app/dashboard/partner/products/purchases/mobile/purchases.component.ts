import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { PurchasesComponent } from '../purchases.component';
import { PurchasesFacade } from '../state/purchases.facade';

@Component({
  selector: 'async-purchases-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, PageSkeletonComponent, PurchasesComponent],
  template: `
    @if (vm.loading()) {
      <async-page-skeleton layout="list" [rows]="4" label="your orders" [showHeader]="false" />
    } @else if (vm.error(); as err) {
      <section class="load-error dp-card" role="alert">
        <mat-icon>cloud_off</mat-icon>
        <div><h2>Could not load your orders</h2><p>{{ err }}</p></div>
        <button mat-flat-button color="primary" type="button" (click)="vm.load()">Retry</button>
      </section>
    } @else {
      <async-purchases [cartObject]="vm.orders()" />
    }
  `,
  styles: [`
    .load-error { display: flex; align-items: center; gap: 0.8em; flex-wrap: wrap; margin-top: 1em; padding: 1.1em 1.2em; }
    .load-error > mat-icon { color: var(--ms-primary-strong); }
    .load-error h2 { margin: 0 0 0.15em; font-size: 1em; }
    .load-error p { margin: 0; color: var(--ms-text-muted); font-size: 0.85em; line-height: 1.45; }
    .load-error button { margin-left: auto; min-height: 44px; }
  `],
})
export class PurchasesMobileComponent implements OnInit {
  protected readonly vm = inject(PurchasesFacade);

  ngOnInit(): void {
    this.vm.ensureLoaded();
  }
}
