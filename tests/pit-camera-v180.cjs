const assert=require('node:assert/strict'),camera=require('../pit-camera-v180.js');
const bounds={x:16*Math.SQRT2/2-.45,z:12*Math.SQRT2/2-.45};let checks=0;
for(const x of [-bounds.x,-bounds.x+.3,0,bounds.x-.3,bounds.x])for(const z of [-bounds.z,-bounds.z+.3,0,bounds.z-.3,bounds.z])for(let i=0;i<24;i++){
 const focus={x,y:1.25,z},angle=i*Math.PI/12,position={x:x-Math.sin(angle)*4.75,y:3.8,z:z-Math.cos(angle)*4.75};camera.constrain(position,focus,bounds);
 assert.ok(Math.abs(position.x)<=bounds.x-.219&&Math.abs(position.z)<=bounds.z-.219,'lens stays inside inner walls');
 assert.ok(position.y-focus.y>=2.4,'never in fighter torso');
 for(let j=0;j<=10;j++){const t=j/10;assert.ok(Math.abs(position.x+(x-position.x)*t)<=bounds.x+1e-8&&Math.abs(position.z+(z-position.z)*t)<=bounds.z+1e-8,'view ray never crosses wall');}
 checks++;
}
const centre={x:0,y:3.8,z:-4.75};camera.constrain(centre,{x:0,y:1.25,z:0},bounds);assert.deepEqual(centre,{x:0,y:3.8,z:-4.75});
console.log('V180 camera PASS:',checks,'edge/corner headings, inside-wall view rays and unchanged centre camera.');
