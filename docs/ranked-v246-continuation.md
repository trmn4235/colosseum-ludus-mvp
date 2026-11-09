# Ranked Arena: V250

Ranked uses a separate 5v5 ladder, 1500 starting points, +10 for a win and −5 for a loss. Parties stay together, every real member must be online and READY, and only the leader starts. Other accounts continue to use human matchmaking.

The owner of the enabled test fleet can invite their clan bots; invitations are accepted after one second and bots become ready. When that owner starts, empty team slots are filled from their clan bots and a five-bot opposing team is created. Real invited teammates still have to confirm READY. Bot actions use the server combat RPC, exclude allies as targets, and consider reach, stamina and visible attacks. The same behavior is used by the existing owner-operated online bots.

Online bot weapon snapshots use enhancement +4, +5 or +6. They do not modify or duplicate the bot accounts' real inventory, or charge exercise to their real gladiators. Ranked outcomes, including bot matches, use the user's requested +10/−5 rules. Bot matches are recorded as such in the server's private session table.

Real players' gladiators and equipment continue to be verified at READY and before play; a match with missing connections is cancelled without scoring. Allies cannot be targeted or hit by projectiles. The V246 equipment and crafting panel remains available.

Automated tests cover bot invitation, READY, full team and opponent creation, weapon snapshots, tactical decisions, damage, authority and once-only points. Real iPhone performance and live player experience still require device verification.
