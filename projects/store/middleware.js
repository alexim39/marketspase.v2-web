const DEFAULT_IMAGE = '/logo/social-profile-1024.png';
const DEFAULT_IMAGE_WIDTH = '1024';
const DEFAULT_IMAGE_HEIGHT = '1024';

const RESERVED = new Set([
  'stores', 'support', 'legal', 'assets', 'api', 'video', '_vercel',
  'index.html', 'favicon.ico', 'robots.txt', 'sitemap.xml', '_redirects'
]);

const STATIC_META = {
  '/stores': {
    title: 'Find a store | MarketSpase Store',
    description: 'Browse independent MarketSpase partner stores and shop directly from real people.',
    path: '/stores',
    image: DEFAULT_IMAGE,
    width: DEFAULT_IMAGE_WIDTH,
    height: DEFAULT_IMAGE_HEIGHT
  },
  '/support': {
    title: 'Support | MarketSpase Store',
    description: 'Get help with a MarketSpase Store order, a partner store or opening your own shop.',
    path: '/support',
    image: DEFAULT_IMAGE,
    width: DEFAULT_IMAGE_WIDTH,
    height: DEFAULT_IMAGE_HEIGHT
  },
  '/legal': {
    title: 'Legal | MarketSpase Store',
    description: 'MarketSpase Store terms, privacy and cookie policies.',
    path: '/legal/terms',
    image: DEFAULT_IMAGE,
    width: DEFAULT_IMAGE_WIDTH,
    height: DEFAULT_IMAGE_HEIGHT
  },
  '/legal/terms': {
    title: 'Terms of Service | MarketSpase Store',
    description: 'The terms that govern use of the MarketSpase Store website and services.',
    path: '/legal/terms',
    image: DEFAULT_IMAGE,
    width: DEFAULT_IMAGE_WIDTH,
    height: DEFAULT_IMAGE_HEIGHT
  },
  '/legal/privacy': {
    title: 'Privacy Policy | MarketSpase Store',
    description: 'How MarketSpase Store collects, uses and protects personal information.',
    path: '/legal/privacy',
    image: DEFAULT_IMAGE,
    width: DEFAULT_IMAGE_WIDTH,
    height: DEFAULT_IMAGE_HEIGHT
  },
  '/legal/cookies': {
    title: 'Cookie Policy | MarketSpase Store',
    description: 'How MarketSpase Store uses cookies and how you can control them.',
    path: '/legal/cookies',
    image: DEFAULT_IMAGE,
    width: DEFAULT_IMAGE_WIDTH,
    height: DEFAULT_IMAGE_HEIGHT
  }
};

const passThrough = () => new Response(null, {
  headers: { 'x-middleware-next': '1' }
});

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

const removeMeta = (html, attribute, key) => {
  const pattern = new RegExp(`\\s*<meta ${attribute}="${key}" content="[^"]*"\\s*/?>`, 'i');
  return html.replace(pattern, '');
};

const absoluteUrl = (origin, value, fallback) => {
  const path = value?.trim() || fallback;
  if (/^https?:\/\//i.test(path)) return path;
  return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
};

const injectPageMeta = (html, meta, origin) => {
  const canonical = `${origin}${meta.path}`;
  const image = absoluteUrl(origin, meta.image, DEFAULT_IMAGE);

  let output = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(meta.title)}</title>`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${escapeAttr(canonical)}">`);

  output = setMeta(output, 'name', 'description', meta.description);
  output = setMeta(output, 'property', 'og:title', meta.title);
  output = setMeta(output, 'property', 'og:description', meta.description);
  output = setMeta(output, 'property', 'og:image', image);
  output = setMeta(output, 'property', 'og:image:alt', meta.title);
  output = setMeta(output, 'property', 'og:url', canonical);
  output = setMeta(output, 'property', 'og:type', meta.type || 'website');
  output = setMeta(output, 'name', 'twitter:card', 'summary_large_image');
  output = setMeta(output, 'name', 'twitter:title', meta.title);
  output = setMeta(output, 'name', 'twitter:description', meta.description);
  output = setMeta(output, 'name', 'twitter:image', image);
  output = setMeta(output, 'name', 'twitter:image:alt', meta.title);

  if (meta.width && meta.height) {
    output = setMeta(output, 'property', 'og:image:width', meta.width);
    output = setMeta(output, 'property', 'og:image:height', meta.height);
  } else {
    output = removeMeta(output, 'property', 'og:image:width');
    output = removeMeta(output, 'property', 'og:image:height');
  }

  return output;
};

export const injectStoreMeta = (html, store, origin) => {
  const name = store.name || store.slug;
  const description = (store.tagline || store.bio || `Shop from ${name} on MarketSpase Store.`).slice(0, 300);

  return injectPageMeta(html, {
    title: `${name} | MarketSpase Store`,
    description,
    path: `/${encodeURIComponent(store.slug)}`,
    image: store.banner || store.logo || DEFAULT_IMAGE,
    width: store.banner ? undefined : DEFAULT_IMAGE_WIDTH,
    height: store.banner ? undefined : DEFAULT_IMAGE_HEIGHT,
    type: 'profile'
  }, origin);
};

export const config = {
  matcher: ['/((?!assets/|api/|video/|_vercel/).*)']
};

export default async function middleware(request) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (pathname === '/' || pathname.includes('.') || pathname.startsWith('/_')) {
      return passThrough();
    }

    const staticMeta = STATIC_META[pathname];
    if (staticMeta) {
      const shellResponse = await fetch(new URL('/index.html', request.url));
      if (!shellResponse.ok) return passThrough();
      const html = await shellResponse.text();
      return new Response(injectPageMeta(html, staticMeta, url.origin), {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400'
        }
      });
    }

    const segments = pathname.split('/').filter(Boolean);
    if (segments.length !== 1) return passThrough();

    const slug = decodeURIComponent(segments[0]).toLowerCase();
    if (!slug || RESERVED.has(slug) || slug.includes('.') || !/^[a-z0-9_]+$/.test(slug)) {
      return passThrough();
    }

    const apiBase = (process.env.STORE_API_URL || process.env.API_BASE_URL || 'https://marketspasev2api-p3jkxlvy.back4.app').replace(/\/+$/, '');
    const storeResponse = await fetch(`${apiBase}/v1/stores/${encodeURIComponent(slug)}`, {
      headers: { accept: 'application/json' },
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(2500) : undefined
    });

    if (!storeResponse.ok) return passThrough();

    const payload = await storeResponse.json();
    const store = payload?.data?.store;
    if (!payload?.success || !store) return passThrough();

    const shellResponse = await fetch(new URL('/index.html', request.url));
    if (!shellResponse.ok) return passThrough();

    const html = await shellResponse.text();
    const injected = injectStoreMeta(html, store, url.origin);

    return new Response(injected, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    });
  } catch {
    return passThrough();
  }
}
