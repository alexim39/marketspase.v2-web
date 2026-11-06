import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID, signal, DOCUMENT } from '@angular/core';

type ConsentChoice = 'accepted' | 'declined';

@Injectable({
  providedIn: 'root'
})
export class ConsentService {
  private readonly storageKey = 'dp-cookie-consent';
  private readonly adsId = 'AW-307794612';
  private readonly isBrowser: boolean;
  private choice: ConsentChoice | null = null;
  private analyticsLoaded = false;

  readonly bannerVisible = signal(false);

  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (!this.isBrowser) return;

    const stored = this.readChoice();
    if (stored) {
      this.choice = stored;
      if (stored === 'accepted') this.loadGoogleAds();
      return;
    }
    this.bannerVisible.set(true);
  }

  accept(): void {
    this.setChoice('accepted');
    this.loadGoogleAds();
  }

  decline(): void {
    this.setChoice('declined');
  }

  open(): void {
    this.bannerVisible.set(true);
  }

  trackConversion(sendTo: string): void {
    if (!this.isBrowser || this.choice !== 'accepted' || !this.analyticsLoaded) return;
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    gtag?.('event', 'conversion', { send_to: sendTo });
  }

  private setChoice(choice: ConsentChoice): void {
    this.choice = choice;
    this.bannerVisible.set(false);
    try {
      localStorage.setItem(this.storageKey, choice);
    } catch {
    }
  }

  private readChoice(): ConsentChoice | null {
    try {
      const value = localStorage.getItem(this.storageKey);
      return value === 'accepted' || value === 'declined' ? value : null;
    } catch {
      return null;
    }
  }

  private loadGoogleAds(): void {
    if (!this.isBrowser || this.analyticsLoaded) return;
    this.analyticsLoaded = true;

    const win = window as unknown as {
      dataLayer: unknown[];
      gtag?: (...args: unknown[]) => void;
    };
    win.dataLayer = win.dataLayer || [];
    win.gtag = function gtag() {
      win.dataLayer.push(arguments);
    };
    win.gtag('js', new Date());
    win.gtag('config', this.adsId);

    const script = this.document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${this.adsId}`;
    this.document.head.appendChild(script);
  }
}
