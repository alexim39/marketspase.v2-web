import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { FooterComponent } from '../index/footer/footer.component';
import { NavComponent } from '../index/nav/nav.component';
import { MobilePublicNavComponent } from './mobile-nav/mobile-public-nav.component';
@Component({
    selector: 'async-index',
    imports: [RouterModule, FooterComponent, NavComponent, MobilePublicNavComponent],
    template: `
    @if (device.isMobileView()) {
      <async-mobile-public-nav />
    } @else {
      <async-nav></async-nav>
    }
    <main>
      <router-outlet></router-outlet>
    </main>
    <async-footer class="footer"></async-footer>
  `,
    changeDetection: ChangeDetectionStrategy.Eager,
    styles: [`
  `]
})
export class IndexComponent {
  protected readonly device = inject(DeviceService);
}
