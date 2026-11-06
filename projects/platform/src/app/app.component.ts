import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeTogglerService } from './_common/services/theme-toggler.service';
import { OfflineBannerComponent } from './core/offline/offline-banner.component';



@Component({
selector: 'async-root',
imports: [RouterOutlet, OfflineBannerComponent],
template: `
  <div id="container">
    <div class="body">
      <async-offline-banner/>
      <router-outlet/>
    </div>
  </div>
  `,
changeDetection: ChangeDetectionStrategy.Eager,
styles: [`

#container {
  .body {
    display: grid;
    min-height: 100vh;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr auto;
  }
}

/* Extra small devices (phones, 600px and down) */
@media only screen and (max-width: 600px) {
  #container {
    display:flex;
    flex-direction: column;
  }
}
  
`]
})
export class AppComponent implements OnInit {
  private readonly themes = inject(ThemeTogglerService);

  ngOnInit(): void {
    this.themes.init();
  }
}
