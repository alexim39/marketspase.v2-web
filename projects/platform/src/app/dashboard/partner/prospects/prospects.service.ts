import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FormGroup } from '@angular/forms';
import { ApiService } from '../../../_common/services/api.service';

export interface ProspectListInterface {
  message: string;
  surname: string;
  name: string;
  email: string;
  phoneNumber: string;
  createdAt: Date; 
  _id: string; 
}
  

@Injectable()
export class ProspectService {
  constructor(private apiService: ApiService) {}
 
  // get prospect owned by the partner
  getAllMyProspect(username: string): Observable<any> {
      return this.apiService.get<ProspectListInterface>(`prospect/my/${username}`, undefined, undefined, true);
  }

  // get prospect owned
  getProspectFor(createdBy: string): Observable<any> {
      return this.apiService.get<ProspectListInterface>(`prospect/for/${createdBy}`, undefined, undefined, true);
  }

  // get contacts createdby
  // get session booking
  getSessionBookingsFor(createdBy: string): Observable<any> {
    return this.apiService.get<ProspectListInterface>(`booking/for/${createdBy}`, undefined, undefined, true);
  }

  // detele single prospect
  deleteBookings(id: string): Observable<any> {
    return this.apiService.delete<ProspectListInterface>(`booking/delete/${id}`, undefined, undefined, true);
  }

  // update the booking status
  updateBookingStatus(formData: FormGroup): Observable<any> {
    return this.apiService.put<any>(`booking/update`, formData, undefined, true);
  }

}