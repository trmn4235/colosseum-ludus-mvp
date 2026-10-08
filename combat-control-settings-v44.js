/* Add future layouts here; only implemented layouts can be selected. */
var CombatControlSettings=(()=>{
 const layouts={classic:'Klasik',regions:'Bölgesel'},key='ludus-combat-controls';
 function load(){try{const value=localStorage.getItem(key);return layouts[value]?value:'regions';}catch{return'regions';}}
 function save(value){if(!layouts[value])return;try{localStorage.setItem(key,value);}catch{}document.body.dataset.controlLayout=value;dispatchEvent(new CustomEvent('combat-control-layout',{detail:value}));}
 function bind(select){select.replaceChildren();for(const [value,label]of Object.entries(layouts)){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}select.value=load();select.addEventListener('change',()=>save(select.value));addEventListener('combat-control-layout',event=>{select.value=event.detail;});}
 addEventListener('storage',event=>{if(event.key===key){document.body.dataset.controlLayout=load();dispatchEvent(new CustomEvent('combat-control-layout',{detail:load()}));}});
 return {layouts,load,save,bind};
})();
