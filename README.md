# Colosseum & Ludus

Static mobile gladiator game served by GitHub Pages. Supabase owns accounts, equipment and multiplayer match state.

## Mobile loading

The anonymous login screen does not request GLBs. In the measured two-fighter Ludus fixture, cold uncompressed source payload falls from 87.40 MiB to 49.85 MiB (43.0%). The arena GLB waits for arena navigation; desk, wardrobe, books and clan chest load on room entry. Four renderer pages share byte-identical, content-addressed equipment/PBR resources, and Ludus reuses the existing persistent cache for the large owner model. The two office books share geometry/materials with independent transforms.

[The investigation](docs/mobile-performance/README.md) includes complete network phases, geometry/texture costs, before/after images, cache and interaction tests, and Meshopt/Draco/KTX2 decisions. Owner/equipment geometry and image bytes are preserved. [The exterior city comparison](docs/city-performance/README.md) verifies the same skyline using 143 spatial image cards: 781,433 → 288 city triangles, 18.41 → 2.07 MiB source payload, with an automatic 3D fallback. These fixture measurements are not production wire-byte, game FPS or physical iPhone benchmarks; device performance remains unmeasured. No migration or hosting change is required.

## Ludus progression V37

The office level book opens from the existing arrow emblem, yellow when a level reward can be collected and faded grey otherwise. The fixed landscape page shows account EXP, granted gladiator rights, the current roster and the exact PDF rewards for levels 2–50 with pagination and no scrolling. New accounts start with two gladiators; total granted rights are three at level 2, four at level 6, five at level 10 and fifteen at level 50. Existing rosters remain intact.

Current PvE victories award 100 Ludus EXP. The first ten daily wins award full EXP, wins 11–30 half and later wins one quarter, capped at 2,500 battle EXP per Istanbul calendar day. Losses, abandoned battles, friendly matches and multiplayer beta award no Ludus EXP. Daily quests award 150/150/250/350 EXP plus a 300 EXP completion bonus. Imperial mission tiers award 500/750/1,000 EXP on collection. Level L requires `3000 + 100*(L-1) + 15*(L-1)^2` EXP for the next level; level 10 requires 33,660 total EXP. Clan and individual gladiator EXP stay independent.

Apply `ludus-level-v37.sql` after the existing backend migrations. Validated settlement and quest-claim transactions grant EXP once. Level claims draw random equipment and random stones from each specified family; repeated or lost-response retries preserve the original draw and cannot duplicate rewards. Gladiators are drawn from classes the player does not own. The current catalog contains seven classes: when all are owned, additional gladiator rights remain pending until an eligible class and a free slot are available. This does not create extra starting slots or delete existing fighters.

Validation: `tests/ludus-level-v37.cjs` exercises the repeatable migration, all PDF totals, daily battle caps, all EXP sources, exact 2/3/4/5/15 rights, persistent random rewards and account isolation in PGlite. `tests/ludus-level-ui-v37.cjs` uses the migrated RPC in Chromium to verify six landscape sizes, pagination, double clicks and reload after a lost claim response. Set `NODE_PATH` to the installed PGlite/Playwright modules and `CHROMIUM_EXECUTABLE_PATH` when needed.

## Multiplayer controls V36

Multiplayer now loads the same textured Colosseum model as the normal arena. A compact health/stamina HUD replaces the oversized banner. The touch controls use the established target, equipment-change, shield, sword and dodge symbols; swipe the attack control up/down/left/right for head/legs/left arm/right arm, or tap for chest. Hold the shield to block. Dual weapons expose the equipment-change control; a selected whip exposes its existing locked-target pull.

Apply `ludus-multiplayer-v36.sql` after V23. The server validates attack regions and weapon hands, spends stamina (attack 13, dodge 25, whip 28), advances continuous dodges and retains timed frontal shields and counters. Attack and dodge IDs prevent duplicate actions after a lost response. The response keeps `combat_version: 23` for older clients and advertises `controls_version: 36` for the new client. Multiplayer remains a beta without rewards or item loss.

