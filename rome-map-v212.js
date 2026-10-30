/* V212: artwork-relative hit targets on the approved illustrative map. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),data=RomeDestinations;
 const art='assets/rome-v212/rome-art.webp',ns='http://www.w3.org/2000/svg';
 const crop={x:28,y:126,width:1293,height:700};
 const positions={ludus:{x:1180,y:289,mark:'L',photoY:224},pit:{x:346,y:646,mark:'A',photoY:364},colosseum:{x:878,y:248,mark:'C',photoY:504},palatine:{x:587,y:533,mark:'CM',photoY:644}};
 let selected='colosseum';
 try{const saved=sessionStorage.getItem('rome-map-choice-v148');if(data.find(saved))selected=saved;}catch{}
 function select(id){
  if(!data.find(id))return;
  selected=id;
  try{sessionStorage.setItem('rome-map-choice-v148',id);}catch{}
  document.querySelectorAll('[data-destination]').forEach(n=>{n.dataset.active=String(n.dataset.destination===id);});
 }
 function artwork(y){
  const svg=document.createElementNS(ns,'svg'),image=document.createElementNS(ns,'image');
  svg.setAttribute('viewBox',`1357 ${y+3} 462 122`);
  svg.setAttribute('preserveAspectRatio','xMidYMid slice');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.classList.add('rome-card-art');
  image.setAttribute('href',art);image.setAttribute('width','1850');image.setAttribute('height','850');svg.append(image);return svg;
 }
 for(const place of data.places){
  const position=positions[place.id];if(!position)continue;
  const open=()=>{select(place.id);RomeTravel.go(place.id);};
  const card=document.createElement('button');card.type='button';card.className='rome-card';card.dataset.destination=place.id;card.setAttribute('aria-label',`${place.name} · ${place.entry} · Git`);
  const tag=document.createElement('small'),name=document.createElement('strong'),entry=document.createElement('span');
  tag.textContent=place.tag;name.textContent=place.name;entry.className='rome-entry';entry.textContent=place.entry;
  card.append(artwork(position.photoY),tag,name,entry);card.addEventListener('click',open);card.addEventListener('focus',()=>select(place.id));card.addEventListener('pointerenter',()=>select(place.id));$('romeCards').append(card);
  const pin=document.createElement('button'),mark=document.createElement('span'),label=document.createElement('span');
  pin.type='button';pin.className='rome-pin';pin.dataset.destination=place.id;pin.style.left=(position.x-crop.x)/crop.width*100+'%';pin.style.top=(position.y-crop.y)/crop.height*100+'%';pin.setAttribute('aria-label',`${place.name} · ${place.entry} · Git`);
  mark.className='rome-pin-mark';mark.textContent=position.mark;mark.setAttribute('aria-hidden','true');label.className='rome-pin-label';label.textContent=place.name;
  pin.append(mark,label);pin.addEventListener('click',open);pin.addEventListener('focus',()=>select(place.id));pin.addEventListener('pointerenter',()=>select(place.id));$('romePins').append(pin);
 }
 function resize(){
  const panel=document.querySelector('.rome-map-panel'),bounds=panel.getBoundingClientRect(),w=bounds.width-panel.clientLeft*2,h=bounds.height-panel.clientTop*2,sizer=$('romeMapSizer');
  // Cover without stretching the artwork or leaving empty side gutters.
  const scale=Math.max(w/crop.width,h/crop.height),width=crop.width*scale,height=crop.height*scale;
  sizer.style.width=width+'px';sizer.style.height=height+'px';sizer.style.left=(w-width)*.75+'px';sizer.style.top=(h-height)/2+'px';
  for(const pin of $('romePins').children){
   pin.classList.remove('rome-pin--label-left');
   if(pin.querySelector('.rome-pin-label').getBoundingClientRect().right>bounds.right-6)pin.classList.add('rome-pin--label-left');
  }
 }
 new ResizeObserver(resize).observe(document.querySelector('.rome-map-panel'));resize();select(selected);
 $('romeInfo').addEventListener('click',()=>$('romeAbout').showModal());$('romeInfoClose').addEventListener('click',()=>$('romeAbout').close());
 LudusNavigation.register(()=>({destination:selected}));
 (async()=>{try{
  const client=LudusClient.create('https://lryeeidutnlpgdesjxje.supabase.co','sb_publishable_5vKWVREHisXbfX55gePMxw_tMyZaeW1'),r=await client.auth.getUser();
  if(r.data?.user){LudusNavigation.setOwner(r.data.user.id);const saved=LudusNavigation.restore();if(data.find(saved?.destination))select(saved.destination);}
 }catch{}})();
 window.RomeMap={select,project:data.project,get selected(){return selected;}};
})();
