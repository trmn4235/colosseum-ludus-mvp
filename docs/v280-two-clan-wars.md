# V280 — Önümüzdeki iki klan savaşı

- Split the existing upper war area into two equal cards. Each has its own order label, format, countdown and roster-entry button. Map, banner, navigation and lower notices retain the V279 layout.
- Upcoming events are restricted to the matching clan and scheduled status, sorted by their explicit start timestamps and deduplicated. The first two are shown; absent schedules produce two distinct placeholders without fabricated dates. Legacy `next_war` data remains supported when the new list is absent.
- Countdown ticks target each stable event key, independently of the other card. Longer day-prefixed countdowns use smaller text to fit narrow cards.
- Roster entry resolves an explicit event-to-roster ID, never the other event's roster or an unrelated current roster. Empty or unavailable rosters open a clear pending state. The regular roster menu still opens the existing clan roster. Selected event context is included in existing page-return state.

## Server contract and limits

Optional future `state.upcoming_wars` entries use the V277 schedule fields plus `id` and `roster_id`. Optional `state.rosters` entries must explicitly match the clan; `state.roster` remains the legacy authenticated current roster. Existing roster mutations use the resolved selected roster ID, and server permissions remain authoritative.

The present backend does not yet provide war schedules or multiple scheduled rosters. This release does not create a scheduler, matchmaking, or 10-player battle/roster backend. The existing generic roster remains 20 slots. Preview-only fixtures demonstrate two 10vs10 cards and two distinct example rosters; they are not shipped in the game source.

## Validation

13 Node checks passed, including chronology, deduplication, missing/foreign schedule data, independent ticking and correct roster association. Browser QA at 874×402 and 568×320 confirmed both cards fit the original war area. First and second preview cards open Birinci Lejyon and İkinci Lejyon respectively. With schedules removed, the second card opens a pending second-war page rather than the current first roster. No production mutation was performed.

Local commit only; no push or deployment performed.
