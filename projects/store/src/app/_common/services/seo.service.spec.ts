import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  let doc: Document;
  let service: SeoService;

  beforeEach(() => {
    doc = window.document.implementation.createHTMLDocument('seo-test');
    TestBed.configureTestingModule({
      providers: [
        SeoService,
        { provide: DOCUMENT, useValue: doc },
      ],
    });
    service = TestBed.inject(SeoService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('sets page title, description, canonical and robots tags', () => {
    service.setPage({
      title: 'FAQ | Diamond Project',
      description: 'Answers to common questions.',
      path: '/faq'
    });

    const canonical = doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    expect(doc.title).toBe('FAQ | Diamond Project');
    expect(doc.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toBe('Answers to common questions.');
    expect(canonical?.getAttribute('href')).toBe('http://localhost:4201/faq');
    expect(doc.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('index, follow');
  });

  it('marks missing pages noindex', () => {
    service.setNotFound('Page not found', '/404');

    expect(doc.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('noindex, nofollow');
    expect(doc.title).toBe('Page not found | MarketSpase Store');
  });

  it('adds and removes JSON-LD structured data', () => {
    service.setJsonLd('test-schema', { '@type': 'Organization', name: 'Diamond Project' });

    const script = doc.getElementById('test-schema');
    expect(script?.textContent).toContain('Diamond Project');

    service.clearJsonLd('test-schema');
    expect(doc.getElementById('test-schema')).toBeNull();
  });
});
