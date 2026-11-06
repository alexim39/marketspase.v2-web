# Catalog content fields

The product editor in **Admin → Products** controls what shoppers see.

## Identity and placement

- **Name** — card and product page title.
- **Category** — category chips and search grouping. Defaults to Essentials.
- **SKU** — internal reference; not shown to buyers.
- **Sort order** — lower numbers appear earlier in the catalog.
- **Featured** — raises a product in the recommended order and adds a badge.
- **Status** — only active products appear in the shop; inactive and archived
  rows stay for order history.

## Pricing and inventory

- **Price** — the retail price for personal purchases.
- **COGS / shipping cost** — platform cost basis for margin and commission.
- **Partner price / suggested retail** — resale terms.
- **Stock** — numeric stock is enforced; blank means unlimited.
- **Commission** — unilevel payout switch; requires COGS above zero.

## Storefront copy

- **Short description** — one line for the catalog card and search results.
- **Description** — full product page copy. Plain text or HTML.
- **Primary image** — image URL or filename/slug under `public/img/products`.
- **Gallery images** — up to 8 URLs or slugs, one per line. The primary image
  is always shown first.
- **Benefits** — up to 8 short lines, one per line.
- **How to use** — product page guidance.
- **Delivery and returns note** — product-specific delivery expectations.

## Where each field appears

| Field | Catalog card | Product page | Resale hub |
|---|---|---|---|
| Short description | yes | yes | yes |
| Description | — | yes | — |
| Primary image | yes | yes | yes |
| Gallery | — | yes | — |
| Benefits | — | yes | — |
| How to use | — | yes | — |
| Delivery note | — | yes | — |
| Partner price | — | — | yes |
| Suggested retail | — | — | yes |

## Guidance

- Keep the short description under 120 characters for clean cards.
- Benefits should be factual; do not invent health claims.
- Gallery images should be square or landscape with a consistent background.
- Check the product page after saving to confirm the fallback copy reads well.
