// Distinguish the anonymous login screen from the authenticated Ludus trace.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),requests=[];
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'};
(async()=>{
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}const body=fs.readFileSync(file);requests.push({url:url.pathname+url.search,sourceBytes:body.length});res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','content-length':body.length,'content-security-policy':"connect-src 'self'"});res.end(body);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/tmp/chromium',args:['--no-sandbox']});
 try{const page=await browser.newPage({viewport:{width:844,height:390}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/index.html',{waitUntil:'networkidle'});assert.equal(requests.filter(r=>r.url.includes('.glb')).length,0,'anonymous launch does not download any models');assert.deepEqual(errors,[]);const result={environment:'fresh anonymous Chromium context, local HTTP, remote connections blocked',requests,sourceBytes:requests.reduce((n,r)=>n+r.sourceBytes,0),models:[],errors};fs.mkdirSync(root+'/docs/mobile-performance',{recursive:true});fs.writeFileSync(root+'/docs/mobile-performance/login-measurement.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({pass:true,...result}));}
 finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
