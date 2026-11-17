# V277 — Klan kaynak haritası ve kariyer yerleşimi

## Changes

- Career now occupies a normal-flow grid header row alongside gladiator identity. Statistics start below both, preventing the Career button from covering the level value on compact landscape screens.
- Clan home uses a narrower banner column. Leader name is removed from the home identity card; level, current/required EXP and an accessible progress bar take its place. Membership and level-detail navigation remain available.
- The main home panel reuses the existing Roma supply panorama and all 16 source locations, including its established hunt/meat and wine/beer aliases. Source markers show per-location counts of matching-clan collecting teams. Forming/completed jobs are excluded; unknown or failed loads do not display false zero counts.
- Selecting a source opens the existing caravan view filtered by resource. All-regions and top-level caravan navigation clear that filter. Existing server permissions and caravan mutations remain unchanged. The existing 20-second home refresh supplies current team data.
- The next-war panel presents 10vs10, roster navigation and an optional schedule countdown. Its one-second tick only changes clock/label text.
- New surfaces use the three shared themes and preserve the single-screen landscape layout.

## Schedule boundary

The deployed clan RPC schema has no war schedule or scheduled battle matcher. Existing roster preparation remains the server's 20-slot roster; this UI change does not implement 10-player matchmaking or alter roster capacity. When no matching schedule is supplied the panel shows `Savaş saati bekleniyor` and `— : — : —`.

The optional future `state.next_war` contract is `{clan_id, status: 'scheduled'|'active', starts_at, team_size}`. The clan must match; starts_at must be an ISO timestamp with an explicit UTC offset; supported team_size is an integer 1–20, defaulting to 10. An elapsed scheduled timestamp is not represented as an active battle. Production never synthesizes a start time.

## Validation

- 14 Node checks passed: dashboard, map identities/coordinates and aggregation, missing data, EXP bounds, schedule validation/countdown, theme persistence and entry points. Both changed JS modules parse, and git diff whitespace checks pass.
- Browser preview used the actual page code with fixture-only account/RPC data. Verified the iron marker opens its two active teams, All regions restores the full list, the war card opens roster preparation, and Career still opens/closes its detail dialog.
- Checked clan and preparation views at 874×402 and 568×320, with no vertical page scrolling or label overlap. Career-to-statistics separation measured 4 px and 3.8 px respectively.
- Checked white marble, black marble and blue themes. Preview data deliberately include six active teams across four sites and a sample war time, labelled as example data in the preview wrapper. The equipment preview uses the pre-existing static gladiator fallback; this release does not change the 3D renderer.

## Release status

Prepared and committed locally on the existing work branch. No push or deployment performed.
