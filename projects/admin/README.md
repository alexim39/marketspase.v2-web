# MarketSpase Admin

Standalone administration app for the MarketSpase platform.

## Local development

```bash
npm install
npm start
```

- Admin app: `http://localhost:4202`
- API: `http://localhost:3000` (proxied by `proxy.conf.json`)
- Partner platform: `http://localhost:4200`
- Store: `http://localhost:4201`

## Build

```bash
npm run build
```

Output: `dist/admin`.

## Access

The app uses the MarketSpase API session and the server's `admin` role. The sign-in page accepts an existing admin account; non-admin accounts are refused.

## Scope

The admin app owns platform-wide operations:

- Activation and KYC
- People, roles, permissions, suspensions and Member 360
- Partner stores, store orders, escrow and settlements
- Product orders, catalog, bonuses and the legacy shop plan
- Compensation, commissions, ranks and mentor bonuses
- Growth campaigns, page leads, public pages and automation
- Broadcast, email list, support tickets, moderation and audit
- Training quizzes, tutorials, presentations and platform settings
