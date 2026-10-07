/* Camera preferences stay on this device, independent of account cosmetics. */
var LudusViewSettings=(()=>{
 'use strict';
 const presets={near:{label:'Yakın',distance:2.5},medium:{label:'Orta yakın',distance:3.6},far:{label:'Uzak',distance:5}};
 const key='ludus-camera-distance';
 function load(){try{const value=localStorage.getItem(key);return presets[value]?value:'medium';}catch{return'medium';}}
 function create({onChange,onOpen,onClose}){
  const dialog=document.createElement('dialog');dialog.className='ludus-view-settings';dialog.setAttribute('aria-labelledby','ludusSettingsTitle');
  dialog.innerHTML='<form method="dialog"><header><h2 id="ludusSettingsTitle">Ayarlar</h2><button aria-label="Ayarları kapat" value="close">✕</button></header><label for="cameraPreset">Kamera uzaklığı</label><select id="cameraPreset">'+Object.entries(presets).map(([id,p])=>'<option value="'+id+'">'+p.label+'</option>').join('')+'</select><p>Kamera duvarlara yaklaşınca otomatik olarak öne gelir.</p><div class="settings-actions"><button type="button" id="accountSettings">Hesap ayarları</button><button value="close">Oyuna dön</button></div></form>';
  document.body.append(dialog);const select=dialog.querySelector('select');select.value=load();
  select.onchange=()=>{try{localStorage.setItem(key,select.value);}catch{}onChange(presets[select.value]);};
  dialog.querySelector('#accountSettings').onclick=()=>{location.href=new URL('index.html?v=revision29',location.href).href;};
  let active=false;const finish=()=>{if(active){active=false;onClose();}};
  dialog.querySelector('form').addEventListener('submit',finish);dialog.addEventListener('close',finish);dialog.addEventListener('cancel',finish);
  return{open(){select.value=load();active=true;onOpen();dialog.showModal();},dialog};
 }
 return{presets,load,create};
})();
