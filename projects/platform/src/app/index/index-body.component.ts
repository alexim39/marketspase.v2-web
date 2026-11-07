import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BannerComponent } from './banner/banner.component';
import { IntroVideoComponent } from './intro-video/intro-video.component';
import { WhyNowComponent } from './why-now/why-now.component';
import { PillarsComponent } from './pillars/pillars.component';
import { OraShowcaseComponent } from './ora-showcase/ora-showcase.component';
import { PathwayComponent } from './pathway/pathway.component';
import { WhyWeExistComponent } from './why-we-exist/why-we-exist.component';
import { FaqComponent } from './faq/faq.component';
import { BePartnerComponent } from './be-partner/be-partner.component';

@Component({
    selector: 'async-index-body',
    imports: [
        BannerComponent,
        IntroVideoComponent,
        WhyNowComponent,
        PillarsComponent,
        OraShowcaseComponent,
        PathwayComponent,
        WhyWeExistComponent,
        FaqComponent,
        BePartnerComponent,
    ],
    template: `
    <async-banner></async-banner>
    <async-index-intro-video></async-index-intro-video>
    <async-index-why-now></async-index-why-now>
    <async-index-pillars></async-index-pillars>
    <async-index-ora-showcase></async-index-ora-showcase>
    <async-index-pathway></async-index-pathway>
    <async-index-why-we-exist></async-index-why-we-exist>
    <async-index-faq></async-index-faq>
    <async-be-partner></async-be-partner>
  `,
    changeDetection: ChangeDetectionStrategy.Eager,
    styles: [``]
})
export class IndexBodyComponent {}
