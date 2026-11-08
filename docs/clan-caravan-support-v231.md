# V231 clan caravan assistance

A clan member can accept an active caravan ambush and control one of their own
available gladiators. The existing server replay verifies the complete fight.
The owner and assisting Ludus can see the result and the defender's name; a
completed assisted defense records 0.10 clan glory once. Withdrawal or an
automatic timeout does not award it. A fighter is reserved while the fight is
active and released when it ends. The existing game remains a single-player
battle: other escorts, if present, remain computer-controlled.

The migration leaves `clan_support` off so existing clients and fights remain
owner-only. Rollout order is database migration, updated edge verifier, updated
client files, verification, then enabling the flag. Scheduled caravan delivery,
existing cargo and old encounters retain their previous behavior.

The full SQL integration suite exercises clan membership, attack notification,
fighter reservation, owner/helper permissions, completed and abandoned fights,
result replay and one-time credit. Browser fixtures cover the ally attack card,
a defense already taken by someone else, and the result history.
