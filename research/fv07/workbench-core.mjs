// Research-only candidate geometry and color evaluation; never imported by production.
import {linearize,encode,lab} from './chroma.mjs';

function rgbOK(x){return Array.isArray(x)&&x.length===3&&x.every(v=>Number.isFinite(v)&&v>0&&v<1)}

function solve(A,b){
 const n=b.length,m=A.map((row,i)=>[...row,b[i]]);let max=0,min=Infinity;
 for(let j=0;j<n;j++){let p=j;for(let i=j+1;i<n;i++)if(Math.abs(m[i][j])>Math.abs(m[p][j]))p=i;[m[j],m[p]]=[m[p],m[j]];const d=m[j][j];if(!Number.isFinite(d)||Math.abs(d)<1e-9)return null;max=Math.max(max,Math.abs(d));min=Math.min(min,Math.abs(d));for(let k=j;k<=n;k++)m[j][k]/=d;for(let i=0;i<n;i++)if(i!==j){const f=m[i][j];for(let k=j;k<=n;k++)m[i][k]-=f*m[j][k]}}
 return max/min>1e7?null:m.map(r=>r[n]);
}

function fitAffine(rows){
 if(!Array.isArray(rows)||rows.length<4||rows.some(p=>!rgbOK(p.expected)||!rgbOK(p.observed)))return null;
 const X=rows.map(p=>[...p.observed.map(linearize),1]),Y=rows.map(p=>p.expected.map(linearize));
 const A=Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>X.reduce((s,r)=>s+r[i]*r[j],0)));
 const C=Array.from({length:3},(_,c)=>solve(A,Array.from({length:4},(_,i)=>X.reduce((s,r,j)=>s+r[i]*Y[j][c],0))));
 return C.every(x=>x!==null)?C:null;
}

function applyAffine(rgb,C){if(!rgbOK(rgb)||!C)return null;const x=[...rgb.map(linearize),1],y=C.map(row=>row.reduce((s,v,i)=>s+v*x[i],0));return y.every(v=>Number.isFinite(v)&&v>0&&v<1)?y.map(encode):null}

function calibrationReport(patches){
 const base={schema:"fv07-reference-evaluation-0.1",skinMeasurementEligible:false,calibrated:false,uncertainty:"not_quantified"};
 if(!Array.isArray(patches)||patches.length>128||patches.some(p=>!p||typeof p.id!=="string"||!p.id||!["fit","holdout"].includes(p.role)||!rgbOK(p.expected))||new Set(patches.map(p=>p.id)).size!==patches.length)return {...base,status:"abstain",reason:"invalid_reference_manifest"};
 const fit=patches.filter(p=>p.role==="fit"),test=patches.filter(p=>p.role==="holdout");
 if(fit.length<4||test.length<3)return {...base,status:"abstain",reason:"insufficient_disjoint_references"};
 const C=fitAffine(fit);
 const rows=test.map(p=>{const raw=rgbOK(p.observed)?p.observed:null,corrected=applyAffine(raw,C);const truth=lab(p.expected);const error=v=>{if(!v)return null;const q=lab(v);return {deltaA:q.a-truth.a,deltaE76:Math.hypot(q.L-truth.L,q.a-truth.a,q.b-truth.b)}};return {id:p.id,raw:error(raw),affine:error(corrected)}});
 const summarize=k=>{const a=rows.map(r=>r[k]).filter(Boolean);return {n:a.length,total:test.length,meanAbsA:a.length?a.reduce((s,v)=>s+Math.abs(v.deltaA),0)/a.length:null,meanDeltaE76:a.length?a.reduce((s,v)=>s+v.deltaE76,0)/a.length:null,maxAbsA:a.length?Math.max(...a.map(v=>Math.abs(v.deltaA))):null}};
 return {...base,status:"research_only",fitCount:fit.length,holdoutCount:test.length,affineAvailable:!!C,rows,raw:summarize("raw"),affine:summarize("affine")};
}

