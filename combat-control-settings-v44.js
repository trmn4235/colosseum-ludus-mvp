/* V180: classic controls are the only supported layout. Migrate saved preferences. */
var CombatControlSettings=(()=>{
 const layouts={classic:'Klasik'},key='ludus-combat-controls';
 function load(){try{if(localStorage.getItem(key)!=='classic')localStorage.setItem(key,'classic');}catch{}return'classic';}
 function save(){load();document.body.dataset.controlLayout='classic';dispatchEvent(new CustomEvent('combat-control-layout',{detail:'classic'}));}
 function bind(select){if(!select)return;select.replaceChildren();const option=document.createElement('option');option.value='classic';option.textContent='Klasik';select.append(option);select.value=load();select.disabled=true;const label=select.closest('label');if(label){label.hidden=true;label.style.setProperty('display','none','important');}}
 addEventListener('storage',event=>{if(event.key===key)save();});
 return {layouts,load,save,bind};
})();
