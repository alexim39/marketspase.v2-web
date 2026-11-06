import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { retry, catchError } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import { PartnerInterface } from '../../../../_common/services/partner.service';
import { FormGroup } from '@angular/forms';


@Injectable()
export class SearchService {
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

  // get users
  getAllUsers(): Observable<Array<PartnerInterface>> {
    return this.http
      .get<Array<PartnerInterface>>(this.apiURL + `/partners/getAllUsers/`, { withCredentials: true })
      .pipe(retry(1), catchError(this.handleError));
  }

  // Method to fetch partner by names: name and surname
  getPartnerByNames(name: string, surname: string): Observable<PartnerInterface> {  
    return this.http
      .get<PartnerInterface>(`${this.apiURL}/partners/getPartnerByNames/${name}/${surname}`, { withCredentials: true })
      .pipe(retry(1), catchError(this.handleError));
  }

  // Method to fetch partner by names: name aline
  getPartnerByName(name: string,): Observable<PartnerInterface> {  
    return this.http
      .get<PartnerInterface>(`${this.apiURL}/partners/getPartnerByName/${name}`, { withCredentials: true })
      .pipe(retry(1), catchError(this.handleError));
  }


  // check-follow-status
  checkFollowStatus(partnerId: string, searchPartnerId: string): Observable<boolean> {
    return this.http
      .get<boolean>(this.apiURL + `/partners/check-follow-status/${partnerId}/${searchPartnerId}`, { withCredentials: true })
      .pipe( catchError(this.handleError));
  }

  // follow
  follow(partnerId: string, searchPartnerId: string) {
    return this.http
      .post(this.apiURL + `/partners/follow/${searchPartnerId}`, {partnerId}, { withCredentials: true })
      .pipe( catchError(this.handleError));
  }

  // unfollow
  unfollow(partnerId: string, searchPartnerId: string){
    return this.http
      .post(this.apiURL + `/partners/unfollow/${searchPartnerId}`, {partnerId}, { withCredentials: true })
      .pipe( catchError(this.handleError));
  }

   
}
