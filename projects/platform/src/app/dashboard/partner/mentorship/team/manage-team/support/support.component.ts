import { Component, inject, Input, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { PartnerInterface, PartnerService } from '../../../../../../_common/services/partner.service';
import { TeamInterface, TeamService } from '../../team.service';
import { userError } from '../../../../../../core/http/api-error';
import { AddMemberComponent } from './add-member/add-member.component';

/** @title Teams details */
@Component({
    selector: 'async-team-support',
    templateUrl: 'support.component.html',
    styleUrls: ['support.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        MatCheckboxModule,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatSelectModule,
        MatInputModule,
        MatChipsModule,
        MatIconModule, MatButtonModule,
        MatDividerModule, MatListModule, CommonModule, RouterModule
    ]
})
export class TeamSupportComponent implements OnDestroy {

  @Input() partner!: PartnerInterface;
  @Input() team!: TeamInterface;
  duration!: null | number;
  readonly dialog = inject(MatDialog);
  subscriptions: Array<Subscription> = [];

  filterText = '';
  confirmingDelete = false;
  deleting = false;
  deleteError: string | null = null;
  confirmRemoveId: string | null = null;
  confirmLeave = false;
  removing = false;
  actionError: string | null = null;


  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private partnerService: PartnerService,
    private teamService: TeamService,

  ) {}


  back(): void {
    this.router.navigateByUrl('dashboard/mentorship/team/members');
  }

  deleteTeam(teamId: string) {
    if (this.deleting) return;
    this.deleting = true;
    this.deleteError = null;
    this.subscriptions.push(
      this.teamService.deleteTeam(teamId, String(this.partner?._id ?? '')).subscribe({
        next: () => {
          this.deleting = false;
          this.confirmingDelete = false;
          this.router.navigateByUrl('dashboard/mentorship/team/members');
        },
        error: (error: unknown) => {
          this.deleting = false;
          this.deleteError = userError(error);
        }
      })
    );
  }

  edit(id: string) {
    this.router.navigate(['/dashboard/mentorship/team/detail', id]);
  }

  /** Owner-only UI — compares as strings (ObjectId vs string shapes). */
  protected isOwner(): boolean {
    const owner = (this.team as unknown as { partnerId?: unknown } | null)?.partnerId;
    return !!owner && !!this.partner?._id && String(owner) === String(this.partner._id);
  }

  /** Context handoff for Message / Create event (prefill downstream). */
  protected teamQuery(): Record<string, string> {
    const id = String(this.team?._id ?? '').trim();
    const name = String(this.team?.teamName ?? '').trim();
    return { ...(id ? { team: id } : {}), ...(name ? { teamName: name } : {}) };
  }

  /** Group-chat handoff for Message — the messages page resolves (or creates)
   * the team's group conversation from this id. Kept separate from teamQuery
   * because community events still consume ?team= for prefilling. */
  protected groupTeamQuery(): Record<string, string> {
    const id = String(this.team?._id ?? '').trim();
    return id ? { teamGroup: id } : {};
  }

  protected leaveTeam(): void {
    if (!this.team?._id || !this.partner?._id) return;
    this.removeMember(String(this.partner._id), String(this.team._id), true);
  }

  viewMember(memberId: string) {
    this.router.navigate(['/dashboard/mentorship/partners/my-partners/detail', memberId]);
  }

  filteredMembers(): PartnerInterface[] {
    const q = this.filterText.trim().toLowerCase();
    const members = this.team?.members ?? [];
    if (!q) return members;
    return members.filter((m) =>
      `${m.name ?? ''} ${m.surname ?? ''} ${m.username ?? ''}`.toLowerCase().includes(q));
  }

  addMember(team: TeamInterface, partner: PartnerInterface) {
    this.actionError = null;
    this.dialog.open(AddMemberComponent, {
      data: { team, partner },
    }).afterClosed().subscribe((added: PartnerInterface[] | undefined) => {
      // Dialog already saved via the API — merge into the local list so the
      // page updates without a full reload.
      if (Array.isArray(added) && added.length > 0) {
        const known = new Set((this.team.members ?? []).map((m) => String(m._id)));
        const fresh = added.filter((m) => m?._id && !known.has(String(m._id)));
        if (fresh.length > 0) this.team = { ...this.team, members: [...(this.team.members ?? []), ...fresh] };
      }
    });
  }

  // Scroll to top when clicked
  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }


  ngOnDestroy() {
    // unsubscribe list
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  removeMember(memberId: string, teamId: string, afterLeaveGoBack = false) {
    if (this.removing) return;
    this.removing = true;
    this.actionError = null;
    this.subscriptions.push(
      this.teamService.deleteTeamMember(memberId, teamId, String(this.partner?._id ?? '')).subscribe({
        next: () => {
          this.removing = false;
          this.confirmRemoveId = null;
          if (afterLeaveGoBack) {
            this.router.navigateByUrl('dashboard/mentorship/team/members');
            return;
          }
          this.team = {
            ...this.team,
            members: (this.team.members ?? []).filter((m) => String(m._id) !== String(memberId)),
          };
        },
        error: (error: unknown) => {
          this.removing = false;
          this.actionError = userError(error);
        }
      })
    );
  }


}
