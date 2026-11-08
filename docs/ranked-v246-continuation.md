# Ranked Arena: V248

V248 implements a separate 5v5 ranked queue for solo players and parties of up to five. A party stays together; every member must be online and READY, and only the leader can start or cancel matchmaking. Ten real players are required. The queue does not silently substitute bots.

The server verifies selected gladiators and equipped items when READY, again during matchmaking, and before play starts. Changes or disconnections can cancel a search; a match with missing connections is cancelled without rating changes. Within a match, allies cannot be targeted or hit by projectiles. When a team wins, each player starts at 1500 and receives +10 for a win or −5 for a loss, settled once on the server. Ranked has its own leaderboard, separate from the historical combined Colosseum board.

The V246 equipment/crafting panel and V247 correction for online +10/−5 scoring remain in place. Single-player Colosseum and naval scoring retain their separate existing rules.

Automated SQL integration tests exercise two complete parties, start permissions, READY changes, team targeting, disconnection, result idempotence, and the separate leaderboard. Browser tests use mocked accounts. Ten independent live users, actual phone performance, and real network conditions still require device verification.
