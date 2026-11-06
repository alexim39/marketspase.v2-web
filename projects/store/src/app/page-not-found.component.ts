import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { SeoService } from './_common/services/seo.service';

/**
 * @title Page not found component
 */
@Component({
    selector: 'async-page-not-found',
    imports: [MatButtonModule, RouterModule],
    styles: [`
:host {
  display: block;
  background: var(--dp-paper);
  color: var(--dp-text);
}

.page_404 {
    padding: 48px 1em;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}

.four_zero_four_bg {
    background: radial-gradient(circle at 50% 30%, #1a1440 0%, #050111 60%, #03010f 100%);
    border: 1px solid var(--dp-gold);
    height: 360px;
    width: min(45%, 100%);
    max-width: 640px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    h1 {
        font-size: 80px;
        margin: 0;
        color: var(--dp-gold-bright);
        text-align: center;
    }
}

.contant_box_404 {
    margin-top: 1.5em;
    text-align: center;
    padding: 1em;
    h2 {
        font-size: 1.6rem;
        margin: 0 0 0.5em;
    }
    p {
        padding: 0.5em 0 1.25em;
    }
    button {
        min-height: 48px;
        padding: 0 1.5em;
    }
}

@media only screen and (max-width: 600px) {
    .four_zero_four_bg {
        height: 240px;
        width: 100%;
    }
    .contant_box_404 {
        h2 {
            font-size: 1.25rem;
        }
    }
}
`],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
<section class="page_404">
    <div class="four_zero_four_bg">
        <h1>404</h1>
    </div>

    <div class="contant_box_404">
        <h2>It looks like you have clicked on the wrong link</h2>
        <p>The page you are looking for is not available.</p>
        <button mat-flat-button color="accent" routerLink="/" routerLinkActive="active-link" [routerLinkActiveOptions]="{exact: true}">Go to Home</button>
    </div>
</section>
`
})
export class PageNotFoundComponent implements OnInit {
  constructor(private seo: SeoService) {}

  ngOnInit(): void {
    this.seo.setNotFound('Page not found', '/404');
  }
}
