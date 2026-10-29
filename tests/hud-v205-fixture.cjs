/* Isolated restored HUD: production markup, styles and rendering functions; no live account. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=function(root){
 const source=fs.readFileSync(path.join(root,'ludus.html'),'utf8');
 const wallet=source.match(/ \$\('accountSummary'\)\.replaceChildren\(\);[\s\S]*?(?= \$\('accountLink'\)\.hidden=false;)/)?.[0];
 const caravans=source.match(/function updateCaravanHud\(data\)\{[\s\S]*?\n\}/)?.[0];
 const levels=source.match(/const levelProgress=LudusLevels\.create[^\n]+/)?.[0];
 assert(wallet&&caravans&&levels,'production HUD rendering functions must be present');
 let html=source.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,(tag,attrs,body)=>
  /rankings-entry-v200|ludus-settings-v29|combat-control-settings-v44|ludus-level-v37|ludus-door-icons-v41|ludus-first-quests-v111/.test(attrs)||/var LudusGems=/.test(body)||/id="gameViewport"/.test(attrs)?tag:'');
 const fixture=`
 const $=id=>document.getElementById(id);
 window.hudClicks={};const hit=key=>hudClicks[key]=(hudClicks[key]||0)+1;
 window.hudData={level:50,count:19,values:[984125,2000,2000,2000,2000]};
 const accountReady=Promise.resolve();
 const accountClient={rpc:async name=>({data:name==='ludus_progress'?{level:hudData.level,current_exp:0,next_exp:3000}:{count:hudData.count,total:22,should_open:false,quests:Object.fromEntries(LudusOnboarding.quests.map(([key])=>[key,{progress:0,target:1,unlocked:true,complete:false}]))}})};
 function setWallet(values){const playerAccount=Object.fromEntries(['gold','diamonds','sapphires','emeralds','rubies'].map((key,i)=>[key,values[i]]));${wallet}}
 ${levels}
 ${caravans}
 const guide=LudusOnboarding.create({client:accountClient,getUser:()=> 'fixture',menu:document.querySelector('.tools'),roster:()=>[],canOpen:()=>true,onOpen:()=>hit('guide'),onClose(){}});
 const settings=LudusViewSettings.create({onChange(){},onOpen(){},onClose(){},onHelp(){hit('help');}});
 $('accountLink').onclick=()=>settings.open();$('friendsOpen').onclick=()=>hit('friends');$('messagesOpen').onclick=()=>hit('messages');
 for(const id of ['messagesOpen','accountLink'])$(id).hidden=false;
 $('messageUnread').hidden=false;$('messageUnread').textContent='43';
 $('loading').hidden=true;$('residentStatus').hidden=true;
 window.hud={async setWallet(values){setWallet(values);await levelProgress.refresh();updateCaravanHud({free_caravans:6,caravans:6});},async setLevel(level){hudData.level=level;await levelProgress.refresh();},setCaravans:updateCaravanHud,async setBook(count){hudData.count=count;await guide.start();}};
 window.hudReady=(async()=>{await hud.setWallet(hudData.values);await guide.start();})();
 document.body.style.backgroundImage='var(--loading-photo-ludus)';document.body.style.backgroundSize='cover';document.body.style.backgroundPosition='center';
 `;
 return html.replace('<script src="rankings-entry-v200.js','<script>'+fixture+'</script><script src="rankings-entry-v200.js');
};
