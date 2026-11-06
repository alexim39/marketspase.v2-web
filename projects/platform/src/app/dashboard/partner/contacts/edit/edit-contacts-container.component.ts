
import {Component, ChangeDetectionStrategy} from '@angular/core';
import { EditContactsComponent } from './edit-contacts.component';


/**
 * @title contacts container — thin wrapper, the child fetches its own data.
 */
@Component({
    selector: 'async-edit-container',
    imports: [EditContactsComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<async-edit-contatcs />`
})
export class EditContactsContainerComponent {
}