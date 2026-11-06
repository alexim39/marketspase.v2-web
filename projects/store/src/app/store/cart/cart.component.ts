import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { CartService } from './cart.service';
import { storeProductImage } from '../store.service';

@Component({
  selector: 'async-store-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [CurrencyPipe, MatIconModule, RouterModule],
})
export class StoreCartComponent {
  protected readonly cart = inject(CartService);

  protected imageUrl(image: string): string {
    return storeProductImage(image);
  }
}
