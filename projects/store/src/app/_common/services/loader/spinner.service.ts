import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoadingSpinnerService {
  private showSpinner = false;

  show() {
    this.showSpinner = true;
  }

  hide() {
    this.showSpinner = false;
  }

  isShowing() {
    return this.showSpinner;
  }
}