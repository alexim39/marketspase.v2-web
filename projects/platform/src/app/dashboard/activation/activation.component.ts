import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError, userError } from '../../core/http/api-error';
import { OnboardingService } from '../../core/onboarding/onboarding.service';
import { PartnerInterface, PartnerService } from '../../_common/services/partner.service';
import {
  OnboardingStatus,
  ShippingInput,
  StarterProduct,
} from '../../core/onboarding/onboarding.models';
import { States } from '../../_common/services/countries';

@Component({
  selector: 'async-activation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    PageSkeletonComponent,
    ReactiveFormsModule,
    RouterModule,
  ],
  template: `
    <section class="activation-page">
      <div class="page-head">
        <div>
          <p class="eyebrow">Partner activation</p>
          <h1>{{ isPartner() ? 'You are activated.' : 'Turn your account into a partner business.' }}</h1>
          <p class="muted lede">
            {{ isPartner()
              ? 'Your starter product is being prepared and your place in the allocation queue is secured.'
              : 'Complete the identity step, activate with the MarketSpase starter product, then receive qualified prospects from platform campaigns.' }}
          </p>
        </div>
        <a mat-stroked-button routerLink="/dashboard">
          <mat-icon>arrow_back</mat-icon>
          Dashboard
        </a>
      </div>

      @if (loading()) {
        <async-page-skeleton layout="form" [rows]="8" label="your activation status" [showHeader]="false" />
      } @else {
        @if (error(); as err) {
          <div class="alert" role="alert">
            <mat-icon>error_outline</mat-icon>
            <p>{{ err }}</p>
            <button mat-icon-button type="button" (click)="error.set(null)" aria-label="Dismiss error">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        }

        @if (isPartner()) {
          <div class="success-hero">
            <div class="success-mark"><mat-icon>verified</mat-icon></div>
            <div>
              <p class="eyebrow">Account status</p>
              <h2>{{ justActivated() ? 'Activation complete' : 'Activated partner' }}</h2>
              @if (partner()?.activatedAt; as activatedAt) {
                <p class="muted">Activated {{ activatedAt | date: 'mediumDate' }}</p>
              }
              <div class="success-facts">
                <span><strong>{{ order()?.orderNumber ?? 'Order processing' }}</strong>Order</span>
                <span><strong>{{ order()?.amount | number: '1.0-0' }}</strong>Wallet paid (₦)</span>
                <span><strong>{{ order()?.status ?? 'Paid' }}</strong>Product status</span>
              </div>
            </div>
          </div>

          <div class="content-grid">
            <div class="panel">
              <div class="panel-head">
                <div>
                  <p class="eyebrow">Allocation</p>
                  <h3>Your campaign queue</h3>
                </div>
                <span class="status-pill" [class.queued]="queue()?.status === 'queued'">
                  {{ queue()?.status ?? 'preparing' }}
                </span>
              </div>
              <p class="queue-copy">{{ queueCopy() }}</p>
              @if (queue()?.position; as position) {
                <div class="queue-position">
                  <strong>#{{ position }}</strong>
                  <span>Your current place in the activation queue</span>
                </div>
              }
              <div class="next-list">
                <div><mat-icon>inventory_2</mat-icon><p>Your starter product is packed and dispatched to the delivery address on your order.</p></div>
                <div><mat-icon>hub</mat-icon><p>When an eligible campaign has capacity, you are placed with a campaign owner and mentor.</p></div>
                <div><mat-icon>trending_up</mat-icon><p>Your Level 1 commission starts when allocated prospects convert; your mentor earns the separate activation mentor bonus.</p></div>
              </div>
            </div>

            <div class="panel">
              <p class="eyebrow">What you unlocked</p>
              <h3>Partner toolkit</h3>
              <ul class="check-list">
                <li><mat-icon>check_circle</mat-icon>Campaign-funded prospect allocation</li>
                <li><mat-icon>check_circle</mat-icon>Five-level, rank-depth-capped partner commission plan</li>
                <li><mat-icon>check_circle</mat-icon>Mentorship and activation support</li>
                <li><mat-icon>check_circle</mat-icon>Starter product for your own retail sales</li>
              </ul>
              <div class="actions">
                <a mat-flat-button color="primary" routerLink="/dashboard/campaigns">Fund a growth campaign</a>
                <a mat-button routerLink="/dashboard">Go to my dashboard</a>
                <a mat-button routerLink="/dashboard/compensation">Compensation</a>
                <a mat-button routerLink="/dashboard/wallet">View wallet</a>
              </div>
            </div>
          </div>
        } @else {
          <ol class="stepper" aria-label="Activation progress">
            <li class="done">
              <span class="step-dot"><mat-icon>check</mat-icon></span>
              <span><strong>Email verified</strong><small>{{ partner()?.email }}</small></span>
            </li>
            <li [class.done]="kycSubmitted()" [class.active]="!kycSubmitted()">
              <span class="step-dot">{{ kycSubmitted() ? '✓' : '2' }}</span>
              <span><strong>Identity check</strong><small>{{ kycStatusText() }}</small></span>
            </li>
            <li [class.done]="walletReady()" [class.active]="kycSubmitted() && !walletReady()">
              <span class="step-dot">{{ walletReady() ? '✓' : '3' }}</span>
              <span><strong>Starter product</strong><small>{{ walletReady() ? 'Wallet ready' : 'Fund your wallet' }}</small></span>
            </li>
          </ol>

          <div class="content-grid">
            <div class="panel">
              <div class="panel-head">
                <div>
                  <p class="eyebrow">Step 2</p>
                  <h3>Identity check</h3>
                </div>
                <span class="status-pill" [class.verified]="kycSubmitted()">
                  {{ kycStatusText() }}
                </span>
              </div>

              @if (kycSubmitted()) {
                <div class="notice success">
                  <mat-icon>verified_user</mat-icon>
                  <p>Identity check complete. No documents or address details are needed right now.</p>
                </div>
              } @else {
                <div class="notice">
                  <mat-icon>badge</mat-icon>
                  <p>No identity documents are needed right now. Complete this step to unlock activation.</p>
                </div>
                <div class="form-actions">
                  <button mat-flat-button color="primary" type="button" [disabled]="busy() !== null" (click)="submitKyc()">
                    {{ busy() === 'kyc' ? 'Completing…' : 'Complete identity step' }}
                  </button>
                  <span class="muted small">This is recorded automatically. Document verification can be added later when it is reintroduced.</span>
                </div>
              }
            </div>

            <div class="panel">
              <div class="panel-head">
                <div>
                  <p class="eyebrow">Step 3</p>
                  <h3>Activate with the starter product</h3>
                </div>
                @if (product(); as p) {
                  <span class="price">₦{{ p.price | number: '1.0-0' }}</span>
                }
              </div>

              @if (product(); as p) {
                <div class="product">
                  <div class="product-gallery">
                    <button
                      type="button"
                      class="product-art zoom-frame"
                      [class.is-zooming]="zooming()"
                      (mousemove)="onZoomMove($event)"
                      (mouseleave)="onZoomLeave()"
                      (click)="openLightbox()"
                      [attr.aria-label]="'View larger image: ' + gallery[activeImage()].alt">
                      <img
                        [src]="gallery[activeImage()].src"
                        [alt]="gallery[activeImage()].alt"
                        [style.transform-origin]="zoomOrigin()" />
                      <span class="zoom-hint">
                        <mat-icon aria-hidden="true">zoom_in</mat-icon>
                        Hover to zoom · tap to expand
                      </span>
                    </button>
                    <div class="thumbs" role="group" aria-label="Hoodie views">
                      @for (image of gallery; track image.src; let i = $index) {
                        <button
                          type="button"
                          class="thumb"
                          [class.active]="activeImage() === i"
                          [attr.aria-pressed]="activeImage() === i"
                          [attr.aria-label]="'Show ' + image.alt"
                          (click)="selectImage(i)">
                          <img [src]="image.src" [alt]="image.alt" />
                        </button>
                      }
                    </div>
                  </div>
                  <div>
                    <h4>{{ p.name }}</h4>
                    <p class="muted">{{ p.description }}</p>
                    <ul class="mini-list">
                      <li>Premium clothing set — two hoodie looks to choose from</li>
                      <li>Nationwide delivery included</li>
                      <li>Activation and onboarding access</li>
                    </ul>
                  </div>
                </div>

                <form [formGroup]="shippingForm" (ngSubmit)="pay()" class="form-grid shipping-grid">
                  <mat-form-field appearance="outline" class="span-2">
                    <mat-label>Full name</mat-label>
                    <input matInput formControlName="fullName" autocomplete="name" />
                    @if (shippingForm.get('fullName')?.touched && shippingForm.get('fullName')?.hasError('required')) {
                      <mat-error>Full name is required.</mat-error>
                    }
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Phone</mat-label>
                    <input matInput formControlName="phone" autocomplete="tel" />
                    @if (shippingForm.get('phone')?.touched && shippingForm.get('phone')?.hasError('required')) {
                      <mat-error>Phone number is required.</mat-error>
                    }
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>State</mat-label>
                    <mat-select formControlName="state">
                      @for (state of states; track state) {
                        <mat-option [value]="state">{{ state }}</mat-option>
                      }
                    </mat-select>
                    @if (shippingForm.get('state')?.touched && shippingForm.get('state')?.hasError('required')) {
                      <mat-error>State is required.</mat-error>
                    }
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="span-2">
                    <mat-label>Street address</mat-label>
                    <input matInput formControlName="street" autocomplete="street-address" />
                    @if (shippingForm.get('street')?.touched) {
                      @if (shippingForm.get('street')?.hasError('required')) {
                        <mat-error>Street address is required.</mat-error>
                      } @else if (shippingForm.get('street')?.hasError('minlength')) {
                        <mat-error>Enter at least 3 characters.</mat-error>
                      }
                    }
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>City</mat-label>
                    <input matInput formControlName="city" autocomplete="address-level2" />
                    @if (shippingForm.get('city')?.touched && shippingForm.get('city')?.hasError('required')) {
                      <mat-error>City is required.</mat-error>
                    }
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Country</mat-label>
                    <input matInput formControlName="country" autocomplete="country-name" />
                    @if (shippingForm.get('country')?.touched && shippingForm.get('country')?.hasError('required')) {
                      <mat-error>Country is required.</mat-error>
                    }
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="span-2">
                    <mat-label>Delivery note (optional)</mat-label>
                    <textarea matInput rows="2" formControlName="notes"></textarea>
                  </mat-form-field>
                </form>

                <p class="muted small centre">This delivery address is saved back to your profile and used for shipping.</p>

                <div class="wallet-box">
                  <div>
                    <span class="muted small">Wallet balance</span>
                    <strong>₦{{ wallet() | number: '1.0-0' }}</strong>
                  </div>
                  @if (shortfall(); as gap) {
                    <div class="shortfall">
                      <span>You need ₦{{ gap | number: '1.0-0' }} more</span>
                      <a mat-stroked-button routerLink="/dashboard/wallet/deposit">Fund wallet</a>
                    </div>
                  } @else {
                    <span class="ready"><mat-icon>check_circle</mat-icon>Ready to activate</span>
                  }
                </div>

                @if (!kycSubmitted()) {
                  <div class="notice">
                    <mat-icon>info</mat-icon>
                    <p>Submit your identity check first, then pay from your wallet.</p>
                  </div>
                }

                <button
                  mat-flat-button
                  color="primary"
                  type="button"
                  class="pay-btn"
                  [disabled]="!canPay() || busy() !== null"
                  (click)="pay()">
                  @if (busy() === 'order') {
                    Activating…
                  } @else {
                    Activate and pay ₦{{ p.price | number: '1.0-0' }}
                  }
                </button>
                <p class="muted small centre">Your order is idempotent: retrying a failed response never charges you twice.</p>
              } @else {
                <div class="notice">
                  <mat-icon>inventory_2</mat-icon>
                  <p>The starter product is not available right now. Contact support so we can open activation for you.</p>
                </div>
              }
            </div>
          </div>
        }
      }

      @if (lightboxOpen()) {
        <div class="lightbox" role="dialog" aria-modal="true" aria-label="Hoodie image preview" (click)="closeLightbox()">
          <button type="button" class="lightbox-close" aria-label="Close image preview" (click)="closeLightbox(); $event.stopPropagation()">
            <mat-icon aria-hidden="true">close</mat-icon>
          </button>
          <div class="lightbox-inner" (click)="$event.stopPropagation()">
            <img [src]="gallery[activeImage()].src" [alt]="gallery[activeImage()].alt" />
            <div class="lightbox-thumbs" role="group" aria-label="Hoodie views">
              @for (image of gallery; track image.src; let i = $index) {
                <button
                  type="button"
                  class="thumb"
                  [class.active]="activeImage() === i"
                  [attr.aria-pressed]="activeImage() === i"
                  [attr.aria-label]="'Show ' + image.alt"
                  (click)="selectImage(i)">
                  <img [src]="image.src" [alt]="image.alt" />
                </button>
              }
            </div>
          </div>
        </div>
      }
    </section>
  `,
  styles: [`
    .activation-page { max-width: 1120px; margin: 0 auto; padding: 24px; }
    .page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(1.7rem, 3vw, 2.4rem); letter-spacing: -0.03em; line-height: 1.1; }
    .lede { max-width: 680px; margin: 0; line-height: 1.6; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
    .muted { color: var(--ms-text-muted); }
    .small { font-size: 0.78rem; }
    .centre { text-align: center; margin: 10px 0 0; }
    .panel { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 16px; padding: 20px; box-shadow: 0 16px 40px rgba(15, 13, 28, 0.06); }
    .loading-panel { display: grid; gap: 14px; place-items: center; padding: 48px; }
    .content-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: 18px; align-items: start; }
    .panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
    .panel-head h3 { margin: 4px 0 0; font-size: 1.18rem; }
    .stepper { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; list-style: none; padding: 0; margin: 0 0 18px; }
    .stepper li { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid var(--ms-line); border-radius: 12px; background: var(--ms-surface); opacity: 0.72; }
    .stepper li.active { opacity: 1; border-color: var(--ms-primary); box-shadow: 0 0 0 3px var(--ms-primary-soft); }
    .stepper li.done { opacity: 1; }
    .stepper li span { display: grid; gap: 2px; min-width: 0; }
    .stepper strong { font-size: 0.88rem; }
    .stepper small { color: var(--ms-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .step-dot { width: 30px; height: 30px; flex: 0 0 30px; border-radius: 999px; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 800; }
    .done .step-dot { background: var(--ms-success-soft); color: var(--ms-success); }
    .step-dot mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 12px; }
    .span-2 { grid-column: span 2; }
    mat-form-field { width: 100%; }
    .form-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0 2px; }
    .notice { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 12px; background: var(--ms-info-soft); color: var(--ms-info); margin: 2px 0 14px; }
    .notice.success { background: var(--ms-success-soft); color: var(--ms-success); }
    .notice p { margin: 0; line-height: 1.5; }
    .notice mat-icon { flex: 0 0 auto; }
    .status-pill { align-self: center; padding: 5px 10px; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }
    .status-pill.verified, .status-pill.queued { background: var(--ms-success-soft); color: var(--ms-success); }
    .price { color: var(--ms-primary-strong); font-size: 1.2rem; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .product { display: grid; grid-template-columns: minmax(200px, 240px) minmax(0, 1fr); gap: 18px; margin-bottom: 18px; align-items: start; }
    .product h4 { margin: 0 0 6px; font-size: 1.08rem; }
    .product p { margin: 0 0 10px; line-height: 1.55; }
    .product-gallery { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
    .product-art {
      position: relative;
      width: 100%;
      aspect-ratio: 4 / 5;
      padding: 0;
      border: 1px solid var(--ms-line);
      border-radius: 16px;
      background: linear-gradient(160deg, #f8f7ff, #ece9ff 58%, #e1dcff);
      overflow: hidden;
      cursor: zoom-in;
      display: block;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5);
    }
    .product-art img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 10px;
      transition: transform 0.12s linear;
      will-change: transform;
    }
    .zoom-frame.is-zooming img { transform: scale(2.1); }
    .zoom-hint {
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 6px 8px;
      border-radius: 999px;
      background: rgba(20, 18, 43, 0.74);
      color: #fff;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.01em;
      backdrop-filter: blur(6px);
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 0.18s ease, transform 0.18s ease;
      pointer-events: none;
    }
    .product-art:hover .zoom-hint,
    .product-art:focus-visible .zoom-hint { opacity: 1; transform: translateY(0); }
    .zoom-hint mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .thumbs { display: flex; gap: 8px; }
    .thumb {
      width: 54px;
      aspect-ratio: 4 / 5;
      padding: 0;
      border: 1px solid var(--ms-line);
      border-radius: 10px;
      overflow: hidden;
      background: var(--ms-surface);
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .thumb:hover, .thumb:focus-visible { opacity: 1; }
    .thumb.active { opacity: 1; border-color: var(--ms-primary); box-shadow: 0 0 0 2px var(--ms-primary-soft); }
    .lightbox {
      position: fixed;
      inset: 0;
      z-index: 2000;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(10, 8, 24, 0.9);
      backdrop-filter: blur(10px);
      animation: lightbox-in 0.18s ease;
    }
    .lightbox-inner { display: flex; flex-direction: column; align-items: center; gap: 14px; max-width: min(92vw, 920px); max-height: 90vh; }
    .lightbox-inner > img { max-width: 100%; max-height: 74vh; object-fit: contain; border-radius: 18px; background: #fff; box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4); }
    .lightbox-thumbs { display: flex; gap: 10px; }
    .lightbox-thumbs .thumb { width: 64px; }
    .lightbox-close {
      position: absolute;
      top: 20px;
      right: 20px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.25);
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      display: grid;
      place-items: center;
      cursor: pointer;
      backdrop-filter: blur(6px);
    }
    .lightbox-close:hover { background: rgba(255, 255, 255, 0.22); }
    @keyframes lightbox-in { from { opacity: 0; } to { opacity: 1; } }
    .mini-list, .check-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 7px; }
    .mini-list li { color: var(--ms-text-muted); font-size: 0.86rem; }
    .mini-list li::before { content: '•'; color: var(--ms-primary); margin-right: 7px; }
    .check-list li { display: flex; align-items: center; gap: 8px; }
    .check-list mat-icon { color: var(--ms-success); font-size: 18px; width: 18px; height: 18px; }
    .shipping-grid { margin-top: 4px; }
    .wallet-box { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px; border: 1px solid var(--ms-line); border-radius: 12px; background: var(--ms-canvas); margin: 8px 0 12px; flex-wrap: wrap; }
    .wallet-box > div { display: grid; gap: 2px; }
    .wallet-box strong { font-size: 1.2rem; font-variant-numeric: tabular-nums; }
    .shortfall { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; color: var(--ms-warning); font-weight: 650; }
    .ready { display: inline-flex; align-items: center; gap: 6px; color: var(--ms-success); font-weight: 700; }
    .ready mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .pay-btn { width: 100%; min-height: 48px; margin-top: 4px; font-weight: 800; }
    .alert { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 12px; background: var(--ms-error-soft); color: var(--ms-error); margin-bottom: 16px; }
    .alert p { margin: 0; line-height: 1.5; flex: 1; }
    .success-hero { display: flex; gap: 18px; align-items: center; padding: 26px; border-radius: 20px; color: #fff; background: linear-gradient(135deg, #14122b 0%, #2b2760 58%, #4f46e5 100%); margin-bottom: 18px; box-shadow: 0 22px 50px rgba(43, 39, 96, 0.28); }
    .success-hero h2 { margin: 4px 0 4px; font-size: 1.8rem; }
    .success-hero .muted { color: rgba(255, 255, 255, 0.72); margin: 0; }
    .success-hero .eyebrow { color: #c7d2fe; }
    .success-mark { flex: 0 0 62px; width: 62px; height: 62px; display: grid; place-items: center; border-radius: 18px; background: rgba(255, 255, 255, 0.14); }
    .success-mark mat-icon { font-size: 36px; width: 36px; height: 36px; }
    .success-facts { display: flex; gap: 22px; flex-wrap: wrap; margin-top: 16px; }
    .success-facts span { display: grid; gap: 2px; font-size: 0.72rem; color: rgba(255, 255, 255, 0.68); text-transform: uppercase; letter-spacing: 0.08em; }
    .success-facts strong { font-size: 1rem; color: #fff; letter-spacing: 0; text-transform: none; }
    .queue-copy { font-size: 1.02rem; line-height: 1.55; margin: 0 0 14px; }
    .queue-position { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 12px; background: var(--ms-primary-soft); margin-bottom: 16px; }
    .queue-position strong { font-size: 1.8rem; color: var(--ms-primary-strong); font-variant-numeric: tabular-nums; }
    .queue-position span { color: var(--ms-text-muted); font-size: 0.86rem; }
    .next-list { display: grid; gap: 12px; }
    .next-list div { display: flex; gap: 10px; align-items: flex-start; }
    .next-list mat-icon { color: var(--ms-primary-strong); flex: 0 0 auto; }
    .next-list p { margin: 0; color: var(--ms-text-muted); line-height: 1.5; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 18px; }
    @media (max-width: 900px) {
      .activation-page { padding: 16px; }
      .page-head { flex-direction: column; }
      .content-grid { grid-template-columns: minmax(0, 1fr); }
      .stepper { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 560px) {
      .form-grid { grid-template-columns: minmax(0, 1fr); }
      .span-2 { grid-column: span 1; }
      .product { grid-template-columns: minmax(0, 1fr); }
      .product-art { aspect-ratio: 1 / 1; }
      .lightbox { padding: 16px; }
      .lightbox-close { top: 12px; right: 12px; }
      .success-hero { align-items: flex-start; padding: 20px; }
      .success-facts { gap: 14px; }
      .form-actions { flex-direction: column; align-items: flex-start; }
    }
  `],
})
export class ActivationComponent implements OnInit {
  private readonly onboarding = inject(OnboardingService);
  private readonly partnerSvc = inject(PartnerService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly checkoutKey = globalThis.crypto?.randomUUID?.()
    ?? `activation-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  protected readonly loading = signal(true);
  protected readonly busy = signal<'kyc' | 'order' | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<OnboardingStatus | null>(null);
  protected readonly products = signal<StarterProduct[]>([]);
  protected readonly justActivated = signal(false);
  protected readonly activeImage = signal(0);
  protected readonly zooming = signal(false);
  protected readonly zoomOrigin = signal('50% 50%');
  protected readonly lightboxOpen = signal(false);
  protected readonly gallery = [
    {
      src: '/img/activation-hoodi.jpeg',
      alt: 'MarketSpase activation hoodie — look one',
    },
    {
      src: '/img/activation-hoodi2.jpeg',
      alt: 'MarketSpase activation hoodie — look two',
    },
  ];

  protected readonly partner = computed(() => this.status()?.partner ?? null);
  protected readonly order = computed(() => this.status()?.activationOrder ?? null);
  protected readonly queue = computed(() => this.status()?.queue ?? null);
  protected readonly product = computed(() => this.products()[0] ?? null);
  protected readonly wallet = computed(() => this.partner()?.balance ?? 0);
  protected readonly isPartner = computed(() => this.partner()?.accountState === 'partner');
  protected readonly kycStatus = computed(() => this.partner()?.kycStatus ?? 'not_started');
  protected readonly kycSubmitted = computed(() => {
    const status = this.kycStatus();
    return status === 'pending' || status === 'verified';
  });
  protected readonly walletReady = computed(() => {
    const product = this.product();
    return !!product && this.wallet() >= product.price;
  });
  protected readonly shortfall = computed(() => {
    const product = this.product();
    if (!product) return 0;
    return Math.max(0, product.price - this.wallet());
  });
  protected readonly queueCopy = computed(() => {
    const entry = this.queue();
    if (!entry) return 'Your allocation entry is being prepared.';
    if (entry.status === 'queued') {
      return entry.position
        ? `You are queued for allocation and currently hold position #${entry.position}.`
        : 'You are in the allocation queue. Position updates as earlier activations are placed.';
    }
    if (entry.status === 'allocated') {
      return 'You have been allocated to a campaign owner. Your mentor will contact you with the next campaign steps.';
    }
    return 'Your queue entry is closed. Contact support if this is unexpected.';
  });

  protected readonly states = States;

  protected readonly shippingForm = this.fb.nonNullable.group({
    fullName: ['', Validators.required],
    phone: ['', Validators.required],
    street: ['', [Validators.required, Validators.minLength(3)]],
    city: ['', Validators.required],
    state: ['', Validators.required],
    country: ['Nigeria', Validators.required],
    notes: [''],
  });

  ngOnInit(): void {
    this.refresh();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closeLightbox();
  }

  protected selectImage(index: number): void {
    this.activeImage.set(index);
    this.zoomOrigin.set('50% 50%');
    this.zooming.set(false);
  }

  protected onZoomMove(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.min(Math.max(((event.clientX - rect.left) / rect.width) * 100, 0), 100);
    const y = Math.min(Math.max(((event.clientY - rect.top) / rect.height) * 100, 0), 100);
    this.zoomOrigin.set(`${x}% ${y}%`);
    this.zooming.set(true);
  }

  protected onZoomLeave(): void {
    this.zooming.set(false);
    this.zoomOrigin.set('50% 50%');
  }

  protected openLightbox(): void {
    this.zooming.set(false);
    this.lightboxOpen.set(true);
  }

  protected closeLightbox(): void {
    this.lightboxOpen.set(false);
    this.zooming.set(false);
    this.zoomOrigin.set('50% 50%');
  }

  protected submitKyc(): void {
    if (this.busy()) return;

    this.busy.set('kyc');
    this.error.set(null);
    this.onboarding.submitKyc({}).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.busy.set(null)),
    ).subscribe({
      next: (response) => {
        this.status.update((current) => current ? {
          ...current,
          kyc: response.data,
          partner: { ...current.partner, kycStatus: response.data.status },
        } : current);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected pay(): void {
    const product = this.product();
    const partner = this.partner();
    if (!product || !partner || this.busy()) return;
    if (!this.kycSubmitted()) {
      this.error.set('Submit your identity check before paying.');
      return;
    }
    if (this.shippingForm.invalid) {
      this.shippingForm.markAllAsTouched();
      this.error.set('Complete the delivery address before activating.');
      return;
    }
    if (partner.balance < product.price) {
      this.error.set('Your wallet balance is too low. Fund your wallet and try again.');
      return;
    }

    this.busy.set('order');
    this.error.set(null);
    this.onboarding.createOrder({
      productId: product.id,
      shipping: this.shippingForm.getRawValue() as ShippingInput,
      idempotencyKey: this.checkoutKey,
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.busy.set(null)),
    ).subscribe({
      next: (response) => {
        const { order, queue, partner: updated } = response.data;
        this.status.update((current) => current ? {
          ...current,
          partner: updated ?? { ...current.partner, accountState: 'partner' },
          activationOrder: order,
          queue,
        } : current);
        this.justActivated.set(!response.data.repeated);
        this.auth.me().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
        this.refreshSharedPartner();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected canPay(): boolean {
    return this.kycSubmitted()
      && this.shippingForm.valid
      && this.walletReady()
      && !this.isPartner();
  }

  protected kycStatusText(): string {
    const status = this.kycStatus();
    if (status === 'verified' || status === 'pending') return 'Verified';
    return 'Not started';
  }

  private refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      status: this.onboarding.status(),
      products: this.onboarding.products(),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: ({ status, products }) => {
        this.status.set(status.data);
        this.products.set(products.data);
        this.prefill(status.data);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  private prefill(status: OnboardingStatus): void {
    const name = [status.partner.name, status.partner.surname].filter(Boolean).join(' ').trim();
    const address = status.partner.address;
    this.shippingForm.patchValue({
      fullName: name,
      phone: status.partner.phone,
      street: address?.street ?? '',
      city: address?.city ?? '',
      state: address?.state ?? '',
      country: address?.country ?? 'Nigeria',
    }, { emitEvent: false });
  }

  /** Keep the shared partner cache current so Settings shows the shipping address too. */
  private refreshSharedPartner(): void {
    this.partnerSvc.getPartner({ fresh: true }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: { success?: boolean; data?: PartnerInterface }) => {
        if (res?.success && res.data) this.partnerSvc.updatePartnerService(res.data);
      },
      error: () => undefined,
    });
  }
}
