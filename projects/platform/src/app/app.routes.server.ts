import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Public marketing pages are prerendered so crawlers and AI answer engines
 * receive complete HTML. Authenticated app routes stay client-rendered and
 * inherit the noindex CSR shell.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'join', renderMode: RenderMode.Prerender },
  { path: 'how-it-works', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: 'faq', renderMode: RenderMode.Prerender },
  { path: 'ora', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
