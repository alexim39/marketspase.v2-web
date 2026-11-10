import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const origin = 'https://store.marketspase.com';
const defaultImage = '/logo/og-store.jpg';
const defaultWidth = '1200';
const defaultHeight = '630';

const pages = [
  {
    path: '/stores',
    title: 'Find a store | MarketSpase Store',
    description: 'Browse independent MarketSpase partner stores and shop directly from real people.'
  },
  {
    path: '/support',
    title: 'Support | MarketSpase Store',
    description: 'Get help with a MarketSpase Store order, a partner store or opening your own shop.'
  },
  {
    path: '/legal',
    title: 'Legal | MarketSpase Store',
    description: 'MarketSpase Store terms, privacy and cookie policies.',
    canonicalPath: '/legal/terms'
  },
  {
    path: '/legal/terms',
    title: 'Terms of Service | MarketSpase Store',
    description: 'The terms that govern use of the MarketSpase Store website and services.'
  },
  {
    path: '/legal/privacy',
    title: 'Privacy Policy | MarketSpase Store',
    description: 'How MarketSpase Store collects, uses and protects personal information.'
  },
  {
    path: '/legal/cookies',
    title: 'Cookie Policy | MarketSpase Store',
    description: 'How MarketSpase Store uses cookies and how you can control them.'
  }
];

const escapeAttr = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const setMeta = (html, attribute, key, content) => {
  const pattern = new RegExp(`<meta ${attribute}="${key}" content="[^"]*"\\s*/?>`, 'gi');
  const tag = `<meta ${attribute}="${key}" content="${escapeAttr(content)}">`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `${tag}\n</head>`);
};

const absolute = (value) => /^https?:\/\//i.test(value) ? value : `${origin}${value}`;

const outputDir = join(process.cwd(), 'dist', 'store', 'browser');
const shellPath = join(outputDir, 'index.html');

if (!existsSync(shellPath)) {
  throw new Error(`Build output not found: ${shellPath}`);
}

const shell = readFileSync(shellPath, 'utf8');

for (const page of pages) {
  const canonical = `${origin}${page.canonicalPath || page.path}`;
  const image = absolute(page.image || defaultImage);
  const width = page.width || defaultWidth;
  const height = page.height || defaultHeight;

  let html = shell
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(page.title)}</title>`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${escapeAttr(canonical)}">`);

  html = setMeta(html, 'name', 'description', page.description);
  html = setMeta(html, 'property', 'og:title', page.title);
  html = setMeta(html, 'property', 'og:description', page.description);
  html = setMeta(html, 'property', 'og:image', image);
  html = setMeta(html, 'property', 'og:image:secure_url', image);
  html = setMeta(html, 'property', 'og:image:type', 'image/jpeg');
  html = setMeta(html, 'property', 'og:image:alt', page.title);
  html = setMeta(html, 'property', 'og:image:width', width);
  html = setMeta(html, 'property', 'og:image:height', height);
  html = setMeta(html, 'property', 'og:url', canonical);
  html = setMeta(html, 'property', 'og:type', 'website');
  html = setMeta(html, 'property', 'og:locale', 'en_NG');
  html = setMeta(html, 'name', 'twitter:card', 'summary_large_image');
  html = setMeta(html, 'name', 'twitter:title', page.title);
  html = setMeta(html, 'name', 'twitter:description', page.description);
  html = setMeta(html, 'name', 'twitter:image', image);
  html = setMeta(html, 'name', 'twitter:image:alt', page.title);
  html = setMeta(html, 'name', 'twitter:url', canonical);

  const targetDir = join(outputDir, ...page.path.split('/').filter(Boolean));
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(join(targetDir, 'index.html'), html, 'utf8');
}

console.log(`Generated static SEO pages: ${pages.length}`);
