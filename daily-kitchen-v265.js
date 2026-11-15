/* V265: choose today's ingredients; only a confirmed server receipt consumes stock. */
var LudusFood=(()=>{
 'use strict';
 const num=n=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:1}).format(n||0);
 const dayLabel=d=>new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',timeZone:'Europe/Istanbul'}).format(new Date(d+'T12:00:00Z'));
 const foodSkus=new Set(['grain','apple','fish','meat','egg','bread','meal']);
 function menu(crew,ingredients){
  const portions=ingredients.reduce((n,i)=>n+(foodSkus.has(i.sku)?i.quantity:0),0),types=new Set(ingredients.filter(i=>i.quantity>0).map(i=>['bread','meal'].includes(i.sku)?'grain':i.sku)).size;
  const goal=Math.min(5,Math.max(0,crew)),variety=goal?Math.min(100,Math.round(types/goal*1000)/10):0,coverage=crew?Math.min(100,Math.round(portions/crew*1000)/10):0;
  return {portions,types,variety,coverage,goal,quality:coverage===100?variety:0};
 }
 function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
 function button(text,action,cls=''){const b=el('button',cls,text);b.type='button';b.onclick=action;return b;}
 function picture(item){const i=el('img');i.src=['bread','meal'].includes(item.sku)?'assets/dining/icons/'+item.sku+'-v57.svg':'assets/resource-icons-v95/'+item.sku+'.webp';i.alt='';i.decoding='async';return i;}
 function create(ctx){
  const opener=button('',open,'room-world-action food-cauldron');opener.id='foodOpen';opener.hidden=true;opener.title='Bugünün mutfağı';opener.setAttribute('aria-label','Mutfağı aç');opener.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 10h14v5a7 7 0 0 1-14 0Zm-2 1h2m14 0h2M8 21l1-2m6 0 1 2M8 7c-2-2 2-3 0-5m4 5c-2-2 2-3 0-5m4 5c-2-2 2-3 0-5"/></svg>';document.body.append(opener);
  const point=ctx.T?new ctx.T.Vector3(-3.55,1.50,-2.9):null;
  const modal=el('section','kitchen');modal.id='foodModal';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','foodTitle');
  const frame=el('div','kitchen-frame'),header=el('header','kitchen-header'),back=button('',close,'kitchen-back'),title=el('div','kitchen-title'),h=el('h1','','Mutfak'),date=el('span','kitchen-date');h.id='foodTitle';back.setAttribute('aria-label','Mutfağı kapat');back.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m13 5-7 7 7 7M6 12h14"/></svg>';title.append(el('small','','LUDUS · BUGÜNÜN YEMEĞİ'),h);header.append(back,title,date);
  const body=el('div','kitchen-body'),main=el('section','kitchen-menu'),inventory=el('aside','kitchen-inventory'),feedback=el('footer','kitchen-feedback'),status=el('p','kitchen-status'),retry=button('Yeniden dene',()=>pending?submit():refresh(),'kitchen-retry');status.setAttribute('role','status');status.setAttribute('aria-live','polite');retry.hidden=true;feedback.append(status,retry);body.append(main,inventory);frame.append(header,body,feedback);modal.append(frame);document.body.append(modal);
  let state=null,owner=null,key=null,pending=null,busy=false,loading=null,opened=false,lastFocus=null,draft={},draftDay=null,draftRevision=null,offset=0,lastRefresh=0,lastAttempt=0,nextTick=0,shopping=false,product='grain',buyQuantity=1;
  function message(text,error=false){status.textContent=text;status.dataset.error=String(error);}
  function place(){if(point&&globalThis.LudusRoomActions)LudusRoomActions.place(opener,point,ctx,ctx.inRoom()&&!opened,8);else opener.hidden=!ctx.inRoom()||opened||ctx.blocked();}
  function ingredients(){const merged=new Map((state?.kitchen?.ingredients||[]).map(i=>[i.sku,i.quantity]));for(const [sku,q]of Object.entries(draft))merged.set(sku,(merged.get(sku)||0)+q);return [...merged].filter(([,q])=>q>0).map(([sku,quantity])=>({sku,quantity}));}
  function adopt(data){
   if(data.user_id!==owner)throw Error('Hesap doğrulanamadı. Sayfayı yenile.');
   if(draftDay&&(draftDay!==data.today||draftRevision!==data.kitchen?.revision)){draft={};draftDay=null;draftRevision=null;message('Günlük menü yenilendi. Seçimini tekrar yapabilirsin.');}
   state=data;offset=Date.parse(data.server_now)-Date.now();lastRefresh=Date.now();ctx.onWallet?.(data.gold);render();
  }
  async function identify(){if(owner)return;const account=await ctx.ready;owner=account.user_id;key='ludus-kitchen-pending-v265:'+owner;try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.owner===owner&&saved.request&&['serve','buy'].includes(saved.action))pending=saved;else{const legacy=JSON.parse(localStorage.getItem('ludus-food-pending-v55:'+owner)||'null');if(legacy?.owner===owner&&legacy.request&&legacy.sku)pending={...legacy,action:'buy',legacy:true};}}catch{message('İşlem kaydı okunamadı.',true);}}
  async function refresh(){if(loading)return loading;lastAttempt=Date.now();loading=(async()=>{await identify();if(busy)return;const r=await ctx.client.rpc('ludus_food_state');if(r.error)throw r.error;adopt(r.data);retry.hidden=!pending;if(pending)message('Önceki işlemin sonucu bekliyor. Yeniden dene ile kontrol et.');})().catch(e=>{message(e.message||'Mutfak yüklenemedi.',true);retry.hidden=false;}).finally(()=>{loading=null;render();});render();return loading;}
  function change(sku,amount){
   if(!state||busy||loading||pending)return;const item=state.items.find(i=>i.sku===sku);if(!item)return;
   const current=draft[sku]||0,next=Math.max(0,current+amount),combined=ingredients(),m=menu(state.crew_count,combined),given=state.kitchen.ingredients.find(i=>i.sku===sku)?.quantity||0;
   if(next>item.quantity)return;
   if(amount>0&&foodSkus.has(sku)&&m.portions>=state.crew_count){message('Bugünün porsiyonları tamam. Seçimden bir porsiyon çıkararak değiştirebilirsin.');return;}
   if(amount>0&&!foodSkus.has(sku)&&given+next>state.crew_count)return;
   if(!draftDay){draftDay=state.today;draftRevision=state.kitchen.revision;}
   draft[sku]=next;if(!next)delete draft[sku];message('');render();
  }
  function gauge(label,value,detail,percent){const box=el('div','kitchen-gauge'),line=el('div','kitchen-gauge-label'),track=el('div','kitchen-track'),fill=el('span');line.append(el('h3','',label),el('strong','',value));track.setAttribute('role','meter');track.setAttribute('aria-label',label);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(percent));fill.style.width=percent+'%';track.append(fill);box.append(line,track,el('small','',detail));return box;}
  function render(){
   const focus=document.activeElement?.dataset.focus;main.replaceChildren();inventory.replaceChildren();modal.setAttribute('aria-busy',String(busy||loading));
   if(!state){main.append(el('p','kitchen-empty','Mutfak yükleniyor…'));return;}
   if(!state.kitchen){main.append(el('p','kitchen-empty','Günlük mutfak hazırlanıyor. Biraz sonra yeniden dene.'));return;}
   const locked=busy||!!loading||!!pending,crew=state.crew_count,chosen=ingredients(),m=menu(crew,chosen),given=state.kitchen.ingredients,changed=Object.values(draft).some(q=>q>0);
   date.textContent=dayLabel(state.today)+' · '+num(crew)+' gladyatör';
   const head=el('div','kitchen-section-head');head.append(el('h2','','Bugünün malzemeleri'),el('span','',given.length?'Yemek verildi':'Henüz yemek verilmedi'));main.append(head);
   const slots=el('div','kitchen-slots');slots.setAttribute('aria-label','Bugünün seçilen malzemeleri');
   for(let k=0;k<Math.max(8,chosen.length);k++){
    const selected=chosen[k],slot=el('article','kitchen-slot');
    if(!selected){slot.dataset.empty='true';slot.append(el('span','kitchen-slot-plus','+'),el('small','','Malzeme seç'));}
    else{const item=state.items.find(i=>i.sku===selected.sku);slot.dataset.sku=item.sku;const art=el('div','kitchen-slot-art'),quantity=el('strong','kitchen-slot-quantity',num(selected.quantity));art.append(picture(item),quantity);slot.append(art,el('h3','',item.name));const delivered=given.find(i=>i.sku===item.sku)?.quantity||0,edit=el('div','kitchen-slot-edit'),minus=button('−',()=>change(item.sku,-1)),plus=button('+',()=>change(item.sku,1));minus.dataset.focus='minus-'+item.sku;plus.dataset.focus='plus-'+item.sku;minus.setAttribute('aria-label',item.name+' seçimini azalt');plus.setAttribute('aria-label',item.name+' seçimini artır');minus.disabled=locked||!draft[item.sku];plus.disabled=locked||(draft[item.sku]||0)>=item.quantity||(foodSkus.has(item.sku)?m.portions>=crew:selected.quantity>=crew);edit.append(minus,el('small','',delivered?num(delivered)+' verildi':'Seçildi'),plus);slot.append(edit);}
    slots.append(slot);
   }
   main.append(slots);const gauges=el('div','kitchen-gauges');gauges.append(gauge('Çeşitlilik',num(Math.min(m.types,m.goal))+' / '+num(m.goal)+' çeşit','Farklı malzemeler çeşitliliği artırır.',m.variety),gauge('Porsiyon',num(m.portions)+' / '+num(crew),crew?num(Math.max(0,crew-m.portions))+' porsiyon eksik':'Henüz gladyatör yok.',m.coverage));main.append(gauges);
   const actions=el('div','kitchen-actions'),serve=button(busy?'İşleniyor…':given.length?'Bugünün yemeğine ekle':'Bugünün yemeğini ver',()=>prepare('serve'),'kitchen-serve');serve.dataset.focus='serve';serve.disabled=locked||!changed||!crew;const clear=button('Seçimi temizle',()=>{draft={};draftDay=null;draftRevision=null;message('');render();},'kitchen-clear');clear.disabled=locked||!changed;actions.append(serve,clear);main.append(actions,el('p','kitchen-note','Seçilenler bugün kullanılır. Menü 00.00’da yenilenir; envanterdeki erzak saklanır.'));
   if(shopping){renderShop(locked);}
   else{
    const invHead=el('div','kitchen-section-head');invHead.append(el('h2','','Gıda envanteri'),button('Erzak al',()=>{shopping=true;render();},'kitchen-shop-open'));inventory.append(invHead,el('p','kitchen-inventory-hint','Malzemeye dokun, bugünün menüsüne ekle.'));
    const grid=el('div','kitchen-stock-grid');
    for(const item of state.items.filter(i=>!i.retired||i.quantity>0||chosen.some(c=>c.sku===i.sku))){const q=item.quantity-(draft[item.sku]||0),card=button('',()=>change(item.sku,1),'kitchen-stock');card.dataset.sku=item.sku;card.dataset.focus='stock-'+item.sku;card.setAttribute('aria-label',item.name+', stok '+num(q)+'. Menüye ekle');card.disabled=locked||q<=0||!crew;card.append(picture(item),el('span','',item.name),el('strong','',num(q)),el('small','',foodSkus.has(item.sku)?'porsiyon':'ek malzeme'));grid.append(card);}inventory.append(grid);
    inventory.append(el('p','kitchen-inventory-note','1 adet gıda = 1 porsiyon. Şarap ve zeytinyağı porsiyon yerine geçmez.'));
   }
   if(focus){const target=body.querySelector('[data-focus="'+CSS.escape(focus)+'"]');if(target&&!target.disabled)target.focus({preventScroll:true});}
  }
  function renderShop(locked){
   const products=state.items.filter(i=>!i.retired);if(!products.some(i=>i.sku===product))product=products[0]?.sku;const item=products.find(i=>i.sku===product);inventory.append(button('‹ Gıda envanteri',()=>{shopping=false;render();},'kitchen-shop-back'),el('h2','','Erzak al'),el('p','kitchen-wallet',num(state.gold)+' denarius'));if(!item)return;
   const form=el('form','kitchen-buy'),select=el('select'),label=el('label','','Malzeme');select.setAttribute('aria-label','Satın alınacak malzeme');select.disabled=locked;for(const i of products){const option=el('option','',i.name);option.value=i.sku;select.append(option);}select.value=product;select.onchange=()=>{product=select.value;render();};label.append(select);
   const amount=el('label','','Miktar'),input=el('input');input.type='number';input.inputMode='numeric';input.min='1';input.max='5000';input.step='1';input.value=buyQuantity;input.setAttribute('aria-label','Satın alınacak miktar');input.dataset.focus='buy-quantity';input.disabled=locked;amount.append(input);const cost=el('p','kitchen-buy-cost'),buy=button('Satın al');buy.type='submit';buy.dataset.focus='buy';
   const update=()=>{const q=Number(input.value);buyQuantity=input.value;cost.textContent=Number.isInteger(q)&&q>0?num(q*item.price)+' denarius':'Geçerli miktar gir.';buy.disabled=locked||!Number.isInteger(q)||q<1||q>5000||q*item.price>state.gold||q+item.quantity>50000;};input.oninput=update;update();form.onsubmit=e=>{e.preventDefault();if(!buy.disabled)prepare('buy');};form.append(label,picture(item),amount,cost,buy);inventory.append(form);
  }
  async function prepare(action){
   if(busy||loading||pending||!state)return;
   const data=action==='serve'?{action,owner,request:crypto.randomUUID(),day:draftDay,revision:draftRevision,items:Object.entries(draft).filter(([,q])=>q>0).map(([sku,quantity])=>({sku,quantity}))}:{action,owner,request:crypto.randomUUID(),sku:product,quantity:Number(buyQuantity)};
   if(action==='serve'&&!data.items.length)return;
   try{localStorage.setItem(key,JSON.stringify(data));pending=data;}catch{message('İşlem kaydı saklanamadı. Tarayıcı depolamasını açıp yeniden dene.',true);return;}await submit();
  }
  function clearPending(){const legacy=pending?.legacy;pending=null;try{localStorage.removeItem(key);if(legacy)localStorage.removeItem('ludus-food-pending-v55:'+owner);}catch{}}
  async function submit(){
   if(busy||!pending)return;busy=true;retry.hidden=true;render();const action=pending.action;message(action==='serve'?'Yemek veriliyor…':'Erzak alınıyor…');
   try{const r=await ctx.client.rpc(action==='serve'?'ludus_food_serve':'ludus_food_buy',action==='serve'?{p_items:pending.items,p_day:pending.day,p_request:pending.request,p_revision:pending.revision}:{p_sku:pending.sku,p_quantity:pending.quantity,p_request:pending.request});if(r.error){if(['P0001','22003','22023','22P02','23514'].includes(r.error.code))clearPending();throw r.error;}const oldDay=action==='serve'&&pending.day!==r.data.today;clearPending();draft={};draftDay=null;draftRevision=null;shopping=false;adopt(r.data);message(oldDay?'Önceki günün işlemi doğrulandı. Bugünün menüsünü seçebilirsin.':action==='serve'?'Bugünün yemeği verildi. Etkisi şimdi aktif.':'Erzak envantere eklendi.');}
   catch(e){message(e.message||'Sonuç alınamadı. Yeniden dene; aynı işlem iki kez harcanmaz.',true);retry.hidden=false;}
   finally{busy=false;render();}
  }
  async function open(){if(opened||!ctx.inRoom()||ctx.blocked())return;opened=true;lastFocus=document.activeElement;modal.hidden=false;ctx.onOpen?.();back.focus();render();await refresh();}
  function close(){if(!opened)return;opened=false;modal.hidden=true;ctx.onClose?.();if(lastFocus?.isConnected&&!lastFocus.hidden)lastFocus.focus();else opener.focus();}
  function enter(){place();refresh();}function leave(){opener.hidden=true;close();}
  function tick(){place();if(Date.now()<nextTick)return;nextTick=Date.now()+1000;if(!state||busy||loading||Date.now()-lastAttempt<15000)return;if(Date.now()+offset>=Date.parse(state.reset_at)||(opened&&Date.now()-lastRefresh>60000))refresh();}
  document.addEventListener('keydown',e=>{if(!opened)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'){const nodes=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(n=>!n.hidden&&n.getClientRects().length);if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}}});modal.addEventListener('pointerdown',e=>e.stopPropagation());ctx.ready.then(()=>refresh()).catch(()=>{});
  return {open,close,enter,leave,tick,refresh,get state(){return state;}};
 }
 return {create,menu};
})();
