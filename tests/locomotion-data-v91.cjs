const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={};vm.runInNewContext(fs.readFileSync(require.resolve('../arena-locomotion-data-v91.js'),'utf8'),c);
for(const [name,clip] of Object.entries(c.ARENA_LOCOMOTION.clips)){
 assert.equal(clip.frames,49);assert.ok(clip.duration>.48&&clip.duration<1.65);assert.ok(clip.stride>1&&clip.stride<4);assert.ok(clip.legLength>.5&&clip.legLength<1.4);
 for(const [kind,tracks] of Object.entries({directions:clip.directions,rotations:clip.rotations}))for(const samples of Object.values(tracks)){
  assert.equal(samples.length,49);assert.deepEqual(samples[0],samples.at(-1),'seamless '+name+' '+kind);
  for(let i=0;i<samples.length;i++){assert.ok(samples[i].every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...samples[i])-1)<.0001);
   if(i&&kind==='rotations'){const dot=Math.abs(samples[i].reduce((sum,x,j)=>sum+x*samples[i-1][j],0));assert.ok(2*Math.acos(Math.min(1,dot))<.15,'no abrupt torso/hip flips');}
  }
 }
 assert.equal(clip.lift[0],clip.lift.at(-1));assert.ok(clip.lift.every(x=>Number.isFinite(x)&&Math.abs(x)<.15));
}
for(const page of ['arena.html','savas.html','multiplayer.html']){const html=fs.readFileSync(require.resolve('../'+page),'utf8');assert.ok(html.includes('arena-locomotion-data-v91.js'));assert.ok(html.includes('arena-locomotion-v91.js'));assert.ok(!html.includes('arena-locomotion-v81.js'));}
console.log('V91 PASS: captured cycle metadata, unit directions/quaternions, seamless loops, bounded hip motion and shared arena integrations.');
