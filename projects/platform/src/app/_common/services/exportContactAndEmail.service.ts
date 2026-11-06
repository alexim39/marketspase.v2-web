import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ExportContactAndEmailService {
  private dataSubject = new BehaviorSubject<string[]>([]);
  data$ = this.dataSubject.asObservable();

  setData(data: string[]) {
    this.dataSubject.next(data);
  }
}
