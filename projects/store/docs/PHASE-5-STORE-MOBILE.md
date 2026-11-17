# Phase 5 — Store Mobile

The public store now selects a dedicated mobile entry point below 960px for
every route while preserving the existing desktop views. Customer flows stay
identical: search, storefront, product, cart, checkout, payment result, order
tracking, support, lead pages and legal pages.

## Routes covered

| Route | Mobile entry |
| --- | --- |
| `/` | Store home with stacked hero, full-width actions and single-column store cards |
| `/stores` | Store directory |
| `/support` | Support topics |
| `/cart` | Cart |
| `/checkout` | Checkout |
| `/checkout/result` | Payment result |
| `/order/:reference` | Order tracking |
| `/legal/terms`, `/privacy`, `/cookies` | Legal layout and policy pages |
| `/lead/:username` | Personal lead page |
| `/:username` | Partner storefront |
| `/:username/product/:productId` | Product detail |

## Mobile behaviour

- Store home no longer expands the layout viewport. The hero collapses to one
  column, actions become full-width, the category row scrolls inside its own
  band, and store/how cards stack.
- The store chrome continues to swap between the desktop and mobile headers
  without replacing the router outlet.
- Cart state remains in the existing `CartService` singleton, so adding a
  product and moving between store, cart and checkout keeps the same state.
- Product media, storefront sections, legal policy navigation and order
  tracking use the existing responsive templates behind their mobile entry
  points.
- Horizontal overflow is clipped at each page host so a scrolling category
  strip cannot widen the document.

## Verification

- `npm run build:store` passes.
- Checked at `390×844` and `1440×900`:
  home, directory, support, cart, checkout, payment result, order tracking,
  product, storefront, personal lead page and legal terms.
- No document-level horizontal scroll at 390px on the checked routes.
- Desktop markup, route titles and store API calls are unchanged.

Admin and platform-only routes are outside this phase.
