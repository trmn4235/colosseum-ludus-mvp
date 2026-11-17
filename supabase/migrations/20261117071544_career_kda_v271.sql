-- V271: extend the existing read-only career response with recorded assists.
-- Prepared patch for publication; does not create or rewrite match records.
begin;
do $patch$
declare src text;needle text;
begin
 src:=pg_get_functiondef('ludus_career_private.read()'::regprocedure);
 if strpos(src,'''kda_matches''')>0 then return;end if;
 needle:='ludus_career_private.number(stats->''kills'') as kills,';
 if strpos(src,needle)=0 then raise exception 'V271 career metrics source changed';end if;
 src:=replace(src,needle,needle||'ludus_career_private.number(stats->''assists'') as assists,');
 needle:='''damage'',sum(damage),';
 if strpos(src,needle)=0 then raise exception 'V271 career grouping source changed';end if;
 src:=replace(src,needle,$fields$
   'assists',sum(assists),'assist_matches',count(assists),
   'kda_matches',count(*)filter(where kills is not null and deaths is not null and assists is not null),
   'kda_kills',sum(kills)filter(where kills is not null and deaths is not null and assists is not null),
   'kda_deaths',sum(deaths)filter(where kills is not null and deaths is not null and assists is not null),
   'kda_assists',sum(assists)filter(where kills is not null and deaths is not null and assists is not null),
   'damage',sum(damage),$fields$);
 execute src;
end
$patch$;
commit;
