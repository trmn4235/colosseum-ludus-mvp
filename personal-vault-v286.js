/* One authenticated chest for the account's existing possessions. */
(function(root){
 'use strict';
 const fmt=n=>Number(n||0).toLocaleString('tr-TR',{maximumFractionDigits:3});
 const families={diamond:'Elmas',sapphire:'Safir',emerald:'Zümrüt',ruby:'Yakut'};
 const rarity={common:'Yaygın',rare:'Nadir',very_rare:'Çok nadir',unique:'Eşsiz'};
 const categories=[['all','Tümü'],['stone','Taşlar'],['papyrus','Papirüsler'],['resource','Malzemeler'],['equipment','Ekipman'],['food','Gıda']];
 const stats={attack:'Saldırı',defense:'Savunma',speed:'Hız',durability:'Dayanıklılık',physical_power:'Fiziksel güç',physical_defense:'Fiziksel savunma',minimum_damage:'En düşük hasar',maximum_damage:'En yüksek hasar',max_hp:'Can',max_stamina:'Kondisyon',attack_speed:'Saldırı hızı',movement_speed:'Hareket hızı',block_rate:'Blok şansı',block_power:'Blok gücü',critical_rate:'Kritik şansı',critical_damage:'Kritik hasar',hp_regeneration:'Can yenilenmesi',stamina_regeneration:'Kondisyon yenilenmesi',armor_penetration:'Zırh delme',recovery_speed:'Toparlanma'};
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 function button(text,fn,cls){const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;}
 const roman=n=>['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII'][n]||String(n);
 function nameOf(row){return row.name||(row.type==='stone'?families[row.family]+(row.family==='diamond'?'':' '+roman(row.stone_id)):root.LudusProduction?.nameForItem(row)||root.LudusItemVisuals?.nameForItem(row)||'Ekipman');}
 function art(row){
  const box=el('span','personal-vault-art');
  if(row.type==='equipment'){box.innerHTML=root.LudusSupplyIcons?.svg(row)||'';return box;}
  if(row.type==='stone'&&root.LudusGems){box.innerHTML=root.LudusGems.svg(row.family,row.family==='diamond'?0:row.stone_id);return box;}
  const img=el('img');img.alt='';img.decoding='async';
  img.src=row.type==='money'?'assets/hud-v202/coin.webp':row.type==='papyrus'?'assets/art-v136/imperial-orders.webp':root.LudusProduction?.photo(row.sku)||'assets/resource-icons-v95/'+row.sku+'.webp';
  img.onerror=()=>{img.remove();box.append(el('span','personal-vault-art-fallback',nameOf(row)));};box.append(img);return box;
 }
 function locationOf(row){
  if(row.type==='papyrus')return (rarity[row.rarity]||'Papirüs')+' · '+row.role_name;
  if(row.type==='equipment')return row.on_market?'Pazarda':row.in_battle?'Savaşta':row.equipped_by?'Takılı · '+(row.equipped_name||'Gladyatör'):row.in_clan_roster?'Klan kadrosunda':'Kasada';
  if(row.retired)return 'Eski stok';
  return row.type==='resource'?(row.stage==='raw'?'Hammadde':'İşlenmiş malzeme'):row.type==='food'?'Erzak':row.type==='stone'?'Taş kesesi':'Bakiye';
 }
 function bonusPreview(row){return (row.effects||[]).map(e=>{const before=Number(row.bonuses?.find(b=>b.key===e.key)?.percent)||0;return e.label+': +%'+fmt(before)+' → +%'+fmt(before+Number(e.percent));}).join(' · ');}
 function create(ctx){
  let state=null,category='all',page=0,role=null,loading=false,busy=false,serial=0,owner=null,previousFocus=null,selected=null,detailPage=0;
  const modal=el('section','personal-vault');modal.id='personalVaultModal';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','personalVaultTitle');
  const header=el('header','personal-vault-header'),back=button('‹',close,'personal-vault-back'),title=el('h1','','Ludus Kasası'),balance=el('strong','personal-vault-balance');title.id='personalVaultTitle';back.setAttribute('aria-label','Kasayı kapat');header.append(back,title,balance);
  const nav=el('nav','personal-vault-tabs');nav.setAttribute('aria-label','Kasa bölümleri');
  const toolbar=el('div','personal-vault-toolbar'),count=el('span'),filter=el('select');filter.setAttribute('aria-label','Papirüsün çalışanı');filter.append(new Option('Bütün çalışanlar',''));
  for(const person of root.LudusSpecialPeople.roles)filter.append(new Option(person.title+' · '+person.name,person.id));
  filter.onchange=()=>{role=filter.value||null;page=0;refresh();};toolbar.append(count,filter);
  const grid=el('div','personal-vault-grid'),pager=el('nav','personal-vault-pager');pager.setAttribute('aria-label','Kasa sayfaları');
  const footer=el('footer','personal-vault-footer'),status=el('span'),retry=button('Yeniden dene',retryAction,'personal-vault-retry');status.setAttribute('role','status');retry.hidden=true;footer.append(status,retry);
  modal.append(header,nav,toolbar,grid,pager,footer);document.body.append(modal);
  const detail=el('dialog','personal-vault-detail');detail.setAttribute('aria-labelledby','vaultItemTitle');document.body.append(detail);
  function message(text,error=false){status.textContent=text;status.dataset.error=String(error);}
  function render(){
   if(modal.hidden)return;modal.setAttribute('aria-busy',String(loading||busy));balance.textContent=state?fmt(state.gold)+' denarius':'— denarius';nav.replaceChildren();
   for(const [id,label]of categories){const b=button(label,()=>{if(busy)return;category=id;page=0;role=null;refresh();});b.setAttribute('aria-pressed',String(category===id));b.disabled=busy;nav.append(b);}
   filter.hidden=category!=='papyrus';filter.value=role||'';filter.disabled=busy||loading;
   count.textContent=loading?'Envanter yükleniyor…':category==='papyrus'?fmt(state?.total)+' okunmamış papirüs':fmt(state?.total)+' kayıt';
   grid.replaceChildren();
   if(!loading&&state?.rows?.length){for(const row of state.rows){const card=button('',()=>showDetail(row),'personal-vault-card');card.dataset.type=row.type;card.dataset.key=row.key;card.setAttribute('aria-label',nameOf(row)+' · '+fmt(row.quantity)+' adet');card.append(art(row),el('strong','',nameOf(row)),el('span','personal-vault-quantity',row.type==='money'?fmt(row.quantity)+' denarius':fmt(row.quantity)+' adet'),el('small','',locationOf(row)));card.disabled=busy;grid.append(card);}}
   else grid.append(el('p','personal-vault-empty',loading?'Kasa açılıyor…':category==='papyrus'?'Kasada okunmamış papirüs yok.':'Bu bölümde eşya yok.'));
   pager.replaceChildren();const pages=Math.max(1,Math.ceil((state?.total||0)/8)),prev=button('‹',()=>{page--;refresh();}),next=button('›',()=>{page++;refresh();});prev.setAttribute('aria-label','Önceki kasa sayfası');next.setAttribute('aria-label','Sonraki kasa sayfası');prev.disabled=busy||loading||page===0;next.disabled=busy||loading||page>=pages-1;pager.append(prev,el('span','',(page+1)+' / '+pages),next);
  }
  async function refresh(){
   const request=++serial;loading=true;retry.hidden=true;render();
   try{owner=(await ctx.ready).user_id;const r=await ctx.client.rpc('ludus_personal_vault',{p_category:category,p_page:page,p_role:role});if(request!==serial)return;if(r.error)throw r.error;if(r.data?.user_id!==owner)throw Error('Kasa hesabı doğrulanamadı.');state=r.data;page=state.page;
    if(ctx.staff.pendingRead){message('Önceki okuma bekliyor. Sonucu yeniden dene ile kontrol et.');retry.hidden=false;}
   }catch(e){if(request===serial){state=null;message(e.message||'Kasa alınamadı.',true);retry.hidden=false;}}
   finally{if(request===serial){loading=false;render();}}
  }
  async function open(tab='all',worker=null){
   if(!categories.some(c=>c[0]===tab))tab='all';
   if(modal.hidden){previousFocus=document.activeElement;ctx.onOpen?.();modal.hidden=false;}
   category=tab;role=root.LudusSpecialPeople.roles.some(r=>r.id===worker)?worker:null;page=0;message('');back.focus({preventScroll:true});await refresh();
  }
  function close(){if(modal.hidden||busy)return;if(detail.open)detail.close();serial++;loading=false;modal.hidden=true;ctx.onClose?.();if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});}
  async function learn(row){
   if(busy||loading)return;busy=true;if(detail.open)detail.close();message('Papirüs okunuyor…');retry.hidden=true;render();
   try{await ctx.staff.readPaper(row);await refresh();message('Papirüs öğrenildi; çalışanın okunanlar listesine geçti.');}
   catch(e){message(e.message||'Sonuç alınamadı. Yeniden dene.',true);retry.hidden=false;}
   finally{busy=false;render();}
  }
  async function retryAction(){
   if(busy)return;if(!ctx.staff.pendingRead)return refresh();busy=true;retry.hidden=true;render();
   try{await ctx.staff.retryRead();await refresh();message('Okuma doğrulandı; papirüs çalışanın arşivinde.');}catch(e){message(e.message||'Okuma doğrulanamadı.',true);retry.hidden=false;}finally{busy=false;render();}
  }
  function showDetail(row,reset=true){
   selected=row;if(reset)detailPage=0;detail.replaceChildren();const heading=el('h2','',nameOf(row));heading.id='vaultItemTitle';detail.append(heading);
   const info=el('div','personal-vault-detail-body'),text=el('div','personal-vault-detail-text');info.append(art(row),text);detail.append(info);
   text.append(el('p','',locationOf(row)),el('p','',fmt(row.quantity)+(row.type==='money'?' denarius':' adet')));
   if(row.type==='papyrus'){
    text.append(el('p','vault-bonus-preview',bonusPreview(row)||'Bu çalışanın papirüs bonusu henüz belirlenmedi.'));
    if(row.unique_id)text.append(el('p','','Sunucuda tek nüsha · İlk bulan: '+row.finder+' · '+new Date(row.found_at).toLocaleDateString('tr-TR',{timeZone:'Europe/Istanbul'})));
    if(row.effects?.length)text.append(el('p','',row.unique_id?'Öğrenildiğinde pasif bonus kazanılır.':'Öğrenildiğinde +0,2 overall kazanılır.'));
   }
   if(row.type==='equipment'){
    const entries=Object.entries(row.base_stats||{}).map(([k,v])=>[stats[k]||k,fmt(v)]);
    for(const [field,label]of [['sapphires','Safir'],['emeralds','Zümrüt'],['rubies','Yakut']])for(const s of row[field]||[])entries.push([label+' '+roman(s.id||s.stone_id||s.stone||s),s.percent!=null?'%'+fmt(s.percent):'Takılı']);
    const dl=el('dl','personal-vault-stats');for(const [label,value]of entries.slice(detailPage*4,detailPage*4+4))dl.append(el('dt','',label),el('dd','',value));text.append(dl);
    if(entries.length>4){const controls=el('div','personal-vault-detail-pages'),prev=button('‹',()=>{detailPage--;showDetail(row,false);}),next=button('›',()=>{detailPage++;showDetail(row,false);});prev.setAttribute('aria-label','Önceki eşya özellikleri');next.setAttribute('aria-label','Sonraki eşya özellikleri');prev.disabled=detailPage===0;next.disabled=(detailPage+1)*4>=entries.length;controls.append(prev,el('span','',(detailPage+1)+' / '+Math.ceil(entries.length/4)),next);text.append(controls);}
   }
   const actions=el('div','personal-vault-detail-actions');actions.append(button('Kapat',()=>detail.close()));
   if(row.type==='papyrus'){
    actions.append(button(row.role_name+' profili',()=>{detail.close();close();ctx.staff.open(row.role);}));
    const read=button(row.effects?.length?'Papirüsü okut':'Henüz okunamaz',()=>learn(row),'personal-vault-learn');read.disabled=!row.effects?.length||busy||!!ctx.staff.pendingRead;actions.append(read);
   }
   detail.append(actions);if(!detail.open)detail.showModal();actions.firstElementChild.focus({preventScroll:true});
  }
  modal.addEventListener('pointerdown',e=>e.stopPropagation());
  modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'){const a=[...modal.querySelectorAll('button:not(:disabled),select:not(:disabled)')].filter(n=>n.getClientRects().length);if(e.shiftKey&&document.activeElement===a[0]){e.preventDefault();a.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===a.at(-1)){e.preventDefault();a[0]?.focus();}}});
  let chest=null,chestPromise=null,lastAttempt=0;
  const marker=button('Kasa',()=>open(),'staff-world-action room-world-action');marker.id='personalVaultMarker';marker.hidden=true;marker.setAttribute('aria-label','Ludus kasasını aç');document.body.append(marker);
  const point=ctx.T?new ctx.T.Vector3(-3.15,1.35,-1.8):null;
  async function loadChest(){
   if(chest)return chest;if(chestPromise)return chestPromise;if(Date.now()-lastAttempt<15000)return null;lastAttempt=Date.now();
   const T=ctx.T;
   chestPromise=(async()=>{const g=await new T.GLTFLoader().loadAsync('clan-chest-v35.glb?v=revision35'),source=g.scene,box=new T.Box3().setFromObject(source),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3()),scale=1.65/Math.max(size.x,size.z);source.scale.setScalar(scale);source.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);const group=new T.Group();group.name='Ludus kişisel kasası';group.add(source);if(size.z>size.x)group.rotation.y=-Math.PI/2;group.position.set(-3.15,0,-1.8);source.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});chest=group;point.y=size.y*scale+.3;return group;})().catch(e=>{console.warn('Ludus kasası modeli',e.message);return null;}).finally(()=>{chestPromise=null;});return chestPromise;
  }
  function tick(){
   if(!ctx.inRoom?.()){marker.hidden=true;return;}
   if(!chest){loadChest();return;}
   if(chest.parent!==ctx.props){ctx.props.add(chest);ctx.invalidate?.();}
   if(!ctx.colliders.some(c=>c.kind==='personal-vault')){chest.updateMatrixWorld(true);const box=new ctx.T.Box3().setFromObject(chest);ctx.colliders.push({kind:'personal-vault',minX:box.min.x,maxX:box.max.x,minZ:box.min.z,maxZ:box.max.z});}
   root.LudusRoomActions.place(marker,point,ctx,modal.hidden,4.5);
  }
  return {open,close,refresh,tick,get visible(){return !modal.hidden;},get state(){return state;},get chest(){return chest;}};
 }
 root.LudusPersonalVault={create,nameOf,bonusPreview};
})(globalThis);
