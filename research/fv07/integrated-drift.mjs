// Experiment 006: synthetic acquisition-to-measurement drift, not skin or camera validation.
import {linearize,encode} from './chroma.mjs';
import {calibrationReport,candidateRegions,sampleRegion,repeatability} from './workbench-core.mjs';

const referenceColors=[[.25,.25,.25],[.5,.5,.5],[.75,.75,.75],[.2,.3,.4],[.65,.25,.3],[.3,.65,.25],[.25,.3,.7],[.45,.32,.24],[.66,.51,.42],[.35,.48,.6],[.28,.19,.16],[.72,.52,.43]];
const regionColors=[[.58,.39,.31],[.55,.36,.30],[.62,.43,.36]];
const conditions=[
 {id:'identity',transform:x=>x},
 {id:'channel-gain',transform:([r,g,b])=>[1.15*r,.85*g,.95*b]},
 {id:'nonlinear-tone',transform:([r,g,b])=>[r**.78,g**.90,b**.98]},
];
function quantize(rgb,transform,offset=0){
 return transform(rgb.map(linearize)).map(v=>Math.max(0,Math.min(255,Math.round((v<=0?0:v>=1?1:encode(v))*255+offset)))/255);
}
function fixtureGeometry(){
 const points=Array.from({length:478},()=>({x:.5,y:.5}));
 for(const [i,x,y] of [[33,.35,.40],[263,.65,.40],[1,.5,.52],[10,.5,.22],[152,.5,.75]])points[i]={x,y};
 return candidateRegions(points,200,200,{yaw:0,pitch:0,roll:0});
}
function syntheticFrame(regions,transform,offset){
 const width=200,height=200,data=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<data.length;i+=4)data.set([110,110,110,255],i);
 for(const [j,r] of regions.entries()){
  const rgb=quantize(regionColors[j],transform,offset).map(v=>Math.round(v*255));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const dx=x+.5-r.cx,dy=y+.5-r.cy;
   if(((dx*r.ux+dy*r.uy)/r.rx)**2+((-dx*r.uy+dy*r.ux)/r.ry)**2<=1)data.set([...rgb,255],(y*width+x)*4);
  }
 }
 return {width,height,data};
}
export function integratedDrift(){
 const regions=fixtureGeometry(),records=[],referenceReports=[];
 for(const {id,transform} of conditions){
  referenceReports.push({condition:id,...calibrationReport(referenceColors.map((expected,i)=>({id:'p'+i,role:i<7?'fit':'holdout',expected,observed:quantize(expected,transform)})))});
  for(let i=0;i<3;i++){
   const frame=syntheticFrame(regions,transform,i-1);
   for(const r of regions){
    const q=sampleRegion(frame,r);
    if(q.status==='research_only')records.push({captureId:id+'-'+i,region:r.id,condition:id,reviewed:true,a:q.medianEncodedA});
   }
  }
 }
 const repeats=repeatability(records);
 const drift=repeats.rows.filter(r=>r.condition!=='identity').map(r=>{
  const baseline=repeats.rows.find(b=>b.region===r.region&&b.condition==='identity');
  return {region:r.region,condition:r.condition,baselineMeanA:baseline?.mean??null,observedMeanA:r.mean,deltaA:Number.isFinite(baseline?.mean)&&Number.isFinite(r.mean)?r.mean-baseline.mean:null,withinConditionSD:r.sd,baselineSD:baseline?.sd??null};
 });
 return {schema:'fv07-integrated-drift-0.1',syntheticOnly:true,skinMeasurementEligible:false,calibrated:false,uncertainty:'not_quantified',referenceReports,repeats,drift,observationCount:records.length};
}