`tests/multiplayer-v36.cjs` runs the repeatable migration and combat/authorization checks in PGlite (`@electric-sql/pglite`). `tests/multiplayer-ui-v36.cjs` uses Playwright, the real models and the real migrated RPC in two isolated local browser sessions: eight viewport sizes, fixed screen layout, all five attack directions, shared damage, lost-response retries, held guard and dodge. Set `CHROMIUM_EXECUTABLE_PATH` to a Chromium executable when needed. Physical iPhone performance and a live two-device match still require device validation.

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
# Gladiator exercise V46

Apply `supabase/migrations/20261008234312_gladiator_exercise_v46.sql` after the existing training, imperial and level migrations. The seven character attributes total 350 at adoption (Overall 50). Existing earned Overall is preserved. Overall is the precise mean of character attributes, excluding equipment.

Each gladiator has one Istanbul-calendar daily allowance. Three completed matches, one selected-attribute training, or one completed easy imperial mission fill it. Mixed activities share the same allowance. Growth is awarded once when it fills; the base daily budget is 3.5 attribute points, slowing at Overall 60/70/80/90. Selected training develops only the chosen attribute, including after earlier matches on the same day. It clamps at 100 without transferring overflow. Matches and easy missions share growth across seven attributes and redistribute their capped-attribute overflow.

The fatigue meter displays remaining energy: a fight costs 20, training 30, and easy/medium/hard missions 20/35/50. Idle recovery adds 10 energy per hour, including offline time; midnight does not reset it. Starting an activity below 30 remaining energy records a server-owned 25% injury chance, rolled once at completion. Injury removes 35 total attribute points (5 Overall), requires 12 hours of recovery, and lost attributes must be trained again. Exhausted and injured fighters cannot start new activities. In-progress historical activities are preserved without retroactive injury rolls.

The courtyard panel shows portrait and Overall, daily and energy bars, then the seven selectable attributes. Batch training starts the selected attribute for up to 30 eligible gladiators atomically. All sessions keep the existing one-hour training plus one-hour rest duration. The former weekly absence penalty is retired.

Validation: `tests/gladiator-exercise-v46.cjs` runs actual migration/functions/triggers in PGlite. `tests/gladiator-exercise-ui-v46.cjs` tests the real UI module and portrait assets in Chromium/WebKit across five landscape sizes. Set `LUDUS_PGLITE_MODULE`, `CODEX_PRIMARY_RUNTIME_NODE_MODULES`, `LUDUS_TEST_ENGINES`, and `LUDUS_TEST_OUTPUT` as appropriate.

# Courtyard training V51

V52 equipment placement follows the rear-right corner toward the arena gate: two posts at x=11.6/9.9, centred paired rudis piles at x=6.9, and three equally spaced shoulder beams at x=4.35/2.4/0.45. The wall-side line is z=-10.55; the gate approach stays clear. Displayed rudis count follows the signed-in roster, including odd counts and roster changes. Speed trainees share the two fixed posts in two rotating queues; the courtyard never adds extra practice posts. The isolated V50 test retains its original equipment layout.

The V50 paired wooden-rudis test is now connected to real one-hour training sessions in Ludus. Attack technique, defense technique and tactics share the approved paired motion; each fighter keeps their own server-selected target. An odd participant practices with one visual instructor that receives no session, fatigue or stat award. Conditioning uses a shoulder timber carry, muscle uses shoulder-timber squats, and speed uses rapid rudis strikes against a wooden post. Practice props and the existing rig share geometry; no new GLBs or large image assets load. Hidden and off-camera rigs stop animating. Completed training removes practice equipment and restores the fighter's owned loadout.

`training-preview-v51.html` shows all motions with the same real model/courtyard, plus an explicitly labeled swinging-bag reflex draft. The reflex draft remains out of the live courtyard. Preview and performance measurement never call account or award endpoints. `training-test-v50.html` retains the original paired experiment. Desktop headless FPS is not an iPhone benchmark.

Apply `supabase/migrations/20261009040911_targeted_training_v51.sql` after V46. It changes only training settlement: chosen-stat growth stays isolated at the cap and after mixed battle/training days. Existing match/mission growth, fatigue, injury rolls, one-hour training/rest, daily caps and retry protection are preserved.

