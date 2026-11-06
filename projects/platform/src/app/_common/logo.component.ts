import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BrandLogoComponent } from '@marketspase/shared/ui/brand-logo/brand-logo.component';

@Component({
  selector: 'async-logo',
  imports: [RouterModule, BrandLogoComponent],
  template: `
    <a
      [routerLink]="link"
      [style.color]="color"
      [class.compact]="compact"
      aria-label="MarketSpase home"
    >
      <async-brand-logo
        [variant]="compact ? 'mark-badge' : (theme === 'light' ? 'full-dark' : 'full-white')"
        [height]="compact ? '34px' : '2.5em'"
        alt=""
      />
    </a>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    a {
      text-decoration: none;
      display: flex;
      align-items: center;
      margin-left: 3em;
    }

    a.compact {
      margin-left: 0;
      justify-content: center;
      width: 100%;
    }

    @media screen and (max-width: 600px) {
      a {
        margin-left: 0;
      }
    }
  `],
})
export class LogoComponent {
  @Input() color = '#14122b';
  /** Where the logo points. The authenticated shell sends users to /dashboard. */
  @Input() link = '/';
  /** `light` selects the dark wordmark for a light background. */
  @Input() theme: 'dark' | 'light' = 'dark';
  /** Compact mode renders the branded badge for the collapsed rail. */
  @Input() compact = false;
}
