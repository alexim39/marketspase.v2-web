# Phase 10 — Messages and Pipeline Hub

This final platform phase routes the inbox and the daily pipeline hub through
dedicated mobile entries. Messages keeps one conversation on screen at a time
and the pipeline hub keeps its action/health cards readable at 390px.

## Routes migrated

| Route | Mobile entry |
| --- | --- |
| `dashboard/messages` | One-pane chat list and thread with a back action |
| `dashboard/pipeline` | Daily pipeline hub cards and shortcuts |

## Mobile behaviour

- The inbox list fills the available height above the fixed dashboard
  navigation. Opening a conversation hides the list, shows the thread and
  exposes the back button.
- The chat shell height now excludes the dashboard header, breadcrumb, page
  heading and bottom navigation, so the composer and send button stay visible.
- The global Ora floating button is hidden on the Messages page so it cannot
  cover the send action.
- Group chats and channels reuse the same one-pane behaviour; opening the
  group panel shows the panel instead of squeezing three columns.
- The pipeline hub keeps follow-up counts, focus queue, stage mix and
  shortcuts in a single mobile flow.
- Each mobile shell clips horizontal overflow.

## Verification

- `npm run build:platform` passes.
- At `390×844`: inbox loads, opening a conversation sets `thread-open`, hides
  the list, shows the thread and back button, and keeps the composer visible.
- Pipeline hub checked at `390×844`; Messages also checked at `1440×900`.
- No document-level horizontal scroll.

Admin remains out of scope.
