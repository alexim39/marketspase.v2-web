# MarketSpase Store — product and technical specification

Status: **confirmed direction, ready for implementation planning**.

## 1. Product definition

MarketSpase Store is the public commerce channel for MarketSpase partners.

- Every verified partner can have a personal store at `/{username}`.
- Partners buy stock from the platform at partner price.
- The platform waybills/ships that stock to the partner’s address.
- The partner holds the physical inventory.
- The partner chooses which received stock to publish in their store, and at what retail price.
- Partners may sell entirely offline and never publish a store. That is a valid choice.
- Customers buy from a partner’s store; the partner self-fulfils and delivers.
- MarketSpase processes payment and holds it in escrow until delivery is confirmed.

The store is a public storefront. Partner operations live in the platform, not in the store app.

## 2. Confirmed decisions

| Area | Decision |
|---|---|
| Inventory | Partner-owned stock, purchased at wholesale/partner price |
| Wholesale delivery | Platform ships/waybills purchased stock to the partner’s address |
| Wholesale delivery cost | Platform-funded in v1 and included in the partner-price margin; revisit if carrier costs rise |
| Store inventory credit | After the partner confirms receipt of the wholesale order |
| Publishing | Stock becomes a draft listing; partner chooses to publish. Optional auto-publish toggle, default off |
| Fulfilment | Partner self-fulfils and delivers |
| Customer delivery fee | Set by the partner, paid by the customer and passed through to the partner; not part of the 2% fee |
| Payment | Customer pays MarketSpase via Paystack; escrow until delivery/return window |
| Settlement | Retail proceeds minus payment fee and store service fee go to the partner wallet |
| Store fee | 2% of merchandise at launch, configurable, not charged on delivery fees |
| Escrow release | After delivery plus a configurable 7-day return window |
| Store discovery | MarketSpase Store directory at `/`; each product links to a partner store |
| Personal lead page | Separate shareable page at `/lead/{username}` with a lead form into the partner's pipeline |
| Signup attribution | Page-specific “Join my team” buttons use `/join?ref={username}`; global header/footer links are still unattributed |
| Multi-store cart | No. One store per checkout |
| Unilevel commission | No additional unilevel payout on the store retail sale; partner keeps the retail margin |
| Brand | Remove all Diamond Project content; MarketSpase Store only |
| Ports | Platform `4200`, store `4201`, admin `4202` |

## 3. Actors

- **Customer** — discovers a partner store, buys, tracks delivery, requests returns.
- **Partner** — buys wholesale stock, receives it, publishes listings, prices, fulfils orders, earns.
- **Platform admin** — ships wholesale orders, approves stores, resolves disputes, releases payouts.
- **System** — syncs inventory, reserves stock, calculates fees, sends notifications, reconciles payments.

## 4. Inventory lifecycle

```text
Platform catalog stock
        │
        ▼
Partner buys at partner price
        │
        ▼
Platform reserves stock and ships to partner address
        │
        ▼
Partner confirms receipt in platform
        │
        ▼
Partner store inventory credited
        │
        ├── Partner publishes listing ──► Store stock
        │
        └── Partner keeps it offline ──► No listing
```

Rules:

- Only **resale** lines from the wholesale order become store inventory. Personal-use lines do not.
- A wholesale order can contain both personal and resale lines.
- Store inventory is credited only after partner receipt confirmation or an admin override.
- Publishing is always a partner decision. `auto-publish` is an opt-in setting, default **off**.
- If a wholesale order is cancelled or refunded before receipt, no store inventory is credited.
- If a wholesale order is refunded after receipt, the platform must reconcile store stock and pause listings if stock becomes negative.
- Every stock movement writes an `inventory_ledger` row: purchase, receipt, publish, sale, cancellation, return, adjustment.

## 5. Partner journeys

### 5.1 Partner buys stock

