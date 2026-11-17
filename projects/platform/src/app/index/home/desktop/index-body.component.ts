import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BannerComponent } from '../../banner/banner.component';
import { IntroVideoComponent } from '../../intro-video/intro-video.component';
import { OraShowcaseComponent } from '../../ora-showcase/ora-showcase.component';
import { PathwayComponent } from '../../pathway/pathway.component';
import { FaqComponent } from '../../faq/faq.component';
import { MoneyComponent } from '../../money/money.component';

@Component({
    selector: 'async-landing-desktop',
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
    changeDetection: ChangeDetectionStrategy.Eager,
    styles: [``]
})
export class LandingDesktopComponent {}
