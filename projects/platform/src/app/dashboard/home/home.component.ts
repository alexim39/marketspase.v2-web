import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { AnalyticsService } from '../../core/analytics/analytics.service';
import { AuthService } from '../../core/auth/auth.service';
import { CommunityService } from '../../core/community/community.service';
import { PresenceService, PresenceStatus } from '../../core/presence/presence.service';
import { AvatarComponent } from '../../_common/avatar.component';
import { ProgressionService } from '../../core/progression/progression.service';
import { LeadPipelineService } from '../partner/prospects/lead-pipeline/lead-pipeline.service';
import { BonusService, EligibleBonus } from '../../core/bonuses/bonus.service';
import { OnboardingService } from '../../core/onboarding/onboarding.service';
import { CampaignsService } from '../../core/campaigns/campaigns.service';
import { TrainingService } from '../../core/training/training.service';
import { Certificate } from '../../core/training/training.models';
import { OnboardingStatus } from '../../core/onboarding/onboarding.models';
import { GrowthCampaign, MyAllocation } from '../../core/campaigns/campaigns.models';
import { DailyAction, DashboardOverview } from '../../core/analytics/analytics.models';
import { CompensationService } from '../../core/compensation/compensation.service';
import { MyCompensation } from '../../core/compensation/compensation.models';
import { StoreService } from '../../core/store/store.service';
import { StoreEarnings } from '../../core/store/store.models';
import { ProgressRingComponent } from '@marketspase/shared/ui/progress-ring/progress-ring.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { FeedPost } from '../../core/community/community.models';
import { Journey } from '../../core/progression/progression.models';
import { ApiError } from '../../core/http/api-error';

/** One meaningful moment for the Home activity timeline. */
interface ActivityItem {
  id: string;
  icon: string;
  title: string;
  detail: string;
  at: string | null;
  link: string;
}

