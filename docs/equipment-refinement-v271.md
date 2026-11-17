# V271 equipment refinement

Prepared locally on `codex/equipment-refinement-v271`. Not pushed or deployed.

- Shared item artwork keeps the original asset pixels and proportions. The SVG viewport removes transparent margins only; an HTML wrapper reserves independent enhancement and caption space. This avoids nested SVG geometry CSS inconsistencies.
- Enhancement numbers use plain dark gray text, with no burgundy plaque or gold lettering. Exact item identity and original files remain unchanged.
- The preparation preview column is narrower; the model and fallback portrait move 4% left. Compact 4:5 slots, six inventory items, and four emerald sockets remain available.
- The selected gladiator profile displays K/D, K/D/A and wins/losses in place of Ready. Async results are guarded against a changed selection. K/D/A follows the existing ratio convention `(kills + assists) / deaths`; zero-death nonzero ratios display infinity.
- `supabase/career-kda-v271.sql` extends the existing authenticated read-only career function with same-match assist coverage. It does not rewrite matches. Missing historical assists remain unknown; partial ratios have a coverage marker. This patch has NOT been applied to live Supabase.
- All consumers of changed shared scripts receive revision 271 cache keys.

## Verification

- Item identity, aliases, original asset hashes, recipe invariants and five rig consumers: 9 tests passed.
- Career SQL test passed, including applying the patch twice, existing telemetry gaps, newly recorded assists, owner isolation and anonymous access denial.
- Browser preview: 874x402, 667x375 and 568x320 layouts checked. Six items and all four emerald sockets fit. Selecting Cassius/Titus updates fixture K/D, K/D/A and wins/losses correctly.
- The preview uses isolated sample account/match data. Browser WebGL is unavailable, so the static fallback portrait is visible; live 3D rendering and an actual iPhone have not been verified.