1. Partner opens **Products → Resell**.
2. Selects products and quantities.
3. Checkout uses partner price and the partner’s delivery address.
4. Wallet is debited.
5. Wholesale order is created with `saleMode: resale`.
6. Platform admin sees the order in the wholesale queue.
7. Admin fulfils/ships and enters carrier/waybill details.
8. Partner sees tracking in platform.

### 5.2 Partner receives stock

1. Partner receives the shipment.
2. Opens **Store → Stock received**.
3. Confirms quantities received.
4. System credits store inventory and creates draft listings.
5. Partner sees: “3 products ready to publish.”

### 5.3 Partner publishes listings

1. Opens **Store → Listings**.
2. Reviews draft listings:
   - Product content inherited from platform
   - Partner price
   - Suggested retail
   - Partner retail price
   - Margin
   - Stock
3. Sets retail price, optional bundle, visibility.
4. Publishes one or more listings.
5. Store becomes publicly visible once it has at least one published product.
6. Partner copies store link, product links, QR code and captions.

Partners who want to sell offline simply never publish. Their store remains private.

### 5.4 Partner fulfils a store order

1. New order notification in platform.
2. Opens **Store → Orders**.
3. Sees items, customer, address, delivery fee, earnings.
4. Accepts the order.
5. Ships and enters tracking/delivery note.
6. Marks **Shipped**.
7. Marks **Delivered** or delivery is auto-confirmed after the delivery window.
8. Earnings move from Pending to Released after the return window.

### 5.5 Partner gets paid

Escrow calculation per order:

```text
customer merchandise total
+ delivery fee
− Paystack/payment processing fee
− 2% store service fee on merchandise only
= partner earnings
```

- Partner earnings are `Pending` until delivery.
- Released after delivery + 7-day return window.
- Credited to the partner wallet.
- Partner withdraws through existing billing.
- Refunds and returns reverse the relevant earnings.

## 6. Customer journeys

### 6.1 Discover

- Partner shares `marketspase.com/{username}` on WhatsApp, TikTok, Instagram, X or QR.
- MarketSpase Store home `/` features partner stores and categories; products link to the partner store.
- No multi-vendor cart in v1.

### 6.2 Browse

- Store home: partner brand, story, featured products, categories, reviews, delivery/returns.
- Shop page: search, category, sort, stock.
- Product page: gallery, price, stock, delivery estimate, benefits, how to use, reviews, partner card, share, add to cart.

### 6.3 Buy

1. Add to cart.
2. Cart: quantity, subtotal, delivery estimate.
3. Checkout:
   - Guest checkout by default
   - Name, phone, email
   - Delivery address
   - Delivery method/fee set by partner
   - Paystack payment
   - Order summary
4. Payment success:
   - Order created
   - Partner stock reserved
   - Partner notified
   - Customer sees confirmation and tracking link.

### 6.4 Track and return

- Order page shows Placed → Processing → Shipped → Delivered.
- Customer can contact the partner via WhatsApp.
- Return request within the partner’s return window.
- Partner/admin approves; refund via Paystack; stock restored if resellable.

## 7. Store information architecture

```text
/                          MarketSpase Store home + directory
/stores                    Find a partner store
/{username}                Partner store home
/{username}/shop           All products
/{username}/product/:slug  Product detail
/{username}/cart           Cart
/{username}/checkout       Checkout
/{username}/order/:no      Confirmation and tracking
/lead/{username}           Shareable personal lead page (story, contact, form, join CTA)
/track                     Guest order lookup
/legal/*                   Terms, privacy, cookies, returns
/support                   Help
```

The existing `/:partnerUsername` route becomes the store slug so old shared links keep working. The personal page is a separate route and must never replace the store link.

## 8. Page-by-page wireframe plan

### 8.1 `/` — MarketSpase Store home

- Header: MarketSpase logo, Store directory, Become a partner, support.
- Hero: “Shop independent. Powered by MarketSpase.”
- Featured partner stores.
- Shop by category.
- Trending products (each opens the owning partner store).
- How it works: discover → buy → track.
- Trust: verified partners, secure payment, delivery protection.
- Partner CTA: open your store / sign in.

