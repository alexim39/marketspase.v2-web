# Phase 8 — Training and Community

This phase routes the Academy and Community surfaces through device-aware
mobile entries. Desktop views remain unchanged; every route gets a dedicated
mobile entry below 960px.

## Routes migrated

| Area | Routes |
| --- | --- |
| Training | `dashboard/training`, `training/analytics`, `training/tutorials`, `training/courses`, `training/courses/:courseId`, `training/courses/:courseId/lessons/:lessonId` |
| Community | `dashboard/community`, `community/feed`, `community/events` |

The shared training detail index serves both the course and lesson routes, so
lesson navigation keeps the same mobile entry.

## Mobile behaviour

- Academy home keeps its progress ring, rank chips and start-learning action
  in a single readable hero.
- Course catalogue filters wrap into touch-sized chips and the course cards
  stack in one column.
- Lesson detail keeps the video/media block, notes and completion actions in
  one column.
- Training analytics keeps its summary cards and completion table within the
  viewport.
- Community hub keeps the feed, message, event and Ora shortcuts as a compact
  card grid.
- Feed posts keep author, reaction, pin and comment actions readable on a
  narrow card.
- Events keep their tabs and create/RSVP actions at 44px or larger.
- Each mobile shell clips horizontal overflow.

## Verification

- `npm run build:platform` passes.
- Checked all training and community routes at `390×844`; Academy home also
  checked at `1440×900`.
- No document-level horizontal scroll.
- Desktop markup, route titles, guards, lazy loading and API calls are
  unchanged.

Admin remains out of scope.
