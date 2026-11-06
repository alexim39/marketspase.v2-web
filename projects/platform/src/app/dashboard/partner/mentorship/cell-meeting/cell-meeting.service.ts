import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { retry, catchError } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import { PartnerInterface } from '../../../../_common/services/partner.service';

export interface CellMeetingInterface {
  message: string;
  data?: Array<{
    prospectName: string;
    prospectSurname: string;
    prospectEmail: string;
    prospectPhone: string;
    prospectSource: string;
    prospectRemark?: string;
    createdAt: Date;
    status: string;
    id: string;
  }> 
}
  

@Injectable()
export class CellMeetingService {
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

// send single email
/* sendProspectEmail(emailObject: {partnerId: string, prospectEmail: string, emailBody: string}): Observable<ContactsInterface> {
  console.log('record', emailObject);
  return this.http
    .post<ContactsInterface>(this.apiURL + `/prospect/send-single-email/`, emailObject, { withCredentials: true })
    .pipe(retry(1), catchError(this.handleError));
} */

  recordAttendance(timeSpent: string, partner: PartnerInterface) {
    const dataObject = { timeSpent, meetingDate: new Date(), partner:  partner};
    console.log('record', dataObject);
    
    return this.http
    .post<CellMeetingInterface>(this.apiURL + `/mentorship/cell-meeting/`, dataObject, { withCredentials: true })
    .pipe(retry(1), catchError(this.handleError));
  }

   
}