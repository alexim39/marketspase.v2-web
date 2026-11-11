import { Injectable } from '@angular/core';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/**
 * Loads the YouTube IFrame API once per browser session.
 *
 * The player component and the admin duration detector both use this service
 * so we never inject the script twice or race two onYouTubeIframeAPIReady
 * callbacks.
 */
@Injectable({ providedIn: 'root' })
export class YouTubeApiService {
  private promise: Promise<any> | null = null;

  load(): Promise<any> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return Promise.reject(new Error('YouTube player is only available in the browser'));
    }
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (this.promise) return this.promise;

    this.promise = new Promise<any>((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      const timer = window.setTimeout(() => {
        this.promise = null;
        reject(new Error('YouTube player timed out. Check the connection and try again.'));
      }, 15000);

      window.onYouTubeIframeAPIReady = () => {
        try {
          previous?.();
        } catch {
          // a previous listener must not break the player
        }
        window.clearTimeout(timer);
        if (window.YT?.Player) resolve(window.YT);
        else reject(new Error('YouTube player failed to initialise'));
      };

      if (!document.querySelector('script[data-ms-youtube-api]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.setAttribute('data-ms-youtube-api', '1');
        document.head.appendChild(script);
      }
    }).catch((error) => {
      this.promise = null;
      throw error;
    });

    return this.promise;
  }

  async createPlayer(
    element: string | HTMLElement,
    options: Record<string, unknown>,
  ): Promise<any> {
    const YT = await this.load();
    return new YT.Player(element, options);
  }
}
