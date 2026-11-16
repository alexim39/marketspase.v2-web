import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { DeviceService } from '@marketspase/shared/core/ui/device.service';
import { FooterComponent } from '../index/footer/footer.component';
import { NavComponent } from '../index/nav/nav.component';
import { MobilePublicNavComponent } from './mobile-nav/mobile-public-nav.component';
@Component({
    selector: 'async-index',
    imports: [RouterModule, FooterComponent, NavComponent, MobilePublicNavComponent],
    template: `
    @if (device.isMobileView()) {
      @if (!isAuthRoute()) {
        <async-mobile-public-nav />
      }
    } @else {
      <async-nav></async-nav>
    }
    <main>
      <router-outlet></router-outlet>
    </main>
    @if (!device.isMobileView() || !isAuthRoute()) {
      <async-footer class="footer"></async-footer>
    }
  `,
    changeDetection: ChangeDetectionStrategy.Eager,
    styles: [`
  `]
})
export class IndexComponent {
  private readonly router = inject(Router);
  protected readonly device = inject(DeviceService);
  protected readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly isAuthRoute = computed(() => {
    const path = this.currentUrl().split('?')[0];
    return /^\/partner\/(?:signin|signup|verify-email|forgot-password|reset-password)$/.test(path);
  });
}
