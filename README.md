# MarketSpase Web

Angular CLI workspace for the MarketSpase web applications.

## Structure

```text
marketspase.v2-web/
  projects/
    platform/   # partner platform (port 4200)
    store/      # public MarketSpase Store (port 4201)
    admin/      # platform administration (port 4202)
    shared/     # shared brand, theme, HTTP/auth foundation and UI
```

The backend lives outside this workspace at `../api`.

## Shared foundation

`projects/shared` is source, not a buildable app. Apps import it through the
`@marketspase/shared/*` path alias (see `tsconfig.json`).

- `assets/brand` — canonical logos, favicons, PWA/social images. Copied into
  every app under `/logo` by `angular.json`.
- `styles` — shared Material theme, design tokens, base globals and the
  platform/admin global layer. Store-only globals stay in the store app.
- `ui/brand-logo` — `async-brand-logo`, the single brand-mark component used
  by all three apps.
- `core/http` — shared `ApiClient`, credentials/auth-token/API-error
  interceptors and cached injection helper.
- `core/config` — `API_BASE_URL` and `AUTH_TOKEN_KEY` injection tokens.
- `core/auth` — shared auth API contracts.

Each app provides its own `API_BASE_URL` and `AUTH_TOKEN_KEY` from its
environment: platform uses `dp_session_token`, admin uses
`ms_admin_session_token`. The store has no bearer fallback; it only uses the
cookie session.

## Commands

```bash
npm install

npm run start:platform   # http://localhost:4200
npm run start:store      # http://localhost:4201
npm run start:admin      # http://localhost:4202

npm run build:platform   # dist/platform/browser
npm run build:store      # dist/store/browser + static SEO pages
npm run build:admin      # dist/admin/browser

npm run test:store
npm run test:admin
npm run ci              # build all apps plus both test suites
```

## API

- Local API: `http://localhost:3000`
- Platform and admin development servers proxy API requests to the local API.
- The store reads its API base from `projects/store/src/environments/environment.ts`.
- All API traffic is cookie-first; platform and admin add the bearer fallback
  for browsers that drop the cross-site session cookie.

## Repositories

`marketspase.v2-web` is the single source of truth for the three Angular applications.
The legacy app repositories are historical mirrors and should not be edited directly.
