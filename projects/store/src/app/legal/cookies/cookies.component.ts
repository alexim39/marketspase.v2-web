import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { RouterModule } from '@angular/router';
import { SeoService } from '../../_common/services/seo.service';

@Component({
    selector: 'async-cookies',
    templateUrl: './cookies.component.html',
    imports: [MatButtonModule, MatDividerModule, MatListModule, RouterModule],
    changeDetection: ChangeDetectionStrategy.Eager,
    styles: [`
    .content {
      p {
        text-align: justify;
      }
      ul, ol {
        li {
          margin-bottom: 10px;
          text-align: justify;
        }
      }
    }
  `]
})
export class CookiesComponent implements OnInit {
  constructor(private seo: SeoService) {}

  ngOnInit(): void {
    this.seo.setPage({
      title: 'Cookie Policy | MarketSpase Store',
      description: 'How MarketSpase Store uses cookies and how you can control them.',
      path: '/legal/cookies'
    });
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

