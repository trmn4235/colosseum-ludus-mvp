# V227 material professions

Workers train nine separate material professions: iron, copper, tin and lead mining;
woodcutting, flax cultivation, leather, wool and resin collection. Food is excluded.
The display names for hide and wool are **Dericilik** and **Yüncülük**.

- Each material-purchase caravan carries one selected, account-owned worker.
- The existing 1–6 caravan entitlement and 60-unit carrying capacity are unchanged.
- A worker cannot serve two active trips. Reservations are serialized by the existing
  account lock and protected by a unique active-assignment index.
- Only successful warehouse delivery grants EXP: one delivered unit = one EXP.
- With multiple caravans, cargo is divided equally among the selected workers;
  integer remainders go to the earliest workers in the saved selection order.
- Cumulative EXP thresholds are 0, 60, 180, 360 and 600 for levels 1–5.
- Caravan EXP stops at 600. Lifetime delivered quantities continue increasing.
- A blocked warehouse delivery keeps its worker reservation and grants no early EXP.
- Assignment receipts make retries and repeat delivery checks idempotent.
- Existing trips and legacy client requests have no known worker assignment and
  receive no retrospective EXP. Food and escort equipment grant no profession EXP.
- Skills, assignment receipts and rewards are private server records. Clients may
  read their own roster through the RPC but cannot write EXP or delivery totals.

Clan production and progression beyond level 5 are not implemented in this version.
The historical totals shown here are purchased resources delivered by caravan, not
resources produced by a clan work team.

Validation: `LUDUS_CARAVAN_COMBAT_TEST=1 node tests/production-v119.cjs` exercises
the real caravan/market/delivery migrations, including the V227 integration module.
The source-route browser suite checks selecting worker 8 and submitting its UUID.
