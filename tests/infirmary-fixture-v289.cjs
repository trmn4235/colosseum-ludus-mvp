// Synthetic account data, only injected by UI tests. No production grant path.
const medicine=[['beeswax_ointment','Balmumu Merhemi',['beeswax','olive_oil']],['laurel_ointment','Defne Merhemi',['laurel','beeswax','olive_oil']],['honey_vinegar_syrup','Ballı Sirke Şurubu',['honey','wine_vinegar']],['fig_syrup','İncir Şurubu',['fig','honey']],['wood_splint','Tahta Atel',['wood','wool','rope']],['linen_bandage','Keten Sargı Bezi',['linen','rope']],['vinegar_sponge','Sirkeli Sünger',['sponge','wine_vinegar']]];
const fs=require('node:fs'),path=require('node:path');
const migrations=path.join(__dirname,'../supabase/migrations'),seed=fs.readFileSync(path.join(migrations,fs.readdirSync(migrations).find(name=>name.endsWith('_infirmary_v289.sql'))),'utf8');
const injuries=[...seed.matchAll(/\('([^']+)','([^']+)','(light|medium|heavy)','[^']+',(?:null|'[^']*'),(\d+),'(\{[^']+\})'\)/g)].map(match=>({injury_key:match[1],injury_name:match[2],severity:match[3],duration_seconds:Number(match[4]),required:JSON.parse(match[5])}));
if(injuries.length!==15)throw Error('Expected the 15 released infirmary injuries');
const names={beeswax:'Balmumu',olive_oil:'Zeytinyağı',laurel:'Defne',honey:'Bal',wine_vinegar:'Şarap sirkesi',fig:'İncir',wood:'Odun',wool:'Yün',rope:'İp',linen:'Keten',sponge:'Sünger'};
function script({user='testUser.id',client='__testClient'}={}){return `
window.__infNow=Date.parse('2026-11-22T08:00:00Z');window.__infReads=[];window.__infReceipts={};window.__infCommits=0;window.__infDropNext=false;
window.__infFixture={user_id:${user},server_now:new Date(__infNow).toISOString(),
 recipes:${JSON.stringify(medicine.map(([sku,name,inputs])=>({sku,name,output_quantity:1,max_craftable:20,ingredients:inputs.map(sku=>({sku,name:names[sku],quantity:1,owned:20,source:sku==='olive_oil'?'food':'resource'}))})))},
 inventory:${JSON.stringify(medicine.map(([sku,name])=>({sku,name,quantity:20})))},
 injuries:${JSON.stringify(injuries)}.map((injury,i)=>({...injury,id:'injury-'+i,gladiator_id:'fighter-'+i,gladiator_name:['Cassius','Titus','Flavius','Lucanus','Brutus'][i%5]+' '+(i+1),status:'untreated',fatigue_value:45.5,treatment_id:null})),treatments:[],legacy_injuries:[{gladiator_id:'legacy-fighter',gladiator_name:'Eski kayıtlı gladyatör',injury_level:1,injured_until:'2026-11-22T15:00:00Z',status:'legacy'}]};
window.__infDoctorEffects=[
 {content_id:'doctor_001',label:'İki sargılı tedavide bir sargı koruma',value:.004,effect_text:'%0,4 ihtimalle bir Keten Sargı Bezi kasada kalır.'},
 {content_id:'doctor_003',label:'Sirkeli Sünger kullanım bilgisi',value:.002,effect_text:'%0,2 ihtimalle bir Sirkeli Sünger kasada kalır.'},
 {content_id:'doctor_006',label:'Ballı Sirke Şurubuyla ek yorgunluk giderimi',value:.004,effect_text:'Şurubun ek yorgunluk giderimi %0,4 artar.'},
 {content_id:'doctor_007',label:'İncir Şurubuyla taburculuk desteği',value:.004,effect_text:'Taburculukta giderilen yorgunluk %0,4 artar.'}
];
function infSettle(){for(const t of __infFixture.treatments)if(t.status==='active'&&Date.parse(t.ends_at)<=__infNow){t.status='finished';__infFixture.injuries.find(i=>i.id===t.injury_id).status='healed';}}
function infState(){infSettle();__infFixture.server_now=new Date(__infNow).toISOString();return structuredClone(__infFixture);}
function infPreview(id){const injury=__infFixture.injuries.find(i=>i.id===id);if(!injury)throw {code:'P0001',message:'Yaralı bulunamadı.'};const required=Object.entries(injury.required).map(([sku,quantity])=>({sku,name:__infFixture.inventory.find(i=>i.sku===sku).name,required:quantity,owned:__infFixture.inventory.find(i=>i.sku===sku).quantity}));return {injury_id:id,can_start:injury.status==='untreated'&&required.every(m=>m.owned>=m.required),reason:required.some(m=>m.owned<m.required)?'Gereken malzemeler eksik.':'',required,doctor_effects:structuredClone(__infDoctorEffects),duration_seconds:injury.duration_seconds,recovery:{base_per_hour:10,doctor_rate:.004,per_hour:10.04,honey_total:required.some(m=>m.sku==='honey_vinegar_syrup')?5.02:0,fig_discharge:required.some(m=>m.sku==='fig_syrup')?5.02:0}};}
const infOldRPC=${client}.rpc;${client}.rpc=async(name,args={})=>{
 if(name!=='ludus_infirmary_v289')return infOldRPC(name,args);
 __infReads.push(structuredClone(args));try{
  if(args.p_action==='state')return {data:infState()};
  if(args.p_action==='preview')return {data:{...infState(),preview:infPreview(args.p_args.injury_id)}};
  if(__infReceipts[args.p_request]){const result=structuredClone(__infReceipts[args.p_request]);result.outcome.replayed=true;return {data:result};}
  if(!args.p_request)throw {code:'P0001',message:'İşlem kimliği gerekli.'};
  let outcome={action:args.p_action,request_id:args.p_request,replayed:false};
  if(args.p_action==='start'){
   const p=infPreview(args.p_args.injury_id);if(!p.can_start)throw {code:'P0001',message:p.reason||'Bu gladyatör zaten tedavide.'};
   const injury=__infFixture.injuries.find(i=>i.id===p.injury_id),consumed={},saved=p.required.some(m=>m.sku==='linen_bandage'&&m.required>=2)?{linen_bandage:1}:{};
   for(const m of p.required){const amount=m.required-(saved[m.sku]||0);consumed[m.sku]=amount;__infFixture.inventory.find(i=>i.sku===m.sku).quantity-=amount;}
   const t={id:'treatment-'+injury.id,injury_id:injury.id,gladiator_id:injury.gladiator_id,started_at:new Date(__infNow).toISOString(),ends_at:new Date(__infNow+injury.duration_seconds*1000).toISOString(),status:'active',consumed,saved,doctor_effects:p.doctor_effects,bonuses:{recovery_rate:.004,recovery_per_hour:10.04,honey_extra:p.recovery.honey_total,fig_discharge:p.recovery.fig_discharge}};
   __infFixture.treatments.push(t);injury.status='treating';injury.treatment_id=t.id;outcome.treatment_id=t.id;
  }else if(args.p_action==='finish'){
   const t=__infFixture.treatments.find(t=>t.id===args.p_args.treatment_id);if(!t)throw {code:'P0001',message:'Tedavi bulunamadı.'};if(Date.parse(t.ends_at)>__infNow)throw {code:'P0001',message:'Tedavi süresi henüz dolmadı.'};t.status='finished';__infFixture.injuries.find(i=>i.id===t.injury_id).status='healed';outcome.treatment_id=t.id;
  }else if(args.p_action==='craft'){
   const recipe=__infFixture.recipes.find(r=>r.sku===args.p_args.sku),count=args.p_args.quantity;if(!recipe||count>recipe.max_craftable)throw {code:'P0001',message:'Üretim malzemesi eksik.'};
   __infFixture.inventory.find(i=>i.sku===recipe.sku).quantity+=count;
   for(const ingredient of recipe.ingredients)for(const r of __infFixture.recipes){const same=r.ingredients.find(i=>i.sku===ingredient.sku);if(same)same.owned-=count;}
   for(const r of __infFixture.recipes)r.max_craftable=Math.min(...r.ingredients.map(i=>Math.floor(i.owned/i.quantity)));
   outcome={...outcome,sku:recipe.sku,quantity:count};
  }else throw Error('Unexpected infirmary action '+args.p_action);
  __infCommits++;const result={...infState(),outcome};__infReceipts[args.p_request]=structuredClone(result);
  if(__infDropNext){__infDropNext=false;throw Error('Yanıt kayboldu. Yeniden dene.');}return {data:result};
 }catch(error){if(error.code)return {error};throw error;}
};
`;}
module.exports={script,medicine,injuries};
