// Shared account fixture; real database reservation and EXP are tested separately.
module.exports=owner=>{
 const names={iron_ore:'Demir madenciliği',copper_ore:'Bakır madenciliği',tin_ore:'Kalay madenciliği',lead_ore:'Kurşun madenciliği',wood:'Odunculuk',flax:'Keten yetiştiriciliği',hide:'Dericilik',wool:'Yüncülük',resin:'Reçine toplayıcılığı'};
 const professions=Object.entries(names).map(([sku,name],i)=>({sku,name,sort_order:i+1}));
 return 'window.__workerRoster='+JSON.stringify({user_id:owner,professions,level_thresholds:[0,60,180,360,600],xp_per_unit:1,caravan_level_cap:5,assignments:[],workers:Array.from({length:8},(_,i)=>({id:'00000000-0000-4000-8000-00000000020'+i,name:'İşçi '+(i+1),slot:i+1,portrait:i,job_id:null,skills:professions.map(p=>({...p,xp:0,level:1,delivered:0}))}))})+';';
};
