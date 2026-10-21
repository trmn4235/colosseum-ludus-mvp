create or replace function ludus_circus_private.physics_step(state jsonb,input float8,duration float8,drive jsonb,plans jsonb)returns jsonb language plpgsql immutable set search_path='' as $$
declare dt float8:=.05;total float8:=(792+70*pi())*5;tick int:=(state->>'tick')::int;t float8:=tick*.05;dist float8:=(state->>'distance')::float8;lane float8:=(state->>'lane')::float8;heading float8:=(state->>'heading')::float8;speed float8:=(state->>'speed')::float8;wall float8:=(state->>'wall')::float8;crashes int:=(state->>'crashes')::int;impact float8:=greatest(0,(state->>'impact')::float8-.05);finish float8:=(state->>'finish')::float8;section float8;curve boolean;scale float8;metrics jsonb;target float8;nextlane float8;nextdist float8;limits float8[];i int;b jsonb;blane float8;bdist float8;
begin
 if finish is not null then return state||jsonb_build_object('tick',tick+1,'impact',impact);end if;
 section:=dist+100-floor((dist+100)/(792+70*pi()))*(792+70*pi());curve:=(section>=396 and section<396+35*pi())or section>=792+35*pi();scale:=case when curve then greatest(.2,1+lane/35)else 1 end;
 heading:=greatest(-1.2,least(1.2,heading+(greatest(-1,least(1,input))*.85+case when curve then speed/(35*scale)else 0 end)*dt));
 metrics:=ludus_circus_private.drive_metrics(drive,t::numeric,duration::numeric);target:=total/duration*case when(metrics->>'boosting')::boolean then 1.5 else 1 end;speed:=speed+greatest(-8*dt,least(3.4*dt,target-speed));
 nextlane:=lane+sin(heading)*speed*dt;nextdist:=dist+greatest(0,cos(heading))*speed*dt/scale;limits:=ludus_circus_private.physics_bounds(100+nextdist);
 if nextlane<limits[1] or nextlane>limits[2]then
  if wall=0 then crashes:=crashes+1;speed:=speed*.58;impact:=.7;end if;wall:=wall+dt;speed:=greatest(0,speed-(5+wall*7)*dt);if wall>=2.5 then speed:=0;end if;nextlane:=greatest(limits[1],least(limits[2],nextlane));
 else wall:=0;end if;
 for i in 0..2 loop
  b:=ludus_circus_private.drive_metrics(drive->'bots'->i,t::numeric,(plans->>(i::text))::numeric);bdist:=total*(b->>'progress')::float8;blane:=(array[-12,-3,5])[i+1]+sin(t*.13+i)*1.5;
  limits:=ludus_circus_private.physics_bounds(100+bdist);blane:=greatest(limits[1]+.2,least(limits[2]-.2,blane));limits:=ludus_circus_private.physics_bounds(100+nextdist);
  if abs(bdist-nextdist)<5.1 and abs(blane-nextlane)<2.8 then
   if impact=0 then crashes:=crashes+1;impact:=.6;speed:=speed*.48;end if;
   nextdist:=least(nextdist,greatest(dist,bdist-5.1));nextlane:=greatest(limits[1],least(limits[2],nextlane+case when nextlane>=blane then 1 else -1 end*.8*dt));
  end if;
 end loop;
 dist:=greatest(dist,nextdist);if dist>=total then dist:=total;finish:=(tick+1)*dt;speed:=0;end if;
 return jsonb_build_object('tick',tick+1,'distance',dist,'lane',nextlane,'heading',heading,'speed',speed,'wall',wall,'crashes',crashes,'impact',impact,'finish',finish);
end $$;
revoke all on function ludus_circus_private.physics_initial()from public,anon,authenticated;
revoke all on function ludus_circus_private.bot_drive(int)from public,anon,authenticated;
revoke all on function ludus_circus_private.physics_bounds(float8)from public,anon,authenticated;
revoke all on function ludus_circus_private.physics_step(jsonb,float8,float8,jsonb,jsonb)from public,anon,authenticated;
