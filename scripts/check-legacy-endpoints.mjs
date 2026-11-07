#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Blocks retired API endpoints from creeping back into the web clients.
 *
 * The dashboard sign-out regression was caused by one stale `auth` call that
 * the API had already retired. This guard fails CI on the known dead routes;
 * add `legacy-endpoint-allow` to a line only when the reference is intentional
 * (for example, a migration test).
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.angular', '.git', 'coverage', 'scripts']);
const SOURCE_FILE = /\.(ts|html|js|mjs)$/;
const ALLOW = 'legacy-endpoint-allow';

export const RULES = [
  {
    name: 'legacy auth endpoint',
    re: /(['"`])\/?auth\1\s*[,)]/,
  },
  {
    name: 'legacy contact form',
    re: /\/?contact\/(?:submit|pre-approach)\b/,
    skipV1: true,
  },
  {
    name: 'legacy survey form',
    re: /\/?survey\/(?:submit|partners)\b/,
    skipV1: true,
  },
  {
    name: 'legacy ticket submit',
    re: /(['"`])\/?ticket\/submit\1/,
  },
  {
    name: 'legacy newsletter endpoint',
    re: /\/?emailSubscription\//,
  },
  {
    name: 'legacy campaign create',
    re: /(?:post|put|patch)\s*\([^\n]*['"`]\/?campaign['"`]|\/campaign\/(?:facebook|youtube|linkedin)\b/,
  },
  {
    name: 'legacy booking email export',
    re: /\/?booking\/email-list\b/,
  },
  {
    name: 'legacy partner lookup/social write',
    re: /\/?partners\/(?:public-search|check-username|whatsappgrouplink|whatsappchatlink|facebookPage|instagramPage|tiktokPage|twitterPage|youtubePage|linkedinPage)\b/,
  },
  {
    name: 'legacy inbox read',
    re: /\/?(?:emails|sms)\/getById\b/,
  },
];

export const findLegacyEndpoints = (content, file = '') => {
  const hits = [];
  const lines = String(content ?? '').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.includes(ALLOW)) return;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) return;

    for (const rule of RULES) {
      const match = rule.re.exec(line);
      if (!match) continue;
      if (rule.skipV1 && /v1\/?$/i.test(line.slice(0, match.index))) continue;
      hits.push({
        file,
        line: index + 1,
        rule: rule.name,
        text: trimmed.slice(0, 180),
      });
    }
  });
  return hits;
};

const walk = async (dir) => {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...await walk(full));
    } else if (entry.isFile() && SOURCE_FILE.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
};

const main = async () => {
  const files = await walk(ROOT);
  const hits = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    hits.push(...findLegacyEndpoints(content, path.relative(ROOT, file).replace(/\\/g, '/')));
  }

  if (hits.length === 0) {
    console.log(`Legacy endpoint guard: ${files.length} files checked, no retired API calls.`);
    return;
  }

  console.error('Retired API endpoint(s) found in web source:');
  for (const hit of hits) {
    console.error(`  ${hit.file}:${hit.line}  [${hit.rule}]  ${hit.text}`);
  }
  console.error('');
  console.error('Move to the /v1 contract, or add `legacy-endpoint-allow` to the line if intentional.');
  process.exitCode = 1;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[legacy-guard] ${error?.message ?? error}`);
    process.exitCode = 1;
  });
}
