# Nav Mapping (Current -> New IA)

Target IA: **Home**, **Pipeline**, **Team**, **Campaigns**, **Wallet**, **Learn**, **Community**, **More**. Mobile bottom nav has 5 items: **Home, Pipeline, Team, Wallet, More**.

## Implemented IA pass (2026-11-04)

- Primary group labels now link to their hub; the chevron opens a smaller submenu.
- Removed repeated “Overview” children and all transient steps/actions.
- Submenu links reduced from **58 to 32**.
- Added section labels: **Workspace**, **Connect**, **Account**.
- Added one-line descriptors under every primary label when the rail is expanded.
- Only one section expands at a time; the active route auto-opens its section.
- Mobile bottom nav fixed to Home, Pipeline, Team, Wallet, More.
- Secondary destinations moved onto hub cards rather than the rail.
- Hub shortcut links were made absolute so they resolve under `/dashboard/*`.

## Mapping
| New Primary | Old Sources | Notes |
| --- | --- | --- |
| **Home** | `/dashboard`, `activate` nudge, alerts/notifications summary | Command Center with next-best-action, activation status, wallet snapshot, team pulse, activity. Keep `activate` as a prominent CTA when `accountState === 'member'`. |
| **Pipeline** | `prospects/*` (reminders, pipeline, board, customer-leads, bookings, kits) | Consolidate follow-ups, deal board, leads, sessions, presentations. Buy prospect retired; page leads replaced by Customer Leads and pipeline referral signups. |
| **Campaigns** | `tools/campaigns/*`, `campaigns` (fund growth), `marketing/roi`, `resources/ads-contents`, `resources/prospecting-contents`, `tools/sms/*`, `tools/email/*` | Merge into Campaign Studio. Central funding + attribution + ROI + share hub + outreach. |
| **Team** | `mentorship/*`, `network/*`, `cell-meeting` | Activation board, partners, tree/org, teams, coaching. |
| **Wallet** | `wallet/*`, `products/*`, `compensation`, `earnings/*` | Balance, deposits/withdrawals, transactions, commissions, shop, orders. Fold compensation/earnings here. |
| **Learn** | `training/*`, `progress/*`, `goals/*` | Academy, courses, paths, tutorials, library, level/targets, coach analytics. |
| **Community** | `community/*`, `messages/*` | Feed, events, DMs. |
| **More** | `settings/*`, `insights/*`, `support/*`, `ora`, `notifications/preferences`, admin entry | Secondary utilities. Admin moves to separate Admin mode/rail (not inside partner rail). |

## Redirect Strategy
| Old Path Pattern | New Path (proposed) | Rationale |
| --- | --- | --- |
| `/dashboard/mentorship/team/activation` | `/dashboard/team/activation` or under Team tab | Consolidate under Team |
| `/dashboard/tools/campaigns/new` | `/dashboard/campaigns/studio` (or `/dashboard/campaigns/new`) | Campaign Studio |
| `/dashboard/tools/campaigns/manage` | `/dashboard/campaigns` | My campaigns |
| `/dashboard/marketing/roi` | `/dashboard/campaigns/roi` | Under Campaigns |
| `/dashboard/compensation` | `/dashboard/wallet/compensation` | Under Wallet |
| `/dashboard/wallet` | `/dashboard/wallet` | Keep (already under Wallet) |
| `/dashboard/network/tree` | `/dashboard/team/tree` | Under Team |
| `/dashboard/training` | `/dashboard/learn` | Under Learn |
| `/dashboard/community` | `/dashboard/community` | Keep |
| `/dashboard/notifications/center` | Global (shell) or `/dashboard/more/notifications` | Shell accessible |
| `/dashboard/admin/*` | Admin mode (`/admin/*` or in-app Admin rail) | Separate surface |

## Notes
- Keep all existing routes working via redirects initially. Feature flag controls shell only.
- Bottom nav on mobile: Home, Pipeline, Team, Wallet, More (Campaigns/Learn/Community via the drawer).
- Command palette should search across all destinations regardless of rail.
- Admin access remains permission-gated; show Admin entry in topbar/More only for admins.
