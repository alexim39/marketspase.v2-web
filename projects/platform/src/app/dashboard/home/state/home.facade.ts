import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of } from 'rxjs';
import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CommunityService } from '../../../core/community/community.service';
import { PresenceService, PresenceStatus } from '../../../core/presence/presence.service';
import { ProgressionService } from '../../../core/progression/progression.service';
import { LeadPipelineService } from '../../partner/prospects/lead-pipeline/lead-pipeline.service';
import { BonusService, EligibleBonus } from '../../../core/bonuses/bonus.service';
import { OnboardingService } from '../../../core/onboarding/onboarding.service';
import { CampaignsService } from '../../../core/campaigns/campaigns.service';
import { TrainingService } from '../../../core/training/training.service';
import { Certificate } from '../../../core/training/training.models';
import { WeeklyVideoService } from '../../../core/weekly-video/weekly-video.service';
import { CurrentWeeklyVideo } from '../../../core/weekly-video/weekly-video.models';
import { OnboardingStatus } from '../../../core/onboarding/onboarding.models';
import { GrowthCampaign, MyAllocation } from '../../../core/campaigns/campaigns.models';
import { DailyAction, DashboardOverview } from '../../../core/analytics/analytics.models';
import { CompensationService } from '../../../core/compensation/compensation.service';
import { MyCompensation } from '../../../core/compensation/compensation.models';
import { StoreService } from '../../../core/store/store.service';
import { StoreEarnings } from '../../../core/store/store.models';
import { FeedPost } from '../../../core/community/community.models';
import { Journey } from '../../../core/progression/progression.models';
import { ApiError } from '../../../core/http/api-error';

/** One meaningful moment for the Home activity timeline. */
export interface HomeActivityItem {
  id: string;
  icon: string;
  title: string;
  detail: string;
  at: string | null;
  link: string;
}

/**
 * Shared Home state and actions.
 *
 * Provided by the device wrapper. Both the desktop and mobile views read the
 * same signals, and `ensureLoaded()` prevents a resize from refetching the
 * thirteen fail-soft requests that make up the command centre.
 */
