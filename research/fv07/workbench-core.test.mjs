import test from 'node:test';
import assert from 'node:assert/strict';
import {linearize,encode} from './chroma.mjs';
import {calibrationReport,candidateRegions,sampleRegion,repeatability} from './workbench-core.mjs';
const colors=[[.2,.3,.4],[.65,.25,.3],[.3,.65,.25],[.25,.3,.7],[.7,.7,.7],[.45,.32,.24],[.66,.51,.42],[.35,.48,.6]];
const manifest=(transform=x=>x)=>colors.map((expected,i)=>({id:'p'+i,role:i<5?'fit':'holdout',expected,observed:transform(expected)}));
const pose={yaw:0,pitch:0,roll:0};
function face(){const p=Array.from({length:478},()=>({x:.5,y:.5}));for(const [i,x,y] of [[33,.35,.40],[263,.65,.40],[1,.5,.52],[10,.5,.22],[152,.5,.75]])p[i]={x,y};return p;}
function frame(rgb=[150,100,80,255]){const data=new Uint8ClampedArray(200*200*4);for(let i=0;i<data.length;i+=4)data.set(rgb,i);return {width:200,height:200,data};}
test('affine correction evaluated on distinct held-out colored references',()=>{
 const mix=x=>{const [r,g,b]=x.map(linearize);return [.84*r+.16*g,.9*g+.1*b,.12*r+.88*b].map(encode);};
 const report=calibrationReport(manifest(mix));assert.equal(report.affine.n,3);assert.ok(report.raw.meanDeltaE76>1);assert.ok(report.affine.meanDeltaE76<1e-6);assert.equal(report.skinMeasurementEligible,false);
});
test('disjoint, nondegenerate references and missing values enforced',()=>{
 const p=manifest();p[7].id=p[0].id;assert.equal(calibrationReport(p).status,'abstain');
 const q=manifest(()=>[.5,.5,.5]);assert.equal(calibrationReport(q).affineAvailable,false);
 const r=manifest();r[7].observed=[1,.5,.5];assert.equal(calibrationReport(r).affine.n,2);
});
test('candidate regions respect pose, missing landmarks, scale, and pixel aspect ratio',()=>{
 const regions=candidateRegions(face(),200,200,pose);assert.equal(regions.length,3);
 assert.equal(candidateRegions(face(),200,200,{...pose,yaw:25}),null);
 assert.equal(candidateRegions(face().slice(0,468),200,200,pose),null);
 assert.equal(candidateRegions(face(),50,50,pose),null);
 const tall=candidateRegions(face(),200,400,pose);assert.equal(tall.length,3);assert.ok(tall[0].cy>regions[0].cy);
});
test('regions are candidates, clipping and insufficient coverage abstain',()=>{
 const [r]=candidateRegions(face(),200,200,pose);const a=sampleRegion(frame(),r);
 assert.equal(a.status,'research_only');assert.ok(a.total>=30);assert.equal(a.excluded,0);
 assert.equal(sampleRegion(frame([255,100,80,255]),r).status,'abstain');
 assert.equal(sampleRegion(frame([150,100,80,0]),r).status,'abstain');
 assert.equal(sampleRegion(frame(),{...r,cx:0}).status,'abstain');
});
test('translation equivariance on synthetic landmarks',()=>{
 const a=candidateRegions(face(),200,200,pose),b=candidateRegions(face().map(p=>({x:p.x+.04,y:p.y+.03})),200,200,pose);
 for(let i=0;i<a.length;i++){assert.ok(Math.abs(b[i].cx-a[i].cx-8)<1e-8);assert.ok(Math.abs(b[i].cy-a[i].cy-6)<1e-8);}
});
test('repeatability is descriptive, grouped by condition, and requires distinct reviewed captures',()=>{
 const records=[1,2,3].map((a,i)=>({captureId:'c'+i,region:'forehead',condition:'A',reviewed:true,a}));
 const report=repeatability([...records,{...records[0],captureId:'c3',condition:'B'}]);assert.equal(report.rows[0].sd,1);assert.equal(report.rows[0].range,2);assert.equal(report.rows[1].status,'insufficient_repeats');assert.equal(report.uncertainty,'not_quantified');
 assert.equal(repeatability([records[0],records[0]]).status,'abstain');assert.equal(repeatability([{...records[0],reviewed:false}]).status,'abstain');
});
