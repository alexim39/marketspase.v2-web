import { inject, Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { AnalyticsService } from '../analytics/analytics.service';
import { CompensationService } from '../compensation/compensation.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { ProgressionService } from '../progression/progression.service';
import { StoreService } from '../store/store.service';
import { LaunchMilestone, LaunchPathState } from './launch-path.models';

const hasText = (value: unknown): boolean => String(value ?? '').trim().length > 0;

const rankOf = (commissionRank?: string | null, levelLabel?: string | null): string =>
  String(commissionRank ?? '').trim() || String(levelLabel ?? '').trim() || 'Partner';

/**
 * Aggregates the existing onboarding, analytics, journey, earnings and store
 * reads into one guided path. No extra backend endpoint is needed: every
 * milestone comes from a source the member already owns.
 */
@Injectable({ providedIn: 'root' })
export class LaunchPathService {
  private readonly onboarding = inject(OnboardingService);
  private readonly analytics = inject(AnalyticsService);
  private readonly progression = inject(ProgressionService);
  private readonly compensation = inject(CompensationService);
  private readonly store = inject(StoreService);

  load(): Observable<LaunchPathState> {
    return forkJoin({
      onboarding: this.onboarding.status().pipe(catchError(() => of(null))),
      overview: this.analytics.overview().pipe(catchError(() => of(null))),
      journey: this.progression.mine().pipe(catchError(() => of(null))),
      compensation: this.compensation.me().pipe(catchError(() => of(null))),
      store: this.store.earnings().pipe(catchError(() => of(null))),
    }).pipe(map(({ onboarding, overview, journey, compensation, store }) => {
      const partner = onboarding?.data?.partner ?? null;
      const address = partner?.address;
      const profileDone = !!partner && hasText(partner.phone) && hasText(address?.street)
        && hasText(address?.city) && hasText(address?.state);
      const activated = partner?.accountState === 'partner';
      const firstProspect = Number(overview?.data?.funnel?.entered ?? 0) > 0;
      const firstCustomer = Number(store?.data?.paidOrders ?? 0) > 0;
      const comp = compensation?.data ?? null;
      const firstCommission = Number(comp?.entries?.length ?? 0) > 0
        || Number(comp?.summary?.released ?? 0) > 0
        || Number(comp?.summary?.pending ?? 0) > 0;
      const recruits = Number(journey?.data?.signals?.recruits ?? 0);
      const journeyLevel = String(journey?.data?.level ?? 'partner').toLowerCase();
      const builder = ['builder', 'leader', 'ambassador'].includes(journeyLevel)
        || String(comp?.partner?.commissionRank ?? '').toLowerCase() !== 'partner' && !!comp?.partner?.commissionRank;

      const basic = (key: string, title: string, detail: string, icon: string, link: string, action: string, done: boolean): LaunchMilestone => ({
        key, title, detail, icon, link, action, done, current: false,
      });

      const milestones: LaunchMilestone[] = [
        basic('verified', 'Verify your account', 'Confirm your email so your account and notifications are secure.', 'mark_email_read', '/dashboard/settings/profiles', 'Open profile', !!partner?.emailVerified),
        basic('profile', 'Complete your profile', 'Add your phone, location and a short bio so your mentor and prospects can reach you.', 'person', '/dashboard/settings/profiles', 'Complete profile', profileDone),
        basic('activation', 'Activate your partner business', 'Get your starter product and unlock commissions, allocation and the partner toolkit.', 'verified_user', '/dashboard/activate', 'Open activation', activated),
        basic('prospect', 'Add your first prospect', 'Start the pipeline with one real person you can help this week.', 'person_add', '/dashboard/prospects/new', 'Add a prospect', firstProspect),
        basic('customer', 'Make your first customer sale', 'Share your store and turn a product into your first real customer order.', 'storefront', '/dashboard/products/my-store', 'Open my store', firstCustomer),
        basic('commission', 'Earn your first commission', 'Your first product or mentor commission proves the engine is working.', 'payments', '/dashboard/compensation', 'View earnings', firstCommission),
        basic('recruit', 'Connect your first partner', 'Invite someone into your team and support their first steps.', 'group_add', '/dashboard/promote', 'Invite a partner', recruits > 0),
        basic('builder', 'Reach Builder', 'Complete the training and team signals that unlock Level 2 commissions.', 'workspace_premium', '/dashboard/learn', 'Open my progress', builder),
      ];

      const completed = milestones.filter((m) => m.done).length;
      const next = milestones.find((m) => !m.done) ?? null;
      if (next) next.current = true;

      return {
        name: [partner?.name, partner?.surname].filter(Boolean).join(' ').trim() || 'Partner',
        rank: rankOf(comp?.partner?.commissionRank, journey?.data?.levelLabel),
        percent: Math.round((completed / milestones.length) * 100),
        completed,
        total: milestones.length,
        next,
        milestones,
      } satisfies LaunchPathState;
    }));
  }
}
