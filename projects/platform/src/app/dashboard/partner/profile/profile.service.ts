import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../_common/services/api.service';

export interface ProfileInterface {
  id: string;
}
  

@Injectable()
export class ProfileService {
  constructor(private apiService: ApiService) {}

  // profile update
  profileUpdate(formData: ProfileInterface): Observable<any> {
    return this.apiService.put<ProfileInterface>(`partners/update-profile`, formData, undefined, true);
  }

  // profession update
  professionUpdate(formData: ProfileInterface): Observable<any> {
    return this.apiService.put<ProfileInterface>(`partners/update-profession`, formData, undefined, true);
  }

  // username Update 
  usernameUpdate(formData: ProfileInterface): Observable<any> {;
    return this.apiService.put<ProfileInterface>(`partners/update-username`, formData, undefined, true);
  }

   // change Password 
   changePassword(formData: ProfileInterface): Observable<any> {
    return this.apiService.put<ProfileInterface>(`partners/change-password`, formData, undefined, true);
  }

   
}