# Mobile Route / QA Audit

Local audit of the migrated platform and store routes after the PWA,
safe-area and accessibility pass.

## Coverage

- **Platform at 390×844 (26 routes):** dashboard, pipeline hub, prospect
  pipeline, team hub, messages, wallet, products, Academy, course list,
  community, community feed, notifications, goals, insights, profile settings,
  trust centre, content library, Ora, network tree, org chart, campaigns,
  promote, Learn, More, launch path and activation.
- **Store at 390×844 (8 routes):** home, directory, support, cart, checkout,
  storefront, personal lead page and legal terms.
- **Platform at 960×900 (5 routes):** dashboard, prospect pipeline, messages,
  course list and network tree.
- **Store at 960×900 (3 routes):** home, storefront and legal terms.

## Result summary

| Check | Result |
| --- | --- |
| Document-level horizontal overflow | **0 routes** |
| Empty/unrendered pages | **0 routes** |
| Missing manifest link | **0 routes** |
| Broken document titles | 0 observed |
| Drawer modal + focus trap | Pass |
| Drawer focus restoration on Escape | Pass |
| Skip-link first-tab focus ring | Pass |
| Chat one-pane + back button 44×44 | Pass |
| Chat composer visible above bottom nav | Pass |
| Store service worker/manifest in build | Pass |
| Platform service worker/manifest in build | Pass |

## Touch-target notes

- Primary Material buttons, FABs, filter chips and category chips now measure
  at least 44px high on mobile.
- Back, find, message-action and send controls in Messages are 44–56px.
- Remaining sub-44 measurements in the sweep are inline text links and some
  visual 40px Material buttons whose real hit area is the Material 48px touch
  target pseudo-element.

## Safe-area notes

`Emulation.setSafeAreaInsets` is not available in the installed headless Chrome,
so a true notch simulation could not be run. Safe-area rules were verified in
source and with zero-inset computed styles. Real-device checks recommended:
iPhone portrait + landscape, Android gesture navigation, installed PWA mode.

## Still to verify on production

1. Deploy the latest platform and store builds.
2. Hard-refresh on a phone and repeat the route sweep.
3. Confirm install prompt/menu behaviour on Android Chrome and iOS Safari.
4. Verify payment checkout and order tracking on the deployed API.
