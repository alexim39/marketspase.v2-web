import {Component, OnDestroy, OnInit, ChangeDetectionStrategy} from '@angular/core';

import { PartnerInterface, PartnerService } from '../../../../../_common/services/partner.service';
import { Subscription } from 'rxjs';
import { EditTeamComponent } from './edit-team.component';
import { ActivatedRoute, Router } from '@angular/router';
import { TeamInterface, TeamService } from '../team.service';

/**
 * @title Container
 */
@Component({
    selector: 'async-edit-team-container',
    template: `
  @if (partner && team) {
    <async-edit-team [partner]="partner" [team]="team"/>
  }
  `,
    providers: [TeamService],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [EditTeamComponent]
})
export class EditTeamContainerComponent implements OnInit, OnDestroy {

    
  partner!: PartnerInterface;
  subscriptions: Subscription[] = [];
  isEmptyRecord = false;
  team!: TeamInterface;

  constructor(
    private partnerService: PartnerService,
    private router: Router, 
    private route: ActivatedRoute,
    private teamService: TeamService,
  ) { }

  ngOnInit() {
      
    // get current signed in user
    this.subscriptions.push(
      this.partnerService.getSharedPartnerData$.subscribe({
       
        next: (partner: PartnerInterface) => {
          this.partner = partner;
          if (this.partner) {
          }
        }
      })
    )

    this.route.paramMap.subscribe(params => {
      const teamId = params.get('id');
      if (teamId) {
        // Fetch prospect details using the ID
        this.subscriptions.push(
          this.teamService.getTeamById(teamId).subscribe(team => {
            this.team = team.data;
          }, error => {
            this.isEmptyRecord = true;
          })
        )
        
      }
    });
  }

  ngOnDestroy() {
    // unsubscribe list
    this.subscriptions.forEach(subscription =>  subscription.unsubscribe());
  }
}
