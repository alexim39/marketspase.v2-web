import { Component, OnInit, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { LogoComponent } from '../../_common/logo.component';

import { DeviceDetectorService } from 'ngx-device-detector';
import { Router, RouterModule, } from '@angular/router';

@Component({
  selector: 'async-nav',
  imports: [MatToolbarModule, MatIconModule, MatButtonModule, LogoComponent, RouterModule],
  template: `

<header>
<mat-toolbar class="brand-nav">
  <mat-toolbar-row>
    <span class="logo">
      <async-logo/>
    </span>
    <span class="nav-spacer"></span>

    @if (isDesktop) {
      <ng-content>
        <a mat-button routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" (click)="scrollToTop()">
          Home
        </a>
        <a mat-button routerLink="partner/signin" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" (click)="scrollToTop()">
          <mat-icon>output</mat-icon> Sign In
        </a>
        <a mat-button routerLink="partner/signup" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" (click)="scrollToTop()">
          <mat-icon>input</mat-icon> Sign Up
        </a>
      </ng-content>
    }
  </mat-toolbar-row>

  @if (isMobile) {
    <mat-toolbar-row>
      <!-- <span>Second Line</span> -->
      <span class="nav-spacer"></span>
      <a mat-button routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" (click)="scrollToTop()">Home</a>
      <a mat-button routerLink="partner/signin" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" (click)="scrollToTop()">
        <mat-icon>output</mat-icon> Sign In
      </a>
      <a mat-button routerLink="partner/signup" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" (click)="scrollToTop()">
        <mat-icon>input</mat-icon> Sign Up
      </a>
    </mat-toolbar-row>
  }

</mat-toolbar>
</header>

`,
changeDetection: ChangeDetectionStrategy.Eager,
styles: `
.brand-nav {
    --mat-toolbar-container-background-color: var(--ms-ink);
    --mat-toolbar-container-text-color: var(--ms-ink-text);
    background: var(--ms-ink);
    color: var(--ms-ink-text);
}
.brand-nav a[mat-button] {
    --mat-button-text-label-text-color: var(--ms-ink-text);
    color: var(--ms-ink-text);
}
.nav-spacer {
    flex: 1 1 auto;
}

`
})
export class NavComponent implements OnInit {
  isMobile!: boolean;
  isTablet!: boolean;
  isDesktop!: boolean;

  constructor(private deviceService: DeviceDetectorService,  private router: Router  ) {}

  ngOnInit(): void {
    this.isMobile = this.deviceService.isMobile();
    this.isTablet = this.deviceService.isTablet();
    this.isDesktop = this.deviceService.isDesktop();
  }

   // scroll to top when clicked
   scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

}
