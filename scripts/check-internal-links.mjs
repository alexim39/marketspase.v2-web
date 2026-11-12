#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Internal navigation guard for the three Angular apps.
 *
 * It catches the class of bug where a routerLink is written relative to the
 * current page (for example `training/courses/:id` on `/dashboard/learn`) or
 * points at a route that does not exist. External URLs, anchors and the few
 * intentional child-route links are ignored.
 *
 * When adding a real route, add its pattern below. Keep links explicit:
 * use `/dashboard/...` for platform links, `/...` for admin links and
 * `/...` for store links.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPS = ['platform', 'admin', 'store'];
const SOURCE_FILE = /\.(ts|html)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.angular', '.git', 'coverage']);

const PLATFORM_ROUTES = [
  /^\/$/,
  /^\/join$/, /^\/how-it-works$/, /^\/ora$/, /^\/about$/, /^\/faq$/,
  /^\/partner(?:\/(?:signin|signup|verify-email|forgot-password|reset-password))?$/,
  /^\/dashboard$/,
  /^\/dashboard\/activate$/,
  /^\/dashboard\/campaigns$/,
  /^\/dashboard\/promote$/,
  /^\/dashboard\/compensation$/,
  /^\/dashboard\/earnings$/,
  /^\/dashboard\/tools\/campaigns(?:\/.*)?$/,
  /^\/dashboard\/prospects\/general-list$/,
  /^\/dashboard\/settings(?:\/(?:profiles|appearance|verification|landing-page|billing|billing\/commissions|notifications))?$/,
  /^\/dashboard\/resources(?:\/(?:ads-contents|prospecting-contents))?$/,
  /^\/dashboard\/mentorship(?:\/.*)?$/,
  /^\/dashboard\/products(?:\/(?:eshop|my-store|store-orders|order-history|guides|resell|[^/]+))?$/,
  /^\/dashboard\/prospects(?:\/(?:bookings|kits|booking\/[^/]+|customer-leads|personal-list|pipeline|new|reminders|board|detail\/[^/]+|edit\/[^/]+))?$/,
  /^\/dashboard\/support(?:\/(?:ticket|about|about\/app))?$/,
  /^\/dashboard\/admin$/,
  /^\/dashboard\/network(?:\/(?:tree|org|view\/[^/]+))?$/,
  /^\/dashboard\/notifications(?:\/(?:center|preferences))?$/,
  /^\/dashboard\/goals$/,
  /^\/dashboard\/insights(?:\/(?:my-business|downloads))?$/,
  /^\/dashboard\/messages$/,
  /^\/dashboard\/progress$/,
  /^\/dashboard\/training(?:\/(?:paths|library|analytics|tutorials|courses(?:\/[^/]+(?:\/lessons\/[^/]+)?)?|[^/]+))?$/,
  /^\/dashboard\/wallet(?:\/(?:history|deposit|deposit\/result))?$/,
  /^\/dashboard\/community(?:\/(?:feed|events))?$/,
  /^\/dashboard\/marketing(?:\/.*)?$/,
  /^\/dashboard\/ora$/,
  /^\/dashboard\/pipeline$/,
  /^\/dashboard\/team$/,
  /^\/dashboard\/learn(?:\/video-of-the-week(?:\/[^/]+)?)?$/,
  /^\/dashboard\/more$/,
  /^\/dashboard\/checkout$/,
];

const ADMIN_ROUTES = [
  /^\/$/,
  /^\/signin$/,
  /^\/dashboard$/,
  /^\/(?:roles|automation|deposits|partner-pipeline|pages|orders|stores|store-orders|store-settlements|activation|growth|compensation|training-quizzes|audit|recycle-bin|tickets|moderation|rank-groups|broadcast|subscriptions|bonuses|tutorials|weekly-videos|settings|products)$/,
  /^\/members\/[^/]+$/,
  /^\/rank-groups\/[^/]+$/,
  /^\/(?:campaigns|reported-leads|leads|prolific-woman-leads|reservations|kits|oversight)$/,
];

const STORE_ROUTES = [
  /^\/$/,
  /^\/stores$/, /^\/support$/, /^\/cart$/, /^\/checkout$/, /^\/checkout\/result$/,
  /^\/order\/[^/]+$/,
  /^\/legal(?:\/(?:terms|privacy|cookies))?$/,
  /^\/(?:get-started|faq|contact|events)$/,
  /^\/lead\/[^/]+$/,
  /^\/[^/]+\/product\/[^/]+$/,
  /^\/[^/]+$/,
];

const ROUTES = { platform: PLATFORM_ROUTES, admin: ADMIN_ROUTES, store: STORE_ROUTES };

