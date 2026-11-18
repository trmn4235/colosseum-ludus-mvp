// Explicit UI test data. Never included by any production page.
module.exports=()=>String.raw`
window.__staffReads=[];window.__staffReceipts={};window.__staffFailOnce=true;
window.__staffRows=LudusSpecialPeople.roles.map(r=>({id:r.id,name:r.name,title:r.title,total:500,collected:r.id==='guard'?26:0,read:0,overall:0,readable:r.id==='guard'?26:0,bonuses:[]}));
window.__staffPapers=Array.from({length:26},(_,i)=>({role:'guard',lesson:i+1,title:'Örnek savunma papirüsü',rarity:'rare',read_at:null,effects:[{key:'fixture_defense',label:'Kervan savunması saldırı bonusu',target:'fixture_only',percent:.03}]}));
function staffFixture(role,page=0){const papers=role==='guard'?__staffPapers.slice().sort((a,b)=>Number(!!a.read_at)-Number(!!b.read_at)||a.lesson-b.lesson):[];page=Math.min(page,Math.max(0,Math.ceil(papers.length/6)-1));return {user_id:testUser.id,staff:structuredClone(__staffRows),role,page,paper_count:papers.length,papyri:structuredClone(papers.slice(page*6,page*6+6))};}
const staffOldRPC=__testClient.rpc;__testClient.rpc=async(name,args={})=>{
 if(name==='ludus_special_staff')return {data:staffFixture(args.p_role,args.p_page),error:null};
 if(name==='ludus_special_staff_archive'){const papers=args.p_role==='guard'&&!args.p_unique?__staffPapers.filter(p=>p.read_at):[],page=Math.min(args.p_page,Math.max(0,Math.ceil(papers.length/6)-1));return {data:{user_id:testUser.id,role:args.p_role,page,unique:args.p_unique,paper_count:papers.length,papyri:structuredClone(papers.slice(page*6,page*6+6))},error:null};}
 if(name==='ludus_personal_vault'){const papers=__staffPapers.filter(p=>!p.read_at&&(!args.p_role||p.role===args.p_role)),page=Math.min(args.p_page,Math.max(0,Math.ceil(papers.length/8)-1));return {data:{user_id:testUser.id,gold:12345,category:args.p_category,page,role:args.p_role,total:papers.length,counts:{papyrus:papers.length},rows:structuredClone(papers.slice(page*8,page*8+8)).map(p=>({...p,type:'papyrus',key:'papyrus:guard:'+p.lesson,name:p.title,quantity:1,role_name:'Marcus',bonuses:__staffRows.find(s=>s.id==='guard').bonuses}))},error:null};}
 if(name==='ludus_special_staff_read'){
  __staffReads.push(structuredClone(args));if(!__staffReceipts[args.p_request]){const p=__staffPapers.find(p=>p.lesson===args.p_lesson);if(p.read_at)return {error:{code:'P0001',message:'Bu papirüs zaten okundu.'}};p.read_at=new Date().toISOString();const s=__staffRows.find(s=>s.id===args.p_role);s.read++;s.readable--;s.overall=s.read*.2;s.bonuses=[{key:'fixture_defense',label:'Kervan savunması saldırı bonusu',percent:s.read*.03}];__staffReceipts[args.p_request]=true;}
  if(__staffFailOnce){__staffFailOnce=false;throw Error('Bağlantı kesildi. Yeniden dene.');}return {data:staffFixture(args.p_role),error:null};
 }
 return staffOldRPC(name,args);
};
__food.crew_count=24;__food.people={gladiators:10,workers:8,specialists:6,total:24};
`;
