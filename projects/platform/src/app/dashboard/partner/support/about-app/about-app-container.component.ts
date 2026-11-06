
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { AboutAppComponent } from './about-app.component';


@Component({
    selector: 'async-about-app-container',
    imports: [AboutAppComponent],
    providers: [],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<async-about-app />`
})
export class AboutAppContainerComponent {}
