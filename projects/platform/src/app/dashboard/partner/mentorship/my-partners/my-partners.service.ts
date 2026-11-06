import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { retry, catchError } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import { FormGroup } from '@angular/forms';
import { PartnerInterface } from '../../../../_common/services/partner.service';

export interface TeamInterface {  
  teamName: string;          // The name of the team  
  description?: string;     // Description or purpose of the team (optional)  
  teamPurpose: string;      // Purpose of the team  
  partnerId: string;
  createdAt?: any;
  _id?: string;
} 
  

@Injectable()
export class MyPartnersService {
  // Define API
  /** Base URL comes from the Angular environment (dev/prod swapped at build). */
  apiURL = environment.apiUrl;


  
  constructor(private http: HttpClient) {}
  /*========================================
    CRUD Methods for consuming RESTful API
  =========================================*/
  // Http Options
  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
    }),
  };

  // Error handling
  private handleError(error: any) {
    let errorMessage: {code: string, message: string};
    if (error.error instanceof ErrorEvent) {
      // Get client-side error
      errorMessage = error.error.message;
    } else {
      // Get server-side error
      errorMessage = {'code': error.status, 'message': error.message};
    }
    //window.alert(errorMessage);
    return throwError(() => {
      return errorMessage;
    });
  }

  // get all partners
  getPartnersOf(partnerId: string, options: { maskContacts?: boolean } = {}): Observable<any> {
    const query = options.maskContacts ? '?maskContacts=1' : '';
    return this.http
      .get<any>(this.apiURL + `/partners/getPartnersOf/${partnerId}${query}`, { withCredentials: true })
      .pipe(retry(1), catchError(this.handleError));
  }

  // get partner byId
  getPartnerById(myPartnerId: string, options: { maskContacts?: boolean } = {}): Observable<any> {
    const query = options.maskContacts ? '?maskContacts=1' : '';
    return this.http
      .get<any>(this.apiURL + `/partners/getById/${myPartnerId}${query}`, { withCredentials: true })
      .pipe(retry(1), catchError(this.handleError));
  }
    
}
