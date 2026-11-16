# Phase 4 — Pipeline, Team and Network

Phase 4 brings the daily relationship workspace onto mobile: prospects, the
pipeline board, mentoring queues, partner dossiers, teams and the network.
Desktop templates stay in `desktop/`; every route selects a dedicated mobile
view below 960px.

## Routes migrated

| Area | Routes | Pattern |
| --- | --- | --- |
| Prospects | `dashboard/prospects/pipeline`, `customer-leads`, `reminders`, `board`, `new`, `detail/:id`, `edit/:id` | Shared facade + desktop/mobile views |
| Team hub | `dashboard/team` | Shared facade + responsive mobile hub |
| Mentor onboarding | `dashboard/team/handoffs` | Shared facade + mobile card queue |
| Activation | `dashboard/mentorship/team/activation` | Shared facade + mobile training cards |
| Partners | `dashboard/mentorship/partners/my-partners` | Shared facade + mobile partner cards |
| Partner dossier | `.../my-partners/detail/:id` | Dedicated mobile shell over the responsive dossier |
| Partner prospects | `.../my-partners/contacts/:id`, `.../contact-detail/:id` | Dedicated mobile shells over the responsive list/detail |
| Teams | `dashboard/mentorship/team/members`, `new`, `member/:id`, `detail/:id` | Dedicated mobile shells over the responsive team views |
| Network | `dashboard/network/tree` | Mobile drill-down list with the same network reads |
| Org chart | `dashboard/network/org` | Dedicated mobile view of the generation chart |
| Member 360 | `dashboard/network/view/:id` | Dedicated mobile read-only member view |

`dashboard/team/handoffs` is also reachable from the sidebar as a top-level
team task route, so the route keeps its title, guard and data behaviour.

## Shared state

- Prospect, customer-lead, reminder, board, quick-add and prospect-detail
  facades are provided by their route wrapper. Data loads once with
  `ensureLoaded()` and survives a desktop/mobile view swap.
- Team hub, mentor handoffs and activation board use the same facade pattern.
- My partners owns list/filter/pagination/presence/activation-stamp state in
  one facade; both views read the same signals.
- Legacy operational containers (partner dossier, downlines, teams) keep their
  existing services and are mounted through device-aware mobile shells. Their
  templates were already responsive, so the shell avoids rewriting approved
  workflows while still giving each route a dedicated mobile entry point.
- The network tree mobile view uses the same `NetworkService` reads and keeps
  drill-down state locally. Desktop keeps the SVG tidy-tree.

## Mobile UX

- Pipeline hero actions stack, the referral link wraps, and no action bar
  clips at 390px.
- Tables become labeled cards; long names and usernames truncate with full
  values available on the detail page.
- Team hub metrics compact to three columns, priority rows become full-width
  tappable cards, and shortcuts use a two-column grid.
- Network tree replaces the wide SVG canvas with a breadcrumb-style drill-down:
  current member, direct partners, search across the loaded tree, and a 360
  link for every row.
- Touch targets are at least 44px on mobile actions, filters and form controls.
- Bottom padding keeps final actions above the fixed dashboard navigation.

## Verification

- `npm run build:platform` passes after each group.
- CDP checks at `390×844` and `1440×900` for:
  - pipeline, customer leads, reminders, board, quick-add, prospect detail,
    edit contact;
  - team hub, handoffs, activation board, my partners;
  - network tree, org chart, member 360.
- No horizontal document overflow at 390px on the checked routes.
- Desktop route titles, guards, lazy loading and API calls are unchanged.

Admin remains out of scope for this phase.
