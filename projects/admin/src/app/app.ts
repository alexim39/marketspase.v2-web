import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ThemeService } from '@marketspase/shared/core/ui/theme.service';
import { SessionRecoveryService } from '@marketspase/shared/core/ui/session-recovery.service';
import { ConnectionBannerComponent } from '@marketspase/shared/ui/connection-banner/connection-banner.component';

@Component({
  selector: 'async-root',
  imports: [RouterModule, ConnectionBannerComponent],
  template: '<async-connection-banner placement="bottom" /><router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  private readonly themes = inject(ThemeService);
  private readonly recovery = inject(SessionRecoveryService);

  ngOnInit(): void {
    this.themes.init();
    this.recovery.restorePending();
  }
}
