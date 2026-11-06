import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FormGroup } from '@angular/forms';
import { ApiService } from '../../../../_common/services/api.service';

export interface TicketInterface {  
  subject: string;               // Subject of the issue  
  description: string;           // Description of the challenge faced  
  date: Date;                    // Date the issue occurred  
  category: string;              // Selected category  
  priority: string;              // Priority level (Low, Medium, High)  
  comment?: string;              // Additional comments (optional)  
  partnerId: string;
}
  

@Injectable()
export class TicketService {
   constructor(private apiService: ApiService) {}

// submit ticket
submitTicket(formObject: FormGroup): Observable<any> {
  return this.apiService.post<TicketInterface>(`ticket/submit`, formObject, undefined, true);
}


   
}