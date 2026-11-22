/* Demirci medical supplies. Recipes, inventory and committed costs come from the server. */
(function(root){
 'use strict';
 const RPC='ludus_infirmary_v289',LIMIT=100;
 const integer=n=>Number.isSafeInteger(Number(n))&&Number(n)>=0?Number(n):0;
 function preview(recipe,quantity,inventory=[]){
  const count=Number(quantity),valid=Number.isSafeInteger(count)&&count>=1&&count<=LIMIT;
  const ingredients=(recipe?.ingredients||[]).map(i=>({...i,owned:integer(i.owned),required:integer(i.quantity)*(valid?count:0)}));
  const stock=integer(inventory.find(i=>i.sku===recipe?.sku)?.quantity),output=integer(recipe?.output_quantity)||1;
  const maximum=Math.min(LIMIT,integer(recipe?.max_craftable));
  return{quantity:count,valid,maximum,ingredients:ingredients.map(i=>({...i,remaining:i.owned-i.required,enough:i.owned>=i.required})),owned:stock,output:valid?count*output:0,after:stock+(valid?count*output:0),canCraft:!!recipe&&valid&&count<=maximum&&ingredients.length>0&&ingredients.every(i=>i.owned>=i.required)};
 }
 function createStore(ctx){
  let data=null,owner=null,pending=null,busy=false,loading=false,error='',notice='',identifyPromise=null,epoch=0;
  const storage=ctx.storage||(typeof localStorage!=='undefined'?localStorage:null),listeners=new Set();
  const snapshot=()=>({data,owner,pending,busy,loading,error,notice});
  const emit=()=>{for(const listener of listeners)listener(snapshot());};
  const key=()=> 'ludus-medical-craft-v289:'+owner;
  function persist(){
   if(pending){if(!storage)throw Error('Üretim işlem kaydı saklanamadı. Depolamayı açıp yeniden dene.');storage.setItem(key(),JSON.stringify(pending));}
   else if(storage)try{storage.removeItem(key());}catch{} // A leftover completed receipt safely replays after reopening.
  }
  async function identify(){
   if(owner)return owner;
   if(!identifyPromise)identifyPromise=Promise.resolve(ctx.ready).then(account=>{
    owner=account?.user_id;if(!owner)throw Error('Ludus hesabı bulunamadı.');
    try{const saved=JSON.parse(storage?.getItem(key())||'null');if(saved?.owner===owner&&saved.sku&&Number.isInteger(saved.quantity)&&saved.quantity>=1&&saved.quantity<=LIMIT&&/^[0-9a-f-]{36}$/i.test(saved.request||''))pending=saved;}catch{}
    return owner;
   }).catch(e=>{identifyPromise=null;throw e;});
   return identifyPromise;
  }
  function adopt(value){
   if(!value||value.user_id!==owner||!Array.isArray(value.recipes)||!Array.isArray(value.inventory))throw Error('Üretim hesabı doğrulanamadı.');
   data=value;return value;
  }
  async function refresh(){
   if(busy)return data;
   const request=++epoch;loading=true;error='';emit();
   try{await identify();const result=await ctx.client.rpc(RPC,{p_action:'state',p_args:{},p_request:null});if(request!==epoch)return data;if(result.error)throw result.error;adopt(result.data);}
   catch(e){if(request===epoch)error=e.message||'Üretim bilgileri alınamadı.';}
   finally{if(request===epoch){loading=false;emit();}}
   return data;
  }
  async function craft(sku,quantity){
   if(busy)return false;
   await identify();if(busy)return false;
   if(pending&&(pending.sku!==sku||pending.quantity!==Number(quantity)))throw Error('Önce bekleyen üretimin sonucunu kontrol et.');
   if(!pending){const recipe=data?.recipes.find(r=>r.sku===sku);if(!preview(recipe,quantity,data?.inventory).canCraft)throw Error('Üretim miktarı veya malzeme stoğu uygun değil.');pending={owner,sku,quantity:Number(quantity),request:(ctx.uuid||(()=>root.crypto.randomUUID()))()};}
   try{persist();}catch{error='Üretim işlem kaydı saklanamadı. Üretim başlamadı; aynı işlemi yeniden dene.';emit();return false;}
   ++epoch;loading=false;busy=true;error='';notice='';emit();
   try{
    const result=await ctx.client.rpc(RPC,{p_action:'craft',p_args:{sku:pending.sku,quantity:pending.quantity},p_request:pending.request});
    if(result.error){if(['P0001','22P02','22003','23514','42501'].includes(result.error.code)){pending=null;persist();}throw result.error;}
    adopt(result.data);const outcome=data.outcome;
    if(!outcome||outcome.action!=='craft'||outcome.request_id!==pending.request)throw Error('Üretim sonucu doğrulanamadı. Aynı işlemi yeniden kontrol et.');
    const name=data.recipes.find(r=>r.sku===outcome.sku)?.name||'Tıbbi malzeme';notice=outcome.quantity+' '+name+' Ludus deposuna eklendi.';pending=null;persist();
    try{await ctx.onCraft?.(data);}catch{}
    return true;
   }catch(e){error=(pending?'Yanıt kesinleşmedi. Aynı işlemi yeniden kontrol et. ':'')+(e.message||'Bağlantı hatası');return false;}
   finally{busy=false;emit();}
  }
  return Object.freeze({refresh,craft,snapshot,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}});
 }
 function create(ctx){
  const store=createStore(ctx),doc=ctx.document||root.document;
  let opened=false,selection=null,quantity=1,returnTo=null,lastFocus=null,renderFocus=null;
  const el=(tag,cls,text)=>{const node=doc.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const btn=(text,action,cls='')=>{const node=el('button',cls,text);node.type='button';node.addEventListener('click',action);return node;};
  const modal=el('section','medsup289');modal.id='medicalSuppliesModal';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','medicalSuppliesTitle');
  const head=el('header','medsup289-head'),back=btn('‹',()=>close(),'medsup289-back');back.setAttribute('aria-label','Geri dön');const title=el('h1','','Demirci · Tıbbi malzeme');title.id='medicalSuppliesTitle';const reload=btn('Yenile',()=>store.refresh(),'medsup289-reload');head.append(back,title,reload);
  const intro=el('p','medsup289-intro','Demirci üretir, Ludus deposu saklar, Doktor tedavide kullanır.');
  const body=el('div','medsup289-body'),catalog=el('nav','medsup289-catalog');catalog.setAttribute('aria-label','Tıbbi üretim tarifleri');const detail=el('section','medsup289-detail');detail.setAttribute('aria-label','Seçili tarif ve üretim miktarı');detail.tabIndex=-1;body.append(catalog,detail);
  const footer=el('footer','medsup289-footer'),status=el('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');const retry=btn('Yeniden kontrol et',()=>{const s=store.snapshot();s.pending?store.craft(s.pending.sku,s.pending.quantity):store.refresh();},'medsup289-retry');footer.append(status,retry);modal.append(head,intro,body,footer);doc.body.append(modal);
  const num=n=>Number(n).toLocaleString('tr-TR');
  function art(sku){const path=root.LudusProduction?.photo(sku);if(!path)return null;const img=el('img','medsup289-art');img.src=path;img.alt='';img.loading='lazy';img.addEventListener('error',()=>img.hidden=true,{once:true});return img;}
  function render(){
   if(!opened)return;const s=store.snapshot(),recipes=s.data?.recipes||[],locked=s.busy||!!s.pending;
   const focused=doc.activeElement;
   if(focused!==detail)renderFocus=focused&&(catalog.contains(focused)||detail.contains(focused))?{id:focused.id,recipe:focused.dataset.recipe,craft:focused.dataset.craft,label:focused.getAttribute('aria-label')}:null;
   function restoreFocus(){
    if(!opened||!renderFocus)return;
    const candidates=[...modal.querySelectorAll('button,input')],key=renderFocus,target=candidates.find(n=>key.id?n.id===key.id:key.recipe?n.dataset.recipe===key.recipe:key.craft?n.dataset.craft===key.craft:key.label&&n.getAttribute('aria-label')===key.label);
    const next=target&&!target.disabled?target:detail.querySelector('[data-craft]:not(:disabled)')||detail;
    next.focus({preventScroll:true});if(next!==detail)renderFocus=null;
   }
   if(s.pending){selection=s.pending.sku;quantity=s.pending.quantity;}
   if(!recipes.some(r=>r.sku===selection))selection=recipes[0]?.sku||null;
   modal.setAttribute('aria-busy',String(s.loading||s.busy));catalog.replaceChildren();detail.replaceChildren();reload.disabled=s.busy||s.loading;retry.hidden=!s.error&&!s.pending;retry.disabled=s.busy||s.loading;
   status.textContent=s.busy?'Üretim işleniyor…':s.error||s.notice||(s.pending?'Bekleyen üretimin sonucunu kontrol et.':s.loading?'Depo ve tarifler yükleniyor…':'Malzemeler yalnızca Üret düğmesine bastığında tüketilir.');status.dataset.error=String(!!s.error);
   if(!s.data){detail.append(el('p','medsup289-empty',s.loading?'Üretim defteri açılıyor…':'Üretim bilgileri henüz alınamadı.'));restoreFocus();return;}
   for(const recipe of recipes){const card=btn('',()=>{selection=recipe.sku;quantity=1;render();},'medsup289-recipe');card.dataset.recipe=recipe.sku;card.disabled=locked;card.setAttribute('aria-pressed',String(recipe.sku===selection));const image=art(recipe.sku);if(image)card.append(image);card.append(el('strong','',recipe.name),el('span','',num(s.data.inventory.find(i=>i.sku===recipe.sku)?.quantity||0)+' depoda'));catalog.append(card);}
   const recipe=recipes.find(r=>r.sku===selection);if(!recipe){detail.append(el('p','medsup289-empty','Bu bölümde üretim tarifi bulunmuyor.'));restoreFocus();return;}
   const p=preview(recipe,quantity,s.data.inventory),heading=el('div','medsup289-heading');heading.append(el('h2','',recipe.name),el('p','',s.pending?num(p.owned)+' depoda · '+num(quantity)+' adet üretim kontrol ediliyor':num(p.owned)+' depoda → '+num(p.after)+' depoda'));
   const controls=el('div','medsup289-quantity'),label=el('label','','Üretim adedi'),input=el('input');input.id='medicalCraftQuantity';input.type='number';input.min='1';input.max=String(LIMIT);input.step='1';input.inputMode='numeric';input.value=String(quantity);input.disabled=locked;label.htmlFor=input.id;
   const minus=btn('−',()=>changeQuantity(quantity-1)),plus=btn('+',()=>changeQuantity(quantity+1));minus.setAttribute('aria-label','Üretim adedini azalt');plus.setAttribute('aria-label','Üretim adedini artır');minus.disabled=locked||quantity<=1;plus.disabled=locked||quantity>=LIMIT;
   controls.append(label,minus,input,plus,el('small','','En çok '+num(p.maximum)+' adet'));
   const wrap=el('div','medsup289-materials'),table=el('table'),thead=el('thead'),tr=el('tr');for(const text of ['Malzeme','Depoda','Gereken','Kalan']){const th=el('th','',text);th.scope='col';tr.append(th);}thead.append(tr);const tbody=el('tbody');
   for(const ingredient of p.ingredients){const row=el('tr');row.dataset.enough=String(ingredient.enough);for(const value of [ingredient.name,num(ingredient.owned),num(ingredient.required),ingredient.enough?num(ingredient.remaining):num(-ingredient.remaining)+' eksik'])row.append(el('td','',value));tbody.append(row);}table.append(thead,tbody);wrap.append(table);
   const action=btn(s.busy?'Üretiliyor…':s.pending?'Aynı üretimi kontrol et':p.canCraft?num(p.output)+' adet üret':'Malzeme yetersiz',()=>store.craft(recipe.sku,quantity).catch(e=>{status.textContent=e.message;status.dataset.error='true';}),'medsup289-primary');action.dataset.craft=recipe.sku;action.disabled=s.busy||s.loading||(!s.pending&&!p.canCraft);
   const note=el('p','medsup289-destination',s.pending?'Sonuç kontrolü aynı üretimi ikinci kez tüketmez.':'Çıktı: '+num(p.output)+' '+recipe.name+' · Ludus deposuna');detail.append(heading,controls,wrap,note,action);
   // Update the preview in place so typing and the first subsequent click keep their targets.
   function updateQuantity(){
    if(locked||!input.isConnected||store.snapshot().busy||store.snapshot().pending)return;
    const value=Number(input.value);if(Object.is(value,quantity))return;quantity=value;
    const next=preview(recipe,quantity,s.data.inventory);
    heading.querySelector('p').textContent=num(next.owned)+' depoda → '+num(next.after)+' depoda';
    tbody.replaceChildren();for(const ingredient of next.ingredients){const row=el('tr');row.dataset.enough=String(ingredient.enough);for(const value of [ingredient.name,num(ingredient.owned),num(ingredient.required),ingredient.enough?num(ingredient.remaining):num(-ingredient.remaining)+' eksik'])row.append(el('td','',value));tbody.append(row);}
    minus.disabled=quantity<=1;plus.disabled=quantity>=LIMIT;action.disabled=s.busy||s.loading||!next.canCraft;action.textContent=!next.valid?'1–100 arasında adet gir':next.canCraft?num(next.output)+' adet üret':'Malzeme yetersiz';
    note.textContent='Çıktı: '+num(next.output)+' '+recipe.name+' · Ludus deposuna';
   }
   input.addEventListener('input',updateQuantity);input.addEventListener('change',updateQuantity);
   restoreFocus();
  }
  function changeQuantity(value){if(store.snapshot().busy||store.snapshot().pending)return;quantity=Number.isSafeInteger(value)?Math.max(1,Math.min(LIMIT,value)):1;render();doc.getElementById('medicalCraftQuantity')?.focus();}
  async function open(options={}){returnTo=typeof options.returnTo==='function'?options.returnTo:null;if(!opened){lastFocus=doc.activeElement;opened=true;modal.hidden=false;ctx.onOpen?.();}render();back.focus();await store.refresh();return store.snapshot().data;}
  function close({returnBack=true}={}){if(!opened)return;opened=false;modal.hidden=true;ctx.onClose?.();const next=returnTo;returnTo=null;if(returnBack&&next)next();else if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});}
  store.subscribe(render);
  modal.addEventListener('pointerdown',e=>e.stopPropagation());modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}else if(e.key==='Tab'){const all=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(n=>!n.hidden&&n.getClientRects().length);if(e.shiftKey&&doc.activeElement===all[0]){e.preventDefault();all.at(-1)?.focus();}else if(!e.shiftKey&&doc.activeElement===all.at(-1)){e.preventDefault();all[0]?.focus();}}});
  return Object.freeze({open,close,refresh:store.refresh,get opened(){return opened;},get state(){return store.snapshot().data;}});
 }
 const api={create,createStore,preview};if(typeof module!=='undefined')module.exports=api;else root.LudusInfirmarySuppliesV289=api;
})(typeof globalThis!=='undefined'?globalThis:this);
