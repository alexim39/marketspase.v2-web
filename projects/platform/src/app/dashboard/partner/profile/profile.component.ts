import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { PartnerInterface } from '../../../_common/services/partner.service';
import { AvatarComponent } from '../../../_common/avatar.component';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

/**
 * @title Profile — sidenav identity header.
 * Compact avatar + name + handle with a profile-completeness nudge.
 * Lives in a plain auto-height wrapper (never inside a fixed-height
 * toolbar) so the avatar always renders at natural size.
 */
@Component({
selector: 'async-profile',
template: `

<div class="identity">
  <async-avatar [photo]="partner?.profileImage" [name]="displayName()" size="lg" />
  <div class="who">
    @if (hasName()) {
      <div class="name">{{ partner?.name | titlecase }} {{ partner?.surname | titlecase }}</div>
    } @else {
      <div class="name">{{ partner?.username }}</div>
    }
    <div class="handle">@{{ partner?.username | lowercase }}</div>
    @if (!profileComplete()) {
      <a class="nudge" routerLink="/dashboard/settings/profiles" title="Add your phone number and location so your upline and prospects can reach you">Complete profile</a>
    }
  </div>
</div>

`,
styles: [`

.identity {
  display: flex;
  align-items: center;
  gap: 0.85em;
  width: 100%;
  box-sizing: border-box;
  padding: 0.9em 0.8em;
}
.who {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.name {
  font-size: 1em;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.handle {
  font-size: 0.82em;
  color: var(--ms-nav-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nudge {
  font-size: 0.8em;
  font-weight: 700;
  color: var(--ms-nav-muted);
  text-decoration: none;
  margin-top: 0.3em;
  align-self: flex-start;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
.nudge:hover {
  text-decoration: underline;
}

`],
changeDetection: ChangeDetectionStrategy.OnPush,
imports: [CommonModule, AvatarComponent, RouterModule]
})
export class ProfileComponent {
  @Input() partner!: PartnerInterface;

  protected displayName(): string {
    if (!this.partner) return '';
    return `${this.partner.name ?? ''} ${this.partner.surname ?? ''}`.trim() || this.partner.username || '';
  }

  protected hasName(): boolean {
    return String(this.partner?.name ?? '').trim().length > 0
      || String(this.partner?.surname ?? '').trim().length > 0;
  }

  /** Same rule as the Home banner: phone + street/city/state. */
  protected profileComplete(): boolean {
    const p = (this.partner ?? {}) as Partial<PartnerInterface> & {
      phone?: unknown; address?: { street?: unknown; city?: unknown; state?: unknown };
    };
    const filled = (v: unknown): boolean => String(v ?? '').trim().length > 0;
    return filled(p.phone)
      && filled(p.address?.street) && filled(p.address?.city) && filled(p.address?.state);
  }
}
