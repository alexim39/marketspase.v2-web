
import {Component, inject, ChangeDetectionStrategy} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef} from '@angular/material/dialog';

/**
 * @title Help Dialog
 */
@Component({
    selector: 'async-help-dialog',
    template: `

<!-- <h2 mat-dialog-title>Hi</h2> -->

<mat-dialog-content>
  <div [innerHTML]="data.help"></div>
  <!-- <p>{{data.help}}</p> -->

</mat-dialog-content>

<mat-dialog-actions>
<button mat-button (click)="close()">Ok</button>
</mat-dialog-actions>

  `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatDialogModule, MatButtonModule, MatDialogContent, MatDialogActions]
})
export class HelpDialogComponent {
    readonly dialogRef = inject(MatDialogRef<HelpDialogComponent>);
    readonly data = inject<any>(MAT_DIALOG_DATA);

    close(): void {
        this.dialogRef.close();
    }
}