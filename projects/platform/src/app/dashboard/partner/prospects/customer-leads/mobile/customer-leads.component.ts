import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, Injector, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { StoreCustomerLead } from '../../../../../core/store/store.models';
import { CustomerLeadsFacade } from '../state/customer-leads.facade';
import { CustomerDetailSheetComponent } from './detail-sheet.component';
import { CustomerFilterSheetComponent } from './filter-sheet.component';

type CustomerSegment = 'all' | 'new' | 'repeat' | 'dormant' | 'loyal';

interface SegmentOption {
  id: CustomerSegment;
  label: string;
  icon: string;
  count: number;
}

@Component({
  selector: 'async-customer-leads-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe, MatBottomSheetModule, MatButtonModule, MatDialogModule,
    MatIconModule, RouterModule, PageSkeletonComponent,
  ],
  template: `
    <section class="clients-page">
      <header class="app-head">
        <div class="head-top">
          <a mat-icon-button routerLink="/dashboard/prospects/pipeline" aria-label="Back to pipeline">
            <mat-icon>arrow_back</mat-icon>
          </a>
          <div class="head-title">
            <p class="eyebrow">Customer retention</p>
            <h1>Your buyers</h1>
          </div>
          <button mat-icon-button type="button" (click)="load()" [disabled]="loading()" aria-label="Refresh customers">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
        <p class="head-lede">People who bought from your store. Keep the relationship warm — follow up only where they opted in.</p>
        <div class="head-actions">
          <a mat-stroked-button routerLink="/dashboard/products/my-store"><mat-icon>storefront</mat-icon> My store</a>
          <a mat-flat-button color="primary" routerLink="/dashboard/products/store-orders"><mat-icon>receipt_long</mat-icon> Store orders</a>
        </div>
      </header>

      @if (initialLoading()) {
        <async-page-skeleton layout="cards" [rows]="4" label="customer retention" [showHeader]="false" />
      }

      @if (error(); as err) {
        <div class="alert" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>{{ err }}</p>
          <button mat-stroked-button type="button" (click)="load()">Retry</button>
        </div>
      }

      @if (summary(); as s) {
        <section class="pulse" aria-label="Customer pulse">
          <div class="pulse-head">
            <h2>Customer pulse</h2>
            <span>All time</span>
          </div>
          <div class="kpi-rail">
            <article class="kpi-card">
              <span class="kpi-icon"><mat-icon>groups</mat-icon></span>
              <strong>{{ s.totalLeads }}</strong>
              <span>Customers captured</span>
              <small>{{ s.newThisMonth }} new this month</small>
            </article>
            <article class="kpi-card kpi-card--repeat">
              <span class="kpi-icon kpi-icon--repeat"><mat-icon>repeat</mat-icon></span>
              <strong>{{ s.repeatCustomers }}</strong>
              <span>Repeat buyers</span>
              <small>{{ repeatRate(s.totalLeads, s.repeatCustomers) }}% of customers</small>
            </article>
            <article class="kpi-card kpi-card--value">
              <span class="kpi-icon kpi-icon--value"><mat-icon>payments</mat-icon></span>
              <strong>{{ s.revenue | currency:'NGN':'symbol-narrow':'1.0-0' }}</strong>
              <span>Lifetime value</span>
              <small>{{ s.paidOrders }} paid orders</small>
            </article>
            <article class="kpi-card kpi-card--due" [class.is-hot]="(s.segments?.dormant ?? 0) > 0">
              <span class="kpi-icon kpi-icon--due"><mat-icon>schedule</mat-icon></span>
              <strong>{{ s.segments?.dormant ?? 0 }}</strong>
              <span>Reorder due</span>
              <small>Quiet for 60+ days</small>
            </article>
          </div>
        </section>
      }

      @if (dormantCount() > 0) {
        <button type="button" class="retention-card" (click)="setSegment('dormant')">
          <span class="retention-icon"><mat-icon>auto_awesome</mat-icon></span>
          <span class="retention-copy">
            <strong>{{ dormantCount() }} customer{{ dormantCount() === 1 ? '' : 's' }} ready for a check-in</strong>
            <small>Quiet for 60+ days. A short, consent-based message can bring them back.</small>
          </span>
          <mat-icon class="retention-arrow">arrow_forward</mat-icon>
        </button>
      }

      <div class="list-controls">
      <div class="search-row">
        <div class="search-box">
          <mat-icon aria-hidden="true">search</mat-icon>
          <input
            type="search"
            inputmode="search"
            placeholder="Search name, phone, email or city"
            [value]="query()"
            (input)="onSearch($any($event.target).value)"
            maxlength="80"
            aria-label="Search customers" />
          @if (query()) {
            <button type="button" class="search-clear" (click)="clearSearch()" aria-label="Clear search">
              <mat-icon>close</mat-icon>
            </button>
          }
        </div>
        <button type="button" class="filter-btn" [class.is-active]="!!status()" (click)="openFilters()" aria-label="Filter customers by status">
          <mat-icon>tune</mat-icon>
          @if (status()) { <span class="filter-dot" aria-hidden="true"></span> }
        </button>
      </div>

      @if (status()) {
        <div class="active-filter-row">
          <span class="filter-chip">
            Status: {{ status() }}
            <button type="button" (click)="setStatus('')" aria-label="Clear status filter"><mat-icon>close</mat-icon></button>
          </span>
        </div>
      }

      <div class="segment-rail" role="tablist" aria-label="Customer segment">
        @for (option of segmentOptions(); track option.id) {
          <button
            type="button"
            role="tab"
            class="segment-chip"
            [class.is-active]="segment() === option.id"
            [attr.aria-selected]="segment() === option.id"
            (click)="setSegment(option.id)">
            <mat-icon aria-hidden="true">{{ option.icon }}</mat-icon>
            <span>{{ option.label }}</span>
            <span class="segment-count">{{ option.count }}</span>
          </button>
        }
      </div>

      </div>

      <div class="list-head">
        <h2>{{ segmentLabel() }}</h2>
        <span>{{ total() }} {{ total() === 1 ? 'customer' : 'customers' }}</span>
      </div>

      @if (loading() && !initialLoading()) {
        <div class="loading-strip" role="status" aria-label="Updating customers"></div>
      }

      @if (!loading() && rows().length === 0) {
        <div class="empty-card">
          <span class="empty-icon"><mat-icon>{{ hasFilters() ? 'search_off' : 'groups' }}</mat-icon></span>
          <h3>{{ hasFilters() ? 'No customers match' : 'No customers yet' }}</h3>
          <p>{{ hasFilters() ? 'Try a different search, status or segment.' : 'Customers appear here automatically when someone reaches checkout in your store. Share your store link to get your first one.' }}</p>
          @if (hasFilters()) {
            <button mat-stroked-button type="button" (click)="resetFilters()">Clear filters</button>
          } @else {
            <a mat-flat-button color="primary" routerLink="/dashboard/products/my-store"><mat-icon>storefront</mat-icon> Open my store</a>
          }
        </div>
      } @else if (rows().length > 0) {
        <div class="customer-list">
          @for (row of rows(); track row.id) {
            <article class="customer-card">
              <button type="button" class="card-main" (click)="select(row)" [attr.aria-label]="'Open customer ' + (row.name || 'profile')">
                <span [class]="'avatar avatar--' + segmentFor(row).tone">{{ initial(row) }}</span>
                <span class="customer-id">
                  <span class="name-line">
                    <strong>{{ row.name || 'Customer' }}</strong>
                    <span [class]="'segment-pill segment-pill--' + segmentFor(row).tone">{{ segmentFor(row).label }}</span>
                  </span>
                  <span class="contact-line">
                    @if (row.phone) { <span><mat-icon aria-hidden="true">call</mat-icon>{{ row.phone }}</span> }
                    @if (row.city) { <span><mat-icon aria-hidden="true">location_on</mat-icon>{{ row.city }}</span> }
                  </span>
                </span>
                <mat-icon class="chev" aria-hidden="true">chevron_right</mat-icon>
              </button>

              <div class="card-stats">
                <span><strong>{{ row.paidOrders }}</strong><small>Orders</small></span>
                <span><strong>{{ row.totalSpent | currency:'NGN':'symbol-narrow':'1.0-0' }}</strong><small>Lifetime</small></span>
                <span><strong>{{ lastOrderLabel(row) }}</strong><small>Last order</small></span>
              </div>

              <div class="card-foot">
                <span [class]="'state-chip state-chip--' + row.status.toLowerCase()">{{ row.status }}</span>
                @if (row.consentToContact) {
                  <span class="consent-chip"><mat-icon aria-hidden="true">verified_user</mat-icon>Opted in</span>
                }
              </div>
            </article>
          }
        </div>

        <div class="list-footer">
          <p>Showing {{ rows().length }} of {{ total() }} customers</p>
          @if (hasNext()) {
            <button mat-flat-button color="primary" type="button" (click)="loadMore()" [disabled]="loadingMore()">
              <mat-icon>{{ loadingMore() ? 'sync' : 'expand_more' }}</mat-icon>
              {{ loadingMore() ? 'Loading…' : 'Load more customers' }}
            </button>
          }
        </div>
      }
    </section>

  `,
  styles: [`
    :host { display: block; -webkit-tap-highlight-color: transparent; }
    .clients-page { display: flex; flex-direction: column; gap: 14px; max-width: 720px; margin: 0 auto; padding-bottom: 28px; }

    .app-head { position: relative; overflow: hidden; padding: 14px; border: 1px solid color-mix(in srgb, var(--ms-primary) 16%, var(--ms-line)); border-radius: 20px; background: linear-gradient(155deg, var(--ms-primary-soft), var(--ms-surface) 70%); }
    .head-top { display: flex; align-items: center; gap: 8px; }
    .head-top > a, .head-top > button { flex: none; background: color-mix(in srgb, var(--ms-surface) 72%, transparent); }
    .head-title { flex: 1; min-width: 0; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.66rem; font-weight: 700; letter-spacing: 0.13em; text-transform: uppercase; }
    .head-title h1 { margin: 1px 0 0; font-size: 1.65rem; letter-spacing: -0.03em; }
    .head-lede { margin: 9px 0 12px; max-width: 42em; color: var(--ms-text-muted); font-size: 0.82rem; line-height: 1.55; }
    .head-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .head-actions a { min-width: 0; min-height: 44px; }
    .head-actions mat-icon { margin-right: 4px; }

    .pulse { display: flex; flex-direction: column; gap: 7px; }
    .pulse-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 0 2px; }
    .pulse-head h2 { margin: 0; font-size: 0.96rem; }
    .pulse-head span { color: var(--ms-text-muted); font-size: 0.68rem; font-weight: 600; }
    .kpi-rail { display: flex; gap: 8px; margin: 0 -2px; padding: 2px 2px 6px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
    .kpi-rail::-webkit-scrollbar { display: none; }
    .kpi-card { flex: 0 0 158px; display: flex; flex-direction: column; gap: 1px; padding: 11px 12px; border: 1px solid var(--ms-line); border-radius: 16px; background: var(--ms-surface); scroll-snap-align: start; }
    .kpi-card.is-hot { border-color: color-mix(in srgb, var(--ms-warning) 40%, var(--ms-line)); background: var(--ms-warning-soft); }
    .kpi-icon { width: 32px; height: 32px; flex: none; display: grid; place-items: center; border-radius: 10px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .kpi-icon--repeat { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .kpi-icon--value { background: var(--ms-success-soft); color: var(--ms-success); }
    .kpi-icon--due { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .kpi-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .kpi-card strong { margin-top: 5px; font-family: var(--ms-font-display); font-size: 1.3rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .kpi-card > span:not(.kpi-icon) { color: var(--ms-text-muted); font-size: 0.7rem; font-weight: 650; }
    .kpi-card small { color: var(--ms-text-muted); font-size: 0.64rem; line-height: 1.35; }

    .retention-card { display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 12px; border: 1px solid color-mix(in srgb, var(--ms-warning) 38%, var(--ms-line)); border-radius: 16px; background: var(--ms-warning-soft); color: var(--ms-text); font: inherit; text-align: left; cursor: pointer; }
    .retention-icon { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; background: var(--ms-surface); color: var(--ms-warning); }
    .retention-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .retention-copy strong { font-size: 0.82rem; line-height: 1.35; }
    .retention-copy small { color: var(--ms-text-muted); font-size: 0.71rem; line-height: 1.4; }
    .retention-arrow { flex: none; color: var(--ms-warning); }
    .list-controls { position: sticky; top: calc(var(--ms-mobile-appbar-height) + var(--ms-safe-top)); z-index: 10; display: flex; flex-direction: column; gap: 8px; margin: 0 -2px; padding: 6px 2px 7px; background: var(--ms-canvas); border-bottom: 1px solid color-mix(in srgb, var(--ms-line) 65%, transparent); }
    .search-row { display: flex; align-items: center; gap: 8px; }
    .search-box { flex: 1; display: flex; align-items: center; gap: 7px; min-width: 0; min-height: 46px; padding: 0 10px 0 12px; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); }
    .search-box:focus-within { border-color: var(--ms-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ms-primary) 16%, transparent); }
    .search-box > mat-icon { flex: none; color: var(--ms-text-muted); font-size: 20px; width: 20px; height: 20px; }
    .search-box input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--ms-text); font: inherit; font-size: 0.84rem; }
    .search-box input::placeholder { color: var(--ms-text-muted); }
    .search-clear { flex: none; width: 30px; height: 30px; display: grid; place-items: center; border: 0; border-radius: 50%; background: var(--ms-canvas); color: var(--ms-text-muted); cursor: pointer; }
    .search-clear mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .filter-btn { position: relative; flex: none; width: 46px; height: 46px; display: grid; place-items: center; border: 1px solid var(--ms-line); border-radius: 14px; background: var(--ms-surface); color: var(--ms-text); cursor: pointer; }
    .filter-btn.is-active { border-color: var(--ms-primary); background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .filter-dot { position: absolute; top: 9px; right: 9px; width: 8px; height: 8px; border-radius: 50%; background: var(--ms-primary-strong); box-shadow: 0 0 0 2px var(--ms-surface); }
    .active-filter-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: -4px; }
    .filter-chip { display: inline-flex; align-items: center; gap: 2px; min-height: 32px; padding: 0 3px 0 10px; border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 700; }
    .filter-chip button { width: 28px; height: 28px; display: grid; place-items: center; border: 0; border-radius: 50%; background: transparent; color: currentColor; cursor: pointer; }
    .filter-chip mat-icon { font-size: 15px; width: 15px; height: 15px; }

    .segment-rail { display: flex; gap: 6px; margin: 0 -2px; padding: 2px 2px 5px; overflow-x: auto; scroll-snap-type: x proximity; scrollbar-width: none; }
    .segment-rail::-webkit-scrollbar { display: none; }
    .segment-chip { flex: none; display: inline-flex; align-items: center; gap: 5px; min-height: 40px; padding: 0 11px; border: 1px solid var(--ms-line); border-radius: 999px; background: var(--ms-surface); color: var(--ms-text-muted); font: inherit; font-size: 0.77rem; font-weight: 650; cursor: pointer; scroll-snap-align: start; }
    .segment-chip mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .segment-chip.is-active { border-color: var(--ms-primary); background: var(--ms-primary); color: var(--ms-ink); }
    .segment-chip.is-active .segment-count { background: color-mix(in srgb, var(--ms-surface) 78%, transparent); color: var(--ms-text); }
    .segment-count { min-width: 20px; height: 20px; padding: 0 6px; display: inline-grid; place-items: center; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.67rem; font-weight: 800; font-variant-numeric: tabular-nums; }

    .list-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 0 2px; }
    .list-head h2 { margin: 0; font-size: 0.98rem; }
    .list-head > span { color: var(--ms-text-muted); font-size: 0.72rem; font-weight: 600; }
    .loading-strip { position: relative; height: 3px; overflow: hidden; border-radius: 999px; background: var(--ms-line); }
    .loading-strip::after { content: ''; position: absolute; inset: 0; width: 38%; border-radius: inherit; background: var(--ms-primary); animation: slide-bar 1.05s ease-in-out infinite; }

    .customer-list { display: flex; flex-direction: column; gap: 10px; }
    .customer-card { display: flex; flex-direction: column; gap: 9px; padding: 12px; border: 1px solid var(--ms-line); border-radius: 16px; background: var(--ms-surface); }
    .card-main { display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
    .avatar { width: 42px; height: 42px; flex: none; display: grid; place-items: center; border-radius: 50%; font-size: 0.82rem; font-weight: 800; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .avatar--new { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .avatar--repeat { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .avatar--loyal { background: var(--ms-success-soft); color: var(--ms-success); }
    .avatar--dormant { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .customer-id { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .name-line { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .name-line strong { font-size: 0.92rem; text-transform: capitalize; }
    .contact-line { display: flex; flex-wrap: wrap; gap: 2px 9px; color: var(--ms-text-muted); font-size: 0.71rem; }
    .contact-line > span { display: inline-flex; align-items: center; gap: 3px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .contact-line mat-icon { flex: none; font-size: 13px; width: 13px; height: 13px; }
    .chev { flex: none; margin-top: 10px; color: var(--ms-text-muted); font-size: 20px; width: 20px; height: 20px; }

    .card-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px; padding: 8px 0; border-top: 1px solid var(--ms-line); border-bottom: 1px solid var(--ms-line); }
    .card-stats > span { display: flex; flex-direction: column; gap: 1px; min-width: 0; padding-left: 8px; border-left: 1px solid var(--ms-line); }
    .card-stats > span:first-child { padding-left: 0; border-left: 0; }
    .card-stats strong { font-size: 0.8rem; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-stats small { color: var(--ms-text-muted); font-size: 0.6rem; font-weight: 650; letter-spacing: 0.04em; text-transform: uppercase; }

    .card-foot { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
    .state-chip, .consent-chip, .segment-pill { display: inline-flex; align-items: center; gap: 3px; border-radius: 999px; padding: 3px 8px; font-size: 0.65rem; font-weight: 700; white-space: nowrap; }
    .state-chip { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .state-chip--new { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .state-chip--contacted, .state-chip--qualified { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .state-chip--converted { background: var(--ms-success-soft); color: var(--ms-success); }
    .state-chip--closed { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .consent-chip { background: var(--ms-success-soft); color: var(--ms-success); }
    .consent-chip mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .segment-pill { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .segment-pill--new { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .segment-pill--repeat { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .segment-pill--loyal { background: var(--ms-success-soft); color: var(--ms-success); }
    .segment-pill--dormant { background: var(--ms-warning-soft); color: var(--ms-warning); }

    .list-footer { display: flex; flex-direction: column; align-items: center; gap: 7px; padding-top: 3px; }
    .list-footer p { margin: 0; color: var(--ms-text-muted); font-size: 0.72rem; }
    .list-footer button { width: 100%; max-width: 320px; min-height: 46px; }

    .empty-card { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 30px 20px; text-align: center; border: 1px dashed var(--ms-line-strong); border-radius: 18px; background: var(--ms-surface); }
    .empty-icon { width: 54px; height: 54px; display: grid; place-items: center; border-radius: 50%; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .empty-icon mat-icon { font-size: 27px; width: 27px; height: 27px; }
    .empty-card h3 { margin: 0; font-size: 1rem; }
    .empty-card p { margin: 0; max-width: 30em; color: var(--ms-text-muted); font-size: 0.81rem; line-height: 1.5; }
    .empty-card a, .empty-card button { min-height: 44px; margin-top: 3px; }
    .alert { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 11px 12px; border-radius: 14px; background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { flex: 1; min-width: 170px; margin: 0; font-size: 0.8rem; }
    .alert button { min-height: 40px; }

    @media (min-width: 700px) {
      .customer-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .kpi-rail { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); overflow: visible; }
      .kpi-card { flex: initial; }
    }
    @media (prefers-reduced-motion: reduce) {
      .loading-strip::after { animation: none; width: 100%; opacity: 0.5; }
    }
    @keyframes slide-bar { 0% { transform: translateX(-110%); } 100% { transform: translateX(290%); } }
  `],
})
export class CustomerLeadsMobileComponent implements OnInit {
  private readonly facade = inject(CustomerLeadsFacade);
  private readonly dialog = inject(MatDialog);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = this.facade.loading;
  protected readonly loadingMore = this.facade.loadingMore;
  protected readonly error = this.facade.error;
  protected readonly rows = this.facade.rows;
  protected readonly total = this.facade.total;
  protected readonly summary = this.facade.summary;
  protected readonly query = this.facade.query;
  protected readonly status = this.facade.status;
  protected readonly segment = this.facade.segment;
  protected readonly hasNext = this.facade.hasNext;

