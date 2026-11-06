import { Component, DestroyRef, inject, OnInit, ChangeDetectionStrategy, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PartnerInterface, PartnerService } from '../../../../_common/services/partner.service';
import { MyPartnersComponent } from './my-partners.component';
import { MyPartnersService } from './my-partners.service';
import { LeadPipelineService } from '../../prospects/lead-pipeline/lead-pipeline.service';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { userError } from '../../../../core/http/api-error';

/**
 * @title My Partners container — owns loading, then gets out of the way.
 *
 * Three states, never conflated: loading bar while identity + list resolve;
 * an error card (real message + Retry + Back) when either fails; otherwise
 * the list component always renders — including its own professional empty
 * state when the partner simply has no downline yet.
 */
@Component({
    selector: 'async-my-partners-container',
    template: `
@if (loading()) {
  <async-page-skeleton layout="list" [rows]="5" label="your partners" [showHeader]="false" />
}
@if (error(); as err) {
  <section class="dp-card container-error" role="alert">
    <mat-icon>error_outline</mat-icon>
    <div>
      <strong>Couldn’t load your partners.</strong>
      <p class="dp-muted">{{ err }}</p>
    </div>
    <span class="spacer"></span>
    <button mat-stroked-button (click)="reload()">Retry</button>
    <button mat-button (click)="navigateBack()">Back to dashboard</button>
  </section>
} @else if (!loading()) {
  @if (partner(); as me) {
    @if (myPartners; as list) {
      <async-my-partners
        [partner]="me"
        [myPartners]="list.data ?? []"
        [supportMap]="supportMap()">
      </async-my-partners>
    }
  }
}
`,
    styles: [`
      .container-error { margin: 1em 0; padding: 1em; display: flex; gap: 0.8em; align-items: center; flex-wrap: wrap; }
      .container-error .spacer { flex: 1; }
      .container-error p { margin: 0.25em 0 0; }
    `],
    providers: [MyPartnersService],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MyPartnersComponent, MatButtonModule, MatIconModule, PageSkeletonComponent, RouterModule]
})
export class MyPartnersContainerComponent implements OnInit {
  protected readonly partner = signal<PartnerInterface | null>(null);
  protected myPartners: { data?: PartnerInterface[] } | null = null;
  protected readonly supportMap = signal<Record<string, any>>({});
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly leads = inject(LeadPipelineService);

  constructor(
    private partnerService: PartnerService,
    private myPartnersService: MyPartnersService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPartnerData();
  }

  /**
   * Load partner data and associated partners
   */
  private loadPartnerData(): void {
    this.loading.set(true);
    this.error.set(null);
    this.partnerService.getSharedPartnerData$
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (partner: PartnerInterface) => {
          // BehaviorSubject replays; ignore the pre-login null until identity lands.
          if (!partner) return;
          this.partner.set(partner);
          this.fetchMyPartners(partner._id);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(userError(err) || 'Your session could not be loaded — try signing in again.');
        }
      });
  }

  protected reload(): void {
    this.myPartners = null;
    this.loadPartnerData();
  }

  /**
   * Fetch partners associated with the current user
   */
  private fetchMyPartners(partnerId: string): void {
    this.myPartnersService.getPartnersOf(partnerId, { maskContacts: true })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (myPartners) => {
          // Empty downline is a healthy state, not an error — the list
          // component renders its own empty guidance (with Activate CTA).
          this.myPartners = myPartners;
          this.loading.set(false);
        },
        error: (err: unknown) => {
          // Transitional: pre-fix servers 404 an empty downline with "No
          // partners found". Absorb only that shape as healthy-empty so the
          // Activate CTA always renders; every other failure keeps the card.
          const status = (err as { status?: unknown })?.status;
          const text = userError(err) || '';
          if (status === 404 && /no partners found/i.test(text)) {
            this.myPartners = { data: [] };
            this.loading.set(false);
            return;
          }
          this.loading.set(false);
          this.error.set(text || 'Partners could not be loaded — check your connection and retry.');
        }
    });
    // Activation snapshot for support chips — fail-soft, table works without it.
    this.leads.activationBoard().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        const map: Record<string, any> = {};
        for (const item of res.data?.items ?? []) {
          map[String(item.partnerId)] = item;
        }
        this.supportMap.set(map);
      },
      error: () => {},
    });
  }

  /**
   * Navigate back to the dashboard
   */
  navigateBack(): void {
    this.router.navigateByUrl('dashboard');
  }
}
