import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { PartnerInterface, PartnerService } from '../../../../_common/services/partner.service';
import { Subscription } from 'rxjs';
import { ProspectBookingComponent } from './prospect-booking.component';
import { ProspectService, ProspectListInterface } from '../prospects.service';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { ErrorStateComponent } from '@marketspase/shared/ui/error-state/error-state.component';
import { userError } from '../../../../core/http/api-error';

/**
 * @title Prospect booking container.
 * Resolves the signed-in partner and their sessions before rendering the page.
 */
@Component({
  selector: 'async-prospect-booking-container',
  imports: [
    ErrorStateComponent,
    MatButtonModule,
    PageSkeletonComponent,
    ProspectBookingComponent,
    RouterModule,
  ],
  providers: [ProspectService],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (loading) {
      <async-page-skeleton layout="list" [rows]="4" label="your sessions" [showHeader]="false" />
    } @else if (error) {
      <async-error-state [message]="error" context="your sessions">
        <button mat-stroked-button type="button" (click)="load()">Try again</button>
        <a mat-button routerLink="/dashboard">Back to dashboard</a>
      </async-error-state>
    } @else if (partner && prospectList) {
      <async-prospect-booking [partner]="partner" [prospectList]="prospectList" />
    }
  `,
})
export class ProspectBookingContainerComponent implements OnInit, OnDestroy {
  partner!: PartnerInterface;
  subscriptions: Subscription[] = [];
  prospectList!: ProspectListInterface[];
  protected loading = true;
  protected error: string | null = null;
  private partnerReady = false;

  constructor(
    private partnerService: PartnerService,
    private prospectListService: ProspectService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.partnerService.getSharedPartnerData$.subscribe({
        next: (partnerObject) => {
          this.partner = partnerObject as PartnerInterface;
          this.partnerReady = !!this.partner;
          if (this.partner) this.load();
        },
        error: (err: unknown) => {
          this.error = userError(err);
          this.loading = false;
        },
      }),
    );
  }

  protected load(): void {
    if (!this.partnerReady) return;
    this.loading = true;
    this.error = null;
    this.subscriptions.push(
      this.prospectListService.getSessionBookingsFor(this.partner._id).subscribe({
        next: (response) => {
          this.prospectList = response.data ?? [];
          this.loading = false;
        },
        error: (err: unknown) => {
          this.error = userError(err);
          this.loading = false;
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }
}