Validation: `tests/targeted-training-v51.cjs` runs all seven targets, cap and mixed-day cases in actual PostgreSQL/PGlite. `tests/training-yard-v51.cjs` verifies the real courtyard and detail UI, solo instructor, 30 trainees, equipment restoration and off-camera culling with isolated account fixtures. `tests/training-preview-v51.cjs` checks every preview, viewport fit, no account requests, and same-scene frame measurements for 2/12/30 models. Use the existing PGlite/Playwright environment variables.

# Dining room V53

Two facing A-frame table/bench sets leave the entrance and central aisle clear. A cauldron and preparation table occupy the rear-left corner. Two ready shelf models form the rear-right pantry, holding grain sacks, wine barrel, ham and an apple crate, with two hanging fish. Foods are decorative; this revision adds no inventory consumption or morale rules.

The shared `assets/dining/dining-kit-v53.glb` is 398,500 bytes, loaded only on dining room entry and reused on subsequent visits. Ready CC0 geometry from Kenney and Quaternius replaces the former generic dining furniture; see `DINING_ASSETS.md`. `tests/dining-room-v53.cjs` verifies delayed-load cancellation, model counts, shelf placement, furniture collisions, the entrance/aisle, one download across repeated visits and browser errors with an isolated account fixture.

## Dining room correction V54

Each bench faces its own table. Replace the ham and fish with ready KayKit/Quaternius models at readable proportions: two bone-in hams, four hanging mackerel and four grain sacks on the rear pantry. Centre two beer barrels on the right pantry's upper shelf, with two apple crates directly below. V54 uses a new cache-safe 412,984-byte bundle; the V53 bundle is retained for older cached clients. The dining browser check also verifies bench orientation, exact food counts and matching barrel/crate columns.

# Dining nutrition and marketplace V57

Each gladiator needs **100 nutrition units per Istanbul calendar day**, shown as two 50-unit meals. The shared daily menu consumes whole product quantities automatically; there is no manual feeding. Values per purchased unit: grain 20, apple 15, fish 25, ham 30, egg 20, bread 15, ready meal 100, wine 5. Wine keeps its internal `beer` SKU to preserve stocks, historic receipts and pending purchase retries. New prices: egg 6, bread 3, ready meal 30 denarius; previous prices remain grain 3/apple 6/fish 9/ham 12/wine 6.

A bounded integer menu planner meets the 100-unit daily need with the smallest excess from whole quantities, or uses the available partial ration if stock is insufficient. It prefers food groups and variety between equal nutrition totals. Unused products remain stocked; small excesses give no extra morale. Seven apples = 105 units for one daily ration, rather than seven daily meals. UI cards show value, actual daily item use and resulting units; the header shows daily units/need and total stock units. The latter is stock quantity, not a promise that every day can be filled exactly.

Full nutrition contributes 70 morale; proportional staple/protein/fruit coverage adds up to 20 and wine up to 10. Ready meals contain all three groups. Wine supplies 5 nutrition units but is capped at one item per gladiator per day. Its morale contribution scales with nutrition coverage, so wine alone still leaves a 95-unit daily deficit. Morale remains an indicator, with no combat modifier. Earlier completed days settle under prior rules before migration changes nutrition. Offline reconciliation batches menus until a consumed ingredient becomes unavailable. Purchase requests remain atomic, owner-scoped and deduplicated; roster changes settle earlier days with the old crew.

White/burgundy/gold interfaces and shared SVG icons remain in use. V57 adds original egg, bread, ready-meal and wine illustrations; prior symbols remain for the other products. Room geometry and model placement remain as designed.

Validation: `tests/dining-nutrition-v57.cjs` executes the actual migrations and functions: repeatability, new products, 100-unit need and minimum excess, integer portions, exact-fill selection, seven apples, wine daily cap and insufficient wine-only nutrition, diversity, retry safety, owner isolation, RLS, roster changes and 1000 offline days. `tests/market-food-v57.cjs` and `tests/dining-food-ui-v57.cjs` check real page integration, eight products, quantity purchases, lost-response retries and three/four landscape sizes. These are headless checks, not iPhone performance measurements.