  protected readonly initialLoading = computed(() => this.loading() && this.summary() === null);
  protected readonly hasFilters = computed(
    () => this.query().trim().length > 0 || this.status().length > 0 || this.segment() !== 'all',
  );
  protected readonly dormantCount = computed(() => this.summary()?.segments?.dormant ?? 0);
  protected readonly segmentOptions = computed<SegmentOption[]>(() => {
    const summary = this.summary();
    const segments = summary?.segments;
    return [
      { id: 'all', label: 'All', icon: 'groups', count: summary?.totalLeads ?? this.total() },
      { id: 'new', label: 'New', icon: 'fiber_new', count: segments?.new ?? 0 },
      { id: 'repeat', label: 'Repeat', icon: 'repeat', count: segments?.repeat ?? 0 },
      { id: 'loyal', label: 'Loyal', icon: 'workspace_premium', count: segments?.loyal ?? 0 },
      { id: 'dormant', label: 'Reorder due', icon: 'schedule', count: segments?.dormant ?? 0 },
    ];
  });
  protected readonly segmentLabel = computed(() => {
    if (this.segment() === 'all') return 'All customers';
    return this.segmentOptions().find((option) => option.id === this.segment())?.label ?? 'Customers';
  });

  ngOnInit(): void { this.facade.ensureLoaded(); }

