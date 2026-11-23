/**
 * SEO readiness check for a deployed platform build.
 *
 * Usage:
 *   node scripts/check-seo-readiness.mjs https://staging.marketspase.com
 *
 * Verifies raw HTML, per-route metadata, sitemap and crawler access.
 */
const base = (process.argv[2] || 'http://localhost:4300').replace(/\/+$/, '');
const site = 'https://marketspase.com';

const publicPages = [
  {
    path: '/',
    title: 'MarketSpase - A Real Online Business Opportunity Without the Chase',
    canonical: `${site}/`,
  },
  {
    path: '/join',
    title: 'Join MarketSpase - Start Your Online Business Without the Chase',
    canonical: `${site}/join`,
  },
  {
    path: '/how-it-works',
    title: 'How Your Online Business Works - MarketSpase',
    canonical: `${site}/how-it-works`,
  },
  {
    path: '/about',
    title: 'About MarketSpase - A Real Online Business Opportunity',
    canonical: `${site}/about`,
  },
  {
    path: '/faq',
    title: 'Online Business Questions - MarketSpase FAQ',
    canonical: `${site}/faq`,
  },
  {
    path: '/ora',
    title: 'Meet Ora - Your AI Business Partner | MarketSpase',
    canonical: `${site}/ora`,
  },
];

const privatePages = ['/partner/signin', '/dashboard/training/tutorials', '/not-a-real-page'];
const crawlerAgents = {
  Googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  Bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  GPTBot:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
  ClaudeBot:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  PerplexityBot:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
};

const failures = [];
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
};

const get = async (path, ua = 'MarketSpase-SEO-Check/1.0') => {
  const response = await fetch(`${base}${path}`, {
    headers: { 'user-agent': ua },
    signal: AbortSignal.timeout(20_000),
  });
  return { response, html: await response.text() };
};

const meta = (html, pattern) => html.match(pattern)?.[1]?.trim() ?? null;
const jsonLdTypes = (html) => {
  const types = [];
  for (const match of html.matchAll(
    /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    try {
      const json = JSON.parse(match[1]);
      for (const node of json['@graph'] ?? [json]) types.push(node['@type']);
    } catch {
      types.push('INVALID_JSON');
    }
  }
  return types;
};

for (const page of publicPages) {
  try {
    const { response, html } = await get(page.path);
    const title = meta(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const canonical = meta(html, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i);
    const robots = meta(html, /<meta[^>]+name="robots"[^>]+content="([^"]*)"/i);
    const hasH1 = /<h1[\s>]/i.test(html);
    const schema = jsonLdTypes(html);
    const visible = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    check(`${page.path}: status 200`, response.status === 200, `got ${response.status}`);
    check(`${page.path}: title`, title === page.title, `got ${title ?? 'none'}`);
    check(`${page.path}: canonical`, canonical === page.canonical, `got ${canonical ?? 'none'}`);
    check(`${page.path}: indexable`, robots === 'index, follow', `got ${robots ?? 'none'}`);
    check(`${page.path}: H1`, hasH1);
    check(`${page.path}: visible copy`, visible.length > 500, `${visible.length} chars`);
    check(`${page.path}: JSON-LD`, schema.length > 0 && !schema.includes('INVALID_JSON'));
  } catch (error) {
    check(`${page.path}: request`, false, error?.message ?? String(error));
  }
}

for (const path of privatePages) {
  try {
    const { response, html } = await get(path);
    const robots = meta(html, /<meta[^>]+name="robots"[^>]+content="([^"]*)"/i);
    const canonical = meta(html, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i);
    check(`${path}: status 200`, response.status === 200, `got ${response.status}`);
    check(`${path}: noindex`, robots === 'noindex, nofollow', `got ${robots ?? 'none'}`);
    check(`${path}: no canonical`, !canonical, canonical ?? '');
  } catch (error) {
    check(`${path}: request`, false, error?.message ?? String(error));
  }
}

try {
  const { response, html } = await get('/sitemap.xml');
  const locs = [...html.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
  check('/sitemap.xml: status 200', response.status === 200, `got ${response.status}`);
  for (const page of publicPages) {
    check(`/sitemap.xml: ${page.path}`, locs.includes(page.canonical), locs.join(', '));
  }
  check(
    '/sitemap.xml: no private routes',
    !locs.some((loc) => /dashboard|partner|legal/.test(loc)),
  );
} catch (error) {
  check('/sitemap.xml: request', false, error?.message ?? String(error));
}

try {
  const { response, html } = await get('/robots.txt');
  check('/robots.txt: status 200', response.status === 200, `got ${response.status}`);
  check('/robots.txt: sitemap', html.includes(`Sitemap: ${site}/sitemap.xml`));
  for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'OAI-SearchBot']) {
    check(`/robots.txt: ${bot}`, html.includes(`User-agent: ${bot}`));
  }
  check('/robots.txt: dashboard disallowed', html.includes('Disallow: /dashboard'));
} catch (error) {
  check('/robots.txt: request', false, error?.message ?? String(error));
}

for (const [name, ua] of Object.entries(crawlerAgents)) {
  try {
    const { response, html } = await get('/about', ua);
    check(`${name}: access`, response.status === 200, `got ${response.status}`);
    check(`${name}: raw H1`, /<h1[\s>]/i.test(html));
    check(`${name}: canonical`, html.includes(`href="${site}/about"`));
  } catch (error) {
    check(`${name}: request`, false, error?.message ?? String(error));
  }
}

const width = Math.max(...results.map((row) => row.name.length));
console.log(`\nSEO readiness: ${base}\n`);
for (const row of results) {
  console.log(`${row.ok ? 'PASS' : 'FAIL'}  ${row.name.padEnd(width)}  ${row.detail}`);
}
console.log(`\n${results.length - failures.length}/${results.length} checks passed.`);
if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s).`);
  process.exitCode = 1;
}
