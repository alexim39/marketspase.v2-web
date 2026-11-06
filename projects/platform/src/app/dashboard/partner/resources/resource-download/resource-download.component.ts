import {Component, inject, Input, ChangeDetectionStrategy} from '@angular/core';
import {MatTabsModule} from '@angular/material/tabs';
import { PartnerInterface } from '../../../../_common/services/partner.service';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { HelpDialogComponent } from '../../../../_common/help-dialog.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { TextDownloadComponent } from './text-download/text-download.component';
import { ImageDownloadComponent } from './image-download/image-download.component';



/**
 * @title Content library — ready-made texts and images with your link.
 */
@Component({
selector: 'async-resource-download',
template: `

<section class="breadcrumb-wrapper">
  <div class="breadcrumb">
    <a routerLink="/dashboard">Dashboard</a> &gt;
    <a>Marketing</a> &gt;
    <a>Share</a> &gt;
    <span>Content library</span>
  </div>
</section>

<section class="library-page">
  <div class="page-head">
    <div>
      <h2>Content library</h2>
      <p class="subtitle">Copy, download or send straight into outreach — every text carries your personal link.</p>
    </div>
    <button mat-button (click)="showDescription()">What is this?</button>
  </div>

  <section class="dp-card library-card">
    <mat-tab-group>
      <mat-tab label="Texts">
        @if (partner) {
          <async-text-download [partner]="partner"/>
        }
      </mat-tab>
      <mat-tab label="Images">
        @if (partner) {
          <async-image-download [partner]="partner"/>
        }
      </mat-tab>
    </mat-tab-group>
  </section>
</section>

`,
styles: [`

.library-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
.page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
.page-head h2 { margin: 0; }
.page-head button { min-height: 44px; }
.subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
.library-card { padding: 1em; }
.breadcrumb-wrapper { margin-bottom: 1em; }
.breadcrumb a { text-decoration: none; }

`],
changeDetection: ChangeDetectionStrategy.Eager,
imports: [MatTabsModule, MatIconModule, MatButtonModule, RouterModule, TextDownloadComponent, ImageDownloadComponent]
})
export class ResourceDownloadComponent {
  @Input() partner!: PartnerInterface;
  subscriptions: Subscription[] = [];
  readonly dialog = inject(MatDialog);

  showDescription () {
    this.dialog.open(HelpDialogComponent, {
      data: {help: 'Pick a text or image, copy it or send it straight into SMS or Email outreach — your personal link is attached automatically.'},
    });
  }

  ngOnDestroy() {
    // unsubscribe list
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
