# V285 — Maç sonu papirüs ganimeti

Four rarities: common (Yaygın), rare (Nadir), very rare (Çok nadir), unique (Eşsiz).
Every profession has 500 standard manuscript identities: 400 common, 90 rare,
10 very rare. Each successful roll chooses a manuscript the owner does not yet
have in that rarity. A full rarity pool produces no reward, never a duplicate
or an automatic higher-rarity upgrade.

One mutually exclusive roll per eligible victory: common 12%, rare 4%, very
rare 0.1%, unique 0.0001% (one in a million). The remaining 83.8999% yields no
papyrus. At 50 eligible victories/week, the expectation is two rare papyri
across all six professions, not a promise or a weekly quota. Drop timing and
collection completion are not guaranteed. No client-supplied rarity or roll.

Eligible: completed solo20, 4x5 and Aventinus victories, plus wins in live
Colosseum, Aventinus and ranked 5v5. Ranked winners include eliminated members
of the winning team, but not leavers. Single-player uses the game's existing
accepted-result validation; this release does not claim to make client combat
simulation authoritative. Ten seconds minimum, two hours maximum. Cancelled,
abandoned, survival and automated bot accounts cannot consume this loot pool.
Multiplayer requires a defeated opponent, not solely a forfeit. Existing gold,
stones, XP, equipment and rating rewards are preserved.

Single-player grants happen inside the result transaction, before its reward
and immutable receipt are returned. Multiplayer captures eligibility on the
playing→finished transition and claims for the authenticated participant only
from that captured proof. This avoids locking other players' accounts while a
match lock is held. The result view automatically claims and displays loot;
network retries reuse the same owner/match receipt including an empty result.
No claim can reroll a result. Historical matches are not eligible retroactively.

Six distinct unique manuscripts (one per profession) are outside the 500.
Each identity can be discovered once in server history. A primary key and
locked catalogue row serialize competing discoveries. Ownership is separate
from the permanent discovery record: reading, removal of ownership or account
deletion cannot reopen supply. First finder uses the public ludus name at
discovery time; discovery date is retained. No sale or transfer route is added.
Profiles show standard collection, separate unique count and rarity details.

The previous skill lists were cancelled and replacement passives have not yet
been selected. This release activates collecting manuscripts, not new passive
effects. All effect definitions remain empty. Unconfigured manuscripts say
“Bonus içeriği hazırlanıyor” / “Henüz okunamaz”; collecting does not increase
overall. Existing reading remains guarded by configured effects. Unique
learning and its overall contribution will be specified with that catalogue.

Live schema migration: `20261117222617_special_staff_loot_v285.sql`.
`tests/special-staff-live-v285.sql` verifies the real start/finish functions,
existing reward triggers, repeat receipts, multiplayer eligibility and claims,
owner isolation, anonymous rejection and denial of direct reward grants. All
synthetic users, matches, rewards and account changes are rolled back. This
administrative integration check passed against the live schema after migration.
The catalogue, row security and function grants were also verified directly.

The profile preview explicitly uses UTF-8, matching the game pages. Papyrus
reward rows retain their full detail height on small phones; 874×402, 568×320
and 1280×588 report/profile layouts were checked without content overflow.
