import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { NotificationService } from '../../../core/notifications/notification.service';
import { PushSubscriptionService } from '../../../core/notifications/push-subscription.service';
import {
  CATEGORY_LABELS,
  ChannelPreference,
  NotificationPreferences,
} from '../../../core/notifications/notification.models';
import { ApiError } from '../../../core/http/api-error';

type Digest = NotificationPreferences['emailDigest'];

const DIGEST_OPTIONS: Array<{ label: string; value: Digest }> = [
  { label: 'Immediately', value: 'immediate' },
  { label: 'Daily digest', value: 'daily' },
  { label: 'Weekly digest', value: 'weekly' },
  { label: 'Off', value: 'off' },
];

/**
 * @title Notification settings — per-category channels + email digest.
 *
 * Grouped category cards with In-app / Email / SMS / Push toggles, a digest
 * picker, and a browser-push opt-in card. Loads backend defaults (in-app
 * on, everything else off) and saves the merged preference set.
 * OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-notification-preferences',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, PageSkeletonComponent, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/notifications/center">Notifications</a> &gt;
        <span>Settings</span>
      </div>
    </section>

    <section class="prefs-page">
      <div class="page-head">
        <div>
          <h2>Notification settings</h2>
          <p class="subtitle">Choose what reaches you, and where. Changes apply to future notifications.</p>
        </div>
      </div>

      @if (loading()) {
        <async-page-skeleton layout="form" [rows]="6" label="notification preferences" [showHeader]="false" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (saved()) {
        <p class="saved" role="status">Preferences saved.</p>
      }

      @if (prefs(); as p) {
        <div class="cards">
          @for (category of categories(); track category) {
            <article class="card">
              <h3>{{ label(category) }}</h3>
              <div class="toggles" role="group" [attr.aria-label]="label(category) + ' channels'">
                <button
                  mat-button
                  [color]="channel(category, 'inApp') ? 'primary' : undefined"
                  [attr.aria-pressed]="channel(category, 'inApp')"
                  (click)="flip(category, 'inApp')"
                >In-app {{ channel(category, 'inApp') ? '✓' : '' }}</button>
                <button
                  mat-button
                  [color]="channel(category, 'email') ? 'primary' : undefined"
                  [attr.aria-pressed]="channel(category, 'email')"
                  (click)="flip(category, 'email')"
                >Email {{ channel(category, 'email') ? '✓' : '' }}</button>
                <button
                  mat-button
                  [color]="channel(category, 'sms') ? 'primary' : undefined"
                  [attr.aria-pressed]="channel(category, 'sms')"
                  (click)="flip(category, 'sms')"
                >SMS {{ channel(category, 'sms') ? '✓' : '' }}</button>
                <button
                  mat-button
                  [color]="channel(category, 'push') ? 'primary' : undefined"
                  [attr.aria-pressed]="channel(category, 'push')"
                  (click)="flip(category, 'push')"
                >Push {{ channel(category, 'push') ? '✓' : '' }}</button>
              </div>
            </article>
          }
        </div>

        <article class="card digest">
          <h3>Email digest</h3>
          <div class="toggles" role="radiogroup" aria-label="Email digest frequency">
            @for (opt of digestOptions; track opt.value) {
              <button
                mat-button
                [color]="prefs()?.emailDigest === opt.value ? 'primary' : undefined"
                role="radio"
                [attr.aria-checked]="prefs()?.emailDigest === opt.value"
                (click)="setDigest(opt.value)"
              >{{ opt.label }}</button>
            }
          </div>
        </article>

        <article class="card push-card">
          <h3>Browser push</h3>
          <p class="muted">{{ pushHint() }}</p>
          @if (push.error(); as pushErr) {
            <p class="error" role="alert">{{ pushErr }}</p>
          }
          <div class="toggles">
            @if (push.status() === 'subscribed') {
              <button mat-button (click)="push.disable()" [disabled]="push.busy()">
                {{ push.busy() ? 'Working…' : 'Turn off push on this device' }}
              </button>
            } @else {
              <button
                mat-button
                color="primary"
                (click)="push.enable()"
                [disabled]="push.busy() || push.status() === 'unsupported' || push.status() === 'denied'"
              >{{ push.busy() ? 'Working…' : 'Turn on push on this device' }}</button>
            }
          </div>
          <p class="muted fine">Per-category Push toggles above decide what may buzz you.</p>
        </article>

        <div class="actions">
          <button mat-button color="primary" (click)="save()" [disabled]="saving() || loading()">
            {{ saving() ? 'Saving…' : 'Save preferences' }}
          </button>
          <a mat-button routerLink="/dashboard/notifications/center">Back to notifications</a>
        </div>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .prefs-page { display: flex; flex-direction: column; gap: 1.25em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.75em; }
    .card { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 10px; padding: 0.9em 1em; }
    .card h3 { margin: 0 0 0.6em; font-size: 1em; }
    .toggles { display: flex; gap: 0.25em; flex-wrap: wrap; }
    .digest { max-width: 560px; }
    .push-card { max-width: 560px; display: flex; flex-direction: column; gap: 0.5em; }
    .push-card p { margin: 0; }
    .fine { font-size: 0.8em; }
    .actions { display: flex; gap: 0.5em; flex-wrap: wrap; align-items: center; }
    .actions button, .actions a, .push-card button, .toggles button { min-height: 44px; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .saved { color: var(--ms-success, #2e7d32); }
  `],
})
export class NotificationPreferencesComponent implements OnInit {
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly push = inject(PushSubscriptionService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly prefs = signal<NotificationPreferences | null>(null);

  protected readonly categories = computed(() => Object.keys(this.prefs()?.channels ?? CATEGORY_LABELS).sort());
  protected readonly digestOptions = DIGEST_OPTIONS;

  ngOnInit(): void {
    this.reload();
    void this.push.refresh();
  }

  protected pushHint(): string {
    switch (this.push.status()) {
      case 'subscribed': return 'Push is on for this device.';
      case 'denied': return 'Browser permission is blocked — allow notifications in your browser settings first.';
      case 'unsupported': return 'This browser does not support push notifications.';
      case 'unsubscribed': return 'Get buzzed for the categories you enable below.';
      default: return 'Checking this device…';
    }
  }

  protected label(category: string): string {
    return CATEGORY_LABELS[category] ?? category;
  }

  protected channel(category: string, field: keyof ChannelPreference): boolean {
    return this.prefs()?.channels[category]?.[field] ?? (field === 'inApp');
  }

  protected flip(category: string, field: keyof ChannelPreference): void {
    const current = this.prefs();
    if (!current) return;
    this.saved.set(false);
    const row = current.channels[category] ?? { inApp: true, email: false, sms: false, push: false };
    this.prefs.set({
      ...current,
      channels: { ...current.channels, [category]: { ...row, [field]: !row[field] } },
    });
  }

  protected setDigest(value: Digest): void {
    const current = this.prefs();
    if (!current) return;
    this.saved.set(false);
    this.prefs.set({ ...current, emailDigest: value });
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.notifications
      .getPreferences()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.prefs.set(res.data ?? null);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected save(): void {
    const current = this.prefs();
    if (!current) return;
    this.saving.set(true);
    this.error.set(null);
    this.saved.set(false);
    this.notifications
      .updatePreferences(current)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.prefs.set(res.data ?? current);
          this.saving.set(false);
          this.saved.set(true);
        },
        error: (err: ApiError) => {
          this.saving.set(false);
          this.error.set(err.message);
        },
      });
  }
}
