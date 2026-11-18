import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterModule } from '@angular/router';
import { AvatarComponent } from '../../../../../_common/avatar.component';
import { PartnerInterface } from '../../../../../_common/services/partner.service';
import { MyPartnersFacade } from '../state/my-partners.facade';

@Component({
  selector: 'async-my-partners-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, RouterModule, AvatarComponent],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>My partners</span>
      </div>
    </section>

    <section class="partners-page">
      <header class="page-head">
        <p class="eyebrow">Mentorship · Direct team</p>
        <h1>My partners</h1>
        <p class="subtitle">Track IPO, QSG and SMO progress, then reach out where they need you most. Contact details are masked — use Message to connect.</p>
        <a mat-flat-button color="primary" routerLink="/dashboard/mentorship/team/activation">
          <mat-icon>priority_high</mat-icon>
          Activation board
        </a>
      </header>

      @if (loading()) {
        <div class="loading-card">Loading your partners…</div>
      }

      @if (error(); as err) {
        <div class="error-card" role="alert">
          <p>{{ err }}</p>
          <button mat-stroked-button type="button" (click)="reload()">Retry</button>
        </div>
      }

      @if (!loading() && !error()) {
        @if (!isEmptyRecord()) {
          <section class="summary-strip" aria-label="Direct team summary">
            <div class="summary-item">
              <span class="summary-icon"><mat-icon>groups</mat-icon></span>
              <div><strong>{{ teamCount() }}</strong><span>Direct downline</span></div>
            </div>
            <div class="summary-item">
              <span class="summary-icon summary-icon--ok"><mat-icon>verified</mat-icon></span>
              <div><strong>{{ activatedCount() }}</strong><span>Partners</span></div>
            </div>
            <div class="summary-item">
              <span class="summary-icon summary-icon--warn"><mat-icon>school</mat-icon></span>
              <div><strong>{{ needsSupportCount() }}</strong><span>Members</span></div>
            </div>
            <div class="summary-item">
              <span class="summary-icon summary-icon--bad"><mat-icon>pending_actions</mat-icon></span>
              <div><strong>{{ pendingStampCount() }}</strong><span>Pending stamps</span></div>
            </div>
          </section>

          <div class="toolbar-card">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
              <mat-icon matPrefix>search</mat-icon>
              <mat-label>Filter by name or username</mat-label>
              <input matInput type="search" [value]="filterText()" (input)="onSearch($event)" />
            </mat-form-field>
            <span class="result-count">{{ totalFiltered() }} partner{{ totalFiltered() === 1 ? '' : 's' }}</span>
          </div>

          @if (pagedPartners().length > 0) {
            <ul class="partner-grid">
              @for (element of pagedPartners(); track element._id) {
                <li class="partner-card">
                  <div class="partner-top">
                    <async-avatar
                      [photo]="element.profileImage"
                      [name]="displayName(element)"
                      size="md"
                      [presence]="presenceStatus(element._id)" />
                    <div class="partner-identity">
                      <strong>{{ element.name | titlecase }} {{ element.surname | titlecase }}</strong>
                      <span>&#64;{{ element.username }}</span>
                    </div>
                    <span class="member-badge" [class.member-badge--partner]="isActivatedPartner(element)">{{ isActivatedPartner(element) ? 'Partner' : 'Member' }}</span>
                    @if (isActivatedPartner(element) && element.commissionRank && element.commissionRank !== 'Partner') {
                      <span class="rank-chip" title="Commission rank">{{ element.commissionRank }}</span>
                    }
                  </div>

                  <div class="stamp-row" aria-label="Training stamps">
                    @if (info(element._id); as s) {
                      <span class="mini-stamp" [class.mini-stamp--done]="s.ipoDone">
                        <mat-icon>{{ s.ipoDone ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                        IPO
                      </span>
                      <span class="mini-stamp" [class.mini-stamp--done]="s.qsgDone">
                        <mat-icon>{{ s.qsgDone ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                        QSG
                      </span>
                      <span class="mini-stamp" [class.mini-stamp--done]="s.smoDone">
                        <mat-icon>{{ s.smoDone ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                        SMO
                      </span>
                      @if (s.overdue) {
                        <span class="overdue-pill">Follow-up overdue</span>
                      }
                    } @else {
                      <span class="muted">Activation data not loaded</span>
                    }
                  </div>

                  <dl class="partner-facts">
                    <div><dt>Phone</dt><dd>{{ element.phone || '—' }}</dd></div>
                    <div><dt>Email</dt><dd>{{ element.email || '—' }}</dd></div>
                    <div><dt>Relationship</dt><dd>{{ info(element._id)?.relation || 'Direct' }}</dd></div>
                    <div><dt>Joined</dt><dd>{{ element.createdAt | date }}</dd></div>
                  </dl>

                  <div class="partner-actions">
                    <button mat-stroked-button type="button" (click)="chat(element)" [attr.aria-label]="'Chat with ' + element.name">
                      <mat-icon>chat</mat-icon>
                      Message
                    </button>
                    <button mat-flat-button color="primary" type="button" (click)="support(element._id)" [attr.aria-label]="'Open ' + element.name">
                      Open member
                      <mat-icon>arrow_forward</mat-icon>
                    </button>
                  </div>
                </li>
              }
            </ul>

            @if (totalPages() > 1) {
              <div class="pager">
                <button mat-stroked-button type="button" (click)="prevPage()" [disabled]="pageIndex() === 0">Previous</button>
                <span class="muted">Page {{ pageIndex() + 1 }} of {{ totalPages() }}</span>
                <button mat-stroked-button type="button" (click)="nextPage()" [disabled]="pageIndex() + 1 >= totalPages()">Next</button>
              </div>
            }
          } @else {
            <div class="empty-card">
              <span class="empty-icon"><mat-icon>person_search</mat-icon></span>
              <h2>No partners match</h2>
              <p>Try a different name or username, or clear the filter to see your full direct team.</p>
              <button mat-stroked-button type="button" (click)="clearFilter()">Clear filter</button>
            </div>
          }
        } @else {
          <div class="empty-card">
            <span class="empty-icon"><mat-icon>group_add</mat-icon></span>
            <h2>No partners yet</h2>
            <p>Invite someone or wait for a campaign placement. Their training progress will appear here and on your Activation board.</p>
            <a mat-flat-button color="primary" routerLink="/dashboard/mentorship/team/activation">Open activation board</a>
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 12px; }
    .breadcrumb a { text-decoration: none; }
    .partners-page { display: flex; flex-direction: column; gap: 14px; padding-bottom: 16px; }
    .page-head { display: flex; flex-direction: column; gap: 6px; }
    .page-head h1 { margin: 0; font-size: 1.9rem; letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .subtitle { margin: 0; color: var(--ms-text-muted); line-height: 1.5; }
    .page-head > a { margin-top: 6px; min-height: 44px; align-self: flex-start; }
    .summary-strip { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 8px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); }
    .summary-item { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: var(--ms-radius-md); min-width: 0; }
    .summary-icon { flex: none; width: 36px; height: 36px; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .summary-icon--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .summary-icon--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .summary-icon--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .summary-icon mat-icon { font-size: 19px; width: 19px; height: 19px; }
    .summary-item div { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .summary-item strong { font-size: 1.3rem; line-height: 1.1; }
    .summary-item span:last-child { color: var(--ms-text-muted); font-size: 0.68rem; font-weight: 600; }
    .toolbar-card { display: flex; flex-direction: column; gap: 4px; padding: 12px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); }
    .search-field { width: 100%; }
    .result-count { color: var(--ms-text-muted); font-size: 0.8rem; padding-left: 4px; }
    .partner-grid { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    .partner-card { display: flex; flex-direction: column; gap: 12px; padding: 14px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); box-shadow: var(--ms-shadow-sm); }
    .partner-top { display: flex; align-items: center; gap: 10px; }
    .partner-identity { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .partner-identity strong { font-size: 1rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .partner-identity span { color: var(--ms-text-muted); font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .member-badge { flex: none; display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 9px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.64rem; font-weight: 800; white-space: nowrap; }
    .member-badge--partner { background: var(--ms-success-soft); color: var(--ms-success); }
    .rank-chip { flex: none; display: inline-flex; align-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); border-radius: 999px; padding: 4px 9px; font-size: 0.64rem; font-weight: 700; white-space: nowrap; }
    .stamp-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-height: 30px; }
    .mini-stamp { display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 999px; border: 1px solid var(--ms-line); color: var(--ms-text-muted); font-size: 0.7rem; font-weight: 600; }
    .mini-stamp mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .mini-stamp--done { background: var(--ms-success-soft); border-color: transparent; color: var(--ms-success); }
    .overdue-pill { margin-left: auto; padding: 4px 9px; border-radius: 999px; background: var(--ms-error-soft); color: var(--ms-error); font-size: 0.64rem; font-weight: 700; }
    .partner-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; margin: 0; padding: 10px 0; border-top: 1px solid var(--ms-line); border-bottom: 1px solid var(--ms-line); }
    .partner-facts div { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .partner-facts dt { color: var(--ms-text-muted); font-size: 0.62rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .partner-facts dd { margin: 0; font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .partner-actions { display: flex; gap: 8px; }
    .partner-actions button { flex: 1; min-height: 44px; }
    .partner-actions mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 4px; }
    .pager { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .pager button { min-height: 44px; }
    .muted { color: var(--ms-text-muted); font-size: 0.8rem; }
    .empty-card, .loading-card, .error-card { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; padding: 32px 20px; background: var(--ms-surface); border: 1px dashed var(--ms-line); border-radius: var(--ms-radius-lg); color: var(--ms-text-muted); }
    .error-card { border-color: var(--ms-error); color: var(--ms-error); }
    .error-card p { margin: 0; }
    .empty-card h2 { margin: 0; color: var(--ms-text); font-size: 1.15rem; }
    .empty-card p { margin: 0; line-height: 1.5; }
    .empty-card a, .empty-card button { width: 100%; min-height: 44px; }
    .empty-icon { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .empty-icon mat-icon { font-size: 26px; width: 26px; height: 26px; }
  `],
})
export class MyPartnersMobileComponent {
  private readonly facade = inject(MyPartnersFacade);

  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly filterText = this.facade.filterText;
  protected readonly pagedPartners = this.facade.pagedPartners;
  protected readonly pageIndex = this.facade.pageIndex;
  protected readonly totalFiltered = this.facade.totalFiltered;
  protected readonly totalPages = this.facade.totalPages;
  protected readonly teamCount = this.facade.teamCount;
  protected readonly activatedCount = this.facade.activatedCount;
  protected readonly needsSupportCount = this.facade.needsSupportCount;
  protected readonly pendingStampCount = this.facade.pendingStampCount;

  constructor() { this.facade.ensureLoaded(); }
  protected isEmptyRecord(): boolean { return this.facade.isEmptyRecord(); }
  protected onSearch(event: Event): void { this.facade.applyFilter((event.target as HTMLInputElement).value); }
  protected clearFilter(): void { this.facade.clearFilter(); }
  protected prevPage(): void { this.facade.prevPage(); }
  protected nextPage(): void { this.facade.nextPage(); }
  protected presenceStatus(id: string | null | undefined) { return this.facade.presenceStatus(id); }
  protected info(id: string) { return this.facade.info(id); }
  protected isActivatedPartner(partner: PartnerInterface): boolean { return this.facade.isActivatedPartner(partner); }
  protected support(id: string): void { this.facade.support(id); }
  protected chat(partner: PartnerInterface): void { this.facade.chat(partner); }
  protected displayName(partner: PartnerInterface): string { return this.facade.displayName(partner); }
  protected reload(): void { this.facade.reload(); }
}
