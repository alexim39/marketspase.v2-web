import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * One-shot handoff of template copy into the outreach composers.
 * The library builds the full text (copy + personal link); the composer
 * takes it on arrival (appended when it already holds text, never wiped).
 */
@Injectable({
  providedIn: 'root'
})
export class TemplateHandoffService {
  private textSubject = new BehaviorSubject<string | null>(null);
  text$ = this.textSubject.asObservable();

  sendText(text: string) {
    this.textSubject.next(text);
  }

  /** One-shot read — clears the slot so later composer visits stay clean. */
  takeText(): string | null {
    const text = this.textSubject.getValue();
    if (text) this.textSubject.next(null);
    return text;
  }
}
