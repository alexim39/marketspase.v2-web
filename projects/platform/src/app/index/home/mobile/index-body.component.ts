import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BannerComponent } from '../../banner/banner.component';
import { IntroVideoComponent } from '../../intro-video/intro-video.component';
import { OraShowcaseComponent } from '../../ora-showcase/ora-showcase.component';
import { PathwayComponent } from '../../pathway/pathway.component';
import { FaqComponent } from '../../faq/faq.component';
import { MoneyComponent } from '../../money/money.component';

/**
 * Mobile landing composition. The shared marketing sections already collapse
 * to one column; the device wrapper keeps the mobile chrome around them.
 */
@Component({
  selector: 'async-landing-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BannerComponent,
    IntroVideoComponent,
    OraShowcaseComponent,
    PathwayComponent,
    FaqComponent,
    MoneyComponent,
  ],
  template: `
    <async-banner></async-banner>
    <async-index-intro-video></async-index-intro-video>
    <async-index-pathway></async-index-pathway>
    <async-index-ora-showcase></async-index-ora-showcase>
    <async-index-money></async-index-money>
    <async-index-faq></async-index-faq>
  `,
})
export class LandingMobileComponent {}
