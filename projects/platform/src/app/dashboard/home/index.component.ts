import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { LaunchPathComponent } from '../partner/launch-path/launch-path.component';
import { HomeDesktopComponent } from './desktop/home.component';
import { HomeMobileComponent } from './mobile/home.component';
import { HomeFacade } from './state/home.facade';

/**
 * Device-aware Home entry point.
 *
 * The command-centre facade lives here so the thirteen dashboard requests run
 * once and survive a mobile/desktop view swap. The launch-path card also sits
 * above the conditional so its five aggregate reads are not repeated on resize.
 */
@Component({
  selector: 'async-home-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HomeDesktopComponent, HomeMobileComponent, LaunchPathComponent],
  providers: [HomeFacade],
  template: `
    <async-launch-path class="home-launch" [compact]="true" />
    @if (device.isMobileView()) {
      <async-home-mobile />
    } @else {
      <async-home-desktop />
    }
  `,
  styles: [`
    .home-launch {
      display: block;
      margin-top: 16px;
      padding: 0 var(--ms-mobile-gutter);
    }

    @media (min-width: 600px) and (max-width: 959.98px) {
      .home-launch {
        max-width: 760px;
        margin: 24px auto 0;
        padding: 0 24px;
        box-sizing: border-box;
      }
    }

    @media (min-width: 960px) {
      .home-launch {
        padding: 0;
      }
    }
  `],
})
export class HomeIndexComponent {
  protected readonly device = inject(DeviceService);
}
