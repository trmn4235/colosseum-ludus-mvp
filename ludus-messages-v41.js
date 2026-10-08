/* Private friend inbox. User-supplied names and messages are always text nodes. */
var LudusMessages=(function(){
 'use strict';
 function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
 function create({client,getUser,onOpen=()=>{},onClose=()=>{}}){
  const trigger=document.getElementById('messagesOpen'),badge=document.getElementById('messageUnread');
  const dialog=node('dialog');dialog.id='ludusMessages';dialog.setAttribute('aria-labelledby','messagesTitle');
  const head=node('header','messages-head'),title=node('h2',null,'Mesajlar');title.id='messagesTitle';
  const closeButton=node('button','messages-close','×');closeButton.type='button';closeButton.setAttribute('aria-label','Mesajları kapat');
  head.append(title,closeButton);
  const content=node('div','messages-content'),peers=node('aside','messages-peers'),select=node('select');select.setAttribute('aria-label','Mesaj göndereceğin arkadaş');
  const conversations=node('nav','messages-conversations');conversations.setAttribute('aria-label','Konuşmalar');peers.append(select,conversations);
  const thread=node('section','messages-thread'),peerName=node('h3','messages-peer-name','Arkadaşını seç'),history=node('div','messages-history');history.setAttribute('role','log');history.setAttribute('aria-label','Mesaj geçmişi');
  const form=node('form','messages-compose'),input=node('textarea');input.maxLength=1000;input.placeholder='Mesajını yaz…';input.setAttribute('aria-label','Mesajın');input.disabled=true;
  const send=node('button',null,'Gönder');send.type='submit';send.disabled=true;form.append(input,send);thread.append(peerName,history,form);content.append(peers,thread);
  const status=node('p','messages-status');status.setAttribute('role','status');dialog.append(head,content,status);document.body.append(dialog);
  let peer=null,state={friends:[],conversations:[],unread:0},sequence=0,sending=false,retry=null,opened=false;
  function empty(text){history.replaceChildren(node('p','messages-empty',text));}
  empty('Arkadaşlarınla buradan konuşabilirsin.');
  function compose(){const allowed=!!peer&&state.friends.some(f=>f.id===peer);input.disabled=!allowed;send.disabled=!allowed||sending||!input.value.trim();}
  function render(data){state=data;
   const unread=Number(data.unread)||0;badge.textContent=unread>99?'99+':String(unread);badge.hidden=unread===0;
   trigger.setAttribute('aria-label',unread?'Mesajlar · '+unread+' okunmamış':'Mesajlar');
   if(!opened)return;
   select.replaceChildren(new Option('Arkadaşını seç…',''));
   for(const f of data.friends||[])select.add(new Option(f.name||f.username||'Arkadaş',f.id));select.value=peer||'';
   conversations.replaceChildren();
   for(const c of data.conversations||[]){const b=node('button');b.type='button';b.setAttribute('aria-pressed',String(c.id===peer));b.append(node('strong',null,(c.name||c.username||'Arkadaş')+(c.unread?' · '+c.unread:'')),node('small',null,c.last_body||''));b.onclick=()=>choose(c.id);conversations.append(b);}
   if(!data.conversations?.length)conversations.append(node('p','messages-empty','Henüz konuşma yok.'));
   if(data.peer&&data.peer.id===peer){peerName.textContent=data.peer.name||data.peer.username||'Arkadaş';
    const wasAtEnd=history.scrollHeight-history.scrollTop-history.clientHeight<45,signature=JSON.stringify((data.messages||[]).map(m=>[m.id,m.read_at]));
    if(history.dataset.signature!==signature){history.dataset.signature=signature;history.replaceChildren();
     for(const m of data.messages||[]){const bubble=node('p','message-bubble'+(m.mine?' mine':'')),body=node('span',null,m.body),time=node('time');time.dateTime=m.created_at;time.textContent=new Date(m.created_at).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});bubble.append(body,time);history.append(bubble);}
     if(!data.messages?.length)empty('İlk mesajı sen yaz.');if(wasAtEnd||sending)history.scrollTop=history.scrollHeight;
    }
   }
   compose();
  }
  async function request(action='inbox',target=null,body=null,id=null){const {data,error}=await client.rpc('ludus_messages',{p_action:action,p_peer:target,p_body:body,p_request:id});if(error)throw Error(error.message||'Mesajlar yüklenemedi.');return data;}
  async function refresh(){if(!getUser()||document.hidden||sending)return;const n=++sequence;
   try{const data=await request(opened&&peer?'thread':'inbox',opened?peer:null);if(n!==sequence)return;render(data);if(opened)status.textContent='';}
   catch(e){if(n===sequence&&opened)status.textContent=e.message||'Mesajlar yüklenemedi. Tekrar açıp deneyebilirsin.';}
  }
  function choose(id){if(sending)return;peer=id||null;retry=null;input.value='';history.dataset.signature='';peerName.textContent=state.friends.find(f=>f.id===peer)?.name||state.conversations.find(c=>c.id===peer)?.name||'Arkadaşını seç';empty(peer?'Mesajlar yükleniyor…':'Arkadaşını seç.');compose();status.textContent='';refresh();}
  async function open(){if(opened||!getUser())return;opened=true;onOpen();dialog.showModal();closeButton.focus({preventScroll:true});status.textContent='Mesajlar yükleniyor…';await refresh();}
  function close(){if(dialog.open)dialog.close();}
  dialog.addEventListener('close',()=>{if(!opened)return;opened=false;++sequence;onClose();trigger.focus({preventScroll:true});});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
  closeButton.onclick=close;trigger.onclick=open;select.onchange=()=>choose(select.value);input.oninput=()=>{retry=null;compose();};
  form.onsubmit=async e=>{e.preventDefault();const body=input.value.trim(),target=peer;if(sending||!target||!body||input.disabled)return;
   const id=retry?.body===body&&retry.peer===target?retry.id:crypto.randomUUID();retry={id,body,peer:target};sending=true;select.disabled=true;input.disabled=true;send.disabled=true;status.textContent='Gönderiliyor…';const n=++sequence;
   try{const data=await request('send',target,body,id);retry=null;if(peer===target)input.value='';if(n===sequence){render(data);history.scrollTop=history.scrollHeight;status.textContent='';}}
   catch(error){if(n===sequence)status.textContent=error.message||'Mesaj gönderilemedi. Tekrar deneyebilirsin.';}
   finally{sending=false;select.disabled=false;compose();if(!opened)refresh();}
  };
  const interval=setInterval(refresh,20000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  return{open,close,refresh,destroy(){clearInterval(interval);close();dialog.remove();}};
 }
 return{create};
})();
