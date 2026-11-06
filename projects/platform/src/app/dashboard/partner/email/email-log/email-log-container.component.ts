
import {Component, DestroyRef, inject, OnInit, ChangeDetectionStrategy} from '@angular/core';
import { PartnerInterface, PartnerService } from '../../../../_common/services/partner.service';
import { filter, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EmailInterface, EmailService } from '../email.service';
import { EmailLogComponent } from './email-log.component';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { HttpErrorResponse } from '@angular/common/http';


/**
 * @title Email log container
 */
@Component({
selector: 'async-email-log-container',
imports: [EmailLogComponent, MatIconModule, MatButtonModule],
providers: [EmailService],
changeDetection: ChangeDetectionStrategy.Eager,
template: `
 @if (partner && emails) {
   <async-email-log [partner]="partner" [emails]="emails"/>
 }
 `,
   
})
export class EmailLogContainerComponent implements OnInit {

  partner!: PartnerInterface;
  emails!: any;
  isEmptyRecord = false;
  serverErrorMessage = '';
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private partnerService: PartnerService,
    private email: EmailService,
    private router: Router,
  ) { }

  ngOnInit() {

    // get current signed in user, then their emails — one stream.
    // Inbox is session-owned server-side: no id travels, so a stale client
    // id can never render an empty (or someone else's) inbox.
    this.partnerService.getSharedPartnerData$.pipe(
      takeUntilDestroyed(this.destroyRef),
      filter((partner): partner is PartnerInterface => !!partner),
      tap(partner => { this.partner = partner; }),
      switchMap(() => this.email.myEmails())
    ).subscribe({
        next: (response) => {
          if (response.success) {
            this.emails = response.data;
          }
        },
        error: () => {
          this.emails = [];
        }
      })
  }

  back(): void {
    if (window.history.length > 1) {
        //window.history
        window.history.back();
    } else {
      // Redirect to a default route if there's no history
      this.router.navigateByUrl('dashboard/tools/email/new');
    }
  }
}