/**
 * @title Home — daily operating center.
 *
 * Priority order: what to do today, what's happening, where I stand on
 * the ladder, then business numbers. Journey + community ride along with
 * the overview call but fail soft so the page never blanks on them.
 * OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent, DatePipe, DecimalPipe, MatButtonModule, MatCardModule, MatChipsModule,
    MatIconModule, RouterModule, ProgressRingComponent, PageSkeletonComponent,
  ],
  template: `
    <section class="home-page">
      @if (activationNeeded()) {
        <div class="activation-banner" role="status">
          <mat-icon>verified_user</mat-icon>
          <div>
            <strong>Your partner account is not activated yet</strong>
            <p>Complete the identity step and activate with the MarketSpase starter product to unlock campaign allocation and commissions.</p>
          </div>
          <a mat-flat-button color="primary" routerLink="/dashboard/activate">Activate now</a>
        </div>
      }
      @if (profileIncomplete() && !bannerDismissed()) {
        <div class="profile-banner" role="status">
          <mat-icon>account_circle</mat-icon>
          <p>Your profile setup is incomplete — add your phone number and location so your upline and prospects can reach you.</p>
          <a mat-button routerLink="/dashboard/settings/profiles">Complete profile</a>
          <button mat-icon-button (click)="bannerDismissed.set(true)" aria-label="Dismiss">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }
      @if (bonus()?.campaign; as campaign) {
        <div class="bonus-banner" role="status">
          <mat-icon>card_giftcard</mat-icon>
          <div class="bonus-body">
            <strong>{{ campaign.title }} — ₦{{ campaign.amountNgn | number }} waiting</strong>
            <p>{{ campaign.message || 'Claim it into your wallet and put it to work.' }}</p>
            @if (bonusNotice(); as note) {
              <p class="notice">{{ note }}</p>
            }
          </div>
          <button mat-flat-button color="primary" (click)="claimBonus()" [disabled]="claimingBonus()">
            {{ claimingBonus() ? 'Claiming…' : 'Claim ₦' + (campaign.amountNgn | number) }}
          </button>
        </div>
      }
      <header class="cc-hero">
        <div class="cc-hero-main">
          <p class="eyebrow">Command center · {{ today | date:'fullDate' }}</p>
          <h2>{{ greeting() }}{{ firstName() ? ', ' + firstName() : '' }}</h2>
          <p class="subtitle">{{ headline() }}</p>
          <div class="cc-chips">
            <span class="cc-chip"><mat-icon>workspace_premium</mat-icon>{{ rankLabel() }}</span>
            <span class="cc-chip"><mat-icon>verified_user</mat-icon>{{ growthStateLabel() }}</span>
            <span class="cc-chip"><mat-icon>badge</mat-icon>KYC {{ kycLabel() }}</span>
          </div>
          @if (roleFocus(); as focus) {
            <p class="role-focus" role="status"><mat-icon aria-hidden="true">flag</mat-icon> {{ focus }}</p>
          }
        </div>
        <div class="cc-next dp-card">
          <p class="cc-next-label">Next best action</p>
          @if (nextAction(); as action) {
            <strong>{{ action.title }}</strong>
            <p class="muted">{{ action.detail }}</p>
            @if (action.link) {
              <a mat-flat-button color="primary" [routerLink]="action.link">Take action</a>
            }
          } @else {
            <strong>You are all clear</strong>
            <p class="muted">No urgent actions. Add a prospect or fund a campaign to keep momentum.</p>
            <a mat-flat-button color="primary" routerLink="/dashboard/prospects/pipeline">Add a prospect</a>
          }
          @if (overview(); as o) {
            <span class="cc-next-count">{{ o.actions.total + (storeActionCount() > 0 ? 1 : 0) }} action{{ o.actions.total + (storeActionCount() > 0 ? 1 : 0) === 1 ? '' : 's' }} today</span>
          }
        </div>
      </header>

      <!-- Growth engine: activation → KYC → queue → placement, in one glance. -->
      @if (growthLoaded()) {
        <div class="dp-card growth-card">
          <div class="growth-main">
            <span class="growth-pill" [class.growth-pill--action]="growthState() === 'member' || growthState() === 'kyc'" [class.growth-pill--live]="growthState() === 'active'">
              {{ growthStateLabel() }}
            </span>
            <strong class="growth-title">{{ growthHeadline() }}</strong>
            <p class="muted growth-detail">{{ growthDetail() }}</p>
            <div class="growth-metrics">
              <div><span>KYC</span><strong>{{ kycLabel() }}</strong></div>
              <div><span>Queue</span><strong>{{ queueLabel() }}</strong></div>
              <div><span>Partner acquisition</span><strong>{{ activeCampaigns() }}</strong></div>
              <div><span>Wallet</span><strong>₦{{ walletBalance() | number }}</strong></div>
            </div>
          </div>
          <div class="growth-actions">
            @if (growthState() === 'member') {
              <a mat-flat-button color="primary" routerLink="/dashboard/activate">Activate now</a>
            } @else if (growthState() === 'kyc') {
              <a mat-flat-button color="primary" routerLink="/dashboard/activate">Finish KYC</a>
            } @else if (growthState() === 'queued') {
              <a mat-flat-button routerLink="/dashboard/campaigns">Partner acquisition</a>
            } @else {
              <a mat-button routerLink="/dashboard/campaigns">Manage acquisition</a>
            }
            <a mat-button routerLink="/dashboard/compensation">Compensation</a>
          </div>
        </div>
      }

      <div class="cc-quick" aria-label="Quick actions">
        <a mat-stroked-button routerLink="/dashboard/prospects/new"><mat-icon>person_add</mat-icon> Add prospect</a>
        @if (storeActionCount() > 0) {
          <a mat-stroked-button routerLink="/dashboard/products/store-orders">
            <mat-icon>local_shipping</mat-icon> Fulfil {{ storeActionCount() }} store order{{ storeActionCount() === 1 ? '' : 's' }}
          </a>
        }
        <a mat-stroked-button routerLink="/dashboard/campaigns"><mat-icon>campaign</mat-icon> Fund acquisition</a>
        <a mat-stroked-button routerLink="/dashboard/messages"><mat-icon>forum</mat-icon> Send message</a>
        <a mat-stroked-button routerLink="/dashboard/wallet"><mat-icon>add_card</mat-icon> Deposit</a>
        <a mat-stroked-button routerLink="/dashboard/ora"><mat-icon>smart_toy</mat-icon> Ask Ora</a>
      </div>

      <div class="cc-momentum">
        <mat-card class="cc-widget">
          <mat-card-content>
            <div class="cc-widget-head"><mat-icon>account_balance_wallet</mat-icon><span>Wallet</span></div>
            <strong class="cc-widget-value">₦{{ walletBalance() | number }}</strong>
            <span class="muted">₦{{ pendingCommissions() | number }} pending · ₦{{ releasedCommissions() | number }} released</span>
            <a mat-button routerLink="/dashboard/wallet">Open wallet</a>
          </mat-card-content>
        </mat-card>

        <mat-card class="cc-widget">
          <mat-card-content>
            <div class="cc-widget-head"><mat-icon>storefront</mat-icon><span>Store</span></div>
            <strong class="cc-widget-value">₦{{ storePendingEarnings() | number }}</strong>
            <span class="muted">{{ storeActionCount() }} to fulfil · ₦{{ storeReleasedEarnings() | number }} released</span>
            <a mat-button routerLink="/dashboard/products/store-orders">Open store orders</a>
          </mat-card-content>
        </mat-card>

        <mat-card class="cc-widget">
          <mat-card-content>
            <div class="cc-widget-head"><mat-icon>campaign</mat-icon><span>Partner acquisition</span></div>
            <strong class="cc-widget-value">{{ activeCampaigns() }}</strong>
            <span class="muted">active · ₦{{ campaignSpend() | number }} spent · ₦{{ campaignRemaining() | number }} left</span>
            <a mat-button routerLink="/dashboard/campaigns">Manage acquisition</a>
          </mat-card-content>
        </mat-card>

        <mat-card class="cc-widget">
          <mat-card-content>
            <div class="cc-widget-head"><mat-icon>groups</mat-icon><span>Team pulse</span></div>
            <strong class="cc-widget-value">{{ (overview()?.team?.downline?.total ?? 0) | number }}</strong>
            <span class="muted">{{ overview()?.team?.downline?.active ?? 0 }} active · {{ overview()?.team?.recruits?.current ?? 0 }} new</span>
            <a mat-button routerLink="/dashboard/mentorship/partners/my-partners">View team</a>
          </mat-card-content>
        </mat-card>

        <mat-card class="cc-widget">
          <mat-card-content>
            <div class="cc-widget-head"><mat-icon>event_available</mat-icon><span>Follow-ups</span></div>
            <strong class="cc-widget-value">{{ followUpsDue() }}</strong>
            <span class="muted">overdue + due today</span>
            <a mat-button routerLink="/dashboard/prospects/reminders">Open reminders</a>
          </mat-card-content>
        </mat-card>

        <mat-card class="cc-widget">
          <mat-card-content>
            <div class="cc-widget-head">
              <mat-icon>school</mat-icon><span>Rank &amp; training</span>
              <span class="spacer"></span>
              <async-progress-ring [value]="trainingPercent()" [size]="38" tone="teal" label="Core training" />
            </div>
            <strong class="cc-widget-value">{{ rankLabel() }}</strong>
            <span class="muted">{{ trainingSummary() }}</span>
            <a mat-button routerLink="/dashboard/training">Continue learning</a>
          </mat-card-content>
        </mat-card>

        <mat-card class="cc-widget">
          <mat-card-content>
            <div class="cc-widget-head"><mat-icon>flag</mat-icon><span>Goals</span></div>
            <strong class="cc-widget-value">{{ overview()?.goals?.complete ?? 0 }}/{{ overview()?.goals?.total ?? 0 }}</strong>
            <span class="muted">
              @if ((overview()?.goals?.behind ?? 0) > 0) {
                {{ overview()?.goals?.behind }} behind
              } @else {
                on track
              }
            </span>
            <a mat-button routerLink="/dashboard/goals">Review goals</a>
          </mat-card-content>
        </mat-card>
      </div>

      @if (!tutorialsDismissed()) {
        <div class="tutorials-callout dp-card">
          <mat-icon>smart_display</mat-icon>
          <p><strong>New:</strong> short videos show how each part of the app works.</p>
          <span class="spacer"></span>
          <a mat-button routerLink="/dashboard/training/tutorials">Watch tutorials</a>
          <button mat-icon-button (click)="tutorialsDismissed.set(true)" aria-label="Dismiss tutorials callout">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }

      @if (showStarter()) {
        <div class="starter-strip dp-card">
          <div class="starter-head">
            <mat-icon>rocket_launch</mat-icon>
            <strong>Getting started</strong>
            <span class="muted">{{ starterDone() }} of 4 done</span>
          </div>
          <ol>
            @for (item of starterItems(); track item.key) {
              <li [class.done]="item.done">
                <mat-icon>{{ item.done ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                <span>{{ item.label }}</span>
                <span class="spacer"></span>
                @if (!item.done) {
                  <a mat-button [routerLink]="item.link">Start<span class="sr-only"> {{ item.label }}</span></a>
                }
              </li>
            }
          </ol>
        </div>
      }

      @if (loading()) {
        <async-page-skeleton layout="dashboard" [rows]="3" label="dashboard details" [showHeader]="false" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (overview(); as o) {
        <div class="cc-columns">
          <div class="cc-col-main">
        <div class="home-section">
          <h3>Today's plan <span class="muted">({{ o.actions.total + (storeActionCount() > 0 ? 1 : 0) }})</span></h3>
          @if (topActions().length > 0) {
            <ul class="action-list">
              @for (action of topActions(); track action.id) {
                <li class="dp-card action-item" [class.action-item--high]="action.priority === 'high'">
                  <div class="action-body">
                    <strong>{{ action.title }}</strong>
                    <span class="muted">{{ action.detail }}</span>
                  </div>
                  @if (action.link) {
                    <a mat-button [routerLink]="action.link">Take action</a>
                  }
                </li>
              }
            </ul>
            @if (o.actions.total + (storeActionCount() > 0 ? 1 : 0) > topActions().length) {
              <a mat-button routerLink="/dashboard/insights">View all {{ o.actions.total + (storeActionCount() > 0 ? 1 : 0) }} actions</a>
            }
          } @else {
            <p class="empty">Nothing needs you right now. Momentum is yours to make.</p>
          }
        </div>
          </div>

          <div class="cc-col-side">
        <div class="home-section">
          <h3>What's happening</h3>
          @if (communityPosts().length > 0) {
            <ul class="preview-list">
              @for (post of communityPosts(); track post.id) {
                <li class="dp-card preview-item">
                  <div class="preview-top">
                    <strong class="byline"><async-avatar [photo]="post.author?.profileImage" [name]="post.author?.name ?? 'Teammate'" size="xs" [presence]="presenceOf(post.authorId)" />{{ post.author?.name ?? 'Teammate' }}</strong>
                    <span class="muted">{{ post.likeCount ?? 0 }} likes · {{ post.commentCount ?? 0 }} comments</span>
                  </div>
                  @if (post.title) {
                    <strong>{{ post.title }}</strong>
                  }
                  <p class="muted">{{ previewText(post.body) }}</p>
                </li>
              }
            </ul>
            <a mat-button routerLink="/dashboard/community">Open community</a>
          } @else if (!loading()) {
            <p class="empty">Quiet here — <a routerLink="/dashboard/community">be the first to post</a>.</p>
          }
        </div>

        <div class="home-section">
          <h3>Recent activity</h3>
          @if (activity().length === 0) {
            <p class="empty">No activity yet. Your next allocation, commission or certificate will appear here.</p>
          } @else {
            <ul class="activity-list">
              @for (item of activity(); track item.id) {
                <li class="dp-card activity-item">
                  <mat-icon [attr.aria-hidden]="true">{{ item.icon }}</mat-icon>
                  <div class="activity-main">
                    <strong>{{ item.title }}</strong>
                    <span class="muted">{{ item.detail }}</span>
                  </div>
                  @if (item.at) {
                    <span class="activity-date muted">{{ item.at | date: 'mediumDate' }}</span>
                  }
                  <a mat-button [routerLink]="item.link">View</a>
                </li>
              }
            </ul>
          }
        </div>

          </div>
        </div>
      }
    </section>
  `,
  styles: [`
    .home-page { display: flex; flex-direction: column; gap: 16px; padding-bottom: 32px; margin-top: 16px; }
    .home-page h3 { margin: 8px 0 0; }
    /* Command center hero — one gradient surface, next action on the right. */
    .cc-hero {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(260px, 1fr);
      gap: 16px;
      padding: 24px;
      border-radius: var(--ms-radius-xl);
      background: linear-gradient(125deg, #667eea 0%, #764ba2 62%, #5a6fd8 100%);
      color: #fff;
      box-shadow: var(--ms-shadow-md);
    }
    .cc-hero-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .cc-hero .eyebrow { color: rgba(255, 255, 255, 0.82); }
    .cc-hero h2 { margin: 0; font-size: 1.75rem; color: #fff; }
    .cc-hero .subtitle { color: rgba(255, 255, 255, 0.85); }
    .cc-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .cc-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border-radius: 999px;
      padding: 4px 12px;
      background: rgba(255, 255, 255, 0.16);
      border: 1px solid rgba(255, 255, 255, 0.28);
      font-size: 0.75rem;
      font-weight: 500;
      mat-icon { font-size: 16px; height: 16px; width: 16px; }
    }
    .cc-next {
      align-self: stretch;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      background: var(--ms-surface);
      color: var(--ms-text);
      border-radius: var(--ms-radius-lg);
      box-shadow: var(--ms-shadow-sm);
    }
    .cc-next-label { margin: 0; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ms-text-muted); }
    .cc-next strong { font-size: 1rem; }
    .cc-next p { margin: 0; }
    .cc-next a { align-self: flex-start; min-height: 44px; }
    .cc-next-count { font-size: 0.75rem; color: var(--ms-text-muted); }
    /* Quick actions — one row of thumb-sized shortcuts. */
    .cc-quick { display: flex; flex-wrap: wrap; gap: 8px; }
    .cc-quick a { min-height: 44px; }
    .cc-quick mat-icon { margin-right: 4px; }
    /* Momentum widgets — six at most above the fold. */
    .cc-momentum {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 16px;
    }
    .cc-widget {
      border-radius: var(--ms-radius-lg);
      border: 1px solid var(--ms-line);
      box-shadow: var(--ms-shadow-sm);
      transition: box-shadow 160ms ease, border-color 160ms ease;
    }
    .cc-widget:hover {
      border-color: var(--ms-line-strong);
      box-shadow: var(--ms-shadow-md);
    }
    .cc-widget mat-card-content { display: flex; flex-direction: column; gap: 4px; min-height: 112px; }
    .cc-widget-head { display: flex; align-items: center; gap: 8px; color: var(--ms-text-muted); font-size: 0.8125rem; font-weight: 500; }
    .cc-widget-head .spacer { flex: 1; }
    .cc-widget-head mat-icon { color: var(--ms-primary-strong); font-size: 20px; height: 20px; width: 20px; }
    .cc-widget-value { font-size: 1.75rem; font-weight: 700; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
    .cc-widget a { align-self: flex-start; min-height: 40px; margin-top: 4px; }
    /* Two-column content below the widgets. */
    .cc-columns { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr); gap: 24px; align-items: start; }
    .cc-col-main, .cc-col-side { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
    @media (max-width: 900px) {
      .cc-hero { grid-template-columns: 1fr; }
      .cc-columns { grid-template-columns: 1fr; }
    }
    .eyebrow { margin: 0 0 8px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ms-primary-strong); }
    .profile-banner { display: flex; align-items: center; gap: 12px; background: var(--ms-info-soft); border: 1px solid var(--ms-info); border-radius: var(--ms-radius-lg); padding: 12px 16px; margin: 16px 0; }
    .bonus-banner { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; background: var(--ms-primary-soft); border: 1px solid var(--ms-primary); border-radius: var(--ms-radius-lg); padding: 12px 16px; margin: 16px 0; }
    .bonus-banner mat-icon { color: var(--ms-primary-strong); flex: none; }
    .bonus-body { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .bonus-body p { margin: 0; font-size: 0.875rem; }
    .bonus-body .notice { color: var(--ms-success); font-weight: 600; }
    .bonus-banner button { flex: none; min-height: 44px; }
  .profile-banner mat-icon { color: var(--ms-info); flex: none; }
  .profile-banner p { margin: 0; flex: 1; font-size: 0.875rem; }
  .profile-banner a { flex: none; min-height: 44px; }
  .activation-banner { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; background: linear-gradient(120deg, var(--ms-primary-soft), var(--ms-surface)); border: 1px solid var(--ms-primary); border-radius: var(--ms-radius-lg); padding: 16px; margin: 16px 0; }
  .activation-banner > mat-icon { color: var(--ms-primary-strong); flex: none; }
  .activation-banner div { flex: 1; min-width: 220px; }
  .activation-banner strong { display: block; margin-bottom: 4px; }
  .activation-banner p { margin: 0; color: var(--ms-text-muted); font-size: 0.875rem; line-height: 1.5; }
  .activation-banner a { flex: none; min-height: 44px; }
    .subtitle { margin: 8px 0 0; color: var(--ms-text-muted); }
    .action-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .action-item { display: flex; gap: 16px; align-items: center; padding: 12px 16px; }
    .action-item a { min-height: 44px; }
    .preview-top a { min-height: 44px; }
    .action-item--high { border-left: 4px solid var(--ms-error); }
    .action-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .role-focus { display: flex; align-items: center; gap: 8px; margin: 0; color: rgba(255, 255, 255, 0.92); font-weight: 500; font-size: 0.875rem; }
    .role-focus mat-icon { font-size: 18px; height: 18px; width: 18px; }
    .home-section { display: flex; flex-direction: column; gap: 8px; }
    .preview-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .preview-item { padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; }
    .preview-item p { margin: 0; }
    .preview-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
    .byline { display: inline-flex; align-items: center; gap: 8px; }
    /* Activity timeline — meaningful events only, newest first. */
    .activity-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .activity-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; }
    .activity-item > mat-icon { color: var(--ms-primary-strong); flex: none; }
    .activity-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .activity-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .activity-main span { font-size: 0.8125rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .activity-date { flex: none; font-size: 0.75rem; white-space: nowrap; }
    .activity-item a { flex: none; min-height: 40px; }
    .starter-strip { padding: 16px; display: flex; flex-direction: column; gap: 8px; border-left: 4px solid var(--ms-primary); }
    .starter-head { display: flex; align-items: center; gap: 8px; }
    .starter-head mat-icon { color: var(--ms-primary-strong); }
    .starter-strip ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .starter-strip li { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid var(--ms-line); }
    .starter-strip li:first-child { border-top: none; }
    .starter-strip li.done { opacity: 0.65; }
    .starter-strip li.done mat-icon { color: var(--ms-success, #2e7d32); }
    .starter-strip .spacer { flex: 1; }
    .starter-strip a { min-height: 44px; }
    .tutorials-callout { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; border-left: 4px solid var(--ms-primary); }
    .tutorials-callout mat-icon { color: var(--ms-primary-strong); flex: none; }
    .tutorials-callout p { margin: 0; font-size: 0.875rem; }
    .tutorials-callout .spacer { flex: 1; }
    .tutorials-callout a { min-height: 44px; flex: none; }
    /* Growth engine card — activation → KYC → queue → placement. */
    .growth-card {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      padding: 16px;
      border-left: 4px solid var(--ms-primary);
      background: linear-gradient(120deg, var(--ms-primary-soft), var(--ms-surface) 55%);
    }
    .growth-main { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 240px; }
    .growth-pill {
      align-self: flex-start;
      border-radius: 999px;
      padding: 2px 12px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      background: var(--ms-info-soft);
      color: var(--ms-info);
    }
    .growth-pill--action { background: var(--ms-error-soft); color: var(--ms-error); }
    .growth-pill--live { background: var(--ms-success-soft); color: var(--ms-success); }
    .growth-title { font-size: 1.125rem; }
    .growth-detail { margin: 0; max-width: 60em; }
    .growth-metrics { display: flex; flex-wrap: wrap; gap: 24px; margin-top: 8px; }
    .growth-metrics div { display: flex; flex-direction: column; gap: 2px; }
    .growth-metrics span { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ms-text-muted); }
    .growth-metrics strong { font-size: 1rem; font-variant-numeric: tabular-nums; }
    .growth-actions { display: flex; flex-direction: column; gap: 8px; flex: none; }
    .growth-actions a { min-height: 44px; }
    .muted { color: var(--ms-text-muted); font-size: 0.875rem; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 8px; }
    .empty { color: var(--ms-text-muted); }
  `],
})
export class HomeComponent implements OnInit {
  private readonly analytics = inject(AnalyticsService);
  private readonly compensationSvc = inject(CompensationService);
  private readonly auth = inject(AuthService);
  private readonly leads = inject(LeadPipelineService);
  private readonly progress = inject(ProgressionService);
  private readonly community = inject(CommunityService);
  private readonly presence = inject(PresenceService);
  private readonly bonuses = inject(BonusService);
  private readonly onboardingSvc = inject(OnboardingService);
  private readonly campaignsSvc = inject(CampaignsService);
  private readonly storeSvc = inject(StoreService);
  private readonly trainingSvc = inject(TrainingService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly overview = signal<DashboardOverview | null>(null);
  protected readonly compensation = signal<MyCompensation | null>(null);
  protected readonly journey = signal<Journey | null>(null);
  protected readonly communityPosts = signal<FeedPost[]>([]);
  /** authorId → lastSeenAt (null = offline/stranger); drives avatar dots. */
  protected readonly presenceMap = signal<Record<string, string | null>>({});
  protected readonly hasProspect = signal(false);
  protected readonly today = new Date();
  protected readonly bannerDismissed = signal(false);
  protected readonly tutorialsDismissed = signal(false);
  protected readonly bonus = signal<EligibleBonus | null>(null);
  protected readonly claimingBonus = signal(false);
  protected readonly bonusNotice = signal<string | null>(null);
  /** Growth engine: activation, KYC, queue and campaigns. */
  protected readonly onboarding = signal<OnboardingStatus | null>(null);
  protected readonly allocation = signal<MyAllocation | null>(null);
  protected readonly campaigns = signal<GrowthCampaign[]>([]);
  protected readonly storeEarnings = signal<StoreEarnings | null>(null);
  protected readonly growthLoaded = signal(false);
  /** Follow-up bucket counts for the momentum card. */
  protected readonly reminders = signal<{ overdue: number; today: number } | null>(null);
  /** Activity timeline inputs. */
  private readonly certificates = signal<Certificate[]>([]);

  protected activationNeeded(): boolean {
    return this.auth.currentUser()?.accountState === 'member';
  }

  /** Required for onboarding: phone + street/city/state (picture stays optional). */
  protected profileIncomplete(): boolean {
    const u = (this.auth.currentUser() ?? {}) as { phone?: unknown; address?: { street?: unknown; city?: unknown; state?: unknown } };
    const filled = (v: unknown): boolean => String(v ?? '').trim().length > 0;
    return !filled(u.phone)
      || !filled(u.address?.street) || !filled(u.address?.city) || !filled(u.address?.state);
  }

  /** Growth engine state: member → KYC → queue → placed/active. */
  protected growthState(): 'member' | 'kyc' | 'queued' | 'placed' | 'active' {
    const o = this.onboarding();
    const state = o?.partner.accountState ?? this.auth.currentUser()?.accountState ?? 'member';
    if (state === 'member') return 'member';
    const kyc = o?.kyc?.status ?? this.auth.currentUser()?.kycStatus ?? 'not_started';
    if (kyc !== 'verified' && kyc !== 'pending') return 'kyc';
    const q = o?.queue;
    if (q?.status === 'queued') return 'queued';
    if (q?.status === 'allocated') return 'placed';
    return 'active';
  }

  protected growthStateLabel(): string {
    switch (this.growthState()) {
      case 'member': return 'Not activated';
      case 'kyc': return 'KYC required';
      case 'queued': return 'In queue';
      case 'placed': return 'Placed';
      default: return 'Active partner';
    }
  }

  protected growthHeadline(): string {
    const position = this.onboarding()?.queue?.position;
    switch (this.growthState()) {
      case 'member': return 'Activate your partner business';
      case 'kyc': return 'Complete the identity step to unlock allocation';
      case 'queued': return position ? `You are #${position} in the allocation queue` : 'You are in the allocation queue';
      case 'placed': return 'Placed with a campaign owner';
      default: return 'Your growth engine is ready';
    }
  }

  protected growthDetail(): string {
    switch (this.growthState()) {
      case 'member': return 'Buy the MarketSpase starter product to enter the allocation queue and unlock commissions.';
      case 'kyc': return 'Your activation order is paid — complete KYC so the allocation engine can place you.';
      case 'queued': return 'We will place you as soon as an eligible funded campaign has capacity. You can fund partner acquisition while you wait.';
      case 'placed': return 'Your mentor handoff is active. Keep your team supported and your commissions accruing.';
      default: return 'Fund partner acquisition to receive activated partners, or keep building your team.';
    }
  }

  protected kycLabel(): string {
    const status = this.onboarding()?.kyc?.status ?? this.auth.currentUser()?.kycStatus ?? 'not_started';
    if (status === 'pending') return 'Verified';
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  protected queueLabel(): string {
    const q = this.onboarding()?.queue;
    if (!q) return '—';
    if (q.status === 'queued') return q.position ? `#${q.position}` : 'Queued';
    if (q.status === 'allocated') return 'Placed';
    return 'Cancelled';
  }

  protected activeCampaigns(): number {
    return this.campaigns().filter((c) => c.status === 'Active').length;
  }

  protected walletBalance(): number {
    return Number(this.onboarding()?.partner.balance ?? 0);
  }

  protected rankLabel(): string {
    return this.compensation()?.partner?.commissionRank
      ?? this.auth.currentUser()?.commissionRank
      ?? 'Partner';
  }

  protected trainingSummary(): string {
    const keys = ['ipo', 'qsg', 'smo'];
    const done = keys.filter((key) => {
      const stamp = this.journey()?.milestones?.[key] as { done?: boolean } | undefined;
      return stamp?.done === true;
    }).length;
    return `${done} of ${keys.length} core trainings recorded`;
  }

  protected trainingPercent(): number {
    const keys = ['ipo', 'qsg', 'smo'];
    const done = keys.filter((key) => {
      const stamp = this.journey()?.milestones?.[key] as { done?: boolean } | undefined;
      return stamp?.done === true;
    }).length;
    return Math.round((done / keys.length) * 100);
  }

  protected nextAction(): DailyAction | null {
    return this.topActions()[0] ?? null;
  }

  protected pendingCommissions(): number {
    return Number(this.compensation()?.summary?.pending ?? 0);
  }

  protected releasedCommissions(): number {
    return Number(this.compensation()?.summary?.released ?? 0);
  }

  protected campaignSpend(): number {
    return this.campaigns().reduce((sum, c) => sum + Number(c.budget?.spent ?? 0), 0);
  }

  protected campaignRemaining(): number {
    return this.campaigns().reduce((sum, c) => sum + Number(c.budget?.remaining ?? 0), 0);
  }

  /** Paid store orders that still need a partner fulfilment action. */
  protected storeActionCount(): number {
    return Number(this.storeEarnings()?.awaitingDelivery ?? 0);
  }

  protected storePendingEarnings(): number {
    return Number(this.storeEarnings()?.pending ?? 0);
  }

  protected storeReleasedEarnings(): number {
    return Number(this.storeEarnings()?.released ?? 0);
  }

  protected followUpsDue(): number {
    const r = this.reminders();
    return r ? r.overdue + r.today : 0;
  }

  /** Recent meaningful moments: placement, commission, certificates, promotion. */
  protected readonly activity = computed<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    const placed = this.allocation()?.allocation;
    if (placed) {
      items.push({
        id: `allocation-${placed.id}`,
        icon: 'hub',
        title: `Placed with ${placed.owner?.name || 'a campaign owner'}`,
        detail: placed.campaign?.name ? `Campaign: ${placed.campaign.name}` : 'Campaign allocation',
        at: placed.allocatedAt ?? null,
        link: '/dashboard/campaigns',
      });
    }

    for (const entry of this.compensation()?.entries ?? []) {
      items.push({
        id: `commission-${entry.id}`,
        icon: 'payments',
        title: `Commission ₦${Number(entry.amount ?? 0).toLocaleString('en-NG')} · ${entry.status}`,
        detail: `Level ${entry.level} · ${entry.buyer?.name || 'Product order'}`,
        at: entry.releasedAt ?? entry.createdAt ?? null,
        link: '/dashboard/compensation',
      });
    }

    for (const cert of this.certificates()) {
      items.push({
        id: `cert-${cert.courseId}`,
        icon: 'workspace_premium',
        title: `Certified: ${cert.title}`,
        detail: cert.number ? `Certificate ${cert.number}` : 'Course completed',
        at: cert.at ?? null,
        link: '/dashboard/training/courses',
      });
    }

    const promoted = this.journey()?.promoted;
    if (promoted) {
      items.push({
        id: `promotion-${promoted.from}-${promoted.to}`,
        icon: 'trending_up',
        title: `Promoted from ${promoted.from} to ${promoted.to}`,
        detail: 'Rank journey',
        at: null,
        link: '/dashboard/progress',
      });
    }

    return items
      .sort((a, b) => {
        const at = a.at ? new Date(a.at).getTime() : 0;
        const bt = b.at ? new Date(b.at).getTime() : 0;
        return bt - at;
      })
      .slice(0, 6);
  });

  protected greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  protected firstName(): string {
    return this.auth.currentUser()?.name?.split(' ')[0] ?? '';
  }

  protected topActions(): DailyAction[] {
    const base = this.overview()?.actions.actions ?? [];
    const storeCount = this.storeActionCount();
    const storeAction: DailyAction | null = storeCount > 0
      ? {
          id: 'store-fulfilment',
          priority: 'high',
          category: 'store',
          title: `${storeCount} store order${storeCount === 1 ? '' : 's'} need${storeCount === 1 ? 's' : ''} fulfilment`,
          detail: 'Start processing, add tracking and mark delivery to release escrow.',
          link: '/dashboard/products/store-orders',
        }
      : null;
    return [...(storeAction ? [storeAction] : []), ...base].slice(0, 5);
  }

  protected headline(): string {
    const o = this.overview();
    if (!o) return 'Loading your business…';
    const urgent = o.actions.actions.filter((a) => a.priority === 'high').length
      + (this.storeActionCount() > 0 ? 1 : 0);
    if (urgent > 0) return `${urgent} item${urgent === 1 ? '' : 's'} need${urgent === 1 ? 's' : ''} you first.`;
    if (o.goals.behind > 0) return 'Calm inbox — but a goal needs pace.';
    return 'All clear. Today is a prospecting day.';
  }

  protected previewText(body: string): string {
    const text = String(body ?? '').trim();
    return text.length > 140 ? `${text.slice(0, 139)}…` : text;
  }

  /**
   * First-run checklist — the four activation moves. Unknown counts as
   * done (fail-soft): the strip must never nag on uncertain data.
   */
  protected starterItems(): Array<{ key: string; label: string; link: string; done: boolean }> {
    return [
      { key: 'profile', label: 'Complete your profile', link: '/dashboard/settings/profiles', done: !this.profileIncomplete() },
      { key: 'prospect', label: 'Submit at least one contact/prospect', link: '/dashboard/prospects/new', done: this.hasProspect() },
      { key: 'goal', label: 'Set your first goal', link: '/dashboard/goals', done: (this.overview()?.goals.total ?? 1) > 0 },
      { key: 'ipo', label: 'Take the IPO course', link: '/dashboard/training', done: this.ipoDone() },
    ];
  }

  protected showStarter(): boolean {
    return this.starterItems().some((i) => !i.done);
  }

  protected starterDone(): number {
    return this.starterItems().filter((i) => i.done).length;
  }

  private ipoDone(): boolean {
    const ipo = this.journey()?.milestones?.['ipo'] as { done?: boolean } | undefined;
    return ipo?.done === true;
  }

  /** One-line focus for this rank — plain words, no jargon. */
  protected roleFocus(): string | null {
    if (!this.journey()) return null;
    const rank = this.rankLabel();
    if (rank === 'Partner') return 'Focus: complete IPO and QSG, then connect your first personal recruit';
    if (rank === 'Builder') return 'Focus: build your retail customer base and your frontline partners';
    if (rank === 'Leader') return 'Focus: develop Builders and lead your frontline teams';
    return 'Focus: organisation volume, leadership depth and Ambassador recognition';
  }

  ngOnInit(): void {
    this.reload();
  }

  /** Presence dot for a post author id (null hides it). */
  protected presenceOf(authorId: string | null | undefined): PresenceStatus {
    if (!authorId) return null;
    return this.presence.statusOf(this.presenceMap()[String(authorId)] ?? null);
  }

  /** Claim the visible bonus — single-tap, idempotent server-side. */
  protected claimBonus(): void {
    const campaign = this.bonus()?.campaign;
    if (!campaign || this.claimingBonus()) return;
    this.claimingBonus.set(true);
    this.bonusNotice.set(null);
    this.bonuses
      .claim(campaign.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.claimingBonus.set(false);
          this.bonusNotice.set(res.message ?? `₦${Number(campaign.amountNgn).toLocaleString()} added to your wallet.`);
          this.bonus.set(null);
        },
        error: (err: ApiError) => {
          this.claimingBonus.set(false);
          // Already-claimed races simply clear the banner.
          if (String(err.message ?? '').toLowerCase().includes('already claimed')) this.bonus.set(null);
          else this.bonusNotice.set(err.message);
        },
      });
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    // Journey + community + prospect count + bonus fail soft — the page must never blank on them.
    const partnerId = String(this.auth.currentUser()?.id ?? '');
    forkJoin({
      overview: this.analytics.overview(30),
      compensation: this.compensationSvc.me().pipe(catchError(() => of(null))),
      journey: this.progress.mine().pipe(catchError(() => of(null))),
      feed: this.community.feed(undefined, 5).pipe(catchError(() => of(null))),
      prospects: partnerId
        ? this.leads.listByPartner(partnerId, { limit: 1 }).pipe(catchError(() => of(null)))
        : of(null),
      bonus: this.bonuses.eligible().pipe(catchError(() => of(null))),
      onboarding: this.onboardingSvc.status().pipe(catchError(() => of(null))),
      allocation: this.campaignsSvc.myAllocation().pipe(catchError(() => of(null))),
      campaignList: this.campaignsSvc.mine().pipe(catchError(() => of(null))),
      storeEarnings: this.storeSvc.earnings().pipe(catchError(() => of(null))),
      reminders: this.leads.reminders().pipe(catchError(() => of(null))),
      certificates: this.trainingSvc.certificates().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ overview, compensation, journey, feed, prospects, bonus, onboarding, allocation, campaignList, storeEarnings, reminders, certificates }) => {
          this.overview.set(overview.data ?? null);
          this.compensation.set(compensation?.data ?? null);
          this.journey.set(journey?.data ?? null);
          this.communityPosts.set(feed?.data?.items?.slice(0, 3) ?? []);
          this.hasProspect.set(((prospects?.meta?.total ?? prospects?.data?.length ?? 0) > 0));
          this.bonus.set(bonus?.data?.campaign ? (bonus.data as EligibleBonus) : null);
          this.onboarding.set(onboarding?.data ?? null);
          this.allocation.set(allocation?.data ?? null);
          this.campaigns.set(campaignList?.data ?? []);
          this.storeEarnings.set(storeEarnings?.data ?? null);
          this.reminders.set(reminders?.data ? { overdue: reminders.data.overdue.length, today: reminders.data.today.length } : null);
          this.certificates.set(certificates?.data ?? []);
          this.growthLoaded.set(true);
          this.loading.set(false);
          const ids = (feed?.data?.items ?? []).map((p) => p.authorId);
          if (ids.length > 0) {
            this.presence
              .lookup(ids)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe((map) => this.presenceMap.set({ ...this.presenceMap(), ...map }));
          }
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }
}
