/* Server-authoritative smith odds. No client-supplied bonus is sent to upgrades. */
(function(root){
 'use strict';
 function create(client){
  let generation=0,key='',state={status:'empty',data:null,error:null};
  const notify=()=>{if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('ludus:smith-preview',{detail:state}));};
  function invalidate(){generation++;key='';state={status:'empty',data:null,error:null};notify();}
  async function update({item,action='enhance',stone=null,owner,busy=false}={}){
   if(!owner||!item?.id){if(key||state.status!=='empty')invalidate();return state;}
   const next=JSON.stringify([owner,item.id,action,stone,item.enhancement,item.certus_used,item.natural_percentages,item.emeralds,item.locked_battle_id,item.stat_version]);
   if(busy){if(state.status!=='working'){generation++;key='';state={status:'working',data:null,error:null};notify();}return state;}
   if(next===key)return state;
   key=next;const current=++generation;state={status:'loading',data:null,error:null};notify();
   try{
    const response=await client.rpc('ludus_smith_preview_v288',{p_item:item.id,p_action:action,p_stone:stone});
    if(current!==generation)return state;
    if(response.error)throw response.error;
    state={status:'ready',data:response.data,error:null};
   }catch(error){if(current!==generation)return state;state={status:'error',data:null,error:error.message||'İşlem hesabı alınamadı.'};key='';}
   notify();return state;
  }
  return Object.freeze({update,invalidate,snapshot:()=>state});
 }
 const api={create};if(typeof module!=='undefined')module.exports=api;else root.LudusSmithV288=api;
})(typeof globalThis!=='undefined'?globalThis:this);
