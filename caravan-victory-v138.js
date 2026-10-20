/* One photographic surface for settlement; rewards appear only after verification. */
(()=>{
 'use strict';
 const names={wood:'odun',flax:'ham keten',hide:'ham deri',wool:'yün',resin:'reçine',iron_ore:'demir cevheri',tin_ore:'kalay cevheri',copper_ore:'bakır cevheri',lead_ore:'kurşun cevheri',apple:'elma',grain:'tahıl',meat:'et',fish:'balık',egg:'yumurta',beer:'şarap',olive_oil:'zeytinyağı'};
 // Start fetching and decoding during battle, rather than on the first result frame.
 const image=new Image();
 image.className='caravan-victory-art';image.alt='';image.decoding='async';image.fetchPriority='low';
 image.addEventListener('error',()=>{image.hidden=true;});
 image.src='assets/caravan-v138/victory.webp';
 image.decode?.().catch(()=>{});
 let dialog;
 function ensureDialog(){
  if(!dialog){
   dialog=document.createElement('dialog');
   dialog.className='caravan-victory';
   dialog.setAttribute('aria-labelledby','caravanVictoryTitle');
   dialog.setAttribute('aria-describedby','caravanVictoryLoot caravanVictoryNext');
   dialog.innerHTML='<div class="caravan-victory-content"><span class="caravan-victory-kicker"></span>'+
    '<h2 id="caravanVictoryTitle" tabindex="-1"></h2>'+
    '<p id="caravanVictoryLoot" role="status" aria-live="polite"></p>'+
    '<div class="caravan-victory-footer"><a class="caravan-victory-return" href="ludus.html" autofocus>Ludus’a dön <span aria-hidden="true">›</span></a>'+
    '<p id="caravanVictoryNext">Yeni baskın <strong>1 saat sonra</strong></p></div></div>';
   dialog.addEventListener('cancel',event=>event.preventDefault());
   dialog.prepend(image);
   document.body.append(dialog);
  }
  return dialog;
 }
 function pending(){
  ensureDialog();
  dialog.setAttribute('aria-busy','true');
  dialog.querySelector('.caravan-victory-kicker').textContent='BASKIN TAMAMLANDI';
  dialog.querySelector('#caravanVictoryTitle').textContent='Sonuç kaydediliyor…';
  dialog.querySelector('#caravanVictoryLoot').textContent='Savaş kaydı doğrulanıyor…';
  dialog.querySelector('.caravan-victory-footer').hidden=true;
  if(!dialog.open)dialog.showModal();
  dialog.querySelector('#caravanVictoryTitle').focus({preventScroll:true});
  return true;
 }
 function show(result){
  if(result?.status!=='resolved'||result.success!==true)return false;
  ensureDialog();
  dialog.setAttribute('aria-busy','false');
  dialog.querySelector('.caravan-victory-kicker').textContent='ZAFER';
  dialog.querySelector('#caravanVictoryTitle').textContent='Kervan baskını başarılı';
  dialog.querySelector('.caravan-victory-footer').hidden=false;
  const loot=Object.entries(result.loot||{}).map(([sku,n])=>n+' '+(names[sku]||sku)).join(', ')||'Ele geçirilen ganimet';
  dialog.querySelector('#caravanVictoryLoot').textContent=loot+(result.delivered_at?' depomuza taşındı.':' güvende; depoda yer açılınca taşınacak.');
  if(!dialog.open)dialog.showModal();
  dialog.querySelector('.caravan-victory-return').focus({preventScroll:true});
  return true;
 }
 function close(){if(dialog?.open)dialog.close();}
 window.CaravanVictory=Object.freeze({pending,show,close});
})();
