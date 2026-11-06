# Shared web code

Source shared by the platform, store and admin applications. Apps import it
through the `@marketspase/shared/*` path alias.

- `assets/brand` — canonical logos, favicons, PWA and social images. Every app
  copies this folder to `/logo` at build time.
- `styles` — shared Material theme, design tokens and base globals. Platform
  and admin also load the shared legacy global layer.
- `ui` — reusable UI components such as `async-brand-logo`.
- `core/http` — `ApiClient`, credentials/auth-token/API-error interceptors and
  the cached injection helper.
- `core/config` — `API_BASE_URL` and `AUTH_TOKEN_KEY` injection tokens. Each
  app provides its own values.
- `core/auth` — shared auth API contracts (`/v1/auth/*`).

App-specific layout, pages and environment values stay inside each app. When
changing shared code, build all three apps and run the store/admin test suites.
