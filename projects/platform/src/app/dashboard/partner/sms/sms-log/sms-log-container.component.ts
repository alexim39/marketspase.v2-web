
import {Component, DestroyRef, inject, OnInit, ChangeDetectionStrategy} from '@angular/core';
import { PartnerInterface, PartnerService } from '../../../../_common/services/partner.service';
import { filter, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SMSService } from '../sms.service';
import { SMSLogComponent } from './sms-log.component';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';


/**
 * @title cell meeting container
 */
@Component({
  selector: 'async-sms-log-container',
  imports: [SMSLogComponent, MatIconModule, MatButtonModule],
  providers: [SMSService],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
     @if (partner && smsObject) {
       <async-sms-log [partner]="partner" [smsObject]="smsObject"/>
     }
     
     `,
})
export class smsLogContainerComponent implements OnInit {

  partner!: PartnerInterface;
  smsObject!: any;
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private partnerService: PartnerService,
    private sms: SMSService,
    private router: Router,
  ) { }

  ngOnInit() {

    // get current signed in user, then their SMS logs — one stream.
    // Inbox is session-owned server-side: no id travels, so a stale client
    // id can never render an empty (or someone else's) inbox.
    this.partnerService.getSharedPartnerData$.pipe(
      takeUntilDestroyed(this.destroyRef),
      filter((partner): partner is PartnerInterface => !!partner),
      tap(partner => { this.partner = partner; }),
      switchMap(() => this.sms.mySms())
    ).subscribe({
        next: (response) => {
          if (response.success) {
              this.smsObject = response.data;
          }
        },
        error: () => {
          this.smsObject = [];
        }
      })
  }

  back(): void {
    if (window.history.length > 1) {
        //window.history
        window.history.back();
    } else {
      // Redirect to a default route if there's no history
      this.router.navigateByUrl('dashboard/tools/sms/new');
    }
  }
}