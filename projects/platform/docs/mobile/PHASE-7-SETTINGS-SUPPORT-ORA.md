# Phase 7 — Settings, Support, Resources and Ora

This phase puts the remaining account and help surfaces behind device-aware
routing. Every route keeps its existing desktop view and gets a dedicated
mobile entry below 960px.

## Routes migrated

| Area | Routes |
| --- | --- |
| Settings | `dashboard/settings/profiles`, `appearance`, `verification`, `landing-page`, `billing`, `trust` |
| Support | `dashboard/support/ticket`, `dashboard/support/about/app` |
| Resources | `dashboard/resources/ads-contents`, `dashboard/resources/prospecting-contents` |
| Ora | `dashboard/ora` |

## Mobile behaviour

- Account profile, verification and trust screens keep their status cards and
  call-to-action groups in a single readable column.
- Appearance choices remain large tap targets with the selected state visible.
- Landing-page editing keeps the form and live preview stacked.
- Billing reuses the wallet patterns already migrated in Phase 3.
- Support ticket fields and priority controls stack full-width with 44px
  controls.
- Content library and prospecting guides keep their copy/share/download
  actions in mobile cards.
- Ora keeps the chat composer and suggested prompts usable at 390px.
- Each page host clips horizontal overflow so wide forms or preview strips
  cannot widen the document.

## Verification

- `npm run build:platform` passes.
- Checked all eleven routes at `390×844`; settings profile also checked at
  `1440×900`.
- No document-level horizontal scroll.
- Desktop markup, route titles, guards and API calls are unchanged.

Admin remains out of scope.
