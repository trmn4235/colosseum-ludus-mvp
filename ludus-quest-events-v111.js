/* Acknowledge viewed information; purchases, rewards and wins are server-recorded. */
var LudusQuestEvents=(()=>{
 const remembered=new Set(),pending=new Map();
 async function record(client,action,subject=null,detail=null){
  if(!client?.auth)return;
  const {data,error}=await client.auth.getUser();if(error)throw error;const owner=data?.user?.id;if(!owner)return;
  const key=JSON.stringify([owner,action,subject,detail]);if(remembered.has(key))return;if(pending.has(key))return pending.get(key);
  const work=(async()=>{
   const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),12000);
   try{let q=client.rpc('ludus_first_quests',{p_action:action,p_subject:subject,p_detail:detail});if(q.abortSignal)q=q.abortSignal(abort.signal);const {data:state,error:e}=await q;if(e)throw e;
    const current=await client.auth.getUser();if(current.data?.user?.id!==owner)return;
    const accepted=action==='inspect'?state?.inspected?.includes(subject):action==='stones'?true:state?.quests?.[action==='supply_review'?'supply':action]?.complete;
    if(accepted)remembered.add(key);window.dispatchEvent(new CustomEvent('ludus-quest-recorded'));return state;
   }finally{clearTimeout(timer);}
  })();pending.set(key,work);try{return await work;}finally{pending.delete(key);}
 }
 return {record};
})();
