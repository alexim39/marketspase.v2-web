import {Component, OnDestroy, OnInit, ChangeDetectionStrategy} from '@angular/core';

import { PartnerInterface, PartnerService } from '../../../../../_common/services/partner.service';
import { Subscription } from 'rxjs';
import { ManageTeamComponent } from './manage-team.component';
import { TeamInterface, TeamService } from '../team.service';

/**
 * @title Container
 */
@Component({
    selector: 'async-manage-team-container',
    template: `
  @if (partner && teams) {
    <async-manage-team [partner]="partner" [teams]="teams"/>
  }
  `,
    providers: [TeamService],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [ManageTeamComponent]
})
export class ManageTeamContainerComponent implements OnInit, OnDestroy {

    
  partner!: PartnerInterface;
  subscriptions: Subscription[] = [];
  teams!: Array<any>;

  constructor(
    private partnerService: PartnerService,
    private teamService: TeamService
  ) { }

  ngOnInit() {
      
    // get current signed in user
    this.subscriptions.push(
      this.partnerService.getSharedPartnerData$.subscribe({
       
        next: (partner: PartnerInterface) => {
          this.partner = partner;
          if (this.partner) {
            // all teams where partner is either creator or member
            this.teamService.getAllTeamsCreatedOrMember(this.partner._id).subscribe((teams: any) => {
              this.teams = teams.data;
            })
          }
        }
  })
    )
  }

  ngOnDestroy() {
    // unsubscribe list
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