### 8.2 `/stores` — Store directory

- Search by store name, category or location.
- Featured stores.
- Store cards: logo, name, tagline, categories, verified badge.
- Empty state when no stores match.

### 8.3 `/{username}` — Partner store home

- Partner header: logo, store name, verified badge, search, cart.
- Hero: banner, tagline, story, “Shop now”.
- Featured products.
- Category shelves.
- Bundles / offers.
- Reviews / social proof.
- Delivery and returns summary.
- WhatsApp/contact.
- “Join {name}'s team” CTA to `{platformUrl}/join?ref={store-slug}`.
- Store footer: policies, MarketSpase badge.

### 8.3.1 `/lead/{username}` — Personal lead page

- Partner identity: photo, name, handle, job title, short bio, hero badge.
- Headline, business tagline, sub-headline.
- CTAs: “Start the conversation” (scrolls to the form without leaving the page),
  WhatsApp chat, WhatsApp group and “Join my team” (`/join?ref={username}`).
- Story, achievements, opportunity points, testimonial, video testimonial link,
  invite note.
- Lead form: name, surname, phone, email, state, message and required consent.
  Submissions create a `Prospect` with source `Personal Page` in the partner's
  pipeline; they do not create a Partner account.
- Direct contact strip: phone, email, store link and join CTA.
- Social links: Facebook, Instagram, TikTok, X, LinkedIn, YouTube.
- The page must render every field saved in the platform landing-page editor.

### 8.4 `/{username}/shop`

- Search, category chips, sort.
- Product grid with quick add, stock, price.
- Empty and error states.
- Mobile: two-column grid; sticky cart.

### 8.5 `/{username}/product/:slug`

- Image gallery.
- Name, price, stock, short benefit.
- Quantity.
- Add to cart / Buy now.
- Delivery estimate and returns.
- What’s included / how to use.
- Verified reviews.
- Partner card and WhatsApp.
- Share product.
- Related products.

### 8.6 Cart

- Line items, quantity, remove.
- Subtotal.
- Delivery estimate.
- Checkout CTA.
- Empty state with “Continue shopping”.

### 8.7 Checkout

- Contact details.
- Delivery address.
- Delivery method/fee.
- Payment: Paystack (card, transfer, USSD).
- Order summary with fees.
- Optional consent to be contacted about the order/offers.
- Place order.
- Guest checkout; optional account creation after purchase.
- A checkout upserts the shopper into the partner's **Customer Leads** list
  (`store_customer_leads`) by partner + normalized phone, including orders that
  are still pending payment. Payment and refund stats update as the order
  progresses. This is separate from the prospect pipeline.

### 8.8 Order confirmation and tracking

- Order number.
- Status timeline.
- Items and totals.
- Delivery address and partner contact.
- Track shipment.
- Request return.
- Buy again.
- Support.

### 8.9 `/track`

- Order number + phone/email lookup.
- No login required.

## 9. Partner cockpit inside the platform

Add **Store** under Products:

- **Overview** — store link, QR, readiness, new orders, low stock, earnings.
- **Stock received** — confirm wholesale deliveries and credit store inventory.
- **Listings** — draft/published/paused, price, margin, stock, publish.
- **Store orders** — accept, ship, deliver, refund, tracking.
- **Payouts** — pending, released, fees, withdrawal.
- **Store settings** — name, story, logo/banner, delivery zones, return policy, WhatsApp, auto-publish.
- **Analytics** — visits, conversion, top products, repeat customers, margin.

## 10. Admin app — port 4202

- Store approvals and suspensions.
- Wholesale shipping queue and waybill entry.
- Store product moderation.
- Store orders and disputes.
- Returns and refunds.
- Payout releases and holds.
- Store service-fee reporting.
- Reviews and abuse.
- Featured stores/categories.
- SEO/content.
- Platform-wide store analytics.

## 11. API and data model

New domains:

