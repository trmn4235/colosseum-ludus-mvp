// Pack prepared GLBs into the game's resource format. Do not commit raw CGTrader FBXs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const source=process.argv[2],helmet=process.argv[3],out=process.argv[4]||'assets/equipment-v167';
if(!source||!helmet)throw Error('Usage: node scripts/pack-equipment-v167.mjs PREPARED_DIR HELMET_GLB [OUT]');
fs.mkdirSync(out,{recursive:true});
const key=Buffer.from([208,72,199,66,217,77,28,174,206,97,233,116,84,211,101,150,96,56,75,205,232,216,123,120,80,21,163,4,179,62,121,210]),header=Buffer.from([67,77,69,49,54,55,0,1]);
for(const [id,file]of [['warhammer',path.join(source,'warhammer.glb')],['heavy_mace',path.join(source,'heavy_mace.glb')],['sylvain_helmet',helmet]]){
 const data=fs.readFileSync(file),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(header);const encrypted=Buffer.concat([cipher.update(data),cipher.final(),cipher.getAuthTag()]);fs.writeFileSync(path.join(out,id+'.cme'),Buffer.concat([header,iv,encrypted]));console.log(id,data.length);
}
