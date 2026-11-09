# Route Inventory (Current -> Target)

This is the baseline to use for redirects when swapping to the new shell. Generated from `platform/src/app/dashboard/partner/dashboard.routes.ts` and known child routes.

> Status: `keep` = migrate to new IA with minimal changes, `consolidate` = merge under new primary destination, `relocate` = move to different section, `retire/redirect` = likely superseded by new model

## Root
| Path | Component/Loader | Auth | Notes | Status |
| --- | --- | --- | --- | --- |
| `/dashboard` | `HomeComponent` | `authGuard` | Command center candidate. Becomes "Home" in new IA. | `keep` |
| `/dashboard/activate` | `ActivationComponent` (lazy) | `authGuard` | Core to new model. Needs to live in a prominent spot (Home/More or its own flow). | `keep` |
| `/dashboard/campaigns` | `CampaignsComponent` (lazy) | `authGuard` | New "Fund growth campaign" flow. Consolidate with marketing tools. | `consolidate` |
| `/dashboard/compensation` | `CompensationComponent` (lazy) | `authGuard` | Move under "Wallet" or "Learn/Team" depending on emphasis. | `relocate` |
| `/dashboard/classic` | `redirectTo: /dashboard/mentorship/partners/my-partners` | `authGuard` | Already redirected. | `retire/redirect` |
| `/dashboard/search` | `redirectTo: /dashboard/mentorship/partners/my-partners` | `authGuard` | Already redirected. | `retire/redirect` |
| `/dashboard/checkout` | `CheckoutComponent` (lazy) | `authGuard` | Keep under Wallet/Products flow. | `keep` |
| `/dashboard/cell-meeting` | `CellMettingContainerComponent` (lazy) | `authGuard` | Belongs to Team/Coaching. | `consolidate` |
| `/dashboard/contact-analytics` | `redirectTo: /dashboard/insights/contact-analytics` | `authGuard` | Already redirected. | `retire/redirect` |

## Feature Modules
| Base Path | Module Routes | Notes | Status |
| --- | --- | --- | --- |
| `/dashboard/settings` | `settings.routes` | Profile, public page, notifications etc. Move to "More" or topbar context. | `consolidate` |
| `/dashboard/resources` | `resources.routes` | Ads contents, prospecting guides. Belongs to "Campaigns/Share". | `consolidate` |
| `/dashboard/mentorship` | `mentorship.routes` | Team coaching, partners, teams. Core to "Team". | `consolidate` |
| `/dashboard/products` | `products.routes` | Eshop, orders, checkout. "Wallet & Marketplace". | `consolidate` |
| `/dashboard/prospects` | `prospects.routes` | Pipeline, board, reminders, bookings, kits, lists. "Pipeline". | `consolidate` |
| `/dashboard/tools` | `tools.routes` | Campaign creation, SMS/Email, contacts. Largely "Campaigns" + "Pipeline". | `consolidate` |
| `/dashboard/support` | `support.routes` | Tickets, about. "More/Support". | `consolidate` |
| `/dashboard/admin` | `admin.routes` | Large admin surface. Needs separate rail/mode. | `keep-separate` |
| `/dashboard/network` | `network.routes` | Tree/org. "Team". | `consolidate` |
| `/dashboard/notifications` | `notifications.routes` | Center + preferences. Global in new shell. | `keep` |
| `/dashboard/goals` | `goals.routes` | My targets. "Learn" or "Home". | `consolidate` |
| `/dashboard/insights` | `insights.routes` | Business health, reports. "More/Insights". | `consolidate` |
| `/dashboard/messages` | `messages.routes` | DMs. "Community". | `consolidate` |
| `/dashboard/earnings` | `earnings.routes` | Earnings views. Fold into "Wallet/Compensation". | `consolidate` |
| `/dashboard/progress` | `progress.routes` | Level & next steps. "Learn". | `consolidate` |
| `/dashboard/training` | `training.routes` | Academy, courses, paths, coach. "Learn". | `consolidate` |
| `/dashboard/wallet` | `wallet.routes` | Wallet, history, deposits/withdrawals. "Wallet". | `consolidate` |
| `/dashboard/community` | `community.routes` | Feed, events. "Community". | `consolidate` |
| `/dashboard/marketing` | `marketing.routes` | ROI. "Campaigns". | `consolidate` |
| `/dashboard/ora` | `ora.routes` | AI assistant. Global/widget or "More/Support". | `keep-global` |

## Notes
- Many entries under `tools/*` and `marketing/*` overlap. The redesign wants to collapse these into the "Campaigns" studio.
- "Buy prospect" (`prospects/general-list`) was retired in batch 4. The partner lead surface is Customer Leads (`prospects/customer-leads`); the old `personal-list` route redirects there.
- Admin must not live inside the partner rail. Move to a dedicated Admin mode with its own nav. 
- `notifications/center` and `notifications/preferences` should be accessible from the new shell topbar regardless of primary nav.
