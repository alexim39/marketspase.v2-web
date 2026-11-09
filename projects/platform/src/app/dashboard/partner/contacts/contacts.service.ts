import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../_common/services/api.service';

export interface ContactsInterface {
    prospectName: string;
    prospectSurname: string;
    prospectEmail: string;
    prospectPhone: string;
    prospectSource: string;
    prospectRemark?: string;
    createdAt: Date;
    status: {
      createdAt: Date;
      expectedDecisionDate: Date;
      name: string;
      note: string;
      status: string;
      _id: string;
    };
    _id: string;
 /*  message: string;
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
  }>;
  success: boolean; */
}

export interface CommunicationInterface {
  interestLevel: string;
  date: Date;
  type: 'call' | 'email' | 'text' | 'zoom' | 'meeting';
  duration?: number;
  description: string;
  topicsDiscussed: string[];
  prospectId: string;
  _id?: string;
}

@Injectable()
export class ContactsService {
  constructor(private apiService: ApiService) {}


  // contact creatioin
  create(formData: ContactsInterface): Observable<any> {
    return this.apiService.post<any>(`prospect/create`, formData, undefined, true);
  }

  // contact creatioin
  update(formData: ContactsInterface): Observable<any> {
    return this.apiService.put<any>(`prospect/update`, formData, undefined, true);
  }

  // get prospect byId
  getProspectById(prospectId: string): Observable<any> {
    return this.apiService.get<ContactsInterface>(`prospect/getById/${prospectId}`, undefined, undefined, true);
  }

  // update prospect status
  updateProspectStatus(payload: { prospectId: string; status: { name: string; note: string | undefined; paydayDate: Date | undefined; }; }): Observable<any> {
    return this.apiService.post<{status: {}; prospectId: string}>(`prospect/updateStatus`, payload, undefined, true);
  }

  // Convert prospect — marks Converted; open registration handles the rest.
  // A legacy reservation code is still accepted when supplied.
  promoteProspectToPartner(payload: { prospectId: string; code?: string; by?: string; byName?: string }): Observable<any> {
    const prospectId = String(payload?.prospectId ?? '').trim();
    const body: Record<string, string> = {};
    if (String(payload?.code ?? '').trim()) body['code'] = String(payload.code).trim();
    if (payload?.by?.trim()) body['by'] = payload.by.trim().slice(0, 40);
    if (payload?.byName?.trim()) body['byName'] = payload.byName.trim().slice(0, 120);
    return this.apiService.post<any>(`v1/prospects/${prospectId}/convert`, body, undefined, true);
  }

  // delete prospect - session-owned v1 DELETE (legacy GET-as-delete retired)
  deleteProspect(id: string): Observable<any> {
    return this.apiService.delete<any>(`v1/prospects/${id}`, undefined, undefined, true);
  }

  /**
   * Update prospect communications
   * @param formData - Object containing communication and prospectId
  */
  updateProspectCommunications(formData: CommunicationInterface): Observable<any> {
    return this.apiService.post<CommunicationInterface>(`prospect/communications`, formData, undefined, true);
  }

  // delete prospect communiction
  deleteCommunictaionEntry(prospectId: string, communicationId: string): Observable<any> {
    return this.apiService.delete<any>(`prospect/communications/${prospectId}/${communicationId}`, undefined, undefined, true);
  }

}