### V58 — Menü kalitesi ve toparlanma
Her gladyatörün günlük ihtiyacı 100 beslenme birimidir. Tamamlanan günün menüsü ertesi İstanbul takvim gününde enerji toparlanmasına en fazla %50 bonus verir (10 → 15 enerji/saat). İhtiyaç tamamen karşılanmışsa protein payı kaliteye 50, meyve payı 50 puana kadar katkı sağlar; hazır öğün dengeli kabul edilir. Şarap morale katkı sağlar. Bonuslar toplanmaz; fazladan besin bonusu artırmaz. Çevrimdışı toparlanma tüketim geçmişinin ilgili günleri üzerinden hesaplanır. Sakatlık süresi ve savaş değerleri değişmez. Satın alma hemen bonus vermez.

Doğrulama: `tests/dining-recovery-v58.cjs`, `tests/dining-nutrition-v57.cjs`, `tests/dining-food-ui-v57.cjs`, `tests/market-food-v57.cjs`.

### V59 — Daha yavaş toparlanma ve üç menü bonusu
Taban enerji toparlanması %35 düşürüldü: 10 → 6,5 enerji/saat. Günlük 100 birim tamamen karşılanınca temel menü %4 (6,76/saat), protein veya meyve katkılı menü %8 (7,02/saat), dengeli menü ve hazır öğün %12 (7,28/saat) sağlar. Yetersiz beslenmede bonus 0’dır. Bonuslar ertesi İstanbul takvim günü geçerlidir ve toplanmaz. Ortak menü kalitesi 0–49 temel, 50–99 katkılı, 100 dengeli olarak değerlendirilir. Eski kazanılmış enerji korunur; çevrimdışı süre yeni politikanın başladığı anda bölünür. Besin değerleri, fiyatlar, günlük ihtiyaç ve faaliyet hakları aynı kalır. Doğrulama: `tests/dining-recovery-v59.cjs` ve mevcut beslenme/ekran testleri.

### V60 — Beslenme bonusunun doğru hedefi: savaş içi kondisyon
V58/V59 yorum hatası düzeltilmiştir. Yemek bonusu savaş sırasında kondisyon barının yenilenmesini etkiler. PvE ve çok oyunculu savaşların mevcut kondisyon yenilenmesi %35 azaltılır; tam günlük beslenme temel %4, protein/meyve katkılı %8, dengeli/hazır öğün %12 bonus sağlar. Bonus yetkili sunucunun tüketilmiş son menüsünden savaş başlangıcında snapshot’a yazılır; stok satın almak anlık avantaj sağlamaz. Dinlenme enerjisi tekrar 10/saat’tir ve yemekten bonus almaz. Eski dönemde kazanılmış enerji geçiş hesabıyla korunur. Fiyatlar, 100 birim ihtiyaç, saldırı/kaçış maliyetleri ve maksimum kondisyon aynı kalır. `tests/combat-food-v60.cjs` gerçek PvE ve çok oyunculu formüllerini, menü/snapshot sahipliğini, dinlenme hesabını ve tekrar denemeleri doğrular.

### V61 — Aktif yemek etkisi ve günlük menü maliyeti
Yemekhane, bugünün savaş bonusunu ve yarın tüketimden kazanılacak bonusu ayrı kartlarda gösterir. Planlanan tüketimin güncel pazar değeri ludus ve gladyatör başına hesaplanır; alımda ödenen erzak için günlük tüketimde ikinci ücret kesilmez. Eksik beslenme ve bonusun günlük tüketimden sonra etkinleşmesi açıkça belirtilir. PvE ve çok oyunculu savaşta kondisyon barının altında yalnızca o savaşın sunucu kaydından gelen aktif beslenme bonusu gösterilir. Mobil ekran, menü maliyeti, gün ayrımı ve iki oyuncunun ayrı bonusları mevcut ekran testleriyle doğrulanır; V60 savaş dengesi aynı kalır.
