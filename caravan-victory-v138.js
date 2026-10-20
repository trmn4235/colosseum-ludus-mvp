/* Presentation only. The battle controller opens this after server verification. */
(()=>{
 'use strict';
 const names={wood:'odun',flax:'ham keten',hide:'ham deri',wool:'yün',resin:'reçine',iron_ore:'demir cevheri',tin_ore:'kalay cevheri',copper_ore:'bakır cevheri',lead_ore:'kurşun cevheri',apple:'elma',grain:'tahıl',meat:'et',fish:'balık',egg:'yumurta',beer:'şarap',olive_oil:'zeytinyağı'};
 let dialog;
 function show(result){
  if(result?.status!=='resolved'||result.success!==true)return false;
  if(!dialog){
   dialog=document.createElement('dialog');
   dialog.className='caravan-victory';
   dialog.setAttribute('aria-labelledby','caravanVictoryTitle');
   dialog.setAttribute('aria-describedby','caravanVictoryLoot caravanVictoryNext');
   dialog.innerHTML='<img class="caravan-victory-art" src="assets/caravan-v138/victory.webp" alt="" decoding="async">'+
    '<div class="caravan-victory-content"><span class="caravan-victory-kicker">ZAFER</span>'+
    '<h2 id="caravanVictoryTitle">Kervan baskını başarılı</h2>'+
    '<p id="caravanVictoryLoot"></p>'+
    '<div class="caravan-victory-footer"><a class="caravan-victory-return" href="ludus.html" autofocus>Ludus’a dön <span aria-hidden="true">›</span></a>'+
    '<p id="caravanVictoryNext">Yeni baskın <strong>1 saat sonra</strong></p></div></div>';
   dialog.addEventListener('cancel',event=>event.preventDefault());
   const image=dialog.querySelector('img');
   image.addEventListener('error',()=>{image.hidden=true;});
   document.body.append(dialog);
  }
  const loot=Object.entries(result.loot||{}).map(([sku,n])=>n+' '+(names[sku]||sku)).join(', ')||'Ele geçirilen ganimet';
  dialog.querySelector('#caravanVictoryLoot').textContent=loot+(result.delivered_at?' depomuza taşındı.':' güvende; depoda yer açılınca taşınacak.');
  if(!dialog.open)dialog.showModal();
  return true;
 }
 window.CaravanVictory=Object.freeze({show});
})();
