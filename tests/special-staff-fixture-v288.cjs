// Test-only server contract. Production catalogue text is read from its migration.
const fs=require('node:fs'),path=require('node:path');
const migration=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261121224449_papyrus_catalog_v288.sql'),'utf8');
const catalog=JSON.parse(migration.match(/\$catalog\$([\s\S]*?)\$catalog\$/)[1]);
function script({user='testUser.id',client='__testClient'}={}){
 return `
window.__papyrusCatalog=${JSON.stringify(catalog)};
window.__papyrusReads=[];window.__papyrusReceipts={};window.__papyrusFailOnce=false;
window.__papyrusSetMode=function(mode='mixed'){
 window.__papyrusRows=__papyrusCatalog.map(p=>({...structuredClone(p),id:p.content_id,role:p.role_id,
  learned:mode==='all'||mode==='mixed'&&[1,2,5].includes(p.ordinal),
  read_at:mode==='all'||mode==='mixed'&&[1,2,5].includes(p.ordinal)?'2026-11-21T00:00:00Z':null,
  owned_quantity:mode==='mixed'?({2:3,3:2,6:1}[p.ordinal]||0):0,
  runtime_status:mode==='mixed'&&[5,6].includes(p.ordinal)?'pending_feature':'active',
  runtime_note:mode==='mixed'&&[5,6].includes(p.ordinal)?null:'Bu örneğin belirtilen oyun koşulunda etkindir.',
  runtime_reason:mode==='mixed'&&[5,6].includes(p.ordinal)?'İlgili oyun akışı hazırlanıyor.':null,
  finder:p.rarity==='unique'?'Örnek Ludus':null}));
 __papyrusReceipts={};__papyrusReads=[];
};
__papyrusSetMode();
window.papyrusFixture=function(role){
 const staff=LudusSpecialPeople.roles.map(def=>{const rows=__papyrusRows.filter(p=>p.role===def.id),collected=rows.filter(p=>p.learned||p.owned_quantity>0).length;
  return {id:def.id,name:def.name,title:def.title,total:25,collected,read:rows.filter(p=>p.learned).length,
   unread_quantity:rows.reduce((n,p)=>n+p.owned_quantity,0),readable:rows.filter(p=>!p.learned&&p.owned_quantity>0).length,
   overall:collected*4,legacy_read:typeof __staffRows==='undefined'?1:(__staffRows.find(s=>s.id===def.id)?.read||0),
   bonuses:rows.filter(p=>p.learned&&p.runtime_status==='active').map(p=>({content_id:p.content_id,role:p.role,effect:p.effect,conditions:p.conditions}))};});
 return {user_id:${user},role,staff,papyri:structuredClone(__papyrusRows.filter(p=>p.role===role)),paper_count:25,catalog_version:288};
};
const papyrusOldRPC=${client}.rpc;
${client}.rpc=async(name,args={})=>{
 if(name==='ludus_papyrus_state_v288')return {data:papyrusFixture(args.p_role||'trainer'),error:null};
 if(name==='ludus_papyrus_read_v288'){
  __papyrusReads.push(structuredClone(args));
  const paper=__papyrusRows.find(p=>p.content_id===args.p_content_id);
  if(!paper)return {error:{code:'P0001',message:'Papirüs bulunamadı.'}};
  const replayed=!!__papyrusReceipts[args.p_request];
  if(replayed&&__papyrusReceipts[args.p_request]!==args.p_content_id)return {error:{code:'P0001',message:'Bu okuma anahtarı başka bir bilgiye ait.'}};
  if(!replayed){
   if(paper.learned)return {error:{code:'P0001',message:'Bu bilgi zaten öğrenildi.'}};
   if(paper.owned_quantity<1)return {error:{code:'P0001',message:'Bu papirüs kasanda yok.'}};
   paper.owned_quantity--;paper.learned=true;paper.read_at=new Date().toISOString();__papyrusReceipts[args.p_request]=args.p_content_id;
  }
  if(__papyrusFailOnce){__papyrusFailOnce=false;throw Error('Bağlantı kesildi. Yeniden dene.');}
  return {data:{...papyrusFixture(paper.role),reading:{content_id:paper.content_id,replayed}},error:null};
 }
 return papyrusOldRPC(name,args);
};`;
}
module.exports={catalog,script};
