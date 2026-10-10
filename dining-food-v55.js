/* Server-owned pantry and retry-safe food purchases. No client-side stock deductions. */
var LudusFood=(()=>{
 'use strict';
 const num=n=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2}).format(n??0);
 const date=d=>new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'short',timeZone:'Europe/Istanbul'}).format(new Date(d+'T12:00:00Z'));
 function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
 function btn(text,fn,cls){const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;}
 function create(ctx){
  const opener=btn('Erzak ve beslenme',open,'food-open');opener.id='foodOpen';opener.hidden=true;document.body.append(opener);
  const modal=el('section','food-modal');modal.id='foodModal';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','foodTitle');
  const frame=el('div','food-frame'),top=el('header','food-top'),heading=el('div'),title=el('h1','','Yemekhane');title.id='foodTitle';heading.append(el('small','','LUDUS · BESLENME'),title);
  const closeButton=btn('×',close,'food-close');closeButton.setAttribute('aria-label','Yemekhaneyi kapat');top.append(heading,closeButton);
  const body=el('div','food-body'),summary=el('div','food-summary'),tabs=el('nav','food-tabs'),stockTab=btn('Erzak',()=>{tab='stock';render()}),buyTab=btn('Erzak al',()=>{tab='buy';render()});tabs.setAttribute('aria-label','Yemekhane bölümleri');tabs.append(stockTab,buyTab);
  const content=el('div','food-content'),status=el('p','food-status'),retry=btn('Yeniden dene',()=>pending?submit():refresh(),'food-retry');retry.hidden=true;status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(summary,tabs,content);frame.append(top,body,status,retry);modal.append(frame);document.body.append(modal);
  let state=null,owner=null,pending=null,busy=false,tab='stock',opened=false,lastFocus=null,offset=0,refreshAt=0,nextTick=0,lastAttempt=0,loading=null,drafts={},key=null;
  function message(text,error=false){status.textContent=text;status.dataset.error=String(error);}
  function adopt(data){if(data.user_id!==owner)throw Error('Hesap doğrulanamadı. Sayfayı yenile.');state=data;offset=Date.parse(data.server_now)-Date.now();refreshAt=Date.now();ctx.onWallet?.(data.gold);render();}
  async function identify(){if(owner)return;const account=await ctx.ready;owner=account.user_id;key='ludus-food-pending-v55:'+owner;try{const value=JSON.parse(localStorage.getItem(key)||'null');if(value?.owner===owner&&value.request&&value.sku&&Number.isInteger(value.quantity))pending=value;}catch{message('Tarayıcı kayıtları okunamadı. Alım sırasında tekrar kontrol edilecek.',true);}}
  async function refresh(){if(loading)return loading;lastAttempt=Date.now();loading=(async()=>{await identify();if(busy)return;const r=await ctx.client.rpc('ludus_food_state');if(r.error)throw r.error;adopt(r.data);if(pending){retry.hidden=false;message('Önceki alımın sonucu bekliyor. Yeniden dene ile kontrol et.');}else{retry.hidden=true;message('');}})().catch(e=>{message(e.message||'Erzaklar yüklenemedi.',true);retry.hidden=false;}).finally(()=>{loading=null;render();});render();return loading;}
  function render(){
   modal.setAttribute('aria-busy',String(busy));stockTab.setAttribute('aria-pressed',String(tab==='stock'));buyTab.setAttribute('aria-pressed',String(tab==='buy'));summary.replaceChildren();content.replaceChildren();
   if(!state){content.append(el('p','food-empty','Erzaklar yükleniyor…'));return;}
   for(const [label,value]of [['Gladyatör',num(state.crew_count)],['Günlük beslenme',num(state.menu.units)+' / '+num(state.menu.daily_need)+' birim'],['Bugünkü menü morali',state.menu.morale===null?'—':num(state.menu.morale)+'/100']]){const s=el('div');s.append(el('small','',label),el('strong','',value));summary.append(s);}
   content.append(el('p','food-wallet',num(state.gold)+' denarius · Stok '+num(state.menu.available_units)+' besin birimi · Eksik '+num(state.menu.missing_units)+' birim'));
   const benefit=el('p','food-benefit','Aktif toparlanma: +%'+num(state.recovery?.active_bonus||0)+' · '+num((state.recovery?.base_rate??6.5)*(1+(state.recovery?.active_bonus||0)/100))+' enerji / saat. Bugünkü menü kalitesi: '+num(state.menu.quality||0)+'/100 → yarın +%'+num(state.menu.recovery_bonus_percent||0)+'.');content.append(benefit);
   const description=el('p','food-rule','Her gladyatör günde 100 besin birimi ister: 2 öğün × 50 birim. Ürünler günlük ortak menüde otomatik kullanılır; öğünler için ayrı besleme yoktur. Gün Türkiye saatiyle 00.00’da tamamlanır.');content.append(description);
   if(tab==='buy'){
    const quantities=el('div','food-quantities');quantities.append(el('span','','Her ürün için porsiyon:'));for(const days of [1,3,7])quantities.append(btn(days+' × gladyatör sayısı',()=>{for(const i of state.items)drafts[i.sku]=Math.min(5000,Math.max(1,state.crew_count)*days);render()}));content.append(quantities);
   }
   const grid=el('div','food-grid');
   for(const item of state.items){
    const card=el('article','food-card');card.dataset.sku=item.sku;const image=el('img');image.src='assets/dining/icons/'+item.sku+'-v57.svg';image.alt='';image.width=96;image.height=96;image.loading='lazy';
    const info=el('div','food-info');info.append(el('h2','',item.name),el('small','food-value',item.nutrition?num(item.nutrition)+' besin birimi / adet':'Açlığı karşılamaz · Moral katkısı'),el('strong','food-stock',num(item.quantity)+' porsiyon'),el('p','',state.crew_count?num(item.daily)+' adet / gün · '+num(item.daily*item.nutrition)+' birim':'Henüz gladyatör yok'));
    card.append(image,info);
    if(tab==='buy'){
     const form=el('form','food-buy');const label=el('label','','Porsiyon'),input=el('input');input.type='number';input.inputMode='numeric';input.min='1';input.max='5000';input.step='1';input.value=String(drafts[item.sku]??Math.max(1,state.crew_count));input.setAttribute('aria-label',item.name+' porsiyon miktarı');input.disabled=busy||!!pending||!!loading;label.append(input);
     const purchase=btn('');purchase.type='submit';purchase.dataset.buy=item.sku;
     function update(){const q=Number(input.value);drafts[item.sku]=input.value;const valid=Number.isInteger(q)&&q>=1&&q<=5000;purchase.textContent=valid?'Al · '+num(q*item.price)+' denarius':'Geçerli miktar gir';purchase.disabled=busy||!!pending||!!loading||!valid||q*item.price>state.gold||q+item.quantity>50000;}
     input.oninput=update;update();form.onsubmit=e=>{e.preventDefault();purchaseItem(item,Number(input.value));};form.append(el('small','',num(item.price)+' denarius / porsiyon'),label,purchase);card.append(form);
    }else{const served=state.menu.served.find(s=>s.sku===item.sku)?.quantity||0;card.append(el('span','food-portion',served?num(served)+' adet menüde':item.quantity?'Stokta saklanacak':'Stok yok'));}
    grid.append(card);
   }
   content.append(grid,el('p','food-note','Menü günlük ihtiyacı karşılayan en yakın tam adetleri seçer; fazla birim ek moral vermez. Tam adet tüketilir; kalan ürünler saklanır. Aynı miktarda besin sağlayan seçeneklerde çeşitlilik tercih edilir. Tahıl/ekmek, protein ve meyve çeşitliliği morali destekler. Şarap 5 besin birimidir; kişi başına günde en fazla 1 adet kullanılır. 100 birim tamamlandığında protein ve meyve, menü kalitesini yükseltir. Menü ertesi gün temel %4, protein veya meyve katkılı %8, dengeli %12 toparlanma bonusu sağlar. Taban hız 6,5 enerji / saattir. Hazır öğün dengeli menüdür; bonuslar toplanmaz. Şarap moral katkısıdır.'));
   if(state.last_menu)content.append(el('p','food-last',date(state.settled_day)+' · Son hesaplanan günün morali: '+(state.last_menu.morale===null?'—':num(state.last_menu.morale)+'/100')));
   else content.append(el('p','food-last','İlk günlük tüketim bu gece hesaplanacak. Yukarıdaki moral bugünkü stoklarla hazırlanabilecek menüyü gösterir.'));
   if(tab==='stock'&&state.history.length){const details=el('details','food-history');details.append(el('summary','','Tüketim geçmişi'));for(const h of state.history){const days=Math.round((Date.parse(h.to_day)-Date.parse(h.from_day))/86400000)+1;const used=h.menu.served.filter(i=>i.quantity).map(i=>{const name=state.items.find(s=>s.sku===i.sku)?.name||i.sku;return name+' '+num(i.quantity*days);}).join(' · ');details.append(el('p','',(h.from_day===h.to_day?date(h.to_day):date(h.from_day)+' – '+date(h.to_day))+' · '+(used||'Erzak yok')));}content.append(details);}
  }
  async function purchaseItem(item,quantity){if(busy||pending||loading||!owner)return;pending={owner,sku:item.sku,quantity,request:crypto.randomUUID()};try{localStorage.setItem(key,JSON.stringify(pending));}catch{pending=null;message('Alım kaydı saklanamadı. Tarayıcı depolamasını açıp tekrar dene.',true);return;}await submit();}
  async function submit(){if(busy||!pending)return;busy=true;retry.hidden=true;render();message('Alım yapılıyor…');
   try{const r=await ctx.client.rpc('ludus_food_buy',{p_sku:pending.sku,p_quantity:pending.quantity,p_request:pending.request});if(r.error){if(['P0001','22003','22P02','23514'].includes(r.error.code)){try{localStorage.removeItem(key)}catch{}pending=null;}throw r.error;}const name=r.data.items.find(i=>i.sku===pending.sku)?.name||'Gıda';const qty=pending.quantity;pending=null;try{localStorage.removeItem(key)}catch{}adopt(r.data);message(num(qty)+' porsiyon '+name+' erzağa eklendi.');}
   catch(e){message(e.message||'Alımın sonucu alınamadı. Aynı işlemi yeniden dene.',true);retry.hidden=true;retry.hidden=!pending;}
   finally{busy=false;render();}
  }
  async function open(){if(opened||!ctx.inRoom()||ctx.blocked())return;opened=true;lastFocus=document.activeElement;modal.hidden=false;ctx.onOpen?.();closeButton.focus();render();await refresh();}
  function close(){if(!opened)return;opened=false;modal.hidden=true;ctx.onClose?.();if(lastFocus?.isConnected&&!lastFocus.hidden)lastFocus.focus();else opener.focus();}
  function enter(){opener.hidden=false;refresh();}
  function leave(){opener.hidden=true;close();}
  function tick(){if(Date.now()<nextTick)return;nextTick=Date.now()+1000;if(!state||busy||loading||Date.now()-lastAttempt<15000)return;if(Date.now()+offset>=Date.parse(state.reset_at)||(opened&&Date.now()-refreshAt>60000))refresh();}
  document.addEventListener('keydown',e=>{if(modal.hidden)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'){const all=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),summary')].filter(n=>!n.hidden&&n.getClientRects().length);if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0]?.focus();}}});
  modal.addEventListener('pointerdown',e=>e.stopPropagation());ctx.ready.then(()=>refresh()).catch(()=>{});
  return {enter,leave,tick,open,close,refresh,get state(){return state;}};
 }
 return {create};
})();
