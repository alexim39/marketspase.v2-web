import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { MediaGalleryComponent } from '@marketspase/shared/ui/media-gallery/media-gallery.component';
import { MobilePageShellComponent } from '@marketspase/shared/ui/mobile-page-shell/mobile-page-shell.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { ProductPageFacade } from '../state/product-page.facade';

@Component({
  selector: 'async-product-page-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, MatButtonModule, MatIconModule, MediaGalleryComponent, MobilePageShellComponent, PageSkeletonComponent, RouterModule],
  templateUrl: './product-page.component.html',
  styleUrls: ['./product-page.component.scss'],
})
export class ProductPageMobileComponent implements OnInit {
  protected readonly vm = inject(ProductPageFacade);

  ngOnInit(): void {
    this.vm.ensureLoaded();
  }
}
