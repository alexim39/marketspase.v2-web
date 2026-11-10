# Partners platform

Angular 22 partner back office for MarketSpase. Local dev server:
`http://localhost:4200`.

## What lives here

- Authentication, activation, KYC and the allocation queue
- Home, Pipeline, Campaigns, Team, Wallet, Learn, Community and More hubs
- Prospect pipeline, referral-signup visibility, personal-page leads and Customer Leads
- Growth campaigns, compensation (automatic commission rank synced from journey rank, with audited admin overrides)
- Training ladder (Partner → Builder → Leader → Ambassador), mentorship and team activation
- Ora, notifications, settings and the admin-mode rail

The admin app is a separate project at `../admin` (port 4202); the store is
`../store` (port 4201). Shared code comes from `../shared` via
`@marketspase/shared/*`.

## Development server

Run `npm start` from the web workspace root, or `ng serve platform` here.
Navigate to `http://localhost:4200/`. The application reloads on source changes.

## Build

Run `npm run build:platform` from the workspace root. Output goes to
`dist/platform/browser`.
