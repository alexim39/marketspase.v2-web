import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CreateContactsComponent } from './create-contacts.component';


/**
 * @title contacts container — hosts the member contact list.
 */
@Component({
    selector: 'async-contacts-container',
    imports: [CreateContactsComponent],
    providers: [],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
  <async-create-contatcs />
  `
})
export class CreateContactsContainerComponent {
}
