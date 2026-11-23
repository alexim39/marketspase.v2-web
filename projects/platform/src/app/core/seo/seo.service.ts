import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { DEFAULT_OG_IMAGE, PUBLIC_SEO, SITE_URL, pageSchema, type SeoPage } from './seo.routes';

/**
 * Applies per-route metadata during client navigation and Angular prerender.
 *
 * Public marketing routes get a self-canonical, indexable robots directive,
 * social tags and page-specific JSON-LD. Auth/dashboard/unknown routes get a
 * noindex directive and no canonical, so the generated CSR shell cannot leak
 * into search results.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  apply(url: string): void {
    const path = this.normalize(url);
    const page = PUBLIC_SEO[path];

    if (!page) {
      this.applyPrivate(path);
      return;
    }

    this.title.setTitle(page.title);
    this.setMeta('name', 'description', page.description);
    this.setMeta('name', 'robots', page.robots);

    this.setMeta('property', 'og:type', 'website');
    this.setMeta('property', 'og:site_name', 'MarketSpase');
    this.setMeta('property', 'og:locale', 'en_NG');
    this.setMeta('property', 'og:title', page.ogTitle ?? page.title);
    this.setMeta('property', 'og:description', page.ogDescription ?? page.description);
    this.setMeta('property', 'og:url', page.canonical);
    this.setMeta('property', 'og:image', DEFAULT_OG_IMAGE);
    this.setMeta('property', 'og:image:secure_url', DEFAULT_OG_IMAGE);
    this.setMeta('property', 'og:image:type', 'image/jpeg');
    this.setMeta('property', 'og:image:width', '1200');
    this.setMeta('property', 'og:image:height', '630');

    this.setMeta('name', 'twitter:card', 'summary_large_image');
    this.setMeta('name', 'twitter:title', page.ogTitle ?? page.title);
    this.setMeta('name', 'twitter:description', page.ogDescription ?? page.description);
    this.setMeta('name', 'twitter:image', DEFAULT_OG_IMAGE);
    this.setMeta('name', 'twitter:url', page.canonical);

    this.setCanonical(page.canonical);
    this.setPageSchema(page);
  }

  private applyPrivate(path: string): void {
    const currentTitle = this.title.getTitle() || 'MarketSpase';
    this.title.setTitle(currentTitle);
    this.setMeta('name', 'robots', 'noindex, nofollow');
    this.setMeta('property', 'og:title', currentTitle);
    this.setMeta('property', 'og:url', `${SITE_URL}${path}`);
    this.setMeta('name', 'twitter:title', currentTitle);
    this.removeCanonical();
    this.removePageSchema();
  }

  private normalize(url: string): string {
    const path =
      String(url ?? '/')
        .split('?')[0]
        .split('#')[0] || '/';
    return path === '/' ? '/' : path.replace(/\/+$/, '');
  }

  private setMeta(attribute: 'name' | 'property', key: string, content: string): void {
    this.meta.updateTag({ [attribute]: key, content });
  }

  private setCanonical(href: string): void {
    this.removeCanonical();
    const link = this.document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', href);
    link.setAttribute('data-ms-seo', 'canonical');
    this.document.head.appendChild(link);
  }

  private removeCanonical(): void {
    this.document
      .querySelectorAll('link[rel="canonical"], link[data-ms-seo="canonical"]')
      .forEach((node) => node.remove());
  }

  private setPageSchema(page: SeoPage): void {
    this.removePageSchema();
    const script = this.document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('data-ms-seo', 'page');
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': pageSchema(page),
    }).replace(/</g, '\\u003c');
    this.document.head.appendChild(script);
  }

  private removePageSchema(): void {
    this.document.querySelectorAll('script[data-ms-seo="page"]').forEach((node) => node.remove());
  }
}
