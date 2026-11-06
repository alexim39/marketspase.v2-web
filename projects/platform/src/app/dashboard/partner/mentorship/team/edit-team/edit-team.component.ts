import { Component, inject, Input, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { PartnerInterface } from '../../../../../_common/services/partner.service';
import { MatDialog } from '@angular/material/dialog';
import { HelpDialogComponent } from '../../../../../_common/help-dialog.component';
import { MatIconModule } from '@angular/material/icon';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatDatepickerModule} from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core'; // For native date adapter
import { TeamInterface, TeamService } from '../team.service';
import { HttpErrorResponse } from '@angular/common/http';
import { userError } from '../../../../../core/http/api-error';

/** Purpose clusters mirror the Start-a-team groups. */
const PURPOSE_GROUPS: Array<{ label: string; options: string[] }> = [
  { label: 'Growth', options: ['Recruitment Team', 'Marketing Team', 'Sales Team', 'Networking Team'] },
  { label: 'Learning', options: ['Training and Development Team', 'Innovation Team', 'Content Creation Team'] },
  { label: 'Operations', options: ['Strategic Planning Team', 'Partner Support Team', 'Events Management Team', 'Tech Support Team', 'Product Development Team', 'Compliance and Regulatory Team', 'Recognition and Rewards Team', 'Feedback and Improvement Team'] },
];

/**
 * @title Mentors Program
 */
@Component({
selector: 'async-edit-team',
templateUrl: 'edit-team.component.html',
styles: [`

.async-background {
    display: flex;
    flex-direction: column;
    gap: 1em;
    padding-bottom: 2em;
    h2 {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 0.4em;
        mat-icon {
            cursor: pointer;
        }
    }
    .page-sub {
        margin: 0;
        color: var(--ms-text-muted);
        font-size: 0.9em;
        max-width: 44em;
    }
    .async-container {
        background: var(--ms-surface);
        border: 1px solid var(--ms-line);
        border-radius: var(--ms-radius-md);
        height: 100%;
        padding: 1em;
        .title {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 0.75em;
            border-bottom: 1px solid var(--ms-line);
            padding: 0.5em 0.5em 1em;
            .control {
                display: flex;
                align-items: center;
                gap: 0.6em;
                .back {
                    cursor: pointer;
                    padding: 0.4em;
                }
                .back:hover {
                    opacity: 0.5;
                }
            }

            h3 {
                margin: 0;
            }
        }
    }
}


.form-container {
    margin-top: 1em;
    padding: 20px;
    background: var(--ms-canvas);
    border: 1px solid var(--ms-line);
    border-radius: var(--ms-radius-md);
    .flex-form {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        .form-group {
            flex: 1 1 calc(50% - 20px); /* Adjusting for gap space */
            display: flex;
            flex-direction: column;
        }
        .notice {
            flex-basis: 100%;
            color: var(--ms-success);
            font-weight: 600;
            margin: 0;
        }
        html[data-theme='dark'] .notice {
            color: #9ccc9f;
        }
        .form-error {
            flex-basis: 100%;
            color: var(--ms-error);
            margin: 0;
        }
        html[data-theme='dark'] .form-error {
            color: #e89a9a;
        }
        .post-save {
            flex-basis: 100%;
        }
        button[mat-flat-button] {
            min-height: 44px;
        }
    }
}


@media (max-width: 600px) {
    .form-group {
        flex: 1 1 100%;
    }
}




`],
providers: [TeamService],
changeDetection: ChangeDetectionStrategy.Eager,
imports: [CommonModule, MatIconModule, RouterModule, MatNativeDateModule, MatDatepickerModule, MatExpansionModule, MatFormFieldModule, MatButtonModule, FormsModule, MatInputModule, ReactiveFormsModule, MatSelectModule]
})
export class EditTeamComponent implements OnInit {
  readonly panelOpenState = signal(false);

    @Input() partner!: PartnerInterface;
    @Input() team!: TeamInterface;
    readonly dialog = inject(MatDialog);

    protected readonly purposeGroups = PURPOSE_GROUPS;

    createTeamForm!: FormGroup;
    subscriptions: Array<Subscription> = [];

    saving = false;
    notice: string | null = null;
    formError: string | null = null;

    constructor(
     private createTeamService: TeamService,
      private router: Router,
    ) {}


    ngOnInit(): void {

        if (this.partner && this.team) {
          this.createTeamForm = new FormGroup({
            teamName: new FormControl(this.team?.teamName, Validators.required),
            description: new FormControl(this.team?.description,),
            teamPurpose: new FormControl(this.team?.teamPurpose, Validators.required),
            partnerId: new FormControl(this.partner._id),
            temaId: new FormControl(this.team?._id),
          });
        }
    }

    onSubmit() {
      Object.keys(this.createTeamForm.controls).forEach((k) => this.createTeamForm.get(k)?.markAsTouched());
      const teamObject = this.createTeamForm.value;

      if (this.createTeamForm.valid && !this.saving) {
        this.saving = true;
        this.notice = null;
        this.formError = null;
        this.subscriptions.push(
          this.createTeamService.updateTeam(teamObject).subscribe({

            next: (response) => {
              this.saving = false;
              this.notice = response.message ?? 'Team updated successfully.';
            },
            error: (error: HttpErrorResponse) => {
              this.saving = false;
              this.formError = userError(error);
            }
        })
    )
      }
    }

    back(): void {
      this.router.navigateByUrl('dashboard/mentorship/team/members');
    }

    showDescription () {
        this.dialog.open(HelpDialogComponent, {
          data: {help: `
            Here, you can modify an existing team details.
          `},
        });
      }

    ngOnDestroy() {
      // unsubscribe list
      this.subscriptions.forEach(subscription => {
        subscription.unsubscribe();
      });
    }

    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
