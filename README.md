# MarketSpase Web

Angular CLI workspace for the MarketSpase web applications.

## Structure

```text
marketspase.v2-web/
  projects/
    platform/   # partner platform (port 4200)
    store/      # public MarketSpase Store (port 4201)
    admin/      # platform administration (port 4202)
    shared/     # reserved shared code
```

The backend lives outside this workspace at `../api`.

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
```

## API

- Local API: `http://localhost:3000`
- Platform and admin development servers proxy API requests to the local API.
- The store reads its API base from `projects/store/src/environments/environment.ts`.

## Repositories

`marketspase.v2-web` is the single source of truth for the three Angular applications.
The legacy app repositories are historical mirrors and should not be edited directly.
