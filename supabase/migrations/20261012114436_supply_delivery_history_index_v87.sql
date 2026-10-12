-- Keep the latest-ten chest delivery ledger bounded as historical jobs accumulate.
create index if not exists supply_jobs_delivered_owner_v87
on ludus_supply_private.jobs(owner_id,claimed_at desc)where claimed_at is not null;
