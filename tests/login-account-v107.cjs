// Exercise the actual welcome page and pinned Supabase SDK with controlled HTTP responses.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),project='lryeeidutnlpgdesjxje';
const user={id:'00000000-0000-4000-8000-000000000107',aud:'authenticated',role:'authenticated',email:'fixture@example.test',is_anonymous:false,user_metadata:{},app_metadata:{provider:'email'}};
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
function session(expired=false){const now=Math.floor(Date.now()/1000),exp=now+(expired?-60:3600);return{access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:user.id,role:'authenticated',aud:'authenticated',iat:now-120,exp})+'.fixture',refresh_token:'fixture-refresh-token',token_type:'bearer',expires_in:3600,expires_at:exp,user};}
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://local'),file=path.resolve(root,'.'+url.pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 let body=fs.readFileSync(file);
 if(process.env.LOGIN_TEST_BASELINE&&url.pathname==='/index.html')body=execFileSync('git',['show','HEAD:index.html'],{cwd:root});
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(body);
});
const future={status:401,body:{code:'PGRST303',message:'JWT issued at future',details:null,hint:null}};
const permission={status:403,body:{code:'42501',message:'permission denied'}};
const ok={status:200,body:{ludus_name:'Legio Test'}};
async function setup(browser,base,{responses=[ok],stored=true,expired=false,recovery=false}={}){
 const context=await browser.newContext({viewport:{width:852,height:393},hasTouch:true,isMobile:true}),page=await context.newPage();
 const state={reads:0,refreshes:0,errors:[],responses:[...responses],headers:[],hold:null};
 page.on('pageerror',e=>state.errors.push(e.message));
 await context.addInitScript(({value,key})=>{if(value)localStorage.setItem(key,JSON.stringify(value));},{value:stored?session(expired):null,key:'sb-'+project+'-auth-token'});
 await page.route('https://'+project+'.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  const reply=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname==='/auth/v1/user')return reply(200,user);
  if(url.pathname==='/auth/v1/token'){state.refreshes++;return reply(200,session());}
  if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204});
  if(url.pathname==='/functions/v1/account-login')return reply(200,session());
  if(url.pathname.startsWith('/rest/v1/rpc/'))return reply(200,{friends:[]});
  if(url.pathname==='/rest/v1/ludus_accounts'){
   assert.equal(req.method(),'GET');assert.equal(url.searchParams.get('user_id'),'eq.'+user.id);
   state.reads++;state.headers.push(req.headers().authorization);
   const response=state.responses.length>1?state.responses.shift():state.responses[0];
   if(response==='network')return route.abort('failed');
   if(response==='hold'){await new Promise(resolve=>{state.hold=resolve;});try{return await reply(200,ok.body);}catch{return;}}
   return reply(response.status,response.body);
  }
  return reply(400,{error:'Unexpected fixture endpoint'});
 });
 let suffix='';if(recovery){const s=session();suffix='?mode=recovery#'+new URLSearchParams({access_token:s.access_token,refresh_token:s.refresh_token,expires_in:'3600',token_type:'bearer',type:'recovery'});}
 await page.goto(base+'/index.html'+suffix,{waitUntil:'domcontentloaded'});
 return{context,page,state};
}
async function ready(page){await page.waitForFunction(()=>document.body.dataset.introState==='ready');}
async function welcome(page){await page.waitForFunction(()=>document.getElementById('welcomeName').textContent==='Legio Test'&&!document.getElementById('enter').disabled,{},{timeout:12000});assert.equal(await page.locator('#accountMessage').textContent(),'');}
async function clean(fixture){assert.deepEqual(fixture.state.errors,[]);await fixture.context.close();}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 const passed=[];
 try{
  let f=await setup(browser,base,{responses:[future,ok]});
  if(process.env.LOGIN_TEST_BASELINE){await ready(f.page);assert.equal(f.state.reads,1);assert.equal(await f.page.locator('#enter').isDisabled(),true);assert.match(await f.page.locator('#accountMessage').textContent(),/Ludus adı yüklenemedi/);await clean(f);console.log('Baseline reproduces the reported error after one PGRST303 response.');return;}
  await welcome(f.page);assert.equal(f.state.reads,2);assert.equal(f.state.refreshes,0);assert.equal(new Set(f.state.headers).size,1);
  await ready(f.page);
  for(const [width,height]of [[667,375],[852,393],[932,430]]){
   await f.page.setViewportSize({width,height});
   const layout=await f.page.locator('#entryPanel').evaluate(el=>{const r=el.getBoundingClientRect();return{bottom:r.bottom,right:r.right,scroll:el.scrollHeight>el.clientHeight+1,viewport:innerHeight};});
   assert.ok(layout.bottom<=height&&layout.right<=width);assert.equal(layout.scroll,false);
  }
  f.state.responses=[future,ok];const before=f.state.reads;await f.page.reload();await welcome(f.page);assert.equal(f.state.reads,before+2);
  if(process.env.LOGIN_QA_OUTPUT){fs.mkdirSync(process.env.LOGIN_QA_OUTPUT,{recursive:true});await ready(f.page);await f.page.screenshot({path:path.join(process.env.LOGIN_QA_OUTPUT,'welcome-recovered.png')});}
  await clean(f);passed.push('fresh JWT rejection recovers on opening and reload; same token; three mobile sizes');

  f=await setup(browser,base,{expired:true,responses:[future,future,ok]});await welcome(f.page);assert.equal(f.state.reads,3);assert.equal(f.state.refreshes,1);await clean(f);passed.push('expired stored session refreshes once, then transient rejection recovers');

  f=await setup(browser,base,{responses:[{status:503,body:{message:'Unavailable'}},'network',ok]});await welcome(f.page);assert.equal(f.state.reads,3);await clean(f);passed.push('temporary server and network failures recover');

  f=await setup(browser,base,{responses:[future]});await f.page.waitForSelector('#retryAccount',{state:'visible',timeout:12000});assert.equal(f.state.reads,4);assert.equal(await f.page.locator('#enter').isDisabled(),true);
  if(process.env.LOGIN_QA_OUTPUT)await f.page.screenshot({path:path.join(process.env.LOGIN_QA_OUTPUT,'retry-panel.png')});
  f.state.responses=[ok];await f.page.locator('#retryAccount').click();await welcome(f.page);assert.equal(f.state.reads,5);assert.equal(await f.page.locator('#retryAccount').isHidden(),true);await clean(f);passed.push('retry budget is bounded; manual retry succeeds without reloading');

  f=await setup(browser,base,{responses:[permission]});await f.page.waitForSelector('#retryAccount',{state:'visible'});assert.equal(f.state.reads,1);assert.equal(await f.page.locator('#enter').isDisabled(),true);
  f.state.responses=[ok];await f.page.evaluate(()=>{for(let i=0;i<5;i++)window.dispatchEvent(new Event('online'));});await welcome(f.page);assert.equal(f.state.reads,2);await clean(f);passed.push('permission failure stays blocked; reconnect triggers one lookup');

  f=await setup(browser,base,{responses:['hold']});await ready(f.page);await f.page.locator('#logout').click();await f.page.waitForSelector('#login',{state:'visible'});f.state.hold();await f.page.waitForTimeout(250);assert.equal(await f.page.locator('#welcome').isHidden(),true);assert.equal(await f.page.locator('#enter').isDisabled(),true);assert.equal(f.state.reads,1);await clean(f);passed.push('late account response cannot restore a signed-out account');

  f=await setup(browser,base,{responses:['hold',ok]});await welcome(f.page);assert.equal(f.state.reads,2);f.state.hold();await clean(f);passed.push('a stalled lookup times out and recovers without freezing the panel');

  f=await setup(browser,base,{stored:false,responses:[future,ok]});await ready(f.page);assert.equal(f.state.reads,0);await f.page.locator('#username').fill('fixture');await f.page.locator('#password').fill('fixture-password');await f.page.locator('#submitLogin').click();await welcome(f.page);assert.equal(f.state.reads,2);await clean(f);passed.push('password sign-in uses the same recovery path');

  f=await setup(browser,base,{stored:false,recovery:true});await ready(f.page);assert.equal(await f.page.locator('#resetForm').isVisible(),true);assert.equal(f.state.reads,0);await clean(f);passed.push('password recovery remains isolated from the welcome lookup');
  console.log(JSON.stringify({pass:true,passed},null,2));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
