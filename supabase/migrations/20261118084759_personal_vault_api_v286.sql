-- Match the existing API boundary: only private, owner-checking functions elevate.
alter function public.ludus_special_staff_archive(text,integer,boolean) security invoker;
alter function public.ludus_personal_vault(text,integer,text) security invoker;
grant execute on function ludus_staff_private.archive_v286(text,integer,boolean),
 ludus_staff_private.vault_v286(text,integer,text) to authenticated;
