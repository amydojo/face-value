// FV07 synthetic stress tests. Never used to score a person or infer camera calibration.
import {linearize,encode,lab,neutralCorrect} from './chroma.mjs';
const fitLevels=[0.25,0.5,0.75];
const holdout=[[0.72,0.5,0.42],[0.5,0.32,0.25],[0.27,0.17,0.12],[0.63,0.44,0.39],[0.35,0.24,0.2],[0.58,0.49,0.38]];
const scenarios={
identity: x=>x,
diagonal_gain: ([r,g,b])=>[1.2*r,.9*g,.8*b],
gain_offset: ([r,g,b])=>[1.1*r+.03,.85*g+.018,.95*b+.01],
tone_curve: ([r,g,b])=>[r**.75,g**.85,b**.95],
channel_mixing: ([r,g,b])=>[.84*r+.16*g,.9*g+.1*b,.12*r+.88*b],
severe_clipping: ([r,g,b])=>[3*r,2*g,2*b]
};

function simulate(rgb, transform){return transform(rgb.map(linearize)).map(x=>x<=0?0:x>=1?1:encode(x));}

function validInterior(rgb){return Array.isArray(rgb)&&rgb.length===3&&rgb.every(x=>Number.isFinite(x)&&x>0&&x<1);}

function fitNeutralRamp(expected, observed){
 if(!Array.isArray(expected)||!Array.isArray(observed)||expected.length!==observed.length||expected.length<3||!expected.every(validInterior)||!observed.every(validInterior))return {status:"abstain",reason:"invalid_or_clipped_reference"};
 const coefficients=[];
 for(let c=0;c<3;c++){
  const x=observed.map(p=>linearize(p[c])),y=expected.map(p=>linearize(p[c]));
  const mx=x.reduce((a,b)=>a+b,0)/x.length,my=y.reduce((a,b)=>a+b,0)/y.length;
  const variance=x.reduce((s,v)=>s+(v-mx)**2,0);
  if(variance<1e-6||Math.max(...x)-Math.min(...x)<.05)return {status:"abstain",reason:"insufficient_reference_span"};
  const slope=x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0)/variance,offset=my-slope*mx;
  if(!Number.isFinite(slope)||!Number.isFinite(offset)||slope<=0)return {status:"abstain",reason:"invalid_fit"};
  coefficients.push({slope,offset});
 }
 return {status:"synthetic_only",coefficients};
}

function applyRamp(rgb,fit){
 if(fit.status!=="synthetic_only")return fit;
 if(!validInterior(rgb))return {status:"abstain",reason:"invalid_or_clipped_sample"};
 const out=rgb.map((v,i)=>linearize(v)*fit.coefficients[i].slope+fit.coefficients[i].offset);
 if(out.some(x=>!Number.isFinite(x)||x<=0||x>=1))return {status:"abstain",reason:"correction_out_of_range"};
 return {status:"synthetic_only",rgb:out.map(encode)};
}

function delta(rgb,expected){const p=lab(rgb),q=lab(expected);return {deltaA:p.a-q.a,deltaE76:Math.hypot(p.L-q.L,p.a-q.a,p.b-q.b)};}

function summarize(rows){const ok=rows.filter(r=>r.status==="synthetic_only");return {total:rows.length,reported:ok.length,abstained:rows.length-ok.length,meanAbsoluteDeltaA:ok.length?ok.reduce((s,r)=>s+Math.abs(r.deltaA),0)/ok.length:null,maxAbsoluteDeltaA:ok.length?Math.max(...ok.map(r=>Math.abs(r.deltaA))):null,meanDeltaE76:ok.length?ok.reduce((s,r)=>s+r.deltaE76,0)/ok.length:null};}

function stressExperiment(){
 const expected=fitLevels.map(x=>[x,x,x]);const rows=[];
 for(const [scenario,transform] of Object.entries(scenarios)){
  const observed=expected.map(p=>simulate(p,transform));const fit=fitNeutralRamp(expected,observed);
  for(const [patch,p] of holdout.entries()){
   const sample=simulate(p,transform);
   const raw=validInterior(sample)?{status:"synthetic_only",rgb:sample}:{status:"abstain",reason:"invalid_or_clipped_sample"};
   const neutral=validInterior(sample)&&validInterior(observed[1])?neutralCorrect(sample,observed[1],expected[1]):{status:"abstain",reason:"invalid_or_clipped_reference_or_sample"};
   for(const [method,result] of Object.entries({raw,neutral,ramp:applyRamp(sample,fit)})){
    rows.push({scenario,patch,method,status:result.status,...(result.status==="synthetic_only"?delta(result.rgb,p):{reason:result.reason})});
   }
  }
 }
 return {schema:"fv07-calibration-stress-0.1",skinMeasurementEligible:false,scope:"synthetic only; arbitrary held-out color patches, not skin or camera observations",rows,summary:Object.keys(scenarios).flatMap(scenario=>["raw","neutral","ramp"].map(method=>({scenario,method,...summarize(rows.filter(r=>r.scenario===scenario&&r.method===method))})))};
}

export {fitNeutralRamp,applyRamp,stressExperiment};
