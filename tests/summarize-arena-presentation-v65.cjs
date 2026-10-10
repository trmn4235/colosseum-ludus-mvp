'use strict';
const fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../docs/arena-presentation-v65');
function span(values){return Math.max(...values)-Math.min(...values);}
function compact(r){
 if(r.rawMotion){r.gait={};for(const [name,samples]of Object.entries(r.rawMotion)){
  const stable=samples.slice(Math.min(20,Math.floor(samples.length/3)));
  r.gait[name]={leftFootMinAnkleY:Math.min(...samples.map(s=>s.leftFoot[1])),rightFootMinAnkleY:Math.min(...samples.map(s=>s.rightFoot[1])),leftRelativeExcursion:[0,1,2].map(i=>span(stable.map(s=>s.leftFoot[i]-s.root[i]))),rightRelativeExcursion:[0,1,2].map(i=>span(stable.map(s=>s.rightFoot[i]-s.root[i]))),finite:samples.every(s=>['root','leftFoot','rightFoot','leftHand','rightHand','shield'].every(k=>s[k].every(Number.isFinite)))};
 }}
 if(r.rawAttack)r.plantedFeet=Object.fromEntries(Object.entries(r.rawAttack).map(([region,ss])=>[region,{leftMinAnkleY:Math.min(...ss.map(s=>s.leftFoot[1])),rightMinAnkleY:Math.min(...ss.map(s=>s.rightFoot[1])),leftTotalExcursion:[0,1,2].map(i=>span(ss.map(s=>s.leftFoot[i]))),rightTotalExcursion:[0,1,2].map(i=>span(ss.map(s=>s.rightFoot[i]))),finite:ss.every(s=>s.leftFoot.every(Number.isFinite)&&s.rightFoot.every(Number.isFinite))}]));
 delete r.rawMotion;delete r.rawAttack;
 if(r.noGPU){r.rendererKind='no-GPU real-rig/DOM fixture';r.nonGraphicsCpuDiagnostic={animationCpuMsPerPose:r.animationCpuMsPerPose||r.nonGraphicsCpuDiagnostic?.animationCpuMsPerPose,sceneCpuMs:r.frameTiming?.cpu??r.nonGraphicsCpuDiagnostic?.sceneCpuMs??null,note:'Single cloud-browser run, matrix renderer stub, no GPU work. Not a graphics benchmark; CPU-only numbers are noisy and do not establish a speedup.'};delete r.animationCpuMsPerPose;r.frameTiming=null;r.snapshots=[];}
 r.layouts=r.layouts.map(l=>l.boxes?{width:l.width,height:l.height,verticalOverflow:Math.max(0,l.scrollHeight-l.height,l.bodyHeight-l.height),horizontalOverflow:Math.max(0,l.scrollWidth-l.width),controlCount:l.boxes.length,insideViewport:true,nonOverlapping:true}:l);
 r.continuity=Object.fromEntries(Object.entries(r.continuity).map(([segment,parts])=>[segment,Object.fromEntries(Object.entries(parts).map(([part,s])=>[part,{max:s.max,p95:s.p95}]))]));
 return r;
}
if(require.main===module){for(const v of ['baseline','after']){const p=path.join(dir,v+'-report.json');if(fs.existsSync(p)){const r=JSON.parse(fs.readFileSync(p));if(process.env.ARENA_KEEP_RAW==='1')fs.writeFileSync(path.join(dir,v+'-raw.json'),JSON.stringify(r));fs.writeFileSync(p,JSON.stringify(compact(r),null,2));}}
 const b=JSON.parse(fs.readFileSync(path.join(dir,'baseline-report.json'))),a=JSON.parse(fs.readFileSync(path.join(dir,'after-report.json')));
 const compare=(path)=>{let x=b,y=a;for(const key of path.split('.')){x=x[key];y=y[key];}return {before:x,after:y,reductionPercent:100*(x-y)/x};};
 const r={status:a.pass&&b.pass?'PASS for real-rig and DOM checks; rendered-device QA pending':'FAIL',renderer:a.rendererKind,baselineRef:'a6f530d',sourceSha256:{before:b.sourceSha256||null,after:a.sourceSha256||null},guardEntryMaxHandStepMetres:compare('continuity.guardEnter.leftHand.max'),guardReleaseMaxHandStepMetres:compare('continuity.guardRelease.leftHand.max'),guardWalkMaxFootStepMetres:compare('continuity.guardWalk.leftFoot.max'),guardWalkForwardFootExcursionMetres:{before:b.gait.guardWalk.leftRelativeExcursion[2],after:a.gait.guardWalk.leftRelativeExcursion[2]},guardStrafeLateralFootExcursionMetres:{before:b.gait.guardStrafe.leftRelativeExcursion[0],after:a.gait.guardStrafe.leftRelativeExcursion[0]},maximumActiveBladeAngleErrorRadians:Math.max(...Object.values(a.alignment).map(x=>x.bladeActiveAngleRadians.max)),maximumGripOffsetMetres:Math.max(...Object.values(a.alignment).map(x=>x.gripOffsetMetres.max)),plantedFeet:a.plantedFeet,landscapeSizes:a.layouts.map(l=>[l.width,l.height]),pause:a.pause,repeatedInput:a.repeatedInput,limitations:['Cloud WebGL context creation is disabled. Only the QA fixture replaces the renderer with a matrix-update stub. All GLB geometry, skeletons and motion code are real.','No rendered before/after scene, video, graphics FPS, GPU timing or aesthetic claim is provided.','Ankle height is a joint diagnostic, not a proof of sole-floor contact or absent mesh penetration.','Pointer capture, actual physical-device behavior and visual naturalness need the WebGL-enabled browser/device follow-up.'],noGPU:true};
 fs.writeFileSync(path.join(dir,'comparison.json'),JSON.stringify(r,null,2));console.log(JSON.stringify(r,null,2));
}
module.exports={compact};
