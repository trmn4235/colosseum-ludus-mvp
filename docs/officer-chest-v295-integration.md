# V295 Officer chest integration audit — implementation pending

Scope: two separately selectable Roman Officer chest items (original and black), plus compatibility notes for the selected Aegis/Hoplomachus bot models. This is an implementation checklist, not a record of shipped changes. Original source downloads, extraction, registration, database migration and verification remain pending. No live catalog, runtime, SQL or account data was changed by this audit.

## Sources and existing content

- Requested Officer source: Sketchfab UID `f643a3129a9f4b15b9e5abe220020af7`. No matching UID or Roman Officer attribution was found in the audited source/credits or local GLB JSON metadata. Likewise no identifiable Aegis `a2619fc3c48a420e9b6fe6091031a401` or Hoplomachus `3cd1e1a6a87749df82161fbed96d50f7` registration was found. A renamed metadata-free file cannot be excluded by this check.
- Existing `assets/equipment-v199/gladiator_chest.glb` is derived from `assets/equipment/gladiator_chest-e2f685b66fb6.glb`; its report records 50,880 source triangles and 3,305 output triangles. Do not replace that existing item.
- Andy Woodhead's segmented manica and maned's lion manica/trident already exist in V196/V197. These are separate assets from the newly selected set.

## Registration and rendering checklist

Proposed identities: `chest-officer` / `officer_chest` and `chest-officer-black` / `officer_chest_black`; both `kind: 'chest'`. Final IDs may change together across client and database. Distinct model IDs are necessary: current visual identity lookup prioritizes `kind:model` over SKU.

| Hook | Pending work |
|---|---|
| `item-visuals-v199.js`, `rows`, `records`, `entry()` | Add two names/icons/model identities. Unknown explicit models deliberately return no icon; do not alias either color to the legacy chest. |
| `ludus-production-v119.js`, `equipment` and `skuForItem()` | Add two equipment/recipe rows. The fallback chest resolver currently distinguishes only `chest_plate`; use exact model matching for new entries. |
| New migration; pattern `20261026090815_arm_equipment_v196.sql:1` | Idempotent rows in `public.ludus_shop_catalog`, `ludus_supply_private.production_recipes_v118`, and `ludus_supply_private.recipes`. Registering a recipe/catalog entry does not grant an inventory copy. Preserve existing ownership and stat initialization paths. |
| `LUDUS_ARMOUR_DATA`, `LudusArmour.model/names/prepare/get` | Add explicit Officer model handling and measured fit dimensions. Current resolver maps all unknown chest IDs to `chest_plate`; current `prepare()` fallback is shoulder-sized. |
| `ClassEquipment.sync()` chest branch | Preserve `f.chestModel` identity, replace the worn template when switching colors, and set the Officer's measured chest placement. |
| `arena-equipment-fit-v164.js` | Reuse cached skeleton fitting. Line 191 currently compresses depth by `.84` for every non-`chest_plate` model; qualify or calibrate this for Officer. `fitGeometry()` projects panels with depth below `.20` onto the front torso; retain a full cuirass's shell instead of accidentally invoking the flat-panel path. |
| `ludus-combat-values-v110.js`, `models` / `sourceName()` | Add Officer display names or resolve them through shared visual identity. Current production-name lookup in `sourceName()` is helmet-specific. |

Armor runtime copies to update consistently: `savas.html` (`LudusArmour` near line 991), `arena.html` (1121), `multiplayer.html` (942), `ludus.html` (525), and `caravan-rig-v126.js` (261). Line numbers are audit-time anchors; locate the named functions after edits. Rebuild `ranked-gladiator-runtime-v253.js` from `savas.html` with `scripts/build-ranked-runtime-v253.cjs`; do not hand-edit the generated copy.

Original and black variants may share immutable geometry/textures where appropriate, but must use distinct cloned materials. `Group.clone(true)` shares materials; tinting a shared material would recolor other fighters and the original. `ArenaEquipmentFit.wornMaterial()` caches by source material, so separate material identities also preserve worn color isolation. Preserve metallic ornaments and readable texture detail in the black treatment.

