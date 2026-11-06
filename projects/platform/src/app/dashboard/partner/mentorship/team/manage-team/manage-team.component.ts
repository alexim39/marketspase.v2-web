import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { MatRadioModule } from '@angular/material/radio';
import { MatCardModule } from '@angular/material/card';
import { PartnerInterface } from '../../../../../_common/services/partner.service';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterModule } from '@angular/router';
import { TeamInterface, TeamService } from '../team.service';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { Subscription } from 'rxjs';
import { MatTooltipModule } from '@angular/material/tooltip';

/** Purpose clusters mirror the Start-a-team groups. */
const PURPOSE_CLUSTERS: Record<string, string[]> = {
  Growth: ['Recruitment Team', 'Marketing Team', 'Sales Team', 'Networking Team'],
  Learning: ['Training and Development Team', 'Innovation Team', 'Content Creation Team'],
  Operations: ['Strategic Planning Team', 'Partner Support Team', 'Events Management Team', 'Tech Support Team', 'Product Development Team', 'Compliance and Regulatory Team', 'Recognition and Rewards Team', 'Feedback and Improvement Team'],
};

@Component({
selector: 'async-manage-team',
templateUrl: 'manage-team.component.html',
styles: [`

.async-background {
    display: flex;
    flex-direction: column;
    gap: 1em;
    padding-bottom: 2em;
    h2 {
        margin: 0;
        mat-icon {
            cursor: pointer;
        }
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
            h3 {
                margin: 0;
            }
            .fund-area {
                .fund {
                    font-weight: bold;
                    margin-top: 1em;
                }
            }
        }

        .search {
            padding: 0.75em 0;
            text-align: center;
            mat-form-field {
                width: min(70%, 560px);

            }
        }

        .table {
            padding: 0.5em;
            border-radius: var(--ms-radius-md);
            background: var(--ms-canvas);
            border: 1px solid var(--ms-line);
            overflow-x: auto;
        }

        .table table.mat-mdc-table {
            background: transparent;
        }

        .table .mat-mdc-header-cell {
            color: var(--ms-text-muted);
        }

        .section-head { margin: 1em 0 0.4em; font-size: 1em; }
        .empty { color: var(--ms-text-muted); margin: 0 0 0.6em; }
        .name-cell { font-weight: 700; }

        .toolbar { display: flex; gap: 0.75em; flex-wrap: wrap; align-items: center; padding: 0.75em 0; }
        .toolbar mat-form-field { flex: 1; min-width: 200px; }
        .filter-row { display: flex; gap: 0.4em; flex-wrap: wrap; }
        .filter-btn { border: 1px solid var(--ms-line); background: transparent; border-radius: 999px; padding: 0.5em 1em; min-height: 44px; cursor: pointer; color: inherit; font: inherit; font-size: 0.85rem; }
        .filter-btn--active { border-color: var(--ms-primary); background: var(--ms-primary-soft); font-weight: 700; }

        .no-campaign {
            text-align: center;
            color: var(--ms-primary-strong);
            font-weight: bold;
        }

        a[mat-raised-button] {
            min-height: 44px;
        }
       
    }
}


`],
imports: [
    MatCardModule, MatTooltipModule,
    CommonModule,
    MatTableModule,
    MatRadioModule,
    MatIconModule,
    RouterModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatCheckboxModule,
    MatSlideToggleModule,
],
changeDetection: ChangeDetectionStrategy.Eager,
providers: [TeamService]
})
export class ManageTeamComponent implements OnInit {
  @Input() partner!: PartnerInterface;
  @Input() teams!: TeamInterface[];
  subscriptions: Subscription[] = [];
  dataSource: TeamInterface[] = [];
  isEmptyRecord = false;
  filterText: string = '';
  purposeFilter: 'all' | 'Growth' | 'Learning' | 'Operations' = 'all';
  protected readonly clusterNames: Array<'Growth' | 'Learning' | 'Operations'> = ['Growth', 'Learning', 'Operations'];
  displayedColumns: string[] = ['team', 'purpose', 'member', 'owner', 'date'];

  constructor(
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (this.teams && this.teams.length > 0) {
      this.dataSource = this.teams.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else {
      this.isEmptyRecord = true;
    }
  }

  manage(id: string) {
    this.router.navigate(['/dashboard/mentorship/team/member', id]);
  }

  filteredTeams(): TeamInterface[] {
    const q = this.filterText.trim().toLowerCase();
    return this.dataSource.filter((t) => {
      if (this.purposeFilter !== 'all'
        && !(PURPOSE_CLUSTERS[this.purposeFilter] ?? []).includes(t.teamPurpose)) return false;
      if (!q) return true;
      return `${t.teamName ?? ''} ${t.teamPurpose ?? ''} ${t.description ?? ''}`.toLowerCase().includes(q);
    });
  }

  protected isOwner(t: TeamInterface): boolean {
    return String((t as { partnerId?: unknown }).partnerId ?? '') === String(this.partner?._id ?? '');
  }

  protected ownedTeams(): TeamInterface[] {
    return this.filteredTeams().filter((t) => this.isOwner(t));
  }

  protected memberTeams(): TeamInterface[] {
    return this.filteredTeams().filter((t) => !this.isOwner(t));
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => {
      subscription.unsubscribe();
    });
  }

  getOwnerName(team: TeamInterface, partnerId: string): string {
    if (String((team as { partnerId?: unknown }).partnerId ?? '') === String(partnerId ?? '')) return 'Me';
    if (team.owner?.name) return team.owner.name;
    if (team && team.members) {
      for (let member of team.members) {
        if (String(member._id) === String((team as { partnerId?: unknown }).partnerId ?? '')) {
          return `${member.surname} ${member.name}`;
        }
      }
    }

    return 'Unknown Owner';
  }
}
