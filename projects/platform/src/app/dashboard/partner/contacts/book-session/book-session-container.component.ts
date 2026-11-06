
import {Component, DestroyRef, inject, OnInit, ChangeDetectionStrategy} from '@angular/core';
import { PartnerInterface, PartnerService } from '../../../../_common/services/partner.service';
import { filter, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BookSessionComponent } from './book-session.component';
import { ContactsInterface, ContactsService } from '../contacts.service';
import { ActivatedRoute, Router } from '@angular/router';


/**
 * @title contacts container
 */
@Component({
    selector: 'async-book-session-container',
    imports: [BookSessionComponent],
    providers: [ContactsService],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
  @if (prospect && partner) {
    <async-book-session [prospect]="prospect"  [partner]="partner"/>
  }
  `
})
export class BookSessionContainerComponent implements OnInit {

  prospect!: ContactsInterface;
  prospectId!: string | null;
  partner!: PartnerInterface;
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private contactsService: ContactsService,
    private partnerService: PartnerService,
  ) { }


  ngOnInit(): void {
    // Route params are infinite; the lookup is one-shot — switchMap
    // cancels the in-flight fetch on re-navigation instead of stacking.
    this.route.paramMap.pipe(
      takeUntilDestroyed(this.destroyRef),
      filter(params => params.get('id') !== null),
      switchMap(params => {
        this.prospectId = params.get('id');
        // Fetch prospect details using the ID
        return this.contactsService.getProspectById(this.prospectId as string);
      })
    ).subscribe({
      next: (response) => {
        this.prospect = response.data;
      }
    });

    // get current signed in user (shared subject — tracked)
    this.partnerService.getSharedPartnerData$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (partner: PartnerInterface) => {
        this.partner = partner;
      }
    })
  }
}