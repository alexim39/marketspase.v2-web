import { CommonModule } from '@angular/common';
import {Component, inject, OnDestroy, ChangeDetectionStrategy} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import {MatExpansionModule} from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';

/**
 * @title Prospect Detail 
 */
@Component({
selector: 'async-prospect-response',
providers: [],
styles: `
  span {
    color: gray;
  }
  .bolder {
    font-weight: bolder;
    color: black;
    margin-top: 5px;
  }
  `,
    template: `

<h2 mat-dialog-title>{{data.prospectSurname | titlecase}} {{data.prospectName | titlecase}}'s Response</h2>

<mat-dialog-content>

  <mat-list>

    <mat-list-item>
      <span matListItemTitle>Prospect phone number:</span>
      <span matListItemLine class="bolder">{{data.prospectPhone ? data.prospectPhone : 'No phone number found'}}</span>
    </mat-list-item>
    <mat-divider></mat-divider>

    <mat-list-item>
      <span matListItemTitle>Prospect email address:</span>
      <span matListItemLine class="bolder">{{data.prospectEmail ? data.prospectEmail : 'No email address found'}}</span>
    </mat-list-item>
    <mat-divider></mat-divider>

    <mat-list-item>
      <span matListItemTitle>Prospect age range:</span>
      <span matListItemLine class="bolder">{{data.survey.ageRange ? data.survey.ageRange : 'No age range record'}}</span>
    </mat-list-item>
    <mat-divider></mat-divider>

    <mat-list-item>
      <span matListItemTitle>Prospect knew about us through:</span>
      <span matListItemLine class="bolder">{{data.survey.referral ? data.survey.referral : 'No record found'}}</span>
    </mat-list-item>
    <mat-divider></mat-divider>

    @if (data.survey.referralCode) {
      <mat-list-item>
        <span matListItemTitle>Prospect was referred by:</span>
        <span matListItemLine class="bolder">{{data.survey.referralCode}}</span>
        <small style="color: gray;"><em>Note that {{data.survey.referralCode}} may be a partner in our business</em></small>
      </mat-list-item>
    }
    @if (data.survey.referralCode) {
      <mat-divider></mat-divider>
    }

    <mat-list-item>
      <span matListItemTitle>Prospect favourite social media platforms:</span>
      <span matListItemLine class="bolder">{{data.survey.socialMedia ? data.survey.socialMedia : 'No record found'}}</span>
    </mat-list-item>
    <mat-divider></mat-divider>

    <mat-list-item>
      <span matListItemTitle>Prospect online purchase frequency:</span>
      <span matListItemLine class="bolder">{{data.survey.onlinePurchaseSchedule ? data.survey.onlinePurchaseSchedule : 'No record found'}}</span>
    </mat-list-item>
    <mat-divider></mat-divider>

    <mat-list-item>
      <span matListItemTitle>Prospect motivation for joining online businesses:</span>
      <span matListItemLine class="bolder">{{data.survey.primaryOnlineBusinessMotivation ? (data.survey.primaryOnlineBusinessMotivation | titlecase) : 'No record found'}}</span>
    </mat-list-item>
    <mat-divider></mat-divider>

    <mat-list-item>
      <span matListItemTitle>Prospect Importance of passive income:</span>
      <span matListItemLine class="bolder">{{data.survey.importanceOfPassiveIncome ? (data.survey.importanceOfPassiveIncome | titlecase) : 'No record found'}}</span>
    </mat-list-item>
    <mat-divider></mat-divider>

    <mat-list-item>
      <span matListItemTitle>Prospect employment status:</span>
      <span matListItemLine class="bolder">{{data.survey.employedStatus ? (data.survey.employedStatus | titlecase) : 'No employment status found'}}</span>
    </mat-list-item>
    <mat-divider></mat-divider>

    <mat-list-item>
      <span matListItemTitle>Prospect comfort with technology:</span>
      <span matListItemLine class="bolder">{{data.survey.comfortWithTech ? data.survey.comfortWithTech : 'No record found'}}</span>
    </mat-list-item>
    <mat-divider></mat-divider>

    <mat-list-item>
      <span matListItemTitle>Business time dedication:</span>
      <span matListItemLine class="bolder">{{data.survey.onlineBusinessTimeDedication ? data.survey.onlineBusinessTimeDedication : 'No record found'}}</span>
    </mat-list-item>
    <mat-divider></mat-divider>

    <mat-list-item>
      <span matListItemTitle>Prospect Country:</span>
      <span matListItemLine class="bolder">{{data.survey.country}}</span>
    </mat-list-item>
    <mat-divider></mat-divider>

    <mat-list-item >
      <span matListItemTitle>Prospect State of Origin:</span>
      <span matListItemLine class="bolder">{{data.survey.state ? data.survey.state : 'State not found'}}</span>
    </mat-list-item>
    <mat-divider></mat-divider>

    <mat-list-item>
      <span matListItemTitle>Date of Visit</span>
      <span matListItemLine class="bolder">{{ data.createdAt | date:'fullDate' }} by {{ data.createdAt | date:'shortTime' }}</span>
    </mat-list-item>

  </mat-list>

  <br><br><br>
</mat-dialog-content>

<mat-dialog-actions>
  <button mat-button (click)="close()">Ok</button>
</mat-dialog-actions>

`,
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [CommonModule, MatListModule, MatDialogModule, MatIconModule, MatExpansionModule, MatButtonModule, MatDividerModule, MatDialogTitle, MatDialogContent, MatDialogActions]
})
export class ProspectResponseComponent implements OnDestroy {
  readonly dialogRef = inject(MatDialogRef<ProspectResponseComponent>);
  readonly data = inject<any>(MAT_DIALOG_DATA);
  subscriptions: Array<Subscription> = [];

  close(): void {
      this.dialogRef.close();
  }

  ngOnDestroy() {
    // unsubscribe list
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
    
}