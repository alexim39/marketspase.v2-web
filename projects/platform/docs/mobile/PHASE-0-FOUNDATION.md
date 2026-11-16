# Mobile foundation (Phase 0)

This phase adds the device layer and native chrome used by the page-by-page
mobile migration. It does **not** convert individual page content yet; the
existing desktop pages remain in place until their mobile counterpart lands.

## Device contract

`DeviceService` lives in `projects/shared/core/ui/device.service.ts`.

| Viewport | Device class | Rendered view |
| --- | --- | --- |
| `< 600px` | `mobile` | mobile |
| `600px – 959.98px` | `tablet` | mobile |
| `>= 960px` | `desktop` | desktop |

`DeviceService.type()` and `orientation()` are signals. `isMobileView()`
returns true for both phone and tablet. The initial value is read
synchronously from the viewport so the first paint does not flash the wrong
layout.

## Wrapper convention

Each routed page will become:

```text
feature/page/
  index.component.ts          # @if (device.isMobileView())
  desktop/                    # existing page, moved unchanged
  mobile/                     # new native mobile page
  state/                      # shared facade/form/view-model logic
```

The wrapper provides the page facade so a resize across the 960px boundary
swaps only the view component. The facade survives, and its idempotent
`ensureLoaded()` prevents duplicate API calls.

## Stable chrome outlets

The dashboard, public platform and store keep **one** router outlet. Only the
chrome around it changes:

- Dashboard: `async-desktop-dashboard-topbar` /
  `async-mobile-dashboard-topbar` + `async-mobile-dashboard-bottom-nav`.
- Public platform: `async-nav` / `async-mobile-public-nav`.
- Store: `async-site-header` / `async-mobile-store-header`.

Do not create separate shell components with their own `<router-outlet>`.
That remounts the routed page and repeats API calls on resize.

## Shared mobile primitives

Available from `projects/shared/ui`:

- `async-mobile-page-shell`
- `async-mobile-card`
- `async-mobile-sticky-action`
- `async-mobile-segmented-tabs`
- `async-mobile-action-sheet`

The shared `_mobile.scss` file adds:

- `--ms-mobile-appbar-height`, `--ms-mobile-bottom-nav-height`
- `--ms-touch-target: 44px`
- safe-area tokens (`--ms-safe-top/right/bottom/left`)
- `ms-touch-target`, `ms-mobile-scroll`, `ms-sheet-open` helpers

The project does not use Tailwind; use the SCSS mixins/helpers rather than
utility classes.

## Verification gates

Each page slice must pass:

- desktop parity at `>= 960px`
- phone at `390×844`
- tablet at `768×1024`
- exact `959px` / `960px` boundary
- no horizontal overflow
- 44px minimum touch targets
- no duplicate API calls when resizing
- guarded actions/forms work end to end
- `npm run ci`

Phase 0 verification used the local dashboard with a short-lived admin token:
the Home component stayed mounted while the chrome switched, and the API call
count remained unchanged.
