import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { ErrorStateComponent } from '@marketspase/shared/ui/error-state/error-state.component';
import { MobileCardComponent } from '@marketspase/shared/ui/mobile-card/mobile-card.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { AvatarComponent } from '../../../_common/avatar.component';
import { HomeFacade } from '../state/home.facade';

/**
 * Home — native mobile command centre.
 *
 * Uses the shared HomeFacade so the mobile and desktop views read the same
 * signals, and a resize never repeats the dashboard request fan-out.
 */
@Component({
  selector: 'async-home-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    DatePipe,
    DecimalPipe,
    ErrorStateComponent,
    MatButtonModule,
    MatIconModule,
    MobileCardComponent,
    PageSkeletonComponent,
    RouterModule,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeMobileComponent implements OnInit {
  protected readonly vm = inject(HomeFacade);

  ngOnInit(): void {
    this.vm.ensureLoaded();
  }
}
