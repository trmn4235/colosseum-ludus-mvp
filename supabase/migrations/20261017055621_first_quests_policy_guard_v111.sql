-- Match the RPC's permanent-account requirement in defense-in-depth policies.
alter policy first_quests_owner_v111 on ludus_private.first_quests_v111
 using(owner_id=(select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,true));
alter policy first_quest_marks_owner_v111 on ludus_private.first_quest_marks_v111
 using(owner_id=(select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,true));
