/* Device-local UI preference. Scene materials and account data are untouched. */
(function(root){
 'use strict';
 const key='ludus-ui-theme';
 const choices=Object.freeze([
  Object.freeze({id:'white',name:'Beyaz Mermer',caption:'Bordo · Altın'}),
  Object.freeze({id:'black',name:'Siyah Mermer',caption:'Antrasit · Gümüş'}),
  Object.freeze({id:'blue',name:'Mavi',caption:'Petrol · Şampanya'})
 ]);
 const valid=id=>choices.some(t=>t.id===id),normalize=id=>valid(id)?id:'white';
 function load(){try{return normalize(root.localStorage.getItem(key));}catch{return 'white';}}
 let current=load();
 function apply(id,persist){
  current=normalize(id);root.document.documentElement.dataset.uiTheme=current;
  if(persist)try{root.localStorage.setItem(key,current);}catch{}
  root.dispatchEvent(new root.CustomEvent('ludus:theme',{detail:{id:current}}));
  return current;
 }
 apply(current,false);
 root.addEventListener('storage',event=>{if(event.key===key||event.key===null)apply(load(),false);});
 root.addEventListener('pageshow',()=>apply(load(),false));
 function picker(){
  const field=root.document.createElement('fieldset');field.className='theme-picker';
  field.innerHTML='<legend>Arayüz teması</legend><div class="theme-choices">'+choices.map(t=>'<label class="theme-choice" data-theme-choice="'+t.id+'"><input type="radio" name="ludusUiTheme" value="'+t.id+'"><span class="theme-swatch" aria-hidden="true"><i></i><em></em></span><strong>'+t.name+'</strong><small>'+t.caption+'</small></label>').join('')+'</div><p class="theme-note" role="status">Seçimin bu cihazda kaydedilir ve açılan sayfalarda kullanılır.</p>';
  const sync=()=>{for(const input of field.querySelectorAll('input'))input.checked=input.value===current;};sync();
  field.addEventListener('change',event=>{if(!valid(event.target.value))return;apply(event.target.value,true);field.querySelector('.theme-note').textContent=choices.find(t=>t.id===current).name+' seçildi. Açılan sayfalar aynı temayı kullanır.';});
  root.addEventListener('ludus:theme',sync);
  return field;
 }
 root.LudusTheme=Object.freeze({key,choices,current:()=>current,set:id=>apply(id,true),picker});
})(globalThis);
