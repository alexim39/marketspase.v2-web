import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { retry, catchError } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';

export interface ProfileInterface {
  id: string;
}
  

@Injectable()
export class LandingPageService {
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



  updateTestimonial(updateObject: {testimonial: string; partnerId: string}): Observable<ProfileInterface> {
    return this.http
      .put<ProfileInterface>(this.apiURL + `/partners/testimonial`, updateObject, { withCredentials: true })
      .pipe(retry(1), catchError(this.handleError));
  }

  updateLandingPage(payload: Record<string, unknown>): Observable<any> {
    return this.http
      .put<any>(this.apiURL + `/partners/landing-page`, payload, { withCredentials: true })
      .pipe(retry(1), catchError(this.handleError));
  }



   
}
