# Colosseum & Ludus

Static mobile gladiator game served by GitHub Pages. Supabase owns accounts, equipment and multiplayer match state.

## Clan room chest V35

The downloaded walnut-tinted chest opens from the established arrow emblem. A fixed, non-scrolling screen presents **Klan Inventory** on the left and **Ludus Inventory** on the right, with separate 6×5 grids and independent pagination. Selecting equipment preserves its + level and all socketed stones. Gem stacks support quantity selection. Equipped, battle-locked and clan-roster-locked equipment cannot be donated.

Enter an integer in the clan denarius field and press its coin emblem to donate personal denarius to the clan. There is no coin withdrawal endpoint or button. All clan members can inspect the chest and donate denarius; equipment/gem deposits and withdrawals require the leader-controlled existing `vault_access` permission. The chest has 60 shared slots, counting equipment and nonempty gem stacks; merging a stack does not consume another slot. The older clan equipment screen respects this same capacity.

Apply `ludus-clan-vault-v35.sql` after the existing V22/V23 backend. The RPC authenticates `auth.uid()`, checks current membership and permissions, uses the established wallet/clan lock order, and records an idempotent request and ledger entry within the same transaction. A persisted pending request can be retried after a lost response without duplicating the transfer. Requests pin the destination clan ID. The new stone table denies all direct client access; only the authenticated chest RPC is exposed, with private helpers inaccessible and an empty security-definer search path.

Verification: `tests/clan-vault-v35.sql` generates fixtures inside a rollback transaction; `tests/clan-vault-v35.cjs` checks seven viewport sizes and transaction UI in Chromium/WebKit; `tests/clan-room-v35.cjs` renders the real model, checks collision/no tunnelling, and verifies room changes do not leave stale colliders. Asset credits: [CLAN_VAULT_ASSETS.md](CLAN_VAULT_ASSETS.md).

## City and camera V29

Walking speed is now 2.1 m/s, with the downloaded walk clip sped up to match. **Ayarlar → Kamera uzaklığı** offers Yakın, Orta yakın (the unchanged default), and Uzak; the selection persists on the device. Closing settings restores movement immediately, including before the browser's asynchronous dialog-close event.

Downloaded monument models replace the procedural amphitheatre and temple. Colosseum height is 48 m; Pantheon height is 43.3 m. Their centres are exactly 2,000 m apart, with the Colosseum southeast of the Pantheon. North is -Z and east is +X. The Pantheon entrance faces north, so the Colosseum is behind-right when looking out. The ludus is positioned for the game view; this is not a surveyed reconstruction of Rome.

A photographed CC0 sky panorama, tiled roof textures, masonry facades, varied building heights, cypresses, a continuous city ground and atmospheric distance replace the previous sky and skyline. The Pantheon scan is cropped to the monument; it is a distant skyline model, not an explorable or high-detail interior. Attribution and modifications are in [CITY_ASSETS.md](CITY_ASSETS.md). No SQL migration is required. V29 JavaScript uses new cache keys; the unchanged owner GLB keeps its V28 cache key.

Local validation includes model dimensions and placement, camera persistence and immediate input resumption, the existing regression suite, actual Three.js rendered views, and an isolated mobile browser fixture. Physical iPhone performance remains unmeasured.

## Owner revisions V28

The owner uses a downloaded MakeHuman human with an adapted long white rope-belt tunic and ankle sandals. Downloaded normal-walk and idle motions replace the previous procedural posing. Hair colours retain strand texture while visibly differentiating blond, brown, red and grey; there are 11 hair, 6 facial-hair and 7 eyebrow choices. Weight blends include more pronounced waist, head, arm and thigh fat targets and fitted clothing.

Appearance does not open on ordinary login. Edit it from **Ludus yönetimi → Ludus sahibinin görünümü**. Manual initial customization remains available during signup. The clothing follows the long white belted silhouette but does not reproduce the reference's diagonal toga drape. Asset attribution and conversion details are in [OWNER_ASSETS.md](OWNER_ASSETS.md).

Preview: [owner preview V28](https://trmn4235.github.io/colosseum-ludus-mvp/owner-preview-v27.html?v=revision28). The GLB retains its existing filename; runtime asset URLs use `revision28` to refresh cached copies.

## Ludus architecture V25

The burgundy wall frieze wraps all four courtyard walls at one height and stops at doorways. Arena torches sit above it. Stair rails now use the balcony’s limestone balusters. The colonnade has fluted Ionic shafts, moulded bases and spiral capitals. An instanced Roman city skyline with tiled roofs, cypresses and a three-tier elliptical amphitheatre is visible beyond the perimeter walls, including from the upper gallery. No SQL migration or new downloaded assets are required.

Validated with three rendered viewpoints, JavaScript compilation and the existing regression suite. Mobile frame rate still requires device testing.

## Combat animation V24

Sword cuts carry the hand across the torso with shoulder and pelvis rotation, a distinct reverse cut and an overhead heavy attack. The attack pose is no longer overwritten by a second animation layer. Feet settle from locomotion during the wind-up, then keep their contact positions through the swing. Shield interruptions preserve the contact posture during recoil; the shield stays upright beside the attacking arm. Embedded Quaternius guard and special-action clips are retained.

V24 changes the three shared combat renderers and their local sword paths. It needs no additional SQL migration. Online V23 timed defense still requires the existing V23 migration below.

## Combat V23

Melee attacks use wind-up, blade contact and recovery. Shield contact interrupts a cut into a continuous recoil. Pressing the existing block control just before contact staggers the attacker and enables one short counter with the existing attack control. Holding block protects normally. The current embedded CC0 Quaternius clips are retained.

Apply `ludus-v23.sql` in the project's Supabase SQL Editor after V22. The migration is repeatable and uses one transaction. It replaces only multiplayer combat RPCs and retains V22 ownership and clan reservation checks. The final query returns `Dövüş V23 hazır`. The updated multiplayer client accepts V22 responses until the migration is applied; authoritative delayed contact and timed counters require V23.

Online strikes resolve once at their scheduled contact time. The server validates facing, distance, equipped shields and new guard presses. Attack command IDs prevent a lost response from applying the same attack again. No reward or item settlement was added to the multiplayer beta.

## Validation

Run `node --test tests/combat-feel-v23.test.cjs` with Node 18 or later. The tests exercise shield recoil, timed counters, held and rapidly toggled defense, target and expiry checks, projectile defense, and compilation of embedded scripts.

Local PostgreSQL checks also cover repeatable migration, delayed damage, attack retry deduplication, late defense and authorization. Browser checks use local assets and an isolated battle fixture. Actual iPhone frame rate and a live two-device match still need device validation.
