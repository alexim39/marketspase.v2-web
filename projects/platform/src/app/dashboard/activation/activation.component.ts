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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError, userError } from '../../core/http/api-error';
import { OnboardingService } from '../../core/onboarding/onboarding.service';
import { PartnerInterface, PartnerService } from '../../_common/services/partner.service';
import {
  ActivationTier,
  MentorContactPreference,
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
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
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
              ? 'Your activation product is being prepared and your place in the allocation queue is secured.'
              : 'Complete the identity step, choose the Essential or Signature plan, then receive qualified prospects from platform campaigns.' }}
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
              <h2>{{ justUpgraded() ? 'Upgrade complete' : justActivated() ? 'Activation complete' : 'Activated partner' }}</h2>
              @if (partner()?.activatedAt; as activatedAt) {
                <p class="muted">Activated {{ activatedAt | date: 'mediumDate' }}</p>
              }
              <div class="success-facts">
                <span><strong>{{ order()?.orderNumber ?? 'Order processing' }}</strong>Order</span>
                <span><strong>{{ planLabel(order()?.tier) }}</strong>Plan</span>
                <span><strong>₦{{ order()?.amount | number: '1.0-0' }}</strong>Wallet paid</span>
                <span><strong>{{ order()?.status ?? 'Paid' }}</strong>Product status</span>
              </div>
            </div>
          </div>

          @if (upgrade()?.eligible) {
            <div class="upgrade-card">
              <div>
                <p class="eyebrow">Signature upgrade</p>
                <h3>Add the Signature set for ₦{{ upgrade()?.price | number: '1.0-0' }}</h3>
                <p class="muted">
                  Your ₦{{ upgrade()?.credit | number: '1.0-0' }} activation payment is credited, plus
                  ₦{{ upgrade()?.handlingFee | number: '1.0-0' }} handling and second delivery. No deadline.
                  You keep your Essential set and earn the ₦1,200 mentor rate.
                </p>
              </div>
              <button mat-flat-button color="primary" type="button" (click)="openUpgrade()">Upgrade</button>
            </div>
          }

          <div class="content-grid">
            <div class="panel">
              @if (sponsor(); as sp) {
                <div class="panel-head">
                  <div>
                    <p class="eyebrow">Your sponsor</p>
                    <h3>Your team upline</h3>
                  </div>
                  <span class="status-pill verified">Connected</span>
                </div>
                <p class="queue-copy">{{ sp.name }} referred you. They are your sponsor, mentor and commission upline — no campaign allocation is needed.</p>
                <div class="next-list">
                  <div><mat-icon>inventory_2</mat-icon><p>Your activation product is packed and dispatched to the delivery address on your order.</p></div>
                  <div><mat-icon>handshake</mat-icon><p>{{ sp.name }} is your onboarding mentor. Reach out through Chat for your first steps.</p></div>
                  <div><mat-icon>trending_up</mat-icon><p>Your Level 1 commission starts when allocated prospects convert; your sponsor earns the activation mentor bonus.</p></div>
                </div>
              } @else {
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
                  <div><mat-icon>inventory_2</mat-icon><p>Your activation product is packed and dispatched to the delivery address on your order.</p></div>
                  <div><mat-icon>hub</mat-icon><p>When an eligible campaign has capacity, you are placed with a campaign owner and mentor.</p></div>
                  <div><mat-icon>trending_up</mat-icon><p>Your Level 1 commission starts when allocated prospects convert; your mentor earns the separate activation mentor bonus.</p></div>
                </div>
              }
            </div>

            <div class="panel">
              <p class="eyebrow">What you unlocked</p>
              <h3>Partner toolkit</h3>
              <ul class="check-list">
                <li><mat-icon>check_circle</mat-icon>Campaign-funded prospect allocation</li>
                <li><mat-icon>check_circle</mat-icon>Five-level, rank-depth-capped partner commission plan</li>
                <li><mat-icon>check_circle</mat-icon>Mentorship and activation support</li>
                <li><mat-icon>check_circle</mat-icon>Activation product for your own retail sales</li>
              </ul>
              <div class="actions">
                <a mat-flat-button color="primary" routerLink="/dashboard/campaigns">Fund a growth campaign</a>
                <a mat-button routerLink="/dashboard">Go to my dashboard</a>
                <a mat-button routerLink="/dashboard/settings/verification">Identity &amp; KYC</a>
                <a mat-button routerLink="/dashboard/compensation">Compensation</a>
                <a mat-button routerLink="/dashboard/wallet">View wallet</a>
              </div>
            </div>
          </div>

          @if (upgradeOpen()) {
            <div class="panel upgrade-panel">
              <div class="panel-head">
                <div>
                  <p class="eyebrow">Signature upgrade</p>
                  <h3>Confirm your upgrade</h3>
                </div>
                <button mat-icon-button type="button" aria-label="Close upgrade" (click)="closeUpgrade()">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
              <p>
                You pay ₦{{ upgrade()?.price | number: '1.0-0' }}. Bonus credit can be used for this
                upgrade; the Signature set ships to the address on your account.
              </p>
              @if (upgradeShortfall() > 0) {
                <div class="notice">
                  <mat-icon>account_balance_wallet</mat-icon>
                  <p>Fund ₦{{ upgradeShortfall() | number: '1.0-0' }} more to complete the upgrade.</p>
                </div>
              }
              <div class="form-actions">
                <button mat-flat-button color="primary" type="button"
                  [disabled]="!upgradeReady() || busy() !== null"
                  (click)="confirmUpgrade()">
                  {{ busy() === 'upgrade' ? 'Upgrading…' : 'Confirm upgrade' }}
                </button>
                <a mat-button routerLink="/dashboard/wallet">Fund wallet</a>
              </div>
            </div>
          }
        } @else {
          <header class="activation-hero">
            <div class="hero-copy">
              <p class="eyebrow">Partner activation</p>
              <h2>Choose your plan. Start your business.</h2>
              <p class="lede">
                Both plans unlock the same partner rights, commission table and rank path.
                Pick the clothing set you want delivered, then complete the short checkout.
              </p>
            </div>

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
                <span><strong>Payment</strong><small>{{ walletReady() ? 'Ready' : 'Fund wallet' }}</small></span>
              </li>
            </ol>
          </header>

          <div class="plan-picker" role="group" aria-label="Choose your activation plan">
            @for (plan of products(); track plan.id) {
              <button
                type="button"
                class="plan-card"
                [class.selected]="selectedTier() === plan.tier"
                [attr.aria-pressed]="selectedTier() === plan.tier"
                (click)="selectPlan(plan.tier)">
                <img class="plan-thumb" [src]="plan.imageUrl" [alt]="plan.name" />
                <span class="plan-body">
                  <span class="plan-top">
                    <span class="plan-badge">{{ plan.tier === 'essential' ? 'Start here' : 'Premium' }}</span>
                    <span class="plan-price">₦{{ plan.price | number: '1.0-0' }}</span>
                  </span>
                  <span class="plan-name">{{ plan.name }}</span>
                  <span class="plan-note">
                    {{ plan.tier === 'essential'
                      ? 'Full partner rights. Upgrade any time.'
                      : 'Signature set and the higher mentor rate.' }}
                  </span>
                </span>
                <mat-icon class="plan-check" aria-hidden="true">
                  {{ selectedTier() === plan.tier ? 'check_circle' : 'radio_button_unchecked' }}
                </mat-icon>
              </button>
            }
          </div>

          @if (bonusLocked() > 0) {
            <div class="notice bonus-note">
              <mat-icon>lock</mat-icon>
              <p>
                ₦{{ bonusLocked() | number: '1.0-0' }} of your wallet is bonus credit.
                Bonus unlocks after activation and cannot pay for a first activation.
              </p>
            </div>
          }

          <section class="panel identity-strip" aria-labelledby="identity-title">
            <div class="identity-main">
              <span class="status-pill" [class.verified]="kycSubmitted()">{{ kycStatusText() }}</span>
              <div>
                <h3 id="identity-title">Identity check</h3>
                <p class="muted small">
                  @if (kycSubmitted()) {
                    Identity check complete. No documents are needed right now.
                  } @else {
                    No documents are needed right now. This step completes automatically so you can activate.
                  }
                </p>
              </div>
            </div>
            @if (!kycSubmitted()) {
              <button mat-flat-button color="primary" type="button" [disabled]="busy() !== null" (click)="submitKyc()">
                {{ busy() === 'kyc' ? 'Completing…' : 'Complete identity step' }}
              </button>
            }
          </section>

          @if (product(); as p) {
            <div class="activation-layout">
              <div class="main-column">
                <section class="panel showcase" aria-labelledby="showcase-title">
                  <div class="showcase-head">
                    <div>
                      <p class="eyebrow">{{ p.tier === 'essential' ? 'Essential plan' : 'Signature plan' }}</p>
                      <h3 id="showcase-title">{{ p.name }}</h3>
                    </div>
                    <span class="price">₦{{ p.price | number: '1.0-0' }}</span>
                  </div>

                  <div class="showcase-gallery">
                    <button
                      type="button"
                      class="showcase-art zoom-frame"
                      [class.is-zooming]="zooming()"
                      (mousemove)="onZoomMove($event)"
                      (mouseleave)="onZoomLeave()"
                      (click)="openLightbox()"
                      [attr.aria-label]="'View larger image: ' + gallery()[activeImage()].alt">
                      <img
                        [src]="gallery()[activeImage()].src"
                        [alt]="gallery()[activeImage()].alt"
                        [style.transform-origin]="zoomOrigin()" />
                      <span class="zoom-hint">
                        <mat-icon aria-hidden="true">zoom_in</mat-icon>
                        Hover to zoom · tap to expand
                      </span>
                      <span class="image-count">{{ activeImage() + 1 }} / {{ gallery().length }}</span>
                    </button>
                    <div class="thumbs" role="group" aria-label="Product views">
                      @for (image of gallery(); track image.src; let i = $index) {
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

                  <p class="showcase-desc">{{ p.description }}</p>

                  <ul class="benefit-list">
                    @if (p.tier === 'essential') {
                      <li><mat-icon>check_circle</mat-icon>Complete everyday clothing set — five looks</li>
                      <li><mat-icon>check_circle</mat-icon>Nationwide delivery included</li>
                      <li><mat-icon>check_circle</mat-icon>Full partner rights, campaigns and store</li>
                      <li><mat-icon>check_circle</mat-icon>Upgrade to Signature any time</li>
                    } @else {
                      <li><mat-icon>check_circle</mat-icon>Premium Signature set — two hoodie looks</li>
                      <li><mat-icon>check_circle</mat-icon>Nationwide delivery included</li>
                      <li><mat-icon>check_circle</mat-icon>Full partner rights and the higher mentor rate</li>
                      <li><mat-icon>check_circle</mat-icon>Five-level commission eligibility</li>
                    }
                  </ul>

                  <div class="assurance-row">
                    <span><mat-icon>local_shipping</mat-icon>Nationwide delivery</span>
                    <span><mat-icon>verified_user</mat-icon>Secure wallet payment</span>
                    <span><mat-icon>autorenew</mat-icon>Upgrade any time</span>
                  </div>
                </section>

                <section class="panel delivery-panel" aria-labelledby="delivery-title">
                  <div class="panel-head">
                    <div>
                      <p class="eyebrow">Step 3</p>
                      <h3 id="delivery-title">Delivery details</h3>
                    </div>
                    <span class="muted small">Ships to your address</span>
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

                  <p class="muted small">This delivery address is saved back to your profile and used for shipping.</p>
                </section>

                <section class="panel mentor-panel" aria-labelledby="mentor-title">
                  <div class="panel-head">
                    <div>
                      <p class="eyebrow">Step 4</p>
                      <h3 id="mentor-title">Mentor contact</h3>
                    </div>
                    <mat-icon aria-hidden="true">support_agent</mat-icon>
                  </div>
                  <p class="muted small">Your direct mentor uses this only for onboarding support. You can change it later.</p>
                  <div [formGroup]="mentorForm" class="mentor-form">
                    <mat-radio-group formControlName="preference" aria-label="Mentor contact preference">
                      <mat-radio-button value="in_app">In-app chat</mat-radio-button>
                      <mat-radio-button value="email">Email</mat-radio-button>
                      <mat-radio-button value="whatsapp">WhatsApp</mat-radio-button>
                      <mat-radio-button value="phone">Phone call</mat-radio-button>
                      <mat-radio-button value="prefer_not_now">Prefer not to be contacted yet</mat-radio-button>
                    </mat-radio-group>
                    @if (needsMentorConsent()) {
                      <mat-checkbox formControlName="consent">
                        I agree my direct mentor can use this channel to contact me about my onboarding.
                      </mat-checkbox>
                    }
                    @if (mentorForm.get('preference')?.value === 'prefer_not_now') {
                      <p class="muted small">No direct mentor outreach will be made. You can change this later if you want support.</p>
                    }
                  </div>
                </section>
              </div>

              <aside class="checkout-column">
                <section class="panel checkout-card" aria-labelledby="checkout-title">
                  <div class="panel-head">
                    <div>
                      <p class="eyebrow">Payment</p>
                      <h3 id="checkout-title">Order summary</h3>
                    </div>
                    <span class="price">₦{{ p.price | number: '1.0-0' }}</span>
                  </div>

                  <div class="order-summary">
                    <div class="summary-row"><span>{{ p.name }}</span><strong>₦{{ p.price | number: '1.0-0' }}</strong></div>
                    <div class="summary-row"><span>Delivery</span><strong>Included</strong></div>
                    <div class="summary-row"><span>Activation</span><strong>Full partner rights</strong></div>
                    <div class="summary-row total"><span>Total</span><strong>₦{{ p.price | number: '1.0-0' }}</strong></div>
                  </div>

                  <div class="wallet-box">
                    <div>
                      <span class="muted small">Available for activation (cash)</span>
                      <strong>₦{{ cashAvailable() | number: '1.0-0' }}</strong>
                      @if (bonusLocked() > 0) {
                        <small class="muted">₦{{ bonusLocked() | number: '1.0-0' }} bonus unlocks after activation</small>
                      }
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
                  <p class="muted small centre">Retrying a failed response never charges you twice.</p>
                </section>
              </aside>
            </div>
          } @else {
            <div class="panel">
              <div class="notice">
                <mat-icon>inventory_2</mat-icon>
                <p>Activation plans are not available right now. Contact support so we can open activation for you.</p>
              </div>
            </div>
          }
        }
      }

      @if (lightboxOpen()) {
        <div class="lightbox" role="dialog" aria-modal="true" aria-label="Product image preview" (click)="closeLightbox()">
          <button type="button" class="lightbox-close" aria-label="Close image preview" (click)="closeLightbox(); $event.stopPropagation()">
            <mat-icon aria-hidden="true">close</mat-icon>
          </button>
          <div class="lightbox-inner" (click)="$event.stopPropagation()">
            <img [src]="gallery()[activeImage()].src" [alt]="gallery()[activeImage()].alt" />
            <div class="lightbox-thumbs" role="group" aria-label="Product views">
              @for (image of gallery(); track image.src; let i = $index) {
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
    .activation-page { max-width: 1280px; margin: 0 auto; padding: 32px; }
    .page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(1.75rem, 3vw, 2.5rem); letter-spacing: -0.03em; line-height: 1.1; }
    .lede { max-width: 680px; margin: 0; line-height: 1.6; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .muted { color: var(--ms-text-muted); }
    .small { font-size: 0.75rem; }
    .centre { text-align: center; margin: 8px 0 0; }
    .panel { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-xl); padding: 24px; box-shadow: var(--ms-shadow-sm); }
    .loading-panel { display: grid; gap: 16px; place-items: center; padding: 48px; }
    .content-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: 24px; align-items: start; }
    .plan-picker { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 20px 0; }
    .plan-card { position: relative; display: flex; align-items: center; gap: 16px; text-align: left; padding: 14px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); cursor: pointer; transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease; }
    .plan-card:hover { border-color: var(--ms-primary); transform: translateY(-1px); }
    .plan-card.selected { border-color: var(--ms-primary); box-shadow: 0 0 0 3px var(--ms-primary-soft); }
    .plan-thumb { flex: none; width: 76px; height: 96px; object-fit: cover; border-radius: 10px; border: 1px solid var(--ms-line); background: var(--ms-canvas); }
    .plan-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
    .plan-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .plan-badge { justify-self: start; padding: 2px 8px; border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    .plan-name { font-weight: 700; }
    .plan-price { color: var(--ms-primary-strong); font-size: 1.25rem; font-weight: 800; font-variant-numeric: tabular-nums; }
    .plan-note { color: var(--ms-text-muted); font-size: 0.8125rem; line-height: 1.5; }
    .plan-check { color: var(--ms-primary); flex: none; }
    .activation-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 0.75fr); gap: 24px; align-items: center; padding: 24px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-xl); background: linear-gradient(120deg, color-mix(in srgb, var(--ms-primary-soft) 55%, var(--ms-surface)), var(--ms-surface)); }
    .hero-copy h2 { margin: 6px 0 8px; font-size: clamp(1.6rem, 3vw, 2.3rem); letter-spacing: -0.03em; line-height: 1.1; }
    .hero-copy .lede { max-width: 640px; margin: 0; line-height: 1.6; }
    .activation-hero .stepper { margin: 0; }
    .activation-layout { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(340px, 0.7fr); gap: 24px; align-items: start; margin-top: 8px; }
    .main-column { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
    .checkout-column { position: sticky; top: 96px; min-width: 0; }
    .identity-strip { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 16px 0; flex-wrap: wrap; }
    .identity-main { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .identity-main h3 { margin: 0 0 2px; font-size: 1rem; }
    .identity-main p { margin: 0; }
    .showcase { padding: 24px; }
    .showcase-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
    .showcase-head h3 { margin: 4px 0 0; font-size: 1.2rem; }
    .showcase-gallery { display: flex; flex-direction: column; gap: 12px; }
    .showcase-art { position: relative; width: 100%; aspect-ratio: 4 / 5; max-height: 600px; padding: 0; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); overflow: hidden; background: var(--ms-canvas); cursor: zoom-in; }
    .showcase-art img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.25s ease; }
    .showcase-art.is-zooming img { transform: scale(1.7); }
    .image-count { position: absolute; right: 12px; bottom: 12px; padding: 4px 9px; border-radius: 999px; background: rgba(9, 9, 11, 0.6); color: #fff; font-size: 0.75rem; }
    .showcase-desc { margin: 16px 0 0; line-height: 1.6; color: var(--ms-text-muted); }
    .benefit-list { list-style: none; margin: 16px 0 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; }
    .benefit-list li { display: flex; align-items: flex-start; gap: 8px; font-size: 0.875rem; line-height: 1.45; }
    .benefit-list mat-icon { color: var(--ms-success); font-size: 18px; width: 18px; height: 18px; flex: none; margin-top: 1px; }
    .assurance-row { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--ms-line); color: var(--ms-text-muted); font-size: 0.8rem; }
    .assurance-row span { display: inline-flex; align-items: center; gap: 6px; }
    .assurance-row mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--ms-primary-strong); }
    .delivery-panel, .mentor-panel { padding: 24px; }
    .checkout-card { display: flex; flex-direction: column; gap: 16px; }
    .order-summary { display: flex; flex-direction: column; gap: 8px; padding: 14px; border: 1px solid var(--ms-line); border-radius: 12px; background: var(--ms-canvas); }
    .summary-row { display: flex; justify-content: space-between; gap: 12px; font-size: 0.875rem; }
    .summary-row span { color: var(--ms-text-muted); }
    .summary-row.total { padding-top: 8px; border-top: 1px solid var(--ms-line); font-size: 1rem; }
    .bonus-note { margin: 0 0 16px; }
    .upgrade-card { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin: 0 0 24px; padding: 24px; border: 1px solid var(--ms-primary); border-radius: var(--ms-radius-xl); background: var(--ms-primary-soft); }
    .upgrade-card h3 { margin: 4px 0 6px; }
    .upgrade-card p { margin: 0; max-width: 640px; line-height: 1.6; }
    .upgrade-panel { margin-top: 24px; }
    .panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
    .panel-head h3 { margin: 4px 0 0; font-size: 1.125rem; }
    .stepper { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; list-style: none; padding: 0; margin: 0 0 16px; }
    .stepper li { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); opacity: 0.72; }
    .stepper li.active { opacity: 1; border-color: var(--ms-primary); box-shadow: 0 0 0 3px var(--ms-primary-soft); }
    .stepper li.done { opacity: 1; }
    .stepper li span { display: grid; gap: 2px; min-width: 0; }
    .stepper strong { font-size: 0.875rem; }
    .stepper small { color: var(--ms-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .step-dot { width: 32px; height: 32px; flex: 0 0 32px; border-radius: 999px; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 700; }
    .done .step-dot { background: var(--ms-success-soft); color: var(--ms-success); }
    .step-dot mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; }
    .span-2 { grid-column: span 2; }
    mat-form-field { width: 100%; }
    .form-actions { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 8px 0; }
    .notice { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-info-soft); color: var(--ms-info); margin: 8px 0 16px; }
    .notice.success { background: var(--ms-success-soft); color: var(--ms-success); }
    .notice p { margin: 0; line-height: 1.5; }
    .notice mat-icon { flex: 0 0 auto; }
    .status-pill { align-self: center; padding: 4px 12px; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }
    .status-pill.verified, .status-pill.queued { background: var(--ms-success-soft); color: var(--ms-success); }
    .price { color: var(--ms-primary-strong); font-size: 1.25rem; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .zoom-frame.is-zooming img { transform: scale(1.7); }
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
    .showcase-art:hover .zoom-hint,
    .showcase-art:focus-visible .zoom-hint { opacity: 1; transform: translateY(0); }
    .zoom-hint mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .thumbs { display: flex; gap: 8px; }
    .thumb {
      width: 54px;
      aspect-ratio: 4 / 5;
      padding: 0;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-md);
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
    .lightbox-inner { display: flex; flex-direction: column; align-items: center; gap: 16px; max-width: min(92vw, 920px); max-height: 90vh; }
    .lightbox-inner > img { max-width: 100%; max-height: 74vh; object-fit: contain; border-radius: var(--ms-radius-xl); background: #fff; box-shadow: var(--ms-shadow-lg); }
    .lightbox-thumbs { display: flex; gap: 12px; }
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
    .check-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
    .check-list li { display: flex; align-items: center; gap: 8px; }
    .check-list mat-icon { color: var(--ms-success); font-size: 18px; width: 18px; height: 18px; }
    .shipping-grid { margin-top: 8px; }
    .mentor-form { display: grid; gap: 12px; }
    .mentor-form mat-radio-group { display: grid; gap: 8px; }
    .mentor-form mat-checkbox { margin-top: 4px; }
    .wallet-box { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-canvas); margin: 8px 0 16px; flex-wrap: wrap; }
    .wallet-box > div { display: grid; gap: 2px; }
    .wallet-box strong { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
    .shortfall { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; color: var(--ms-warning); font-weight: 600; }
    .ready { display: inline-flex; align-items: center; gap: 8px; color: var(--ms-success); font-weight: 600; }
    .ready mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .pay-btn { width: 100%; min-height: 48px; margin-top: 8px; font-weight: 700; }
    .alert { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-error-soft); color: var(--ms-error); margin-bottom: 16px; }
    .alert p { margin: 0; line-height: 1.5; flex: 1; }
    .success-hero { display: flex; gap: 24px; align-items: center; padding: 32px; border-radius: var(--ms-radius-2xl); color: #fff; background: linear-gradient(135deg, #14122b 0%, #2b2760 58%, #4f46e5 100%); margin-bottom: 24px; box-shadow: var(--ms-shadow-md); }
    .success-hero h2 { margin: 4px 0; font-size: 1.875rem; }
    .success-hero .muted { color: rgba(255, 255, 255, 0.72); margin: 0; }
    .success-hero .eyebrow { color: #c7d2fe; }
    .success-mark { flex: 0 0 64px; width: 64px; height: 64px; display: grid; place-items: center; border-radius: var(--ms-radius-xl); background: rgba(255, 255, 255, 0.14); }
    .success-mark mat-icon { font-size: 36px; width: 36px; height: 36px; }
    .success-facts { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 16px; }
    .success-facts span { display: grid; gap: 2px; font-size: 0.75rem; color: rgba(255, 255, 255, 0.68); text-transform: uppercase; letter-spacing: 0.08em; }
    .success-facts strong { font-size: 1rem; color: #fff; letter-spacing: 0; text-transform: none; }
    .queue-copy { font-size: 1rem; line-height: 1.6; margin: 0 0 16px; }
    .queue-position { display: flex; align-items: center; gap: 16px; padding: 16px; border-radius: var(--ms-radius-lg); background: var(--ms-primary-soft); margin-bottom: 16px; }
    .queue-position strong { font-size: 1.875rem; color: var(--ms-primary-strong); font-variant-numeric: tabular-nums; }
    .queue-position span { color: var(--ms-text-muted); font-size: 0.875rem; }
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
      .plan-picker { grid-template-columns: minmax(0, 1fr); }
      .upgrade-card { flex-direction: column; align-items: flex-start; }
      .lightbox { padding: 16px; }
      .lightbox-close { top: 12px; right: 12px; }
      .success-hero { align-items: flex-start; padding: 24px; }
      .success-facts { gap: 16px; }
      .form-actions { flex-direction: column; align-items: flex-start; }
    }
    @media (max-width: 1100px) {
      .activation-hero { grid-template-columns: minmax(0, 1fr); }
      .activation-layout { grid-template-columns: minmax(0, 1fr); }
      .checkout-column { position: static; order: 2; }
      .main-column { order: 1; }
    }
    @media (max-width: 720px) {
      .activation-page { padding: 16px; }
      .plan-picker { grid-template-columns: minmax(0, 1fr); }
      .plan-thumb { width: 64px; height: 82px; }
      .benefit-list { grid-template-columns: minmax(0, 1fr); }
      .showcase { padding: 18px; }
      .delivery-panel, .mentor-panel { padding: 18px; }
      .showcase-art { aspect-ratio: 1 / 1; }
      .identity-strip { align-items: flex-start; }
    }
  `],
})
export class ActivationComponent implements OnInit {
  private readonly onboarding = inject(OnboardingService);
  private readonly partnerSvc = inject(PartnerService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private checkoutKey = this.newCheckoutKey();
  private upgradeKey = this.newUpgradeKey();
  private identityAutoCompleteRequested = false;

  protected readonly loading = signal(true);
  protected readonly busy = signal<'kyc' | 'order' | 'upgrade' | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<OnboardingStatus | null>(null);
  protected readonly products = signal<StarterProduct[]>([]);
  protected readonly justActivated = signal(false);
  protected readonly justUpgraded = signal(false);
  protected readonly upgradeOpen = signal(false);
  protected readonly activeImage = signal(0);
  protected readonly zooming = signal(false);
  protected readonly zoomOrigin = signal('50% 50%');
  protected readonly lightboxOpen = signal(false);
  protected readonly selectedTier = signal<ActivationTier>('essential');

  protected readonly partner = computed(() => this.status()?.partner ?? null);
  protected readonly sponsor = computed(() => this.status()?.sponsor ?? null);
  protected readonly order = computed(() => this.status()?.activationOrder ?? null);
  protected readonly upgrade = computed(() => this.status()?.upgrade ?? null);
  protected readonly queue = computed(() => this.status()?.queue ?? null);
  protected readonly product = computed(() => {
    const products = this.products();
    return products.find((plan) => plan.tier === this.selectedTier())
      ?? products[0]
      ?? null;
  });
  protected readonly gallery = computed(() => {
    const product = this.product();
    if (!product) return [];
    const images = product.images?.length
      ? product.images
      : [{ url: product.imageUrl, alt: product.name }];
    return images.map((image) => ({ src: image.url, alt: image.alt || product.name }));
  });
  protected readonly wallet = computed(() => this.partner()?.balance ?? 0);
  /** Cash only: bonus credit cannot fund a first activation. */
  protected readonly cashAvailable = computed(() => {
    const partner = this.partner();
    if (!partner) return 0;
    return typeof partner.withdrawableBalance === 'number'
      ? partner.withdrawableBalance
      : Math.max(partner.balance - (partner.bonusBalance ?? 0), 0);
  });
  protected readonly bonusLocked = computed(() => (
    Math.max(this.wallet() - this.cashAvailable(), 0)
  ));
  protected readonly isPartner = computed(() => this.partner()?.accountState === 'partner');
  protected readonly kycStatus = computed(() => this.partner()?.kycStatus ?? 'not_started');
  protected readonly kycSubmitted = computed(() => this.kycStatus() === 'verified');
  protected readonly walletReady = computed(() => {
    const product = this.product();
    return !!product && this.cashAvailable() >= product.price;
  });
  protected readonly shortfall = computed(() => {
    const product = this.product();
    if (!product) return 0;
    return Math.max(0, product.price - this.cashAvailable());
  });
  protected readonly upgradeReady = computed(() => {
    const quote = this.upgrade();
    return !!quote?.eligible && quote.price !== null && this.wallet() >= quote.price;
  });
  protected readonly upgradeShortfall = computed(() => {
    const price = this.upgrade()?.price ?? 0;
    return Math.max(0, price - this.wallet());
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

  protected readonly mentorForm = this.fb.nonNullable.group({
    preference: ['in_app' as MentorContactPreference],
    consent: [false],
  });

  protected needsMentorConsent(): boolean {
    return ['email', 'whatsapp', 'phone'].includes(this.mentorForm.controls.preference.value);
  }

  ngOnInit(): void {
    this.refresh();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closeLightbox();
    this.closeUpgrade();
  }

  private newCheckoutKey(): string {
    return globalThis.crypto?.randomUUID?.()
      ?? `activation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private newUpgradeKey(): string {
    return globalThis.crypto?.randomUUID?.()
      ?? `upgrade-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  protected selectPlan(tier: ActivationTier): void {
    if (this.isPartner() || this.selectedTier() === tier) return;
    this.selectedTier.set(tier);
    this.activeImage.set(0);
    this.closeLightbox();
    // A different product must not replay the previous plan's order.
    this.checkoutKey = this.newCheckoutKey();
  }

  protected planLabel(tier: ActivationTier | undefined): string {
    return tier === 'essential' ? 'Essential' : 'Signature';
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

  /**
   * The identity step is document-free for now, so members should not have to
   * click a manual button. Submit it once when the page loads; if the request
   * fails, the visible button remains as a retry.
   */
  private autoCompleteIdentity(status: OnboardingStatus): void {
    if (this.identityAutoCompleteRequested) return;
    if (status.partner.accountState !== 'member') return;
    if ((status.partner.kycStatus ?? 'not_started') !== 'not_started') return;
    this.identityAutoCompleteRequested = true;
    this.submitKyc();
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
    const mentor = this.mentorForm.getRawValue();
    if (['email', 'whatsapp', 'phone'].includes(mentor.preference) && !mentor.consent) {
      this.error.set('Agree to share your chosen contact channel with your mentor.');
      return;
    }
    if (mentor.preference === 'email' && !partner.email) {
      this.error.set('Add an email address before choosing email.');
      return;
    }
    if (['whatsapp', 'phone'].includes(mentor.preference) && !partner.phone) {
      this.error.set('Add a phone number before choosing WhatsApp or phone.');
      return;
    }
    if (this.cashAvailable() < product.price) {
      this.error.set(
        'Your cash balance is too low. Activation is paid from cash only; bonus credit unlocks after activation.',
      );
      return;
    }

    this.busy.set('order');
    this.error.set(null);
    this.onboarding.createOrder({
      productId: product.id,
      shipping: this.shippingForm.getRawValue() as ShippingInput,
      mentorContactPreference: mentor.preference,
      mentorContactConsent: mentor.consent,
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
        this.selectedTier.set(order.tier ?? product.tier);
        this.justActivated.set(!response.data.repeated);
        this.auth.me().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
        this.refreshSharedPartner();
        // Reload the live upgrade quote for the new partner.
        this.refresh();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected openUpgrade(): void {
    this.upgradeKey = this.newUpgradeKey();
    this.error.set(null);
    this.upgradeOpen.set(true);
  }

  protected closeUpgrade(): void {
    this.upgradeOpen.set(false);
  }

  protected confirmUpgrade(): void {
    const quote = this.upgrade();
    if (!quote?.eligible || this.busy()) return;
    if (this.shippingForm.invalid) {
      this.shippingForm.markAllAsTouched();
      this.error.set('Complete the delivery address before upgrading.');
      return;
    }
    if (this.wallet() < (quote.price ?? 0)) {
      this.error.set('Fund your wallet with the upgrade amount and try again.');
      return;
    }

    this.busy.set('upgrade');
    this.error.set(null);
    this.onboarding.upgrade({
      shipping: this.shippingForm.getRawValue() as ShippingInput,
      idempotencyKey: this.upgradeKey,
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.busy.set(null)),
    ).subscribe({
      next: (response) => {
        const { order, partner: updated } = response.data;
        this.status.update((current) => current ? {
          ...current,
          partner: updated ?? { ...current.partner, activationTier: 'signature' },
          activationOrder: order,
          upgrade: { ...current.upgrade, eligible: false, reason: 'already_signature' },
        } : current);
        this.selectedTier.set('signature');
        this.justUpgraded.set(!response.data.repeated);
        this.upgradeOpen.set(false);
        this.refreshSharedPartner();
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected canPay(): boolean {
    const mentor = this.mentorForm.getRawValue();
    const mentorReady = !['email', 'whatsapp', 'phone'].includes(mentor.preference)
      || (mentor.consent && (mentor.preference === 'email' ? !!this.partner()?.email : !!this.partner()?.phone));
    return this.kycSubmitted()
      && this.shippingForm.valid
      && mentorReady
      && this.walletReady()
      && !this.isPartner();
  }

  protected kycStatusText(): string {
    const status = this.kycStatus();
    if (status === 'verified') return 'Verified';
    if (status === 'pending') return 'Under review — activation opens once verified';
    if (status === 'rejected') return 'Verification rejected — resubmit';
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
        if (status.data.partner.accountState === 'partner') {
          this.selectedTier.set(
            status.data.activationOrder?.tier
              ?? status.data.partner.activationTier
              ?? 'signature',
          );
        } else {
          this.selectedTier.set('essential');
        }
        this.prefill(status.data);
        this.autoCompleteIdentity(status.data);
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
    this.mentorForm.patchValue({
      preference: status.partner.mentorContactPreference ?? 'in_app',
      consent: !!status.partner.mentorContactConsentAt,
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
