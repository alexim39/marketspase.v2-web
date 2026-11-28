import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { AvatarComponent } from '../../../../_common/avatar.component';
import type { PresenceStatus } from '../../../../core/presence/presence.service';

export interface LiveCirclePerson {
  id: string;
  name: string;
  photo: string | null;
  presence: PresenceStatus;
}

/**
 * Dark presence card for the desktop community hero.
 *
 * Shows real teammate photos with their live/recent pulse and opens messages.
 */
@Component({
  selector: 'async-community-live-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, MatIconModule, RouterModule],
  template: `
    <a class="live-card" routerLink="/dashboard/messages" [attr.aria-label]="headline() + '. Open team messages.'">
      <span class="live-stack" aria-hidden="true">
        @for (person of people(); track person.id) {
          <async-avatar [photo]="person.photo" [name]="person.name" size="sm" [presence]="person.presence" />
        }
        @if (people().length === 0) {
          <span class="live-empty"><mat-icon>groups</mat-icon></span>
        }
      </span>
      <span class="live-copy">
        <span class="live-label"><span class="live-dot" [class.is-live]="onlineCount() > 0" aria-hidden="true"></span>{{ label() }}</span>
        <strong>{{ headline() }}</strong>
        <small>{{ detail() }}</small>
      </span>
      <mat-icon class="live-arrow" aria-hidden="true">chevron_right</mat-icon>
    </a>
  `,
  styles: [`
    :host { display: block; min-width: 0; }

    .live-card {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      height: 100%;
      padding: 11px 13px;
      border-radius: 16px;
      background:
        radial-gradient(120% 160% at 100% 0%, rgba(129, 140, 248, 0.4), transparent 58%),
        linear-gradient(135deg, #19152e 0%, #2a2247 58%, #3b2e5d 100%);
      box-shadow: 0 10px 26px rgba(16, 12, 35, 0.18);
      color: var(--ms-ink-text);
      text-decoration: none;
    }

    .live-card:hover {
      transform: translateY(-1px);
    }

    .live-stack {
      display: flex;
      align-items: center;
      flex: none;
      padding-left: 7px;
    }

    .live-stack async-avatar {
      display: inline-flex;
      margin-left: -9px;
      border-radius: 50%;
      box-shadow: 0 0 0 2px #2a2247;
    }

    .live-stack async-avatar:first-child {
      margin-left: 0;
    }

    .live-empty {
      display: grid;
      width: 42px;
      height: 42px;
      place-items: center;
      border: 1px dashed rgba(246, 244, 255, 0.28);
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.08);
      color: #c7d2fe;
    }

    .live-empty mat-icon {
      font-size: 21px;
      width: 21px;
      height: 21px;
    }

    .live-copy {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }

    .live-label {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      color: #c7d2fe;
      font-size: 0.6rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .live-dot {
      width: 7px;
      height: 7px;
      flex: none;
      border-radius: 50%;
      background: rgba(246, 244, 255, 0.38);
    }

    .live-dot.is-live {
      background: #34d399;
      animation: presence-pulse 1.8s ease-out infinite;
    }

    .live-copy strong {
      overflow: hidden;
      color: #f8f7ff;
      font-size: 0.82rem;
      line-height: 1.3;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .live-copy small {
      overflow: hidden;
      color: rgba(246, 244, 255, 0.64);
      font-size: 0.68rem;
      line-height: 1.35;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .live-arrow {
      flex: none;
      color: rgba(246, 244, 255, 0.52);
    }

    @keyframes presence-pulse {
      0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.55); }
      70% { box-shadow: 0 0 0 7px rgba(52, 211, 153, 0); }
      100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .live-dot.is-live {
        animation: none;
      }

      .live-card:hover {
        transform: none;
      }
    }
  `],
})
export class CommunityLiveCircleCardComponent {
  readonly people = input<LiveCirclePerson[]>([]);
  readonly label = input('Team pulse');
  readonly headline = input('Build your circle');
  readonly detail = input('');
  readonly onlineCount = input(0);
}
