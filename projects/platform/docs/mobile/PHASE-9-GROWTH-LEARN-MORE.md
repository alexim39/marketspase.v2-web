# Phase 9 — Campaigns, Promote, Learn, More and Launch

This phase covers the growth, launch and utility routes that sit outside the
core workspace. Each route selects a dedicated mobile entry below 960px while
desktop keeps the existing view.

## Routes migrated

| Area | Routes |
| --- | --- |
| Activation | `dashboard/activate` |
| Launch path | `dashboard/path` |
| Campaigns | `dashboard/campaigns` |
| Promote | `dashboard/promote` |
| Learn | `dashboard/learn`, `dashboard/learn/video-of-the-week`, `dashboard/learn/video-of-the-week/:id`, `dashboard/learn/video-of-the-week/:id/reflections` |
| More | `dashboard/more` |

The weekly video index is reused for both the current video and the dated
video route; reflections keeps its own mobile entry.

## Mobile behaviour

- Activation keeps account, order, product and sponsor status in stacked
  cards with the back action visible.
- Launch path keeps the progress ring, next milestone and CTA in one column.
- Campaign funding cards keep fairness and allocation notes readable without
  a horizontal table.
- Promote keeps the page/referral links, copy actions and preview buttons
  full-width and tappable.
- Learn keeps the video-of-the-week card, rank comparison and course progress
  in a compact card grid.
- Video briefing and reflections keep the media, notes and completion actions
  stacked.
- More keeps the profile card, install prompt and utility links in a single
  column.
- Each mobile shell clips horizontal overflow.

## Verification

- `npm run build:platform` passes.
- Checked the activation, launch path, campaigns, promote, Learn, video and
  More routes at `390×844`.
- No document-level horizontal scroll.
- Desktop markup, route titles, guards, lazy loading and API calls are
  unchanged.

Admin remains out of scope.
