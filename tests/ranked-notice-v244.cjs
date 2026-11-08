const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const nodes=[];let action=null,authCallback=null;
function node(tag){return {tag,hidden:false,style:{},children:[],setAttribute(){},append(...x){this.children.push(...x)}};}
const client={auth:{getUser:async()=>({data:{user:{id:'recipient',is_anonymous:false}}}),onAuthStateChange(fn){authCallback=fn;}},
 rpc:async(_name,p)=>{action=p.p_action;return{data:{invites:p.p_action==='inbox'?[{id:'invite-1',leader:'Ludus Roma'}]:[]},error:null}}};
const document={hidden:false,body:{append(x){nodes.push(x)}},createElement:node,addEventListener(){}};
const context={document,location:{href:''},supabase:{},LudusClient:{create:()=>client},setInterval:()=>1,clearInterval(){},setTimeout:f=>f(),addEventListener(){}};context.globalThis=context;
vm.runInNewContext(fs.readFileSync('ranked-invites-v244.js','utf8'),context);
setImmediate(()=>{try{
 const box=nodes[0];assert.equal(box.hidden,false);assert.equal(action,'inbox');
 assert.equal(box.children[1].textContent,'Ludus Roma seni takımına davet etti.');box.children[2].onclick();assert.equal(context.location.href,'ranked-team-v244.html?invite=invite-1');
 authCallback('SIGNED_OUT',null);assert.equal(box.hidden,true);console.log('V244 NOTICE PASS: scoped inbox, safe text, explicit navigation and sign-out cleanup.');
 }catch(e){console.error(e);process.exitCode=1}});
