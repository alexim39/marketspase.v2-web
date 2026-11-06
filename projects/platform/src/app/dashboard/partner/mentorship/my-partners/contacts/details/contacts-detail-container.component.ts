import { Component, DestroyRef, inject, OnInit, ChangeDetectionStrategy, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MyPartnerContactsDetailComponent } from './contacts-detail.component';
import { ContactsInterface, ContactsService } from '../contacts.service';
import { MyPartnersService } from '../../my-partners.service';
import { PartnerInterface } from '../../../../../../_common/services/partner.service';
import { userError } from '../../../../../../core/http/api-error';

/**
 * @title Downline prospect detail — loads the prospect, then its owner.
 *
 * Owns loading: :id -> prospect -> owner profile (fail-soft; the coaching
 * view renders with whatever resolved). Resolving the owner here (instead of
 * hoping for ?from=) powers the "Belongs to" banner, dossier link and all
 * back-navigation fallbacks. OnPush + signals.
 */
@Component({
selector: 'async-manage-contacts-detail-container',
template: `
  @if (loading()) {
    <mat-progress-bar mode="indeterminate" aria-label="Loading prospect" />
  }
  @if (error(); as err) {
    <div class="container">
      <p class="no-content">{{ err }}</p>
      <div class="row">
        <button mat-stroked-button (click)="reload()">Retry</button>
        <button mat-flat-button (click)="back()"><mat-icon>arrow_back</mat-icon>Go back</button>
      </div>
    </div>
  } @else if (!loading() && prospect()) {
    <async-my-partner-contacts-detail [prospect]="prospect()" [myPartner]="myPartner()" [fromOwnerId]="fromOwnerId()"/>
  }
  `,
providers: [ContactsService, MyPartnersService],
imports: [MyPartnerContactsDetailComponent, MatButtonModule, MatIconModule, MatProgressBarModule],
changeDetection: ChangeDetectionStrategy.OnPush,
styles: `
  .container {
    padding: 2em;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1em;
  }
  .no-content {
    color: rgb(196, 129, 4);
    font-weight: bold;
    text-align: center;
  }
  .row { display: flex; gap: 0.6em; flex-wrap: wrap; justify-content: center; }
  `
})
export class MyPartnerContactsDetailContainerComponent implements OnInit {

  prospect = signal<ContactsInterface | null>(null);
  myPartner = signal<PartnerInterface | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  fromOwnerId = signal<string | null>(null);
  private prospectId: string | null = null;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly contactsService = inject(ContactsService);
  private readonly myPartnersService = inject(MyPartnersService);
  private readonly destroyRef = inject(DestroyRef);

  back(): void {
    const from = String(this.fromOwnerId() ?? '').trim();
    if (from) {
      this.router.navigate(['/dashboard/mentorship/partners/my-partners/contacts', from]).catch(() => undefined);
    } else {
      window.history.back(); // Go back to the previous page
    }
  }

  ngOnInit(): void {
    this.fromOwnerId.set(this.route.snapshot.queryParamMap.get('from'));
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params.get('id');
        // Same-route re-navigation (rare here) reloads cleanly.
        if (id && id !== this.prospectId) this.load(id);
      });
  }

  reload(): void {
    if (this.prospectId) this.load(this.prospectId);
  }

  private load(prospectId: string): void {
    this.prospectId = prospectId;
    this.loading.set(true);
    this.error.set(null);
    this.contactsService.getProspectById(prospectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (prospect) => {
          this.prospect.set(prospect);
          this.loading.set(false);
          const data = (prospect as { data?: { partnerId?: unknown } })?.data;
          const ownerId = data?.partnerId ? String(data.partnerId) : '';
          if (ownerId) {
            this.myPartnersService.getPartnerById(ownerId)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (owner) => this.myPartner.set((owner as { data?: PartnerInterface })?.data ?? null),
                error: () => this.myPartner.set(null),
              });
          } else {
            // Legacy shaped payload — fall back to the ?from= owner when present.
            const from = String(this.fromOwnerId() ?? '').trim();
            if (from) {
              this.myPartnersService.getPartnerById(from)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe({
                  next: (owner) => this.myPartner.set((owner as { data?: PartnerInterface })?.data ?? null),
                  error: () => this.myPartner.set(null),
                });
            }
          }
        },
        error: (err: unknown) => {
          this.error.set(userError(err) || 'Something went wrong — you may not have contacts yet!');
          this.loading.set(false);
        },
      });
  }
}
