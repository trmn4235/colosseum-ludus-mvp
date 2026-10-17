/* Camera preferences stay on this device, independent of account cosmetics. */
var LudusViewSettings=(()=>{
 'use strict';
 const presets={near:{label:'Yakın',distance:2.5},medium:{label:'Orta yakın',distance:3.6},far:{label:'Uzak',distance:5}};
 const key='ludus-camera-distance';
 function load(){try{const value=localStorage.getItem(key);return presets[value]?value:'medium';}catch{return'medium';}}
 function create({onChange,onOpen,onClose,onViewToggle,isExploring,onHelp,onControlsSave}){
  const dialog=document.createElement('dialog');dialog.className='ludus-view-settings';dialog.setAttribute('aria-labelledby','ludusSettingsTitle');
  dialog.innerHTML='<form method="dialog"><div class="settings-heading"><h2 id="ludusSettingsTitle">Ayarlar</h2><button aria-label="Ayarları kapat" value="close">✕</button></div><label for="cameraPreset">Kamera uzaklığı<select id="cameraPreset">'+Object.entries(presets).map(([id,p])=>'<option value="'+id+'">'+p.label+'</option>').join('')+'</select></label><label for="combatControlPreset">Dövüş kontrol düzeni<select id="combatControlPreset"></select></label><p>Kamera duvarlara yaklaşınca otomatik öne gelir.</p><p>Klasik: kaydırarak saldır. Bölgesel: vücut bölgesine dokun.</p><button type="button" id="viewModeToggle">Genel görünüme geç</button><button type="button" id="saveCombatControls">Kontrolleri kaydet</button><div class="settings-help"><button type="button" id="beginnerHelp">Yardım · Başlangıç rehberi</button><small id="settingsSaveStatus" role="status"></small></div><div class="settings-actions"><button type="button" id="accountSettings">Hesap ayarları</button><button value="close">Oyuna dön</button></div></form>';
  document.body.append(dialog);CombatControlSettings.bind(dialog.querySelector('#combatControlPreset'));const select=dialog.querySelector('#cameraPreset');select.value=load();
  select.onchange=()=>{try{localStorage.setItem(key,select.value);}catch{}onChange(presets[select.value]);};
  dialog.querySelector('#accountSettings').onclick=()=>{location.href=new URL('index.html?v=revision84',location.href).href;};
  const viewToggle=dialog.querySelector('#viewModeToggle');viewToggle.hidden=!onViewToggle;viewToggle.onclick=()=>{dialog.close();finish();onViewToggle?.();};
  let active=false;const finish=()=>{if(active){active=false;onClose();}};
  const help=dialog.querySelector('#beginnerHelp');help.hidden=!onHelp;help.onclick=()=>{dialog.close();finish();onHelp?.();};
  const save=dialog.querySelector('#saveCombatControls'),status=dialog.querySelector('#settingsSaveStatus');
  save.onclick=async()=>{const value=dialog.querySelector('#combatControlPreset').value;CombatControlSettings.save(value);save.disabled=true;status.textContent='Kaydediliyor…';try{await onControlsSave?.(value);status.textContent='Kontroller kaydedildi.';}catch{status.textContent='Kaydedilemedi. Tekrar dene.';}finally{save.disabled=false;}};
  dialog.querySelector('form').addEventListener('submit',finish);dialog.addEventListener('close',finish);dialog.addEventListener('cancel',finish);
  return{open(){viewToggle.textContent=isExploring?.()?'Genel görünüme geç':'Avluda gezin';select.value=load();dialog.querySelector('#combatControlPreset').value=CombatControlSettings.load();active=true;onOpen();dialog.showModal();},dialog};
 }
 return{presets,load,create};
})();