@Injectable()
export class HomeFacade {
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
  private readonly weeklyVideos = inject(WeeklyVideoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly overview = signal<DashboardOverview | null>(null);
  readonly compensation = signal<MyCompensation | null>(null);
  readonly journey = signal<Journey | null>(null);
  readonly communityPosts = signal<FeedPost[]>([]);
  /** authorId → lastSeenAt (null = offline/stranger); drives avatar dots. */
  readonly presenceMap = signal<Record<string, string | null>>({});
  readonly hasProspect = signal(false);
  readonly today = new Date();
  readonly bannerDismissed = signal(false);
  readonly tutorialsDismissed = signal(false);
  readonly bonus = signal<EligibleBonus | null>(null);
  readonly claimingBonus = signal(false);
  readonly bonusNotice = signal<string | null>(null);
  /** Growth engine: activation, KYC, queue and campaigns. */
  readonly onboarding = signal<OnboardingStatus | null>(null);
  readonly allocation = signal<MyAllocation | null>(null);
  readonly campaigns = signal<GrowthCampaign[]>([]);
  readonly storeEarnings = signal<StoreEarnings | null>(null);
  readonly growthLoaded = signal(false);
  /** Follow-up bucket counts for the momentum card. */
  readonly reminders = signal<{ overdue: number; today: number } | null>(null);
  /** Current weekly briefing — dashboard follow-up when incomplete. */
  readonly weeklyVideo = signal<CurrentWeeklyVideo | null>(null);
  /** Activity timeline inputs. */
  private readonly certificates = signal<Certificate[]>([]);

  private started = false;

  ensureLoaded(): void {
    if (this.started) return;
    this.started = true;
    this.load();
  }

  reload(): void {
    if (this.loading()) return;
    this.load();
  }

  activationNeeded(): boolean {
    return this.auth.currentUser()?.accountState === 'member';
  }

  /** Required for onboarding: phone + street/city/state (picture stays optional). */
  profileIncomplete(): boolean {
    const u = (this.auth.currentUser() ?? {}) as { phone?: unknown; address?: { street?: unknown; city?: unknown; state?: unknown } };
    const filled = (v: unknown): boolean => String(v ?? '').trim().length > 0;
    return !filled(u.phone)
      || !filled(u.address?.street) || !filled(u.address?.city) || !filled(u.address?.state);
  }

  /** Growth engine state: member → KYC → queue → placed/active. */
  growthState(): 'member' | 'kyc' | 'queued' | 'placed' | 'active' {
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

  growthStateLabel(): string {
    switch (this.growthState()) {
      case 'member': return 'Not activated';
      case 'kyc': return 'KYC required';
      case 'queued': return 'In queue';
      case 'placed': return 'Placed';
      default: return 'Active partner';
    }
  }

  growthHeadline(): string {
    const position = this.onboarding()?.queue?.position;
    switch (this.growthState()) {
      case 'member': return 'Activate your partner business';
      case 'kyc': return 'Complete the identity step to unlock allocation';
      case 'queued': return position ? `You are #${position} in the allocation queue` : 'You are in the allocation queue';
      case 'placed': return 'Placed with a campaign owner';
      default: return 'Your growth engine is ready';
    }
  }

  growthDetail(): string {
    switch (this.growthState()) {
      case 'member': return 'Buy the MarketSpase starter product to enter the allocation queue and unlock commissions.';
      case 'kyc': return 'Your activation order is paid — complete KYC so the allocation engine can place you.';
      case 'queued': return 'We will place you as soon as an eligible funded campaign has capacity. You can fund partner acquisition while you wait.';
      case 'placed': return 'Your mentor handoff is active. Keep your team supported and your commissions accruing.';
      default: return 'Fund partner acquisition to receive activated partners, or keep building your team.';
    }
  }

  kycLabel(): string {
    const status = this.onboarding()?.kyc?.status ?? this.auth.currentUser()?.kycStatus ?? 'not_started';
    if (status === 'pending') return 'Verified';
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  queueLabel(): string {
    const q = this.onboarding()?.queue;
    if (!q) return '—';
    if (q.status === 'queued') return q.position ? `#${q.position}` : 'Queued';
    if (q.status === 'allocated') return 'Placed';
    return 'Cancelled';
  }

  activeCampaigns(): number {
    return this.campaigns().filter((c) => c.status === 'Active').length;
  }

  walletBalance(): number {
    return Number(this.onboarding()?.partner.balance ?? 0);
  }

  rankLabel(): string {
    return this.compensation()?.partner?.commissionRank
      ?? this.auth.currentUser()?.commissionRank
      ?? 'Partner';
  }

  trainingSummary(): string {
    const keys = ['ipo', 'qsg', 'smo'];
    const done = keys.filter((key) => {
      const stamp = this.journey()?.milestones?.[key] as { done?: boolean } | undefined;
      return stamp?.done === true;
    }).length;
    return `${done} of ${keys.length} core trainings recorded`;
  }

  trainingPercent(): number {
    const keys = ['ipo', 'qsg', 'smo'];
    const done = keys.filter((key) => {
      const stamp = this.journey()?.milestones?.[key] as { done?: boolean } | undefined;
      return stamp?.done === true;
    }).length;
    return Math.round((done / keys.length) * 100);
  }

  nextAction(): DailyAction | null {
    return this.topActions()[0] ?? null;
  }

  pendingCommissions(): number {
    return Number(this.compensation()?.summary?.pending ?? 0);
  }

  releasedCommissions(): number {
    return Number(this.compensation()?.summary?.released ?? 0);
  }

  campaignSpend(): number {
    return this.campaigns().reduce((sum, c) => sum + Number(c.budget?.spent ?? 0), 0);
  }

  campaignRemaining(): number {
    return this.campaigns().reduce((sum, c) => sum + Number(c.budget?.remaining ?? 0), 0);
  }

  /** Paid store orders that still need a partner fulfilment action. */
  storeActionCount(): number {
    return Number(this.storeEarnings()?.awaitingDelivery ?? 0);
  }

  storePendingEarnings(): number {
    return Number(this.storeEarnings()?.pending ?? 0);
  }

  storeReleasedEarnings(): number {
    return Number(this.storeEarnings()?.released ?? 0);
  }

  followUpsDue(): number {
    const r = this.reminders();
    return r ? r.overdue + r.today : 0;
  }

  /** Recent meaningful moments: placement, commission, certificates, promotion. */
  readonly activity = computed<HomeActivityItem[]>(() => {
    const items: HomeActivityItem[] = [];

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

  greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  firstName(): string {
    return this.auth.currentUser()?.name?.split(' ')[0] ?? '';
  }

  topActions(): DailyAction[] {
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

  headline(): string {
    const o = this.overview();
    if (!o) return 'Loading your business…';
    const urgent = o.actions.actions.filter((a) => a.priority === 'high').length
      + (this.storeActionCount() > 0 ? 1 : 0);
    if (urgent > 0) return `${urgent} item${urgent === 1 ? '' : 's'} need${urgent === 1 ? 's' : ''} you first.`;
    if (o.goals.behind > 0) return 'Calm inbox — but a goal needs pace.';
    return 'All clear. Today is a prospecting day.';
  }

  previewText(body: string): string {
    const text = String(body ?? '').trim();
    return text.length > 140 ? `${text.slice(0, 139)}…` : text;
  }

  /**
   * First-run checklist — the four activation moves. Unknown counts as
   * done (fail-soft): the strip must never nag on uncertain data.
   */
  starterItems(): Array<{ key: string; label: string; link: string; done: boolean }> {
    return [
      { key: 'profile', label: 'Complete your profile', link: '/dashboard/settings/profiles', done: !this.profileIncomplete() },
      { key: 'prospect', label: 'Submit at least one contact/prospect', link: '/dashboard/prospects/new', done: this.hasProspect() },
      { key: 'goal', label: 'Set your first goal', link: '/dashboard/goals', done: (this.overview()?.goals.total ?? 1) > 0 },
      { key: 'ipo', label: 'Take the IPO course', link: '/dashboard/training', done: this.ipoDone() },
    ];
  }

  showStarter(): boolean {
    return this.starterItems().some((i) => !i.done);
  }

  starterDone(): number {
    return this.starterItems().filter((i) => i.done).length;
  }

  /** One-line focus for this rank — plain words, no jargon. */
  roleFocus(): string | null {
    if (!this.journey()) return null;
    const rank = this.rankLabel();
    if (rank === 'Partner') return 'Focus: complete IPO and QSG, then connect your first personal recruit';
    if (rank === 'Builder') return 'Focus: build your retail customer base and your frontline partners';
    if (rank === 'Leader') return 'Focus: develop Builders and lead your frontline teams';
    return 'Focus: organisation volume, leadership depth and Ambassador recognition';
  }

  /** Presence dot for a post author id (null hides it). */
  presenceOf(authorId: string | null | undefined): PresenceStatus {
    if (!authorId) return null;
    return this.presence.statusOf(this.presenceMap()[String(authorId)] ?? null);
  }

  /** Claim the visible bonus — single-tap, idempotent server-side. */
  claimBonus(): void {
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
          this.bonusNotice.set(
            res.message
              ? `${res.message} Platform use only — not withdrawable.`
              : `₦${Number(campaign.amountNgn).toLocaleString()} added as platform credit. Use it for SMS, campaigns and other services; it cannot be withdrawn.`,
          );
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

  private ipoDone(): boolean {
    const ipo = this.journey()?.milestones?.['ipo'] as { done?: boolean } | undefined;
    return ipo?.done === true;
  }

  private load(): void {
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
      weekly: this.weeklyVideos.current().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ overview, compensation, journey, feed, prospects, bonus, onboarding, allocation, campaignList, storeEarnings, reminders, certificates, weekly }) => {
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
          this.weeklyVideo.set(weekly?.data ?? null);
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
