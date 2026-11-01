const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../ludus-room-actions-v62.js'),'utf8');
function place(width,height,size,x,y){
 const c={innerWidth:width,innerHeight:height};vm.createContext(c);vm.runInContext(source,c);
 const button={offsetWidth:size[0],offsetHeight:size[1],style:{}},point={x:0,z:0,clone:()=>({project:()=>({x,y,z:0})})};
 const ctx={blocked:()=>false,player:{x:0,z:0},camera:{},canvas:{getBoundingClientRect:()=>({left:0,top:0,width,height})}};
 c.LudusRoomActions.place(button,point,ctx,true);return button;
}
test('wide groom actions and square icons stay entirely inside every viewport edge',()=>{
 for(const [width,height]of [[1536,706],[874,402],[667,375],[568,320]])for(const size of [[86,44],[132,44],[44,44]])for(const x of [-1,0,1])for(const y of [-1,0,1]){
  const b=place(width,height,size,x,y),left=parseFloat(b.style.left)-size[0]/2,top=parseFloat(b.style.top)-size[1]/2;
  assert.equal(b.hidden,false);assert.ok(left>=2&&left+size[0]<=width-2);assert.ok(top>=2&&top+size[1]<=height-2);
  if(x===0&&y===0){assert.equal(parseFloat(b.style.left),width/2);assert.equal(parseFloat(b.style.top),height/2);}
 }
});
test('off-screen world actions remain hidden',()=>{assert.equal(place(667,375,[86,44],1.1,0).hidden,true);});