- `stores`
- `store_products`
- `store_inventory_ledger`
- `store_orders`
- `store_customer_leads`
- `store_payments`
- `store_payouts`
- `store_returns`
- `store_reviews`
- `store_promotions`

Critical events:

- `wholesale.order.paid` → reserve platform stock, create wholesale order
- `wholesale.order.shipped` → tracking available to partner
- `wholesale.order.received` → credit partner store inventory, create draft listings
- `store.order.paid` → reserve partner store stock, create order, notify partner, upsert Customer Lead
- `store.order.refunded` → refund/chargeback, update Customer Lead payment totals, reverse earnings
- `store.order.fulfilled` → notify customer, start payout clock
- `store.order.delivered` → start return window
- `store.order.cancelled` → refund, restore stock, reverse earnings
- `store.payout.due` → credit partner wallet

Public endpoints must be read-only and rate-limited. Partner/admin endpoints require auth and ownership checks. Payment webhooks must be idempotent.

## 12. Brand and design system

- Brand: MarketSpase Store. Remove all Diamond Project names, logos, imagery, legal copy, metadata and old partner-page content.
- Audience: 18–35; mobile-first, image-led, minimal copy, fast checkout.
- Visual system: MarketSpase indigo/purple, ink and white, Bricolage Grotesque + Manrope + JetBrains Mono, 12–16px radii, subtle motion.
- Commerce patterns: quick add, slide cart, sticky mobile buy bar, one-page checkout, order timeline.
- Trust: verified partner badge, secure Paystack, delivery estimates, returns, verified reviews, WhatsApp support.
- Accessibility: 44px targets, contrast, keyboard, reduced motion.
- SEO: SSR or prerender for store and product pages, OG images, structured data, sitemap. Do not ship the store as a pure SPA.

## 13. Rebrand scope (completed)

At least 29 source files referenced Diamond Project at the start. The rebrand was completed across:

- `src/index.html`, titles and metadata
- Header, footer, home, about, FAQ, contact, events, partner pages
- Legal terms, privacy and cookies
- Get-started survey and Diamond campaign content
- Images, logos, OG images, favicons
- Dialogs and email/WhatsApp copy
- Redirects for retired Diamond routes

The Diamond `get-started` survey has been retired/redirected to MarketSpase partner signup. The store app does not carry Diamond Project lead-generation pages.

## 14. Delivery phases

**Phase 0 — foundations**
- Store data model and API contracts
- Brand tokens and content inventory
- Rebrand plan and route removal

**Phase 1 — storefront MVP**
- MarketSpase Store home and directory
- Partner store home, catalog, product page
- Cart, checkout with Paystack sandbox
- Order confirmation and tracking
- Rebrand all public pages

**Phase 2 — partner operations**
- Wholesale receipt confirmation
- Store inventory credit and draft listings
- Publish/pause, retail pricing, stock
- Store orders, fulfilment, tracking
- Escrow ledger and payout release
- Returns/refunds

**Phase 3 — growth**
- Reviews
- Bundles and discounts
- Share kit, QR, captions
- Abandoned cart recovery
- Featured stores
- SEO/SSR optimization

**Phase 4 — advanced commerce**
- Platform-fulfilled/dropship listings
- Delivery integrations
- Multi-warehouse stock
- Recommendations
- Full admin app on `4202`

## 15. Success metrics

- Partner store activation rate
- Time from stock receipt to first published listing
- Time to first sale
- Store conversion rate
- Average order value
- Repeat purchase rate
- Delivery SLA
- Refund/dispute rate
- Partner payout time
- Share-link click-through rate

## 16. Phase 1 acceptance criteria

- Public store home, directory, partner store, catalog and product pages render in MarketSpase branding.
- No Diamond Project text, logo or metadata remains in the store routes.
- A partner’s published products are visible only in that partner’s store.
- Stock cannot be oversold.
- Guest checkout works end to end in Paystack test mode.
- Orders can be tracked without signing in.
- Partner stock is separate from platform stock.
- Mobile layouts pass at 360px, 390px, 768px and desktop.
- Production build passes and store tests pass.
