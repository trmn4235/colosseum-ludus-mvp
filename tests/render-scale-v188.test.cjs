const test=require('node:test'),assert=require('node:assert/strict');
const {AdaptiveQuality,RenderScale,pixelRatio}=require('../arena-runtime-v96.js');
function frames(quality,fps,seconds,current=1.25,start=0){
 const changes=[];
 for(let n=0;n<=fps*seconds;n++){
  const now=start+n*1000/fps,next=quality.sample(now,current);
  if(next!==null){current=next;changes.push({now,current});}
 }
 return{current,changes};
}
for(const fps of [2,3,10,15])test('sustained '+fps+' FPS reaches the safe floor instead of being discarded',()=>{
 const r=frames(new AdaptiveQuality(1.25,.75),fps,15);
 assert.equal(r.current,.75);assert.ok(r.changes[0].now<=5000,JSON.stringify(r));
 assert.ok(r.changes.every(c=>c.current>=.75));
});
test('uneven sustained frames adapt while isolated stalls do not',()=>{
 const uneven=new AdaptiveQuality(1.25,.75),spikes=new AdaptiveQuality(1.25,.75);let a=1.25,b=1.25,t=0,u=0;
 for(let n=0;n<1000;n++){
  t+=n%2?33:16;u+=n%120===0?300:1000/60;
  a=uneven.sample(t,a)??a;b=spikes.sample(u,b)??b;
 }
 assert.equal(a,.75);assert.equal(b,1.25);
});
function renderer(){return{ratio:1,width:300,height:150,style:{width:'100%',height:'100%'},resizes:0,
 getPixelRatio(){return this.ratio;},setPixelRatio(r){this.ratio=r;this.setSize(this.width,this.height,false);},
 setSize(w,h,style){this.width=w;this.height=h;this.buffer=[Math.floor(w*this.ratio),Math.floor(h*this.ratio)];this.resizes++;if(style!==false)this.style={width:w+'px',height:h+'px'};}
};}
test('resizes enforce the pixel budget and leave CSS layout unchanged',()=>{
 const r=renderer(),scale=new RenderScale(r,{touch:true});scale.resize(932,430,3);assert.equal(r.ratio,1.25);
 scale.resize(3840,2160,3);assert.ok(r.buffer[0]*r.buffer[1]<=900000);
 assert.ok(Math.abs(r.ratio-pixelRatio(3,true,3840,2160))<1e-10);
 assert.deepEqual(r.style,{width:'100%',height:'100%'});assert.equal(scale.width,3840);assert.equal(scale.height,2160);assert.equal(scale.sourceRatio,3);
});
test('paused overlays discard their cadence; stable play restores detail gradually',()=>{
 const r=renderer(),scale=new RenderScale(r,{touch:true});scale.resize(932,430,3);
 for(let n=0;n<=150;n++)scale.sample(n*100,false);assert.equal(r.ratio,1.25);
 for(let n=1;n<=450;n++)scale.sample(15000+n*1000/30);assert.equal(r.ratio,.75);
 const floor=r.ratio;for(let n=1;n<=60;n++)scale.sample(30000+n*1000/60);assert.equal(r.ratio,floor);
 for(let n=61;n<=3000;n++)scale.sample(30000+n*1000/60);assert.equal(r.ratio,1.25);
 assert.deepEqual(r.style,{width:'100%',height:'100%'});
});
test('fractional drawing buffers do not become viewport resize signals',()=>{
 const r=renderer(),scale=new RenderScale(r,{touch:true});scale.resize(931,429,2);const before=r.resizes;
 for(let i=0;i<120;i++)if(931!==scale.width||429!==scale.height||2!==scale.sourceRatio)scale.resize(931,429,2);
 assert.equal(r.resizes,before);assert.notEqual(r.buffer[0],Math.round(931*r.ratio));
});
