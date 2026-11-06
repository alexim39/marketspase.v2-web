import { Component, inject, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PartnerInterface } from '../../../../../_common/services/partner.service';
import { MatDialog } from '@angular/material/dialog';
import { HelpDialogComponent } from '../../../../../_common/help-dialog.component';
import { MatIconModule } from '@angular/material/icon';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';

import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core'; // For native date adapter
import { TeamService } from '../team.service';
import { SearchService } from '../../../index/search/search.service';
import { HttpErrorResponse } from '@angular/common/http';
import { userError } from '../../../../../core/http/api-error';

/** Purpose clusters — same stored values, grouped so creators pick with intent. */
const PURPOSE_GROUPS: Array<{ label: string; options: string[] }> = [
  { label: 'Growth', options: ['Recruitment Team', 'Marketing Team', 'Sales Team', 'Networking Team'] },
  { label: 'Learning', options: ['Training and Development Team', 'Innovation Team', 'Content Creation Team'] },
  { label: 'Operations', options: ['Strategic Planning Team', 'Partner Support Team', 'Events Management Team', 'Tech Support Team', 'Product Development Team', 'Compliance and Regulatory Team', 'Recognition and Rewards Team', 'Feedback and Improvement Team'] },
];

/**
 * @title Start a purpose team — organize people around one job.
 *
 * A team is NOT your downline: it is any set of platform users gathered
 * for a training, task or event. Pick a purpose, optionally add members
 * from the whole platform, create, and manage it under My teams.
 */
@Component({
    selector: 'async-create-team',
    templateUrl: 'create-team.component.html',
    styleUrls: ['create-team.component.scss'],
    providers: [TeamService, SearchService],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [CommonModule, MatIconModule, RouterModule, MatNativeDateModule, MatDatepickerModule, MatExpansionModule, MatFormFieldModule, MatButtonModule, FormsModule, MatInputModule, ReactiveFormsModule, MatSelectModule, MatAutocompleteModule, MatChipsModule]
})
export class CreateTeamComponent implements OnInit {
  readonly panelOpenState = false;

    @Input() partner!: PartnerInterface;
    readonly dialog = inject(MatDialog);

    createTeamForm!: FormGroup;
    subscriptions: Array<Subscription> = [];

    protected readonly purposeGroups = PURPOSE_GROUPS;

    /** Platform-wide member search (any user, not only your partners). */
    memberSearch = new FormControl('', { nonNullable: true });
    allUsers: PartnerInterface[] = [];
    filteredUsers: PartnerInterface[] = [];
    selectedMembers: PartnerInterface[] = [];

    saving = false;
    notice: string | null = null;
    formError: string | null = null;
    createdTeamId: string | null = null;

    constructor(
     private createTeamService: TeamService,
      private searchService: SearchService,
      private router: Router,
    ) {}


    ngOnInit(): void {
        if (this.partner) {
          this.createTeamForm = new FormGroup({
            teamName: new FormControl('', Validators.required),
            description: new FormControl('',),
            teamPurpose: new FormControl('', Validators.required),
            partnerId: new FormControl(this.partner._id),
          });
        }
        this.subscriptions.push(
          this.searchService.getAllUsers().subscribe({
            next: (users) => {
              this.allUsers = users ?? [];
              this.filteredUsers = [];
            },
            error: () => {
              this.allUsers = [];
              this.filteredUsers = [];
            },
          })
        );
    }

    displayMember(user: PartnerInterface | null): string {
      if (!user) return '';
      return `${user.name ?? ''} ${user.surname ?? ''}`.trim() || user.username || '';
    }

    onMemberInput(value: string): void {
      const q = String(value ?? '').trim().toLowerCase();
      if (q.length < 2) {
        this.filteredUsers = [];
        return;
      }
      const picked = new Set(this.selectedMembers.map((m) => String(m._id)));
      this.filteredUsers = this.allUsers
        .filter((u) => !picked.has(String(u._id)))
        .filter((u) => `${u.name ?? ''} ${u.surname ?? ''} ${u.username ?? ''}`.toLowerCase().includes(q))
        .slice(0, 20);
    }

    selectMember(user: PartnerInterface): void {
      if (!user) return;
      if (!this.selectedMembers.some((m) => String(m._id) === String(user._id))) {
        this.selectedMembers.push(user);
      }
      this.memberSearch.setValue('');
      this.filteredUsers = [];
    }

    removeMember(user: PartnerInterface): void {
      this.selectedMembers = this.selectedMembers.filter((m) => String(m._id) !== String(user._id));
    }

    onSubmit() {
      Object.keys(this.createTeamForm.controls).forEach((k) => this.createTeamForm.get(k)?.markAsTouched());
      if (this.createTeamForm.invalid || this.saving) return;
      const teamObject = this.createTeamForm.value;
      this.saving = true;
      this.notice = null;
      this.formError = null;
      this.createdTeamId = null;

      this.subscriptions.push(
        this.createTeamService.createTeam(teamObject).subscribe({
          next: (response: any) => {
            const teamId = String(response?.savedTeam?._id ?? response?.data?._id ?? '');
            if (this.selectedMembers.length > 0 && teamId) {
              this.subscriptions.push(
                this.createTeamService.addTeamMember([...this.selectedMembers], teamId, String(this.partner?._id ?? '')).subscribe({
                  next: () => {
                    this.saving = false;
                    this.createdTeamId = teamId;
                    this.notice = `Team created with ${this.selectedMembers.length} member${this.selectedMembers.length === 1 ? '' : 's'}.`;
                  },
                  error: (error: HttpErrorResponse) => {
                    this.saving = false;
                    this.createdTeamId = teamId;
                    this.notice = 'Team created, but adding members failed — add them from the team page.';
                  }
                })
              );
            } else {
              this.saving = false;
              this.createdTeamId = teamId || null;
              this.notice = 'Team created successfully.';
            }
          },
          error: (error: HttpErrorResponse) => {
            this.saving = false;
            this.formError = userError(error);
          }
        })
      );
    }

    startAnother(): void {
      this.createTeamForm.reset({ teamName: '', description: '', teamPurpose: '', partnerId: this.partner?._id });
      this.selectedMembers = [];
      this.memberSearch.setValue('');
      this.filteredUsers = [];
      this.notice = null;
      this.formError = null;
      this.createdTeamId = null;
    }

    showDescription () {
        this.dialog.open(HelpDialogComponent, {
          data: {help: `
            A purpose team organizes any platform users — not only your downline — around one job: a training cohort, an event crew, a sales push. Create it here, then manage members under My teams.
          `},
        });
    }

    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }


    ngOnDestroy() {
      // unsubscribe list
      this.subscriptions.forEach(subscription => subscription.unsubscribe());
    }
}
