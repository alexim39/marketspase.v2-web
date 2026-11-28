import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { AvatarComponent } from '../../../../_common/avatar.component';
import { PresenceStatus } from '../../../../core/presence/presence.service';
import { NetworkNode } from '../network.models';

export type NetworkLevelTone = 'earning' | 'locked' | 'view';
export type NetworkRankTone = 'partner' | 'builder' | 'leader' | 'ambassador';

/**
 * One branch in the mobile network tree.
 *
 * The card is deliberately self-contained: the tree owns hierarchy, connectors
 * and expansion, while this card owns identity, rank/level context and the
 * member actions. Deep branches stay compact because the chips wrap and the
 * card stretches to the indented tree column.
 */
@Component({
  selector: 'async-network-node-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, MatIconModule, RouterModule],
  template: `
    <article
      class="node-card"
      [class.rank-builder]="rankTone() === 'builder'"
      [class.rank-leader]="rankTone() === 'leader'"
      [class.rank-ambassador]="rankTone() === 'ambassador'"
      [class.is-match]="matched()"
      [class.is-dimmed]="searching() && !matched()"
      [id]="'network-node-' + node().id">
      <div class="node-head">
        <async-avatar [photo]="avatar()" [name]="name()" size="sm" [presence]="presence()" />
        <div class="node-copy">
          <strong>{{ name() }}</strong>
          <span class="node-handle">&#64;{{ node().username }} · {{ node().commissionRank }}</span>
          <div class="node-chips">
            <span [class]="'level-chip level-chip--' + levelTone()" [attr.title]="earningNote()">{{ levelLabel() }}</span>
            <span class="relation-chip" [class.is-placement]="node().relationType === 'placement'">{{ relationLabel() }}</span>
            <span class="direct-chip">{{ node().childCount }} direct</span>
          </div>
        </div>
        @if (hasChildren() && !searching()) {
          <button
            type="button"
            class="node-toggle"
            [class.is-open]="expanded()"
            (click)="toggled.emit(node())"
            [attr.aria-expanded]="expanded()"
            [attr.aria-label]="(expanded() ? 'Collapse ' : 'Expand ') + name() + ' branch'">
            <mat-icon>{{ expanded() ? 'expand_less' : 'expand_more' }}</mat-icon>
            <span>{{ node().childCount }}</span>
          </button>
        }
      </div>

      <div class="node-actions">
        <a class="node-action" [routerLink]="['/dashboard/network/view', node().id]" aria-label="Open 360 view">
          <mat-icon>person_search</mat-icon>
        </a>
        <a
          class="node-action"
          [routerLink]="['/dashboard/messages']"
          [queryParams]="{ chat: node().id, chatName: name() }"
          aria-label="Chat with partner">
          <mat-icon>chat</mat-icon>
        </a>
        <button type="button" class="node-action node-action--focus" (click)="focused.emit(node())">
          <mat-icon>center_focus_strong</mat-icon>
          <span>Focus</span>
        </button>
      </div>
    </article>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .node-card { display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--ms-line); border-left: 3px solid var(--ms-primary); border-radius: 14px; background: var(--ms-surface); box-shadow: 0 4px 12px rgba(20, 18, 43, 0.04); transition: border-color 140ms ease, box-shadow 140ms ease; }
    .node-card.rank-builder { border-left-color: var(--ms-info); }
    .node-card.rank-leader { border-left-color: var(--ms-success); }
    .node-card.rank-ambassador { border-left-color: var(--ms-warning); }
    .node-card.is-match { border-color: var(--ms-success); border-left-color: var(--ms-success); box-shadow: 0 0 0 3px var(--ms-success-soft); }
    .node-card.is-dimmed { opacity: 0.55; }
    .node-head { display: flex; align-items: flex-start; gap: 9px; min-width: 0; padding: 10px 10px 8px; }
    .node-head async-avatar { flex: none; }
    .node-copy { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
    .node-copy strong { overflow: hidden; font-size: 0.85rem; line-height: 1.3; text-overflow: ellipsis; text-transform: capitalize; white-space: nowrap; }
    .node-handle { overflow: hidden; color: var(--ms-text-muted); font-size: 0.67rem; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
    .node-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }
    .level-chip, .relation-chip, .direct-chip { display: inline-flex; align-items: center; gap: 2px; max-width: 100%; padding: 2px 7px; border-radius: 999px; font-size: 0.61rem; font-weight: 750; line-height: 1.4; white-space: nowrap; }
    .level-chip--earning { background: var(--ms-success-soft); color: var(--ms-success); }
    .level-chip--locked { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .level-chip--view { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .relation-chip { background: var(--ms-canvas); color: var(--ms-text-muted); }
    .relation-chip.is-placement { background: var(--ms-info-soft); color: var(--ms-info); }
    .direct-chip { padding-left: 1px; background: transparent; color: var(--ms-text-muted); }
    .node-toggle { display: inline-flex; align-items: center; gap: 1px; flex: none; min-height: 40px; padding: 0 8px; border: 1px solid var(--ms-line); border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font: inherit; font-size: 0.69rem; font-weight: 800; cursor: pointer; }
    .node-toggle.is-open { border-color: color-mix(in srgb, var(--ms-primary) 35%, var(--ms-line)); background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .node-toggle mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .node-actions { display: flex; align-items: center; gap: 2px; padding: 2px 6px 4px; border-top: 1px solid var(--ms-line); }
    .node-action { display: inline-grid; place-items: center; flex: none; width: 38px; height: 38px; border: 0; border-radius: 50%; background: transparent; color: var(--ms-text-muted); font: inherit; text-decoration: none; cursor: pointer; }
    .node-action:active { background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .node-action mat-icon { font-size: 19px; width: 19px; height: 19px; }
    .node-action--focus { display: inline-flex; align-items: center; gap: 4px; width: auto; margin-left: auto; padding: 0 7px; border-radius: 999px; font-size: 0.71rem; font-weight: 650; }
  `],
})
export class NetworkTreeNodeCardComponent {
  readonly node = input.required<NetworkNode>();
  readonly expanded = input(false);
  readonly hasChildren = input(false);
  readonly searching = input(false);
  readonly matched = input(false);
  readonly presence = input<PresenceStatus>(null);
  readonly avatar = input<string | null>(null);
  readonly levelLabel = input('');
  readonly levelTone = input<NetworkLevelTone>('earning');
  readonly relationLabel = input('Referral');
  readonly rankTone = input<NetworkRankTone>('partner');
  readonly earningNote = input('');

  readonly toggled = output<NetworkNode>();
  readonly focused = output<NetworkNode>();

  protected readonly name = computed(() => {
    const node = this.node();
    const full = `${node.name ?? ''} ${node.surname ?? ''}`.trim();
    return full || node.username;
  });
}
