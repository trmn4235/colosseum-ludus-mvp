/* Server-owned pantry and retry-safe food purchases. No client-side stock deductions. */
var LudusFood=(()=>{
 'use strict';
 const num=n=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2}).format(n??0);
 const date=d=>new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'short',timeZone:'Europe/Istanbul'}).format(new Date(d+'T12:00:00Z'));
 function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
 function btn(text,fn,cls){const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;}
 // A nutrition estimate, not a promise of identical future menus. Wine is capped
 // at one portion per gladiator per day; oil has no nutritional value.
 function reserveDays(data){
  const need=Number(data.menu.daily_need)||0;if(!data.crew_count||!need)return null;
  let food=0,wine=0;for(const i of data.items){const units=Math.max(0,Number(i.quantity)||0)*Math.max(0,Number(i.nutrition)||0);if(i.sku==='beer')wine+=units;else food+=units;}
  return Math.max(0,Math.min((food+wine)/need,food/Math.max(1,need-data.crew_count*5)));
 }
 function foodImage(item){const image=el('img');image.src=['grain','apple','fish','meat','beer','egg','olive_oil'].includes(item.sku)?'assets/resource-icons-v95/'+item.sku+'.webp':'assets/dining/icons/'+item.sku+'-v57.svg';image.alt='';image.decoding='async';image.width=96;image.height=96;return image;}
 function create(ctx){
  const opener=btn('',open,'room-world-action food-cauldron');opener.id='foodOpen';opener.hidden=true;opener.title='Erzak ve beslenme';opener.setAttribute('aria-label','Erzak ve beslenmeyi aç');opener.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 10h14v5a7 7 0 0 1-14 0Zm-2 1h2m14 0h2M8 21l1-2m6 0 1 2M8 7c-2-2 2-3 0-5m4 5c-2-2 2-3 0-5m4 5c-2-2 2-3 0-5"/></svg>';document.body.append(opener);
  const cauldronPoint=ctx.T?new ctx.T.Vector3(-3.55,1.50,-2.9):null;
  function placeOpener(){if(cauldronPoint&&globalThis.LudusRoomActions)LudusRoomActions.place(opener,cauldronPoint,ctx,ctx.inRoom()&&!opened,8);else opener.hidden=!ctx.inRoom()||opened||ctx.blocked();}
  const modal=el('section','food-modal');modal.id='foodModal';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','foodTitle');
  const frame=el('div','food-frame'),top=el('header','food-top'),heading=el('div'),title=el('h1','','Yemekhane');title.id='foodTitle';heading.append(el('small','','LUDUS · BESLENME'),title);
  const closeButton=btn('×',close,'food-close');closeButton.setAttribute('aria-label','Yemekhaneyi kapat');top.append(heading,closeButton);
  const body=el('div','food-body'),main=el('div','food-main'),summary=el('div','food-summary'),content=el('section','food-content'),shop=el('aside','food-shop');shop.setAttribute('aria-label','Erzak alışverişi');main.append(summary,content);body.append(main,shop);
  const footer=el('div','food-feedback'),status=el('p','food-status'),retry=btn('Yeniden dene',()=>pending?submit():refresh(),'food-retry');retry.hidden=true;status.setAttribute('role','status');status.setAttribute('aria-live','polite');footer.append(status,retry);
  const infoLayer=el('div','food-help-layer'),infoPanel=el('section','food-help'),infoHeading=el('h2'),infoText=el('div','food-help-text'),infoClose=btn('×',()=>hideInfo(),'food-help-close');infoLayer.hidden=true;infoHeading.id='foodHelpTitle';infoPanel.id='foodHelpPanel';infoPanel.setAttribute('role','dialog');infoPanel.setAttribute('aria-modal','true');infoPanel.setAttribute('aria-labelledby',infoHeading.id);infoClose.setAttribute('aria-label','Bilgiyi kapat');infoPanel.append(infoHeading,infoClose,infoText);infoLayer.append(infoPanel);infoLayer.addEventListener('click',e=>{if(e.target===infoLayer)hideInfo();});
  frame.append(top,body,footer,infoLayer);modal.append(frame);document.body.append(modal);
  let state=null,owner=null,pending=null,busy=false,opened=false,lastFocus=null,offset=0,refreshAt=0,nextTick=0,lastAttempt=0,loading=null,drafts={},key=null,selectedSku=null,infoTopic=null;
  function message(text,error=false){status.textContent=text;status.dataset.error=String(error);}
  function adopt(data){if(data.user_id!==owner)throw Error('Hesap doğrulanamadı. Sayfayı yenile.');state=data;offset=Date.parse(data.server_now)-Date.now();refreshAt=Date.now();ctx.onWallet?.(data.gold);render();}
  async function identify(){if(owner)return;const account=await ctx.ready;owner=account.user_id;key='ludus-food-pending-v55:'+owner;try{const value=JSON.parse(localStorage.getItem(key)||'null');if(value?.owner===owner&&value.request&&value.sku&&Number.isInteger(value.quantity))pending=value;}catch{message('Tarayıcı kayıtları okunamadı. Alım sırasında tekrar kontrol edilecek.',true);}}
  async function refresh(){if(loading)return loading;lastAttempt=Date.now();loading=(async()=>{await identify();if(busy)return;const r=await ctx.client.rpc('ludus_food_state');if(r.error)throw r.error;adopt(r.data);if(pending){retry.hidden=false;message('Önceki alımın sonucu bekliyor. Yeniden dene ile kontrol et.');}else{retry.hidden=true;message('');}})().catch(e=>{message(e.message||'Erzaklar yüklenemedi.',true);retry.hidden=false;}).finally(()=>{loading=null;render();});render();return loading;}
  function infoButton(topic,label){const button=btn('i',()=>showInfo(topic),'food-info-button');button.dataset.info=topic;button.dataset.focus='info-'+topic;button.setAttribute('aria-label',label+' hakkında bilgi');button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','foodHelpPanel');button.setAttribute('aria-expanded',String(infoTopic===topic));return button;}
  function infoCopy(topic){
   const menu=state.menu,crew=Number(state.crew_count)||0;
   if(topic==='crew')return ['Gladyatörlerin beslenmesi',
    'Ludusundaki '+num(crew)+' gladyatörün her biri günde 2 öğün, toplam 100 besin birimi tüketir. Şu anki günlük ihtiyaç '+num(menu.daily_need)+' birimdir.',
    'Menü stoktaki ürünlerden otomatik hazırlanır. Günlük tüketim Türkiye saatiyle 00.00’da hesaplanır; tek tek besleme yapman gerekmez.'];
   if(topic==='days')return ['Yemeğim kaç gün yeter?',
    'Süre, mevcut gladyatör sayısı ve erzakların besin değerine göre tahmin edilir. Her gladyatör günde 100 birim tüketir. Tam porsiyon seçimi ve gladyatör sayısının değişmesi gerçek süreyi etkileyebilir.',
    'Şarap kişi başına günde en fazla 1 adetle hesaba katılır. Zeytinyağı besin birimi sağlamaz, yalnızca menü kalitesini destekler.',
    'Stok: '+num(menu.available_units)+' besin birimi. Bugünkü menü: '+num(menu.units)+' / '+num(menu.daily_need)+' birim.'+(menu.missing_units?' Eksik: '+num(menu.missing_units)+' birim.':'')];
   if(topic==='quality')return ['Gıda kalitesi nasıl değişir?',
    'Bu oran, elindeki erzaklarla hazırlanacak menünün kalitesidir. Günlük besin ihtiyacı karşılanmazsa kalite %0 olur.',
    'İhtiyaç karşılandığında et, balık ve yumurta protein katkısıyla; elma meyve katkısıyla kaliteyi artırır. Protein ve meyve ayrı ayrı en fazla 50 puan sağlar. Seçilen menüde kişi başına birer porsiyon her grubun tam katkısını verir.',
    'Tam protein ve meyve menüsü, gladyatör başına 1 zeytinyağıyla %100 kaliteye ulaşır. Herkese yetecek yağ yoksa bu menünün kalitesi %75 olur. Yağ diğer menülerde saklanır.',
    menu.balanced_without_oil&&!menu.olive_oil_used?'Şu an %100 kalite için '+num(menu.olive_oil_needed)+' adet zeytinyağı gerekiyor.':'Erzaklar tüketildikçe veya gladyatör sayın arttıkça menü değişebilir ve kalite düşebilir.',
    'Kondisyon yenilenmesi: bugün +%'+num(state.combat?.active_bonus||0)+', bu menü tüketildikten sonra +%'+num(menu.stamina_bonus_percent||0)+'. Menü bonusları toplanmaz.'];
   const lines=['Erzaklarım','Kartlarda elindeki porsiyon sayısını görürsün. Bir ürüne dokunarak onu sağdaki alışveriş alanında seçebilirsin. Sıfır stoklu ürünler soluk görünür.',
    'Menü günlük ihtiyacı karşılayan tam porsiyonları otomatik seçer; kalan erzak saklanır. Tahıl, protein ve meyve çeşitliliği morali destekler; şarap da morale katkı sağlar.',
    'Denarius yalnızca satın alırken ödenir. Günlük tüketimde yeniden ücret kesilmez.'];
   if(state.history?.length){lines.push('Son tüketimler');for(const h of state.history.slice(0,3)){const days=Math.round((Date.parse(h.to_day)-Date.parse(h.from_day))/86400000)+1;const used=h.menu.served.filter(i=>i.quantity).map(i=>(state.items.find(s=>s.sku===i.sku)?.name||i.sku)+' '+num(i.quantity*days)).join(' · ');lines.push((h.from_day===h.to_day?date(h.to_day):date(h.from_day)+' – '+date(h.to_day))+' · '+(used||'Erzak yok'));}}
   return lines;
  }
  function updateInfo(){if(!infoTopic||!state)return;const [heading,...paragraphs]=infoCopy(infoTopic);infoHeading.textContent=heading;infoText.replaceChildren(...paragraphs.map(p=>el('p','',p)));}
  function showInfo(topic){if(!state)return;infoTopic=topic;updateInfo();body.querySelector('[data-info="'+topic+'"]')?.setAttribute('aria-expanded','true');infoLayer.hidden=false;top.inert=body.inert=footer.inert=true;infoClose.focus();}
  function hideInfo(restore=true){const topic=infoTopic;infoTopic=null;body.querySelector('[data-info="'+topic+'"]')?.setAttribute('aria-expanded','false');infoLayer.hidden=true;top.inert=body.inert=footer.inert=false;if(restore)body.querySelector('[data-info="'+topic+'"]')?.focus();}
  function render(){
   const focus=document.activeElement?.dataset.focus;
   modal.setAttribute('aria-busy',String(busy||loading));summary.replaceChildren();content.replaceChildren();shop.replaceChildren();
   if(!state){content.append(el('p','food-empty','Erzaklar yükleniyor…'));return;}
   const crew=Number(state.crew_count)||0,menu=state.menu,days=reserveDays(state),quality=Math.min(100,Math.max(0,Number(menu.quality)||0)),shortage=crew>0&&Number(menu.missing_units)>0;
   function metric(topic,label,value,unit,detail){
    const card=el('div','food-metric food-'+topic),head=el('div','food-metric-head'),amount=el('div','food-metric-value');head.append(el('span','',label),infoButton(topic,label));amount.append(el('strong','',value));if(unit)amount.append(el('span','',unit));card.append(head,amount);if(detail)card.append(el('small','food-metric-detail',detail));summary.append(card);return card;
   }
   metric('crew','Gladyatör',num(crew),'',num(crew*2)+' öğün / gün');
   const dayText=days===null?'—':days===0?'0':days<1?'<1':'≈'+num(Math.floor(days*10)/10);
   const supply=metric('days','Yemek stoğu',dayText,days===null?'':'gün',!crew?'Henüz gladyatör yok':shortage?'Bugünkü menü eksik':num(menu.daily_need)+' birim / gün');supply.dataset.low=String(shortage||days!==null&&days<1);
   const qualityCard=metric('quality','Gıda kalitesi',crew?'%'+num(quality):'—','',null),track=el('div','food-quality-track'),fill=el('span');track.setAttribute('role','meter');track.setAttribute('aria-label','Gıda kalitesi');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(quality));fill.style.width=quality+'%';track.append(fill);qualityCard.append(track);
   const inventoryHead=el('div','food-inventory-head'),inventoryTitle=el('h2','','Erzaklarım');inventoryTitle.id='foodInventoryTitle';content.setAttribute('aria-labelledby',inventoryTitle.id);inventoryHead.append(inventoryTitle,el('span','',num(state.items.filter(i=>i.quantity>0).length)+' çeşit stokta'),infoButton('inventory','Erzaklar'));content.append(inventoryHead);
   const available=state.items.filter(i=>!i.retired);if(!available.some(i=>i.sku===selectedSku))selectedSku=available[0]?.sku||null;
   const grid=el('div','food-grid');
   for(const item of state.items.filter(i=>!i.retired||i.quantity>0)){
    const card=el('article','food-card');card.dataset.sku=item.sku;card.dataset.empty=String(!item.quantity);
    const tile=item.retired?el('div','food-tile'):btn('',()=>{selectedSku=item.sku;render();},'food-tile');
    if(!item.retired){tile.dataset.focus='item-'+item.sku;tile.setAttribute('aria-label',item.name+', stokta '+num(item.quantity)+' porsiyon. Alışverişte seç');tile.setAttribute('aria-pressed',String(item.sku===selectedSku));}
    const art=el('div','food-art');art.append(foodImage(item));const text=el('div','food-item-text');text.append(el('h3','',item.name),el('strong','food-stock',num(item.quantity)),el('small','',item.retired?'Eski stok':'porsiyon'));tile.append(art,text);card.append(tile);grid.append(card);
   }
   content.append(grid);
   renderShop(available.find(i=>i.sku===selectedSku),available);
   updateInfo();
   if(focus&&!infoTopic){const target=body.querySelector('[data-focus="'+CSS.escape(focus)+'"]');if(target&&!target.disabled)target.focus({preventScroll:true});else closeButton.focus({preventScroll:true});}
  }
  function renderShop(item,available){
   const wallet=el('div','food-wallet');wallet.append(el('span','food-wallet-label','BAKİYEN'),el('strong','',num(state.gold)),el('small','','denarius'));shop.append(wallet);
   const heading=el('h2','','Erzak al');shop.append(heading);
   if(!item){shop.append(el('p','food-empty','Satın alınabilecek erzak yok.'));return;}
   const form=el('form','food-buy'),label=el('label','food-product-label','Ürün'),select=el('select');select.id='foodProduct';select.setAttribute('aria-label','Alınacak erzak');select.dataset.focus='product';
   for(const product of available){const option=el('option','',product.name);option.value=product.sku;select.append(option);}select.value=item.sku;select.disabled=busy||!!pending;select.onchange=()=>{selectedSku=select.value;render();};label.append(select);
   const preview=el('div','food-product-preview'),description=el('div');description.append(el('strong','',num(item.price)+' denarius'),el('small','','1 porsiyon'));preview.append(foodImage(item),description);
   const quantityLabel=el('label','food-quantity-label','Porsiyon'),stepper=el('div','food-stepper'),input=el('input');input.id='foodQuantity';quantityLabel.htmlFor=input.id;input.type='number';input.inputMode='numeric';input.min='1';input.max='5000';input.step='1';input.value=String(drafts[item.sku]??Math.max(1,state.crew_count));input.dataset.focus='quantity';input.setAttribute('aria-label',item.name+' porsiyon miktarı');input.disabled=busy||!!pending;
   const minus=btn('−',()=>step(-1)),plus=btn('+',()=>step(1));minus.setAttribute('aria-label','Porsiyonu azalt');plus.setAttribute('aria-label','Porsiyonu artır');minus.dataset.focus='minus';plus.dataset.focus='plus';stepper.append(minus,input,plus);
   const total=el('div','food-total'),totalValue=el('strong');total.append(el('span','','Toplam'),totalValue);
   const purchase=btn('Satın al');purchase.type='submit';purchase.dataset.buy=item.sku;purchase.dataset.focus='buy';const hint=el('p','food-buy-hint');hint.id='foodBuyHint';purchase.setAttribute('aria-describedby',hint.id);
   function update(){
    const q=Number(input.value),valid=Number.isInteger(q)&&q>=1&&q<=5000,cost=q*Number(item.price),locked=busy||!!pending||!!loading;drafts[item.sku]=input.value;
    const tooMany=valid&&q+Number(item.quantity)>50000,tooCostly=valid&&cost>Number(state.gold);
    totalValue.textContent=valid?num(cost)+' denarius':'—';purchase.disabled=locked||!valid||tooCostly||tooMany;purchase.textContent=busy?'Alınıyor…':'Satın al';minus.disabled=locked||valid&&q<=1;plus.disabled=locked||valid&&q>=5000;
    hint.textContent=!valid?'1–5.000 arası tam sayı gir.':tooMany?'Stok sınırı: 50.000 porsiyon.':tooCostly?'Denarius yetersiz.':'';
   }
   function step(change){input.value=String(Math.max(1,Math.min(5000,(Number(input.value)||0)+change)));update();}
   input.oninput=update;update();form.onsubmit=e=>{e.preventDefault();if(!purchase.disabled)purchaseItem(item,Number(input.value));};form.append(label,preview,quantityLabel,stepper,total,purchase,hint);shop.append(form);
  }
  async function purchaseItem(item,quantity){if(busy||pending||loading||!owner||item.retired||!Number.isInteger(quantity)||quantity<1||quantity>5000||quantity*item.price>state.gold||quantity+Number(item.quantity)>50000)return;pending={owner,sku:item.sku,quantity,request:crypto.randomUUID()};try{localStorage.setItem(key,JSON.stringify(pending));}catch{pending=null;message('Alım kaydı saklanamadı. Tarayıcı depolamasını açıp tekrar dene.',true);return;}await submit();}
  async function submit(){if(busy||!pending)return;busy=true;retry.hidden=true;render();message('Alım yapılıyor…');
   try{const r=await ctx.client.rpc('ludus_food_buy',{p_sku:pending.sku,p_quantity:pending.quantity,p_request:pending.request});if(r.error){if(['P0001','22003','22P02','23514'].includes(r.error.code)){try{localStorage.removeItem(key)}catch{}pending=null;}throw r.error;}const name=r.data.items.find(i=>i.sku===pending.sku)?.name||'Gıda';const qty=pending.quantity;pending=null;try{localStorage.removeItem(key)}catch{}adopt(r.data);message(num(qty)+' porsiyon '+name+' erzağa eklendi.');}
   catch(e){message(e.message||'Alımın sonucu alınamadı. Aynı işlemi yeniden dene.',true);retry.hidden=true;retry.hidden=!pending;}
   finally{busy=false;render();}
  }
  async function open(){if(opened||!ctx.inRoom()||ctx.blocked())return;opened=true;lastFocus=document.activeElement;modal.hidden=false;ctx.onOpen?.();closeButton.focus();render();await refresh();}
  function close(){if(!opened)return;hideInfo(false);opened=false;modal.hidden=true;ctx.onClose?.();if(lastFocus?.isConnected&&!lastFocus.hidden)lastFocus.focus();else opener.focus();}
  function enter(){placeOpener();refresh();}
  function leave(){opener.hidden=true;close();}
  function tick(){placeOpener();if(Date.now()<nextTick)return;nextTick=Date.now()+1000;if(!state||busy||loading||Date.now()-lastAttempt<15000)return;if(Date.now()+offset>=Date.parse(state.reset_at)||(opened&&Date.now()-refreshAt>60000))refresh();}
  document.addEventListener('keydown',e=>{if(modal.hidden)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(infoTopic)hideInfo();else close();}if(e.key==='Tab'){const all=[...(infoTopic?infoPanel:modal).querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary')].filter(n=>!n.hidden&&n.getClientRects().length);if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0]?.focus();}}});
  modal.addEventListener('pointerdown',e=>e.stopPropagation());ctx.ready.then(()=>refresh()).catch(()=>{});
  return {enter,leave,tick,open,close,refresh,get state(){return state;}};
 }
 return {create,reserveDays};
})();
