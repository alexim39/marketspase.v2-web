# MarketSpase Store

This project uses Angular CLI **22** with the `@angular/build` application
builder. It is the public MarketSpase commerce and partner-page site.

Two partner-facing public routes share the same app:

- `/{username}` — the partner's store (catalogue, cart, checkout, order tracking).
- `/lead/{username}` — the partner's shareable personal lead page (story, offer,
  contact links, WhatsApp, social links, lead form and “Join my team” CTA).
- `/join?ref={username}` links hand off to the platform signup, which sets the
  partner as the new member's `partnerOf` when the referrer is eligible.

Checkout also captures the shopper in the partner's **Customer Leads** list
(`store_customer_leads`), separate from the prospect pipeline. The store does
not own partner operations; those live in the platform app.

## Development server

Run `npm start` for a dev server. Navigate to `http://localhost:4201/`. The
application reloads automatically when source files change.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
