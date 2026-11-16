# Phase 2 — public platform and auth

This phase moves the public funnel behind the device wrapper and adds focused
mobile auth screens.

## Auth

```text
auth/signin|signup|forgot-password|reset-password|verify-email/
  index.component.ts          # wrapper + page facade provider
  state/*.facade.ts           # form, signals, API actions
  desktop/*.component.*       # existing desktop page
  mobile/*.component.ts       # native mobile page
auth/mobile-auth-shell/       # brand, safe areas, card, secure note
```

- Sign-in, sign-up, forgot-password, reset-password and verify-email each share
  one facade between desktop and mobile.
- Form state survives a device resize because the facade is provided on the
  wrapper.
- The public marketing nav and footer are hidden on mobile auth routes only;
  desktop auth keeps the existing nav and footer.
- Mobile inputs use email/tel input modes, autocomplete, 44px actions and a
  focused single-column card.

Verified:

- empty-form validation on sign-in and sign-up
- mobile auth shell renders without public nav/footer
- desktop sign-in still has the existing public nav/footer
- reset and verify states render their missing-token paths

## Marketing pages

```text
index/home|join|how-it-works|ora|about|faq-page/
  index.component.ts
  desktop/
  mobile/
```

- The landing mobile view composes the existing responsive marketing sections.
- Join keeps campaign/ref/lead capture in `JoinLandingFacade`; the mobile and
  desktop views share the same attribution and signup query params.
- Meet Ora uses `OraPublicFacade`, so the selected demo survives a resize.
- How-it-works, About and FAQ use their responsive marketing templates in
  dedicated mobile components.
- Mobile public pages keep the compact public nav and footer.

Verified at `390×844` and `1440×900`:

- no horizontal overflow on any public page
- correct mobile/desktop component per route
- Join referral/campaign chips and signup URL attribution
- Ora demo selection persisted across `1440 → 390`
- full CI green
