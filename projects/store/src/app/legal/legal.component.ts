import { Component, ChangeDetectionStrategy } from '@angular/core';

import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'async-legal',
    imports: [MatButtonModule, MatDividerModule, MatListModule, RouterModule],
    template: `
    <section class="legal">
      
      <div class="legal-menu">
        <mat-list>
            <mat-list-item> 
                <a [routerLink]="['terms']" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">Terms of Service</a>
            </mat-list-item>
            <mat-divider></mat-divider>
            <mat-list-item> 
                <a [routerLink]="['privacy']" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">Privacy Policy</a>
            </mat-list-item>
            <mat-divider></mat-divider>
            <mat-list-item>
                <a [routerLink]="['cookies']" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">Cookies Policy</a>
            </mat-list-item>
            <mat-divider></mat-divider>
        </mat-list>
      </div>

      <div class="legal-content">
          <router-outlet></router-outlet>
      </div>
    </section>
  `,
    changeDetection: ChangeDetectionStrategy.Eager,
    styles: [`
    .legal {
      padding: 2em 4em;
      display: flex;
      gap: 2em;
      max-width: 1200px;
      margin: 0 auto;
      background: var(--dp-paper);
      color: var(--dp-text);
      .legal-menu {
        flex: 0 0 220px;
        width: 100%;
        padding-right: 2em;
        border-right: 1px solid var(--dp-line);
        mat-list {
          mat-list-item {
            a {
              text-decoration: none;
              color: var(--dp-text);
              font-weight: bold;
            }
            a:hover {
              color: var(--dp-gold-ink);
            }
            a.active {
              color: var(--dp-gold-ink);
            }
          }
        }
      }
      .legal-content {
        flex: 1;
        min-width: 0;
        padding-left: 0;
      }
    }

  /* Extra small devices (phones, 600px and down) */
  @media only screen and (max-width: 600px) {
    .legal {
      display: flex;
      flex-direction: column;
      padding: 1em;
      gap: 1em;
      .legal-menu {
        flex: none;
        padding-right: 0;
        border-right: 0;
        border-bottom: 1px solid var(--dp-line);
        padding-bottom: 1em;
      }
    }
  }
  `]
})
export class LegalComponent { }

