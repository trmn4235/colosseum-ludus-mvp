/* V254: one dismissible, clan-originated invitation below the shared top menu. */
(()=>{
 'use strict';
 if(!globalThis.LudusClient||!globalThis.supabase||document.getElementById('rankedInvite'))return;
 const client=LudusClient.create('https://lryeeidutnlpgdesjxje.supabase.co','sb_publishable_5vKWVREHisXbfX55gePMxw_tMyZaeW1');
 if(typeof client?.auth?.getUser!=='function'||typeof client?.rpc!=='function')return;
 const battlePage=/\/(?:ranked-team-v244|arena|multiplayer|caravan-field|circus-maximus)\.html$/.test(location.pathname);
 const blocked=()=>battlePage||!!document.querySelector('[data-duel-active="true"]');
 let user=null,busy=false,joining=false,seq=0,timer=0,expiry=0,stopped=false,paused=false,active=null,dismissed=[],drag=null,header=null;
 const box=document.createElement('aside');box.id='rankedInvite';box.hidden=true;box.tabIndex=0;box.setAttribute('role','status');box.setAttribute('aria-live','polite');box.setAttribute('aria-label','Ranked daveti. Sağa kaydırarak veya Escape ile kapat.');
 Object.assign(box.style,{position:'fixed',zIndex:'2147483000',right:'max(10px, env(safe-area-inset-right))',top:'calc(env(safe-area-inset-top) + 62px)',boxSizing:'border-box',width:'min(360px, calc(100vw - 20px))',padding:'9px 12px',background:'#fff8e9',border:'3px double #ae8a51',borderRadius:'5px',boxShadow:'0 5px 20px #0006',color:'#4a1e26',font:'14px Georgia, serif',touchAction:'pan-y',userSelect:'none'});
 const row=document.createElement('div'),desc=document.createElement('strong'),open=document.createElement('button'),error=document.createElement('p');
 Object.assign(row.style,{display:'flex',alignItems:'center',gap:'12px'});Object.assign(desc.style,{flex:'1',minWidth:'0',overflowWrap:'anywhere'});
 open.type='button';open.textContent='KATIL';Object.assign(open.style,{flex:'none',minHeight:'40px',background:'#741d2c',color:'#fff3dc',border:'1px solid #c7a16b',borderRadius:'3px',padding:'8px 14px',font:'bold 14px Georgia, serif',touchAction:'manipulation'});
 error.hidden=true;error.style.margin='6px 0 0';error.setAttribute('role','alert');row.append(desc,open);box.append(row,error);document.body.append(box);
 const resize=new ResizeObserver(()=>{if(!box.hidden)position();});
 function position(){
  const next=[...document.querySelectorAll('#ludusHud,.ludus-menu,body>header,.rome-header,.top')].find(e=>{const b=e.getBoundingClientRect();return b.height>0&&b.top>=-1&&b.top<innerHeight/3;});
  if(next!==header){resize.disconnect();header=next;if(header)resize.observe(header);}
  if(header)box.style.top=Math.max(8,header.getBoundingClientRect().bottom+8)+'px';
  else box.style.top='calc(env(safe-area-inset-top) + 62px)';
 }
 function hide(){box.hidden=true;active=null;drag=null;box.style.transform='';box.style.opacity='';clearTimeout(expiry);}
 function remember(id){dismissed=[...dismissed.filter(x=>x!==id),id].slice(-24);try{sessionStorage.setItem('ranked-dismissed-v254:'+user,JSON.stringify(dismissed));}catch{}}
 function dismiss(){if(!active||joining)return;const id=active.id;remember(id);hide();Promise.resolve(client.rpc('ludus_ranked_party_v253',{p_action:'decline',p_invite:id})).catch(()=>{});}
 function show(i,serverNow){
  if(joining||blocked())return;
  if(!i){hide();return;}
  const remaining=Date.parse(i.expires_at)-Date.parse(serverNow||new Date().toISOString());
  if(remaining<=0){hide();return;}
  if(active?.id!==i.id){error.hidden=true;open.disabled=false;box.style.transform='';box.style.opacity='';}
  active=i;desc.textContent=i.leader+'’ten Ranked 5v5';box.hidden=false;position();
  clearTimeout(expiry);expiry=setTimeout(()=>{if(active?.id===i.id)hide();},Math.min(Number.isFinite(remaining)?remaining:180000,180000));
 }
 async function refresh(){
  clearTimeout(timer);if(!user||stopped||document.hidden)return;if(busy){timer=setTimeout(refresh,250);return;}
  const pause=blocked();if(pause){hide();if(paused)return;}else paused=false;
  busy=true;const current=seq;let delay=15000;
  try{
   const r=await client.rpc('ludus_ranked_invites_v254',{p_action:pause?'pause':'pulse'});
   if(current!==seq||stopped)return;
   if(!r.error){paused=pause;delay=Math.max(1000,Math.min(15000,Number(r.data?.next_in_ms)||15000));
    if(!pause)show((r.data?.invites||[]).find(i=>!dismissed.includes(i.id)),r.data?.server_now);}
  }catch{}finally{busy=false;if(current===seq&&user&&!stopped&&!document.hidden&&!pause)timer=setTimeout(refresh,delay);}
 }
 open.onclick=async()=>{
  if(!active||joining)return;joining=true;open.disabled=true;error.hidden=true;const id=active.id,current=seq;
  try{
   const r=await client.rpc('ludus_ranked_party_v253',{p_action:'accept',p_invite:id});
   if(current!==seq||stopped)return;if(r.error)throw r.error;
   if(!r.data?.party?.members?.some(m=>m.user_id===user))throw Error('Takıma katılım doğrulanamadı.');
   location.href='ranked-team-v244.html?v=254';
  }catch(e){if(current===seq){error.textContent=e.message||'Katılım tamamlanamadı. Yeniden dene.';error.hidden=false;}}
  finally{joining=false;open.disabled=false;}
 };
 box.addEventListener('pointerdown',e=>{if(joining||e.button>0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0};});
 box.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(Math.abs(dy)>30&&Math.abs(dy)>Math.abs(dx)){drag=null;box.style.transform='';box.style.opacity='';return;}
  drag.dx=Math.max(0,dx);if(dx>8){box.setPointerCapture?.(e.pointerId);box.style.transform='translateX('+drag.dx+'px)';box.style.opacity=String(Math.max(.2,1-drag.dx/box.clientWidth));}
 });
 box.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const remove=drag.dx>=Math.min(80,box.clientWidth*.25);drag=null;box.style.transform='';box.style.opacity='';if(remove){e.preventDefault();dismiss();}});
 box.addEventListener('pointercancel',()=>{drag=null;box.style.transform='';box.style.opacity='';});
 box.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();dismiss();}});
 function setUser(id){
  if(id===user)return;seq++;clearTimeout(timer);hide();user=id;paused=false;joining=false;dismissed=[];
  if(id){try{const saved=JSON.parse(sessionStorage.getItem('ranked-dismissed-v254:'+id)||'[]');if(Array.isArray(saved))dismissed=saved.filter(x=>typeof x==='string').slice(-24);}catch{}if(busy)timer=setTimeout(refresh,250);else refresh();}
 }
 client.auth.getUser().then(r=>setUser(r.data?.user&&!r.data.user.is_anonymous?r.data.user.id:null)).catch(()=>{});
 client.auth.onAuthStateChange?.((_event,session)=>setTimeout(()=>setUser(session?.user&&!session.user.is_anonymous?session.user.id:null),0));
 const duel=new MutationObserver(()=>{if(blocked()!==paused)refresh();});duel.observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-duel-active']});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timer);hide();}else refresh();});
 addEventListener('resize',()=>{if(!box.hidden)position();});
 addEventListener('pagehide',()=>{stopped=true;seq++;clearTimeout(timer);clearTimeout(expiry);resize.disconnect();});
 addEventListener('pageshow',e=>{if(e.persisted){stopped=false;paused=false;header=null;refresh();}});
})();
