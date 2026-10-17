/* V108 message center. User text is rendered only through textContent. */
var LudusMessages=(function(){
 'use strict';
 const icons={
  mail:['M3 5h18v14H3z','m3 6 9 7 9-7'],
  helmet:['M5 13V9a7 7 0 0 1 14 0v4l-3 1v7l-4-3-4 3v-7z','M6 10h12M12 3v7'],
  mission:['M6 3h12v18H6z','M6 3H3v4h3M18 17h3v4h-3','M9 8h6M9 12h6M9 16h4'],
  training:['M5 6v12M2 8v8M19 6v12M22 8v8M5 12h14'],
  market:['M3 8c0-3 12-3 12 0s-12 3-12 0z','M3 8v5c0 3 12 3 12 0V8','M9 16v3c0 3 12 3 12 0v-5c0-2-3-3-6-3M15 16h5'],
  upgrade:['M3 8h18l-5 5h-3v6h5v2H6v-2h4v-6H7z','M5 3h9v5'],
  reward:['M4 7h16v5H4zM6 12v9h12v-9M12 7v14','M12 7C3 7 5 0 9 3l3 4 3-4c4-3 6 4-3 4'],
  supply:['m3 7 9-4 9 4v13H3z','M3 7l9 4 9-4M12 11v9'],
  guild:['M12 3 4 6v6c0 5 8 10 8 10s8-5 8-10V6z','M8 10h8M12 7v10'],
  global:['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0','M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18'],
  trash:['M4 6h16M9 3h6M6 6l1 15h10l1-15M10 10v7M14 10v7']
 };
 function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
 function icon(kind){const e=el('span','mc-icon');e.setAttribute('aria-hidden','true');e.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+(icons[kind]||icons.helmet).map(d=>'<path d="'+d+'"/>').join('')+'</svg>';return e;}
 function button(text,cls,fn){const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;}
 function ago(value){const d=Math.max(0,(Date.now()-Date.parse(value))/60000);return d<1?'Şimdi':d<60?Math.floor(d)+' dk':d<1440?Math.floor(d/60)+' sa':Math.floor(d/1440)+' gün';}
 function date(value){return new Date(value).toLocaleString('tr-TR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}
 function create({client,getUser,onOpen=()=>{},onClose=()=>{},onNavigate=()=>{}}){
  const trigger=document.getElementById('messagesOpen'),badge=document.getElementById('messageUnread');
  const dialog=el('dialog');dialog.id='ludusMessages';dialog.dataset.version='108';dialog.setAttribute('aria-labelledby','messagesTitle');
  const header=el('div','mc-head'),title=el('h2',null,'Mesajlar');title.id='messagesTitle';
  const shortcut=button('Sistem','mc-shortcut',()=>changeChannel('system')),closeButton=button('×','mc-close',()=>dialog.close());closeButton.setAttribute('aria-label','Mesajları kapat');
  header.append(icon('mail'),title,shortcut,closeButton);
  const content=el('div','mc-content'),left=el('section','mc-panel mc-left'),leftTitle=el('h3',null,'Konuşmalar'),tabs=el('div','mc-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Mesaj kanalı');
  const tabButtons={};for(const [key,label] of Object.entries({private:'Özel',guild:'Guild',global:'Global',system:'Sistem'})){
   const b=button(label,'mc-tab',()=>changeChannel(key));b.setAttribute('role','tab');b.id='mc-tab-'+key;b.setAttribute('aria-controls','mc-channel');tabButtons[key]=b;tabs.append(b);
  }
  tabs.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const keys=Object.keys(tabButtons),i=keys.indexOf(channel),next=e.key==='Home'?0:e.key==='End'?3:(i+(e.key==='ArrowRight'?1:3))%4;changeChannel(keys[next]);tabButtons[keys[next]].focus();});
  const select=el('select','mc-friends');select.setAttribute('aria-label','Yeni özel konuşma');select.add(new Option('Arkadaşını seç…',''));select.onchange=()=>choosePeer(select.value);
  const leftList=el('div','mc-list'),leftPager=pager('Konuşma sayfası',()=>{leftPage--;renderLeft();},()=>{leftPage++;renderLeft();});
  left.append(leftTitle,tabs,select,leftList,leftPager.root);
  const center=el('section','mc-panel mc-center');center.id='mc-channel';center.setAttribute('role','tabpanel');
  const centerHead=el('div','mc-thread-head'),back=button('‹ Konuşmalar','mc-back',()=>{dialog.dataset.mobile='list';}),identity=el('div','mc-identity'),name=el('h3',null,'Konuşmaların'),subtitle=el('p',null,'Özel sohbet');identity.append(name,subtitle);centerHead.append(back,icon('helmet'),identity);
  const history=el('div','mc-history');history.setAttribute('role','log');history.setAttribute('aria-label','Mesaj geçmişi');
  const threadPager=pager('Mesaj sayfası',()=>{messagePage++;refresh();},()=>{messagePage--;refresh();});
  const form=el('form','mc-compose'),input=el('textarea');input.maxLength=1000;input.placeholder='Mesaj yaz…';input.setAttribute('aria-label','Mesajın');input.rows=2;
  const send=el('button','mc-send','Gönder');send.type='submit';form.append(input,send);
  const announcement=el('label','mc-announcement'),check=el('input');check.type='checkbox';announcement.append(check,document.createTextNode('Guild duyurusu olarak yayımla'));
  const detail=el('section','mc-detail');detail.hidden=true;
  center.append(centerHead,history,threadPager.root,form,announcement,detail);
  const right=el('aside','mc-panel mc-right'),rightTitle=el('h3',null,'Sistem Bildirimleri'),noteList=el('div','mc-list mc-notes');
  const notePager=pager('Bildirim sayfası',()=>{notePage--;refresh();},()=>{notePage++;refresh();});
  const clearButton=button('Tüm Bildirimleri Sil','mc-clear',confirmClear);clearButton.prepend(icon('trash'));right.append(rightTitle,noteList,notePager.root,clearButton);
  const mobileClear=button('Tüm Bildirimleri Sil','mc-mobile-clear',confirmClear);left.append(mobileClear);
  content.append(left,center,right);
  const footer=el('div','mc-footer'),status=el('p','mc-status'),retryButton=button('Tekrar dene','mc-retry',()=>lastFailed?.());status.setAttribute('role','status');retryButton.hidden=true;footer.append(status,retryButton);
  const confirmation=el('div','mc-confirm');confirmation.hidden=true;confirmation.setAttribute('role','alertdialog');confirmation.setAttribute('aria-modal','true');confirmation.setAttribute('aria-labelledby','mc-confirm-title');
  dialog.append(header,content,footer,confirmation);document.body.append(dialog);
  let data={friends:[],conversations:[],notifications:[]},channel='private',peer=null,leftPage=0,messagePage=0,notePage=0;
  let sizes={left:4,messages:3,notes:4},opened=false,sending=false,mutating=false,sequence=0,owner=null,pendingNavigation=null,retry=null,lastFailed=null,destroyed=false,requestCount=0;
  let selectedNote=null,fullMessage=null,textPage=0,textPages=[],resizeTimer=null,refreshing=false;
  const drafts=new Map();
  function pager(label,prev,next){const root=el('nav','mc-pager');root.setAttribute('aria-label',label);const a=button('‹',null,prev),b=button('›',null,next),count=el('span');a.setAttribute('aria-label',label+' · önceki');b.setAttribute('aria-label',label+' · sonraki');root.append(a,count,b);return{root,a,b,count};}
  function setPager(p,page,total,size,reverse=false){const pages=Math.max(1,Math.ceil(total/size));p.a.disabled=reverse?page>=pages-1:page<=0;p.b.disabled=reverse?page<=0:page>=pages-1;p.count.textContent=(page+1)+' / '+pages;p.root.hidden=total<=size;}
  function error(e,fn){status.textContent=e?.message||'Bağlantı kurulamadı. Tekrar dene.';lastFailed=fn;retryButton.hidden=!fn;}
  function clearError(){status.textContent='';retryButton.hidden=true;lastFailed=null;}
  function draftKey(){return channel+':'+(peer||'');}
  function saveDraft(){drafts.set(draftKey(),input.value);}
  function empty(where,text,kind='mail'){const box=el('div','mc-empty');box.append(icon(kind),el('p',null,text));where.replaceChildren(box);}
  function compose(){const allowed=opened&&!sending&&!mutating&&!!data.can_send&&channel!=='system'&&!fullMessage;input.disabled=!allowed;send.disabled=!allowed||!input.value.trim();select.disabled=sending||mutating;check.disabled=sending||mutating;for(const b of Object.values(tabButtons))b.disabled=sending||mutating;announcement.hidden=channel!=='guild'||!data.clan?.leader||!!fullMessage;}
  function updateBadge(){const unread=(Number(data.unread)||0)+(Number(data.notification_unread)||0);badge.textContent=unread>99?'99+':String(unread);badge.hidden=!unread;trigger.setAttribute('aria-label',unread?'Mesajlar · '+unread+' okunmamış':'Mesajlar');shortcut.textContent='Sistem'+(data.notification_unread?' · '+data.notification_unread:'');}
  function notificationRow(n){const b=button('', 'mc-row mc-note'+(!n.read_at?' unread':''),()=>chooseNote(n));const text=el('span','mc-row-text');text.append(el('strong',null,n.title),el('small',null,n.body));const t=el('time',null,ago(n.created_at));t.dateTime=n.created_at;t.title=date(n.created_at);b.append(icon(n.kind),text,t);b.setAttribute('aria-label',n.title+': '+n.body+(!n.read_at?' · okunmamış':''));return b;}
  function renderLeft(){
   for(const [key,b] of Object.entries(tabButtons)){b.setAttribute('aria-selected',String(channel===key));b.tabIndex=channel===key?0:-1;}
   mobileClear.hidden=channel!=='system';mobileClear.disabled=mutating||!(data.notification_total>0);center.setAttribute('aria-labelledby','mc-tab-'+channel);select.hidden=channel!=='private';leftList.replaceChildren();
   if(channel==='private'){
    select.replaceChildren(new Option('Arkadaşını seç…',''));for(const f of data.friends||[])select.add(new Option(f.name||f.username||'Arkadaş',f.id));select.value=peer||'';
    const list=data.conversations||[];leftPage=Math.min(leftPage,Math.max(0,Math.ceil(list.length/sizes.left)-1));
    for(const c of list.slice(leftPage*sizes.left,(leftPage+1)*sizes.left)){
     const b=button('','mc-row mc-conversation',()=>choosePeer(c.id)),text=el('span','mc-row-text'),line=el('span','mc-row-top');line.append(el('strong',null,c.name||c.username||'Arkadaş'),el('time',null,ago(c.last_at)));text.append(line,el('small',null,c.last_body||''));b.append(icon('helmet'),text);if(c.unread)b.append(el('span','mc-unread',c.unread>99?'99+':c.unread));b.setAttribute('aria-pressed',String(c.id===peer));leftList.append(b);
    }
    if(!list.length)empty(leftList,data.friends?.length?'İlk konuşmanı başlatmak için bir arkadaşını seç.':'Arkadaşlar bölümünden arkadaş ekleyerek özel sohbet başlatabilirsin.');setPager(leftPager,leftPage,list.length,sizes.left);
   }else if(channel==='system'){
    for(const n of data.notifications||[])leftList.append(notificationRow(n));if(!data.notifications?.length)empty(leftList,'Henüz sistem bildirimi yok. Tamamlanan işlemler burada görünecek.','mission');
    leftPager.a.onclick=()=>{notePage--;refresh();};leftPager.b.onclick=()=>{notePage++;refresh();};setPager(leftPager,notePage,data.notification_total||0,sizes.notes);
   }else{
    const label=channel==='guild'?(data.clan?.name||'Guild sohbeti'):'Global sohbet';const b=button('','mc-row mc-channel-row',()=>{dialog.dataset.mobile='thread';});const text=el('span','mc-row-text');text.append(el('strong',null,label),el('small',null,channel==='guild'?'Klan üyeleriyle konuş':'Tüm oyuncularla konuş'));b.append(icon(channel),text);leftList.append(b);
    if(channel==='guild'&&!data.clan)leftList.append(el('p','mc-empty-copy','Guild sohbeti için bir klana katılmalısın.'));leftPager.root.hidden=true;
   }
   if(channel!=='system'){leftPager.a.onclick=()=>{leftPage--;renderLeft();};leftPager.b.onclick=()=>{leftPage++;renderLeft();};}
  }
  function renderNotes(){noteList.replaceChildren();for(const n of data.notifications||[])noteList.append(notificationRow(n));if(!data.notifications?.length)empty(noteList,'Henüz bildirim yok.','mission');setPager(notePager,notePage,data.notification_total||0,sizes.notes);clearButton.disabled=mutating||!(data.notification_total>0);}
  function renderThread(){
   const isSystem=channel==='system';history.hidden=isSystem||!!fullMessage;form.hidden=isSystem||!!fullMessage;threadPager.root.hidden=isSystem||!!fullMessage;
   centerHead.querySelector('.mc-icon')?.replaceWith(icon(isSystem?'mission':channel==='private'?'helmet':channel));
   name.textContent=isSystem?'Sistem mesajları':channel==='guild'?(data.clan?.name||'Guild sohbeti'):channel==='global'?'Global sohbet':(data.peer?.name||data.friends?.find(f=>f.id===peer)?.name||data.conversations?.find(c=>c.id===peer)?.name||'Konuşmaların');
   subtitle.textContent=isSystem?'Ludus’undaki son gelişmeler':channel==='private'?'Özel sohbet':channel==='guild'?'Klan sohbeti':'Tüm oyuncular';
   detail.hidden=!(isSystem||fullMessage);
   if(isSystem||fullMessage){renderDetail();compose();return;}
   history.replaceChildren();const messages=data.messages||[];
   for(const m of messages){const bubble=el('article','mc-bubble'+(m.mine?' mine':'')),meta=el('div','mc-bubble-meta'),time=el('time');time.dateTime=m.created_at;time.textContent=new Date(m.created_at).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});time.title=date(m.created_at);meta.append(el('strong',null,m.mine?'Sen':m.name||name.textContent),time);if(m.announcement)meta.prepend(el('span','mc-tag','Duyuru'));const body=el('p',null,m.body);bubble.append(meta,body);if(m.body.length>45){const full=button('Tamamını oku','mc-read-more',()=>{fullMessage=m;textPage=0;renderThread();});bubble.append(full);}history.append(bubble);}
   history.style.setProperty('--message-rows',Math.max(1,messages.length));
   if(!messages.length)empty(history,channel==='guild'&&!data.clan?'Guild sohbeti için önce bir klana katıl.':channel==='private'&&!peer?'Konuşmak için soldan bir arkadaşını seç.':'Henüz mesaj yok. İlk mesajı sen yaz.',channel==='private'?'mail':channel);
   setPager(threadPager,messagePage,data.message_total||0,sizes.messages,true);compose();
  }
  function renderDetail(){
   const n=fullMessage||selectedNote;detail.replaceChildren();if(!n){empty(detail,'Bir sistem bildirimini seçerek ayrıntısını görebilirsin.','mission');return;}
   const heading=el('h4',null,fullMessage?'Mesaj':n.title),time=el('time','mc-detail-time',date(n.created_at)),body=el('p','mc-detail-body'),pages=pager('Metin sayfası',()=>{textPage--;showText();},()=>{textPage++;showText();});
   const action=button(fullMessage?'Sohbete dön':({missions:'Görevlere git',training:'Gladyatörlere git',market:'Pazara git',upgrades:'Geliştirmelere git',levels:'Ödüllere git',supply:'Depoya git',guild:'Guild sohbetini aç'}[n.target]||'Aç'),'mc-detail-action',()=>{
    if(fullMessage){fullMessage=null;renderThread();}else if(n.target==='guild')changeChannel('guild');else{pendingNavigation=n.target;dialog.close();}
   });detail.append(heading,time,body,pages.root,action);
   function showText(){textPage=Math.max(0,Math.min(textPage,textPages.length-1));body.textContent=textPages[textPage]||'';setPager(pages,textPage,textPages.length,1);}
   // Long messages are paged by their actual available height, never silently cut.
   requestAnimationFrame(()=>{if(!body.isConnected||body.clientHeight<1)return;textPages=[];let rest=n.body||'';pages.root.hidden=false;
    while(rest){let low=1,high=rest.length,best=1;while(low<=high){const mid=Math.floor((low+high)/2);body.textContent=rest.slice(0,mid);if(body.scrollHeight<=body.clientHeight+1){best=mid;low=mid+1;}else high=mid-1;}textPages.push(rest.slice(0,best));rest=rest.slice(best);}
    if(!textPages.length)textPages=[''];showText();
   });
  }
  function render(){updateBadge();if(!opened)return;renderLeft();renderNotes();renderThread();}
  async function request(action,extra={},id=null){
   const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),12000);requestCount++;
   try{const q=client.rpc('ludus_message_center',{p_action:action,p_data:{channel,peer,limit:sizes.messages,offset:messagePage*sizes.messages,thread_until:messagePage?data.thread_until:null,notification_limit:sizes.notes,notification_offset:notePage*sizes.notes,...extra},p_request:id});const {data:result,error:e}=await (q.abortSignal?q.abortSignal(abort.signal):q);if(e)throw Error(e.message||'Mesajlar yüklenemedi.');return result;}finally{clearTimeout(timer);requestCount--;}
  }
  function resetOwner(id){owner=id;data={friends:[],conversations:[],notifications:[]};channel='private';peer=null;leftPage=messagePage=notePage=0;selectedNote=fullMessage=null;drafts.clear();input.value='';retry=null;updateBadge();}
  async function refresh(){
   if(destroyed||document.hidden||sending||mutating)return;const id=getUser();if(owner!==id){++sequence;resetOwner(id);if(!id&&dialog.open)dialog.close();}if(!id)return;
   const n=++sequence;refreshing=true;
   try{const result=await request(opened&&(peer||channel!=='private')?'thread':'state');if(n!==sequence||id!==getUser())return;data=result;notePage=Math.floor((result.notification_offset||0)/sizes.notes);messagePage=Math.floor((result.message_offset||0)/sizes.messages);render();clearError();}
   catch(e){if(n===sequence&&opened)error(e,refresh);}finally{refreshing=false;}
  }
  function changeChannel(next){if(sending||mutating)return;saveDraft();channel=next;peer=next==='private'?peer:null;messagePage=leftPage=0;fullMessage=null;data.messages=[];data.peer=null;data.can_send=false;input.value=drafts.get(draftKey())||'';check.checked=false;dialog.dataset.mobile=next==='guild'||next==='global'?'thread':'list';clearError();render();resize();refresh();}
  function choosePeer(id){if(sending||mutating||!id)return;saveDraft();channel='private';peer=id;messagePage=0;fullMessage=null;data.peer=null;data.messages=[];data.can_send=false;input.value=drafts.get(draftKey())||'';dialog.dataset.mobile='thread';render();resize();refresh();}
  async function chooseNote(n){
   if(sending||mutating)return;saveDraft();channel='system';selectedNote=n;fullMessage=null;textPage=0;dialog.dataset.mobile='thread';render();mutating=true;compose();const seq=++sequence,id=getUser();
   try{const result=await request('read',{event_key:n.event_key});if(seq===sequence&&id===getUser()){data=result;selectedNote={...n,read_at:n.read_at||new Date().toISOString()};render();clearError();}}
   catch(e){if(seq===sequence)error(e,()=>chooseNote(n));}finally{mutating=false;compose();}
  }
  function confirmClear(){
   if(mutating||!data.notification_latest)return;const through=data.notification_latest;confirmation.replaceChildren();const box=el('div','mc-confirm-box'),h=el('h3',null,'Bildirimler silinsin mi?');h.id='mc-confirm-title';const p=el('p',null,data.notification_total+' sistem bildirimi silinecek. Oyun ilerlemen ve mesajların korunur.'),actions=el('div');const cancel=button('Vazgeç','mc-secondary',()=>{confirmation.hidden=true;clearButton.focus();}),ok=button('Bildirimleri sil',null,async()=>{
    if(mutating)return;mutating=true;ok.disabled=cancel.disabled=true;const seq=++sequence,id=getUser();
    try{const result=await request('clear',{through});if(seq===sequence&&id===getUser()){data=result;notePage=0;selectedNote=null;render();clearError();confirmation.hidden=true;clearButton.focus();}}
    catch(e){if(seq===sequence){confirmation.hidden=true;error(e,confirmClear);}}finally{mutating=false;ok.disabled=cancel.disabled=false;renderNotes();compose();}
   });actions.append(cancel,ok);box.append(h,p,actions);confirmation.append(box);confirmation.hidden=false;cancel.focus();
  }
  input.oninput=()=>{saveDraft();compose();};
  form.onsubmit=async e=>{
   e.preventDefault();const body=input.value.trim();if(sending||mutating||input.disabled||!body)return;const key=draftKey(),signature=JSON.stringify([key,body,check.checked]);const id=retry?.signature===signature?retry.id:crypto.randomUUID();retry={signature,id};sending=true;compose();status.textContent='Gönderiliyor…';retryButton.hidden=true;const seq=++sequence,user=getUser();
   try{const result=await request('send',{body,announcement:check.checked,offset:0},id);if(user!==getUser())return;drafts.delete(key);retry=null;input.value='';if(seq===sequence){messagePage=0;data=result;render();clearError();}}
   catch(e){if(seq===sequence)error(e,null);}finally{sending=false;compose();if(!opened)refresh();}
  };
  function resize(){clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!opened)return;const next={left:leftList.clientHeight?Math.max(1,Math.floor(leftList.clientHeight/(window.innerHeight<=500?50:64))):sizes.left,messages:history.clientHeight?Math.max(1,Math.min(8,Math.floor(history.clientHeight/(window.innerHeight<=500?84:110)))):sizes.messages,notes:noteList.clientHeight?Math.max(1,Math.floor(noteList.clientHeight/(window.innerHeight<=500?58:66))):sizes.notes};if(window.innerWidth<620&&leftList.clientHeight)next.notes=Math.max(1,Math.floor(leftList.clientHeight/70));for(const k of Object.keys(next))next[k]=Math.min(20,next[k]);if(JSON.stringify(sizes)!==JSON.stringify(next)&&!sending&&!mutating){sizes=next;leftPage=messagePage=notePage=0;refresh();}else if(selectedNote||fullMessage)renderDetail();},120);}
  async function open(initialChannel){if(opened||!getUser())return;if(owner!==getUser())resetOwner(getUser());if(initialChannel==='system'){channel='system';peer=null;selectedNote=null;fullMessage=null;}opened=true;dialog.dataset.mobile='list';onOpen();dialog.showModal();closeButton.focus({preventScroll:true});render();status.textContent='Mesajlar yükleniyor…';resize();await refresh();}
  dialog.addEventListener('close',()=>{if(!opened)return;opened=false;++sequence;confirmation.hidden=true;saveDraft();onClose();const target=pendingNavigation;pendingNavigation=null;if(target)onNavigate(target);else trigger.focus({preventScroll:true});});
  dialog.addEventListener('cancel',e=>{if(!confirmation.hidden){e.preventDefault();confirmation.hidden=true;clearButton.focus();}});
  dialog.addEventListener('keydown',e=>{if(!confirmation.hidden&&e.key==='Tab'){const buttons=[...confirmation.querySelectorAll('button')];e.preventDefault();buttons[document.activeElement===buttons[0]?1:0].focus();}});
  const visibility=()=>{if(!document.hidden)refresh();};const interval=setInterval(()=>{if(!refreshing&&!requestCount)refresh();},20000);document.addEventListener('visibilitychange',visibility);window.addEventListener('resize',resize);window.addEventListener('online',visibility);trigger.onclick=open;
  return{open,close(){if(dialog.open)dialog.close();},refresh,destroy(){destroyed=true;++sequence;clearInterval(interval);clearTimeout(resizeTimer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('resize',resize);window.removeEventListener('online',visibility);if(dialog.open)dialog.close();dialog.remove();}};
 }
 return{create};
})();