// Intentional relative child links. These resolve inside their own route tree.
const RELATIVE_ALLOW = new Set([
  'projects/store/src/app/legal/legal.component.ts',
]);

const lineAt = (text, index) => text.slice(0, index).split('\n').length;
const appOf = (file) => APPS.find((app) => file.startsWith(`projects/${app}/`)) ?? null;
const cleanTarget = (value) => String(value).split(/[?#]/)[0];
const isExternal = (value) => /^(https?:|mailto:|tel:|#|\/\/)/i.test(value);

const segmentsOf = (expression) => {
  const inner = expression.trim().replace(/^\[|\]$/g, '');
  if (!inner.trim()) return [];
  return inner.split(',').map((part) => {
    const raw = part.trim();
    const literal = /^['"`](.*)['"`]$/.exec(raw)?.[1];
    return literal === undefined ? ':param' : literal;
  });
};

const targetFromCommand = (expression) => {
  const segments = segmentsOf(expression);
  if (segments.length === 0) return { skip: true };
  const first = segments[0];
  if (first === '' || first.startsWith('.') || first.startsWith('?')) return { skip: true };
  if (!first.startsWith('/')) return { bare: true, target: first };
  const target = `/${segments.map((s) => s.replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/')}`;
  return { target: target === '/' ? '/' : target };
};

const checkTarget = (app, target) => Boolean(ROUTES[app]?.some((rx) => rx.test(cleanTarget(target))));

const checkFile = async (file) => {
  const content = await readFile(path.join(ROOT, file), 'utf8');
  const app = appOf(file);
  if (!app) return [];
  const issues = [];

  const report = (index, kind, target, bare = false) => {
    issues.push({ file, line: lineAt(content, index), kind, target, bare });
  };

  for (const match of content.matchAll(/routerLink\s*=\s*"([^"]*)"/g)) {
    const value = match[1].trim();
    if (!value || isExternal(value) || value.startsWith('.') || value.startsWith('?')) continue;
    if (!value.startsWith('/')) {
      if (!RELATIVE_ALLOW.has(file)) report(match.index, 'routerLink', value, true);
      continue;
    }
    if (!checkTarget(app, value)) report(match.index, 'routerLink', value);
  }

  for (const match of content.matchAll(/\[routerLink\]\s*=\s*"([^"]*)"/g)) {
    const expression = match[1].trim();
    if (!expression.startsWith('[')) continue;
    const result = targetFromCommand(expression);
    if (result.skip) continue;
    if (result.bare) {
      if (!RELATIVE_ALLOW.has(file)) report(match.index, 'routerLink[]', result.target, true);
      continue;
    }
    if (!checkTarget(app, result.target)) report(match.index, 'routerLink[]', result.target);
  }

  for (const match of content.matchAll(/router\.navigate\s*\(\s*(\[[\s\S]*?\])\s*[,)]/g)) {
    const result = targetFromCommand(match[1]);
    if (result.skip) continue;
    if (result.bare) {
      if (!RELATIVE_ALLOW.has(file)) report(match.index, 'navigate', result.target, true);
      continue;
    }
    if (!checkTarget(app, result.target)) report(match.index, 'navigate', result.target);
  }

  for (const match of content.matchAll(/router\.navigateByUrl\s*\(\s*'([^']+)'\s*\)/g)) {
    const value = match[1];
    if (!value.startsWith('/')) {
      if (!RELATIVE_ALLOW.has(file)) report(match.index, 'navigateByUrl', value, true);
      continue;
    }
    if (!checkTarget(app, value)) report(match.index, 'navigateByUrl', value);
  }

  for (const match of content.matchAll(/\blink\s*:\s*'([^']*)'/g)) {
    const value = match[1].trim();
    if (!value.startsWith('/')) continue;
    if (!checkTarget(app, value)) report(match.index, 'link', value);
  }

  return issues;
};

const walk = async (dir) => {
  const files = [];
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...await walk(path.join(dir, entry.name)));
    } else if (SOURCE_FILE.test(entry.name)) {
      files.push(path.join(dir, entry.name).replaceAll('\\', '/'));
    }
  }
  return files;
};

const files = [];
for (const app of APPS) {
  files.push(...await walk(`projects/${app}/src/app`));
}

const issues = [];
for (const file of files) {
  issues.push(...await checkFile(file));
}

if (issues.length > 0) {
  console.error(`Internal link check failed: ${issues.length} broken or unsafe target(s).`);
  for (const issue of issues) {
    const detail = issue.bare ? 'relative path has no leading / or ../' : 'route does not exist';
    console.error(`  ${issue.file}:${issue.line} [${issue.kind}] ${issue.target} — ${detail}`);
  }
  process.exit(1);
}

console.log(`Internal link check passed: ${files.length} source files, no broken internal navigation.`);
