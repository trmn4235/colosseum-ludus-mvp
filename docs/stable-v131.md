# Ahır V131

The 30 × 54 m stable now uses compacted brown earth, narrow wooden board aprons beside the stalls and wooden decking around the feed store. New neutral-lit earth, timber grain and straw textures replace the grey tile grid and gate-patterned wood. Individual plank colour variation, irregular stone courses, damp staining, soot above torches, hoof impressions, small pebbles and scattered straw give the surfaces variation at human scale.

Sixteen iron torch fixtures stand in pairs along the aisle, spaced seven metres apart. Animated crossed flame planes and glowing embers share two instanced draws. Six pooled warm point lights follow the nearest actual torch positions; the ceiling light is disabled and ambient illumination reduced while inside. No point-light shadow maps are allocated. The flame shader includes logarithmic depth chunks to match the existing renderer. Leaving restores the prior room lighting, and returning reuses all geometry, textures and lights.

The stalls have slatted hay mangers, inset water basins, visible gate hinges/latches, hanging leather bridles, varied bedding and lower horse placement with soft contact shadows. The feed store includes tied sacks, textured hay bales, staved grain barrels, buckets, rope coils and tools. All static joinery and small objects use 25 shared batches. Existing horse appearances, owner-sized groom, husbandry rules, capacity and clear central aisle remain intact.

The caravan pictogram now shows a side-view horse, its shafts and a two-wheeled cart. The same muted monochrome paths are used by the HUD, door badge and interaction button. A wider intrinsic view box preserves the proportions; the canvas badge uses the same aspect ratio.

Three built-in Imagegen calls produced the 1024 × 1024 WebP materials in `assets/stable-v131/`. Final prompts, asset paths and generation mode are recorded in `art-direction.json`. No new model download is required.

Validation covers actual GLB sizes, repeated entry/exit, all seven coat materials, the full 54 m aisle, torch placement and fixed light count, light movement to the rear, original light restoration, world-coordinate material sampling, flame logarithmic-depth compatibility and existing stable UI interactions. The caravan icon was rendered as a standalone SVG for inspection. Managed Sites does not provide local browser QA here; on-device appearance and frame rate are not measured by these checks.