function candidateRegions(points,width,height,pose){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||!Array.isArray(points)||points.length!==478||!pose||![pose.yaw,pose.pitch,pose.roll].every(Number.isFinite)||Math.abs(pose.yaw)>12||Math.abs(pose.pitch)>12||Math.abs(pose.roll)>10)return null;
 const ids=[33,263,1,10,152],v=ids.map(i=>points[i]);if(v.some(p=>!p||![p.x,p.y].every(Number.isFinite)||p.x<0||p.x>1||p.y<0||p.y>1))return null;
 const [a,b,n,f,c]=v.map(p=>({x:p.x*width,y:p.y*height}));const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<30||dx<=0)return null;const u={x:dx/d,y:dy/d},w={x:-u.y,y:u.x};const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};const proj=p=>(p.x-mid.x)*w.x+(p.y-mid.y)*w.y;
 if(!(proj(f)<0&&proj(n)>.08*d&&proj(c)>proj(n)+.15*d))return null;
 const region=(id,x,y,rx,ry)=>({id,cx:mid.x+u.x*x+w.x*y,cy:mid.y+u.y*x+w.y*y,rx,ry,ux:u.x,uy:u.y});
 const cheekY=(proj(n)+proj(c))*.5, foreheadY=proj(f)*.55;
 const out=[region("image_left_cheek",-.54*d,cheekY,.17*d,.12*d),region("image_right_cheek",.54*d,cheekY,.17*d,.12*d),region("forehead",0,foreheadY,.23*d,.10*d)];
 if(out.some(r=>r.cx-Math.max(r.rx,r.ry)<0||r.cx+Math.max(r.rx,r.ry)>width||r.cy-Math.max(r.rx,r.ry)<0||r.cy+Math.max(r.rx,r.ry)>height))return null;return out;
}

function sampleRegion(frame,r){
 const {width,height,data}=frame||{};if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||width*height>4000000||!data||data.length!==width*height*4||!r||![r.cx,r.cy,r.rx,r.ry,r.ux,r.uy].every(Number.isFinite)||r.rx<=0||r.ry<=0||Math.abs(Math.hypot(r.ux,r.uy)-1)>1e-6)return {status:"abstain",reason:"invalid_frame_or_region"};
 const radius=Math.max(r.rx,r.ry);if(r.cx-radius<0||r.cy-radius<0||r.cx+radius>width||r.cy+radius>height)return {status:"abstain",reason:"region_out_of_frame"};
 const rgb=[],a=[];let total=0,excluded=0;
 for(let y=Math.floor(r.cy-radius);y<Math.ceil(r.cy+radius);y++)for(let x=Math.floor(r.cx-radius);x<Math.ceil(r.cx+radius);x++){const dx=x+.5-r.cx,dy=y+.5-r.cy;if(((dx*r.ux+dy*r.uy)/r.rx)**2+((-dx*r.uy+dy*r.ux)/r.ry)**2>1)continue;total++;const i=(y*width+x)*4,p=[data[i],data[i+1],data[i+2]];if(data[i+3]!==255||p.some(v=>!Number.isFinite(v)||v<=2||v>=250)||.2126*p[0]+.7152*p[1]+.0722*p[2]<=5){excluded++;continue;}const v=p.map(x=>x/255);rgb.push(v);a.push(lab(v).a)}
 if(rgb.length<30||excluded/Math.max(1,total)>.1)return {status:"abstain",reason:"insufficient_clean_pixels",total,excluded};
 const median=x=>{const s=[...x].sort((a,b)=>a-b),i=s.length>>1;return s.length%2?s[i]:(s[i-1]+s[i])/2};
 return {status:"research_only",total,excluded,medianRGB:[0,1,2].map(i=>median(rgb.map(p=>p[i]))),medianEncodedA:median(a)};
}

function repeatability(records){
 const base={schema:"fv07-regional-repeatability-0.1",skinMeasurementEligible:false,calibrated:false,uncertainty:"not_quantified",units:"descriptive a* of assumed encoded sRGB only"};
 if(!Array.isArray(records)||records.length>128||records.some(r=>!r||typeof r.captureId!=="string"||!r.captureId||!["forehead","image_left_cheek","image_right_cheek"].includes(r.region)||!Number.isFinite(r.a)||r.reviewed!==true||typeof r.condition!=="string"||!r.condition)||new Set(records.map(r=>JSON.stringify([r.captureId,r.region]))).size!==records.length)return {...base,status:"abstain",reason:"invalid_or_duplicate_records"};
 const groups=new Map();for(const r of records){const key=JSON.stringify([r.region,r.condition]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r.a)}
 const rows=[...groups].map(([k,a])=>{const [region,condition]=JSON.parse(k),n=a.length,mean=a.reduce((s,v)=>s+v,0)/n,sd=n>=3?Math.sqrt(a.reduce((s,v)=>s+(v-mean)**2,0)/(n-1)):null;return {region,condition,n,mean:n>=3?mean:null,sd,range:n>=3?Math.max(...a)-Math.min(...a):null,repeatabilityCoefficient:null,status:n>=3?"descriptive_only":"insufficient_repeats"}});
 return {...base,status:rows.some(r=>r.status==="descriptive_only")?"research_only":"abstain",rows};
}

export {calibrationReport,candidateRegions,sampleRegion,repeatability};
