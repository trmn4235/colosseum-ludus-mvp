/* Ranked invitations appear only for the logged-in recipient. */
(()=>{
 'use strict';
 if(!globalThis.LudusClient||!globalThis.supabase)return;
 const client=LudusClient.create('https://lryeeidutnlpgdesjxje.supabase.co','sb_publishable_5vKWVREHisXbfX55gePMxw_tMyZaeW1');
 let user=null,busy=false,seq=0;
 const box=document.createElement('aside');box.hidden=true;box.setAttribute('role','status');box.setAttribute('aria-live','polite');
 Object.assign(box.style,{position:'fixed',zIndex:'2147483000',right:'max(10px, env(safe-area-inset-right))',top:'max(10px, env(safe-area-inset-top))',width:'min(310px, 70vw)',padding:'10px 12px',background:'#fff8e9',border:'3px double #ae8a51',boxShadow:'0 5px 20px #0009',color:'#4a1e26',font:'14px Georgia, serif'});
 const title=document.createElement('strong'),desc=document.createElement('p'),open=document.createElement('button');title.textContent='Ranked takım daveti';desc.style.margin='5px 0 8px';open.type='button';open.textContent='Daveti gör';Object.assign(open.style,{background:'#741d2c',color:'#fff3dc',border:'1px solid #c7a16b',padding:'5px 12px',font:'bold 13px Georgia, serif'});box.append(title,desc,open);document.body.append(box);
 async function refresh(){
  if(!user||busy||document.hidden)return;busy=true;const current=++seq;
  try{const r=await client.rpc('ludus_ranked_party_v244',{p_action:'inbox'});if(current!==seq||r.error)return;const i=r.data?.invites?.[0];box.hidden=!i;if(i){desc.textContent=i.leader+' seni takımına davet etti.';open.onclick=()=>{location.href='ranked-team-v244.html?invite='+encodeURIComponent(i.id);};}}
  catch{}finally{busy=false;}
 }
 function setUser(id){
  if(id===user)return;user=id;seq++;box.hidden=true;
  if(!id)return;
  refresh();
 }
 client.auth.getUser().then(r=>setUser(r.data.user&&!r.data.user.is_anonymous?r.data.user.id:null)).catch(()=>{});
 client.auth.onAuthStateChange((_event,session)=>setTimeout(()=>setUser(session?.user&&!session.user.is_anonymous?session.user.id:null),0));
 const timer=setInterval(refresh,5000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 addEventListener('pagehide',()=>{clearInterval(timer);},{once:true});
})();
