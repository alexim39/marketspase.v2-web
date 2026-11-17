# PWA, Install and Accessibility Polish

This pass closes the install, safe-area and keyboard/touch gaps left after the
route migrations. No route or business flow changed.

## PWA and install

- Platform keeps its existing `manifest.webmanifest` and `push-sw.js`; the
  manifest now also exposes a **Messages** shortcut.
- Store now has its own `manifest.webmanifest` with standalone display,
  maskable icons and Store/Stores/Cart/Support shortcuts.
- Store now registers `store-sw.js` in production for the offline shell. Dev
  builds unregister workers so stale chunks cannot survive HMR.
- Store index has the full install metadata: manifest link, application name,
  theme colour, Android/iOS capable flags and Apple status-bar style.
- Store captures `beforeinstallprompt` before Angular boots and exposes an
  **Install store app** action in the mobile menu when the browser offers it.
- Platform install actions stay where they were: desktop topbar, mobile More
  menu and the More hub install card.

## Safe areas

Applied `env(safe-area-inset-*)` to:

- platform mobile app bar horizontal padding;
- platform mobile content gutters;
- platform bottom navigation and drawer;
- Messages chat header and composer;
- store mobile header horizontal padding;
- store page gutters and footer;
- store cookie banner;
- existing sticky actions, sheets and mobile page shells already used the
  shared safe-area tokens.

`viewport-fit=cover` was already present in both apps.

## Accessibility

- Added a platform **Skip to main content** link as the first focusable item,
  with a visible focus ring.
- Platform mobile drawer is now an explicit modal dialog with a focus trap,
  `aria-modal="true"` and a `Primary navigation` label. Focus moves into the
  drawer on open and returns to the menu button on Escape/close.
- All visual primary buttons, FABs, filter chips and category chips are forced
  to a 44px minimum height on mobile. Material's 48px touch-target padding is
  retained.
- Messages mobile controls: back button 44×44, find-bar controls 44px, message
  action buttons 44px and send button 56px.
- Chat composer and header respect safe-area insets and remain above the fixed
  bottom navigation.
- Mobile form fields use a 16px minimum font size to prevent iOS zoom.
- Focus-visible outlines are retained globally; focused controls receive
  scroll margins so the sticky app bar and bottom navigation cannot cover them.

## Verification

- `npm run build:platform`, `npm run build:store` and `npm run ci` pass.
- Built output contains `platform/manifest.webmanifest`, `platform/push-sw.js`,
  `store/manifest.webmanifest` and `store/store-sw.js`.
- Keyboard audit: first Tab reaches the skip link with a 2px focus ring;
  drawer opens as a modal with focus inside; Escape restores focus to the menu
  button.
- Chat audit at 390px: opening a conversation sets `thread-open`, back target
  is 44×44 and the composer stays visible.
- Chrome DevTools Protocol in this environment does not expose safe-area
  emulation, so notch insets were checked statically and with zero-inset
  computed padding; a real-device pass is still recommended before sign-off.
