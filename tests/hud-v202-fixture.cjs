/* Isolated UI fixture: production HTML/CSS, HUD, gems and settings; no account/network writes. */
const fs=require('node:fs'),path=require('node:path');
module.exports=function(root){
 let html=fs.readFileSync(path.join(root,'ludus.html'),'utf8');
 html=html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,(tag,attrs,body)=>
  /ludus-hud-v202|rankings-entry-v200|ludus-settings-v29|combat-control-settings-v44/.test(attrs)||/var LudusGems=/.test(body)||/id="gameViewport"/.test(attrs)?tag:'');
 const fixture=`
 window.hudClicks={};const hit=key=>hudClicks[key]=(hudClicks[key]||0)+1;
 const settings=LudusViewSettings.create({onChange(){},onOpen(){},onClose(){},onHelp(){hit('help');}});
 document.getElementById('accountLink').onclick=()=>settings.open();
 document.getElementById('friendsOpen').onclick=()=>hit('friends');
 document.getElementById('messagesOpen').onclick=()=>hit('messages');
 window.hud=LudusHudV202.create({openCaravans:()=>hit('caravans'),openGladiators:()=>hit('gladiators')});
 window.hudData={now:Date.now(),roster:Array.from({length:12},(_,i)=>({record:{id:String(i),status:i<8?'available':'locked'}}))};
 hud.setWallet([984125,2000,2000,2000,2000]);hud.setLevel({level:50});hud.setCaravans({free_caravans:6,caravans:6});hud.setRoster(hudData.roster,true,hudData.now);
 for(const id of ['messagesOpen','accountLink'])document.getElementById(id).hidden=false;
 const unread=document.getElementById('messageUnread');unread.hidden=false;unread.textContent='43';
 const book=document.createElement('button');book.id='beginnerOpen';book.textContent='19/22';document.querySelector('.tools').append(book);
 document.getElementById('loading').hidden=true;document.getElementById('residentStatus').hidden=true;
 document.body.style.backgroundImage='var(--loading-photo-ludus)';document.body.style.backgroundSize='cover';document.body.style.backgroundPosition='center';
 `;
 // Mount before the shared ranking script so it cannot add the retired separate panel.
 return html.replace('<script src="rankings-entry-v200.js', '<script>'+fixture+'</script><script src="rankings-entry-v200.js');
};