Equip validation in `20261009005058_gladiator_equipment_v49.sql:22` is kind/slot based for chest. Combat stat selection in `20261011141358_combat_stats_v73.sql:15` is also kind based. Two cosmetic colors need no additional combat bonuses or chest-model allowlist.

## Papyrus coverage: automatic for valid upgradeable items

**No per-model papyrus registration or new papyrus content is required for these two chest models.** This is verified in the current implementation, rather than inferred from UI labels:

- `20261121231322_papyrus_catalog_v288.sql`, embedded `$catalog$` records `blacksmith_general_001` through `_025`, explicitly apply to all upgradeable item models for supported operations. The catalog remains 25 knowledge entries per profession / 150 total.
- `20261121231323_smith_effects_v288.sql:17`, `ludus_staff_private.smith_bonus_v288`, selects learned smith entries by owner, role and operation/ordinal. Conditions use enhancement, socket qualities and the **physical item ID** plus operation family. It never filters by model or SKU. General plus highest applicable conditional bonus is capped at `.006`.
- The same migration's `smith_calculation_v288` at line 71 requires an unlocked item with `stat_version = 10`; sapphire eligibility comes from `natural_stats`. `ludus_smith_preview_v288` at line 97 and the actual `ludus_upgrade_item_v10` at line 108 both use this calculation.
- `smith-knowledge-v288.js:8` sends only the selected item ID, action and stone to the authoritative preview RPC. `gelistirmeler.html` uses the generic chest stat group and rejects items not initialized to stat version 10.

Consequently the remaining requirement is to create both variants through the normal V10 item path, preserving natural stats, enhancement, percentages and emeralds. Verify the actual production result has `stat_version = 10`; the audit did not query the live database's initializer. Do not seed duplicate knowledge, alter the 150-entry catalog, grant papyri, or reset learning. Add regression coverage for both new model IDs through preview and actual enhance/sapphire/emerald transactions, including replay and physical-item-series isolation.

## Asset processing, icons and bots

- Fresh checkout contains `scripts/pack-chest-v199.mjs` and `scripts/render-item-icons-v199.cjs`. Reuse their processing/rendering patterns in a V295-specific script; do not run the V199 packer against new assets because its paths overwrite the legacy chest.
- The existing icon script selects only `assets/items-v199/` rows. Extend a new V295 renderer intentionally. Render each final model/material variant directly with Three.js; preserve transparent WebP icons and recorded geometry/image hashes. Existing icon budget is under 35 KB at 320 x 320.
- Record source author/link, CC BY 4.0, extraction/recoloring/optimization, source/output hashes and actual final triangle/texture budgets in V295 credits/build metadata. Downloadable source files have not yet been inspected; separate armor objects must not be assumed.
- Whole bot models require a compatible skeleton. `ImportedGladiator.create()` currently clones one template and directly expects named Hips/Head/Spine2 and paired limb bones. Class `type` alone does not select a different body. `caravan-rig-v126.js` already demonstrates `create(id,type,source=template)`.
- New source helmets/weapons will not automatically be hidden unless they match the legacy `/^(weapon|helmet|shield)_geo/` convention. Strip/mark source props explicitly to avoid duplicates and prevent tall props from distorting the runtime's 2.08-height normalization. Cache shared model resources; never transfer weights per frame.

## Verification when implementation is ready

1. Extend `tests/item-identity-v199.cjs` for both rows and color switching; update its intentional 36-equipment/recipe-hash baseline only for the authorized additions.
2. Extend `tests/equipment-stability-v164.cjs` and use `tests/performance-v84.cjs`'s `rigRuntime()` for all copied runtimes. Check fitted geometry reuse and independent skeletons.
3. Follow `tests/arm-equipment-sql-v196.cjs` for migration replay, chest equip and battle entry/exit identity. Reuse `tests/smith-effects-v288.cjs` / `tests/smith-preview-v288.cjs` for the automatic papyrus coverage above.
4. Browser-check original → black → original and two differently colored fighters simultaneously; inventory/drop icon match; attack, guard, roll and recovery clipping; Aegis/Hoplomachus props and equipment visibility.
5. Rebuild ranked runtime, then `node scripts/build-ranked-runtime-v253.cjs --check`. Run relevant scene/render/performance checks after final assets exist; none were run for this documentation-only audit.
