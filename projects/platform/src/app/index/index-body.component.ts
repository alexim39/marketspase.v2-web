import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BannerComponent } from './banner/banner.component';
import { PillarsComponent } from './pillars/pillars.component';
import { PathwayComponent } from './pathway/pathway.component';
import { WhyWeExistComponent } from './why-we-exist/why-we-exist.component';
import { BePartnerComponent } from './be-partner/be-partner.component';
import { FaqComponent } from './faq/faq.component';



@Component({
    selector: 'async-index-body',
    imports: [BannerComponent, PillarsComponent, PathwayComponent, WhyWeExistComponent, RouterModule, BePartnerComponent, FaqComponent,],
    template: `
    <async-banner></async-banner>
    <async-index-pillars></async-index-pillars>
    <async-index-pathway></async-index-pathway>
    <async-index-why-we-exist></async-index-why-we-exist>
    <async-index-faq></async-index-faq>
    <async-be-partner></async-be-partner>
  `,
    changeDetection: ChangeDetectionStrategy.Eager,
    styles: [` `]
})
export class IndexBodyComponent {}
