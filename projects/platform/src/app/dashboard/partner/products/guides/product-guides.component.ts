import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

/**
 * Product guides — short, practical answers for first-time buyers.
 * Resale tools arrive in a later phase; this page is honest about that.
 */
@Component({
  selector: 'async-product-guides',
  templateUrl: './product-guides.component.html',
  styleUrls: ['./product-guides.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterModule],
})
export class ProductGuidesComponent {}
