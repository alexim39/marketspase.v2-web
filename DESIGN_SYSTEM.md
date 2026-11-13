# MarketSpase Design System

Last verified: 2026-11-13.

One visual language for the platform, store and admin apps. Feature apps should
consume the shared tokens, Material theme and UI primitives instead of defining
their own colours, type scales or loading states.

## App personalities

- **Platform** — calm, focused workspace. Strong hierarchy, restrained chrome,
  clear cards and data surfaces.
- **Store** — editorial and spacious. Larger display type, wide gutters,
  image-led sections and a lighter border rhythm.
- **Admin** — spacious but scannable. Sticky table headers, clear row rhythm,
  generous page padding and fast visual scanning.

Linear/Vercel-style restraint is the reference: monochrome surfaces, crisp
typography, 1px borders, soft shadows and brand violet/teal used sparingly.

## Typography

| Role | Family | Usage |
| --- | --- | --- |
| Display | **Space Grotesk Variable** | Page titles, hero headings, card values, empty-state titles |
| UI / body | **Inter Variable** | Body copy, labels, navigation, tables, buttons, form fields |
| Data / code | **JetBrains Mono Variable** | Reference codes, audit IDs, technical values |

Space Grotesk gives MarketSpase a confident, modern editorial voice. Inter
keeps dense product and admin screens highly legible. The pairing is
deliberately restrained rather than decorative.

### Tokens

- `--ms-font-display`, `--ms-font-sans`, `--ms-font-mono`
- `--ms-text-2xs` … `--ms-text-xl`
- `--ms-display-sm`, `--ms-display-md`, `--ms-display-lg`
- `--ms-leading-tight`, `--ms-leading-body`
- `--ms-tracking-display`, `--ms-tracking-label`

Headings automatically use the display face. Body copy is 16px / 1.6.

## Spacing and shape

- Strict 8px layout grid: `--ms-space-1` (8px) through `--ms-space-10` (120px).
- 4px is reserved only for optical alignment inside icons, badges and compact
  controls where 8px would break density.
- Radii: `--ms-radius-sm` 8px, `--ms-radius-md` 10px, `--ms-radius-lg` 12px,
  `--ms-radius-xl` 16px, `--ms-radius-2xl` 24px, `--ms-radius-pill` 999px.
- Borders are always 1px using `--ms-line` or `--ms-line-strong`.
- Elevation: `--ms-shadow-sm`, `--ms-shadow-md`, `--ms-shadow-lg`,
  `--ms-shadow-glow`. No heavy or coloured shadows.
- Controls keep a 44px minimum touch target; primary actions are 48px high.
- Page widths: `--ms-content-lg` (1280px) for storefronts and platform pages;
  admin uses a 1500px max-width with 32px gutters.
- Mobile gutters step down to 24px and then 16px.

## Themes

Colour and surface tokens live in `projects/shared/styles/_tokens.scss` for both
`html[data-theme="light"]` and `html[data-theme="dark"]`. Never hardcode surface
colours in feature components; use semantic tokens (`--ms-surface`,
`--ms-text-muted`, `--ms-primary-strong`, `--ms-success`, etc.).

The user-facing theme choice (Light / Dark / System) lives in **More → Settings →
Appearance** (`/dashboard/settings/appearance`) in the platform app. The store
and admin expose their own switchers; all use the shared `ThemeService`.

## Component rules

- **Buttons:** 40px default height, 48px primary height, 12px radius, 16px
  horizontal padding. Use one primary action per surface.
- **Cards:** 1px border, 12px radius, 24px padding, soft shadow. Avoid nested
  cards; use dividers or tinted surfaces instead.
- **Tables:** 48px header, 56px rows, 16px × 24px cells, uppercase 11px headers.
  Hover uses `--ms-surface-2`; no zebra striping by default.
- **Dialogs:** 16px radius, no extra surface padding when the dialog paints its
  own hero, soft shadow, mobile bottom-sheet treatment under 600px.
- **Forms:** 12px field radius, always-visible labels, 48px control height,
  one clear helper or error line.
- **Status:** chips are pill-shaped, sentence case, and use semantic soft
  backgrounds. Colour is never the only signal; include a label or icon.

## Material forms

All three apps provide `MAT_FORM_FIELD_DEFAULT_OPTIONS` with
`floatLabel: 'always'`. Labels stay on the outline when a value is written
programmatically, so prefilled profile and checkout fields never collide with
their labels.

## Skeletons

Use `async-page-skeleton` for page-level loading. It mirrors the real page shape
instead of showing a generic progress bar or spinner.

```html
<async-page-skeleton
  layout="dashboard"
  [rows]="4"
  [showHeader]="false"
  label="command centre"
/>
```

Available layouts:

`dashboard`, `wallet`, `list`, `table`, `cards`, `storefront`, `product`,
`form`, `checkout`, `profile`, `result`, `board`, `inbox`, `network`.

- Use `board` for Kanban and activation boards, `inbox` for messaging and chat
  surfaces, and `network` for org/tree views.
- Use `[showHeader]="false"` when the real page header is already visible and
  only the data region is loading.
- Keep action-level progress (uploads, sending a message) as a progress bar;
  skeletons are for page/content loading.
- The skeleton has a status role and a visually hidden live label for assistive
  technology.

## State language

Every non-happy path answers **what happened, why, and what to do next**.

- `async-state-panel` — one surface for empty, error, offline, permission,
  session, search, slow and success states. Always include a reason and a next
  step where the state is not self-explanatory.
- `async-error-state` — rich inline error for a page or panel. Project a retry
  or back action into the slot.
- `async-empty-state` — lightweight empty content with a clear action.
- `async-field-error` — inline validation under a Material field. Pass the
  `AbstractControl`; it waits until the user has interacted, then names the
  exact problem and how to fix it.
- `async-connection-banner` — shared offline/slow/lite/cached surface.

### Connectivity

`NetworkStatusService` tracks real request activity and exposes offline, slow,
progress and lite-mode state. `httpCacheInterceptor` keeps successful GET
responses in session storage and serves them only when the network cannot
reach the API; mutations, identity and payment endpoints are never cached.
The banner explains what still works offline and offers a real lite mode.
Lite mode disables animation/backdrop effects and hides heavy embeds marked
with `.ms-lite-hide`.

### Session recovery

`sessionExpiryInterceptor` captures named form fields before redirecting an
expired session to sign-in. `SessionRecoveryService` restores those values when
the user returns to the same route after signing in. Passwords, payment fields
and named sensitive values are never stored. The sign-in surface explains what
was saved and why the session ended.

### Forms

All apps use `MAT_FORM_FIELD_DEFAULT_OPTIONS` with `floatLabel: 'always'` so
labels never overlap programmatically filled values. Add `async-field-error`
under required fields for precise, friendly corrections.

## Reusable UI

`projects/shared/ui` contains:

- `async-brand-logo`
- `async-page-header`
- shared shell navigation tokens
- `async-stat-card`
- `async-page-skeleton`
- `async-progress-ring`
- `async-status-chip`
- `async-empty-state`
- `async-state-panel`
- `async-error-state`
- `async-field-error`
- `async-connection-banner`

Use these before building a one-off card, header, status pill, empty state,
error surface or loading screen.

