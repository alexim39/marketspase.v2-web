import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@marketspase/shared/core/http/api-client.service';

export interface emailSubscriptionInterface {
  email: string;
}

@Injectable()
export class FooterService {
  private readonly api = inject(ApiClient);
 

  /**
 * Submits the partner signin data to the backend API.
 * @param formObject The signin data to be submitted.
 * @returns An Observable that emits the API response or an error.
 */
  submit(formObject: emailSubscriptionInterface): Observable<any> {
    return this.api.post<emailSubscriptionInterface>('v1/email-subscription/subscribe', formObject);
  }


  

  
}