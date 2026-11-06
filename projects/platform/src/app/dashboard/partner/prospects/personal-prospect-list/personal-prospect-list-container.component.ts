import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { PartnerInterface, PartnerService } from '../../../../_common/services/partner.service';
import { Subscription } from 'rxjs';
import { MyProspectListComponent } from './personal-prospect-list.component';
import { ProspectService, ProspectListInterface } from '../prospects.service';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { ErrorStateComponent } from '@marketspase/shared/ui/error-state/error-state.component';
import { userError } from '../../../../core/http/api-error';

/**
 * @title Page leads container.
 * Loads the signed-in partner and their page submissions before rendering.
 */
@Component({
  selector: 'async-my-prospect-list-container',
  imports: [ErrorStateComponent, MatButtonModule, MyProspectListComponent, PageSkeletonComponent, RouterModule],
  providers: [ProspectService],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (loading) {
      <async-page-skeleton layout="table" [rows]="5" label="your page leads" [showHeader]="false" />
    } @else if (error) {
      <async-error-state [message]="error" context="your page leads">
        <button mat-stroked-button type="button" (click)="load()">Try again</button>
        <a mat-button routerLink="/dashboard">Back to dashboard</a>
      </async-error-state>
    } @else if (partner && prospectList) {
      <async-my-prospect-list [partner]="partner" [prospectList]="prospectList" />
    }
  `,
})
export class MyProspectListContainerComponent implements OnInit, OnDestroy {
  partner!: PartnerInterface;
  subscriptions: Subscription[] = [];
  prospectList!: ProspectListInterface[];
  protected loading = true;
  protected error: string | null = null;
  private partnerReady = false;

  constructor(
    private partnerService: PartnerService,
    private prospectService: ProspectService,
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
      this.prospectService.getAllMyProspect(this.partner.username).subscribe({
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
