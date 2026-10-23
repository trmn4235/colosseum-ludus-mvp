# V169 — Sylvain Delandre helmet

The existing licensed `sylvain_helmet.cme` is now a separate wearable item: **Vizörlü gladyatör miğferi**, SKU `helmet-sylvain`, model `sylvain_helmet`, kind/slot `helmet`. Existing helmets and player inventories remain unchanged.

The original dark steel textures and 11,674-triangle mesh are retained. The catalog normalizes height to 0.36 m. The existing rig measures the actual head once and fits the rigid mesh to the Head bone, using the same transform throughout movement. No independent animation or per-frame rebuilding is added. The asset loads only when requested and is cached across characters; a completed download invalidates the worn placeholder. Arena, multiplayer, naval combat, Ludus selection and caravan all preserve the model ID, including drops.

Recipe: 5 steel ingots, 3 processed leather, 2 linen cloth, 1 wool cloth → one +0 helmet. Basic purchase costs 100 denarius. The existing authenticated stock/crafting/equip APIs remain authoritative; no authorization or balance grants changed. Migration is idempotent.

The 320×320 transparent WebP is rendered from the actual mesh and original textures, not a substitute illustration. To reproduce: `RENDER_HELMET_ICON=1 node tests/helmet-render-v169.cjs` (Playwright Chromium; optionally CHROMIUM_PATH). Original credit and CC BY 4.0 license: `assets/equipment-v167/CREDITS.md`.

Validation: head-relative transforms stay fixed over 420 frames across idle/walk/attack/guard/dodge/hurt/down in each of five runtime copies; lazy load, switch-back and drop identity checked. Fifteen textured front/side/rear views reviewed. Production tested at 1366×768, 932×430, 844×390, 667×375 and 568×320. Full 36-recipe PostgreSQL fixture validates exact stock debits, output identities, receipt replay and ownership. No live player was charged or granted a helmet during validation.
