-- Explicit deny policies document the private-RPC-only access model.
-- No client table grants are added. The authenticated RPC checks ownership itself.
create policy stable_no_direct_access on ludus_stable_private.rules for all to authenticated using(false) with check(false);
create policy stable_no_direct_access on ludus_stable_private.houses for all to authenticated using(false) with check(false);
create policy stable_no_direct_access on ludus_stable_private.horses for all to authenticated using(false) with check(false);
create policy stable_no_direct_access on ludus_stable_private.requests for all to authenticated using(false) with check(false);
create policy stable_no_direct_access on ludus_stable_private.receipts for all to authenticated using(false) with check(false);
create policy stable_no_direct_access on ludus_stable_private.duels for all to authenticated using(false) with check(false);
