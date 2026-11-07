import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'async-be-partner',
  imports: [MatButtonModule, MatIconModule, RouterModule],
  template: `
    <section class="mkt-section" aria-labelledby="final-cta-title">
      <div class="mkt-section-inner">
        <div class="mkt-cta">
          <p class="mkt-eyebrow">Your move</p>
          <h2 id="final-cta-title">Your online business. Without the chase.</h2>
          <p>
            Create your free account, meet Ora and see your first plan. No cold calls.
            No chasing friends. No scripts. Just a real business opportunity you can start today.
          </p>
          <div class="mkt-actions">
            <a mat-flat-button color="primary" routerLink="/partner/signup" (click)="scrollToTop()">Start your online business</a>
            <a mat-stroked-button routerLink="/ora" (click)="scrollToTop()">Meet Ora first</a>
          </div>
          <p class="mkt-fine">
            Free to join. Activation is a real product purchase.<br />
            <a
              href="https://whatsapp.com/channel/0029Vb77xA51NCrKysUMO11D"
              target="_blank"
              rel="noopener"
              style="color: #fff; font-weight: 700;"
            >chat with a human on WhatsApp</a>.
          </p>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class BePartnerComponent {
  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
