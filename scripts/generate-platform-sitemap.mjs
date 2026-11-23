import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Generate the public sitemap from Angular's prerender manifest.
 * Run after `ng build --output-mode static`.
 */
const root = path.resolve(process.argv[2] ?? 'dist/platform');
const routesFile = path.join(root, 'prerendered-routes.json');
const outputFile = path.join(root, 'browser', 'sitemap.xml');
const site = 'https://marketspase.com';

const defaults = { changefreq: 'monthly', priority: '0.7' };
const overrides = {
  '/': { changefreq: 'weekly', priority: '1.0' },
  '/join': { changefreq: 'monthly', priority: '0.9' },
  '/how-it-works': { changefreq: 'monthly', priority: '0.9' },
  '/faq': { changefreq: 'monthly', priority: '0.8' },
  '/ora': { changefreq: 'monthly', priority: '0.8' },
  '/about': { changefreq: 'monthly', priority: '0.7' },
};

const manifest = JSON.parse(await fs.readFile(routesFile, 'utf8'));
const routes = Object.keys(manifest.routes ?? {}).sort();
if (routes.length === 0) throw new Error('No prerendered routes found');

const today = new Date().toISOString().slice(0, 10);
const urls = routes
  .map((route) => {
    const meta = { ...defaults, ...(overrides[route] ?? {}) };
    const loc = `${site}${route === '/' ? '/' : route}`;
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${meta.changefreq}</changefreq>\n    <priority>${meta.priority}</priority>\n  </url>`;
  })
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
await fs.writeFile(outputFile, xml, 'utf8');
console.log(`Generated ${outputFile} with ${routes.length} public routes.`);