  protected load(): void { this.facade.load(); }
  protected onSearch(value: string): void { this.facade.onSearch(value); }
  protected clearSearch(): void { this.facade.onSearch(''); }
  protected setStatus(value: string): void { this.facade.setStatus(value); }
  protected setSegment(value: CustomerSegment): void { this.facade.setSegment(value); }
  protected resetFilters(): void { this.facade.resetFilters(); }
  protected loadMore(): void { this.facade.loadMore(); }
  protected select(row: StoreCustomerLead): void {
    this.facade.select(row);
    this.dialog.open(CustomerDetailSheetComponent, {
      panelClass: 'ms-customer-detail-dialog',
      injector: this.injector,
      width: '100%',
      height: '100%',
      maxWidth: '100vw',
      maxHeight: '100vh',
      autoFocus: 'dialog',
      restoreFocus: true,
    }).afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.facade.selected.set(null);
      this.facade.notice.set(null);
    });
  }
  protected initial(row: StoreCustomerLead): string { return this.facade.initial(row); }
  protected segmentFor(row: StoreCustomerLead) { return this.facade.segmentFor(row); }

  protected repeatRate(total: number, repeat: number): number {
    return total > 0 ? Math.round((repeat / total) * 100) : 0;
  }

  protected lastOrderLabel(row: StoreCustomerLead): string {
    if (!row.lastPaidAt) return '—';
    const time = new Date(row.lastPaidAt).getTime();
    if (Number.isNaN(time)) return '—';
    const days = Math.floor((Date.now() - time) / 86_400_000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  }

  protected openFilters(): void {
    this.bottomSheet.open(CustomerFilterSheetComponent, {
      panelClass: 'ms-filter-sheet-panel',
      injector: this.injector,
      autoFocus: 'dialog',
      restoreFocus: true,
    });
  }
}

