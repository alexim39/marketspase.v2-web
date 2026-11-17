# Phase 6 — Notifications, Goals, Insights and Progress

This phase brings the reporting and self-management screens behind the same
device-aware routing used by earlier mobile phases. Desktop views stay in
place; each route gets a dedicated mobile entry below 960px.

## Routes migrated

| Area | Routes |
| --- | --- |
| Notifications | `dashboard/notifications/center`, `dashboard/notifications/preferences` |
| Goals | `dashboard/goals` |
| Insights | `dashboard/insights`, `dashboard/insights/my-business`, `dashboard/insights/downloads` |
| Progress | `dashboard/progress` |

## Mobile behaviour

- Notifications summary becomes a compact 2×2 grid instead of a stacked list.
- Notification bulk actions wrap into a 2×2 touch grid with 44px targets.
- Insights highlights use the same 2×2 summary grid and retain the action
  center, funnel and team-health panels below.
- Notification preferences keep their per-category channel controls in
  full-width cards.
- Goals, My Business, Reports and Progress reuse their responsive content
  inside dedicated mobile entry points.
- Each mobile shell clips horizontal overflow so charts and wide rows cannot
  widen the document.

## Verification

- `npm run build:platform` passes.
- Checked at `390×844` for all seven routes and at `1440×900` for Insights.
- No document-level horizontal scroll on the checked routes.
- Desktop markup, route titles, guards and API calls are unchanged.

Admin remains out of scope.
