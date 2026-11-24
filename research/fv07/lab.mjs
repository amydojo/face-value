import {calibrationReport,candidateRegions,sampleRegion,repeatability} from './workbench-core.mjs';
import {loadMediaPipeLandmarker} from '../../src/features/local-optics/landmarkSource.ts';
import {faceGeometry} from '../../src/features/local-optics/opticsMetrics.ts';
const $=id=>document.getElementById(id);
const video=$('video'),view=$('view'),ctx=view.getContext('2d',{willReadFrequently:true});
const allowedHost=['localhost','127.0.0.1','[::1]'].includes(location.hostname) || (import.meta.env.VITE_FV07_RESEARCH === 'true' && location.protocol === 'https:' && /^face-value-optics-[a-z0-9-]+-amy-dos-projects\.vercel\.app$/.test(location.hostname));
let stream=null,model=null,pixels=null,regions=null,source=null,report=null,records=[],captureId=0,recorded=false,busy=false,epoch=0;
const status=t=>{$('status').textContent=t;};
const show=(id,x)=>{$(id).textContent=JSON.stringify(x,null,2);};
const buttons=['start','stop','snap','fixture','clear','calibrate','face','record','repeat','export'];
function lock(v){busy=v;for(const id of buttons)$(id).disabled=v||!allowedHost;}
function assertLocal(){if(!allowedHost)throw Error('This workbench requires localhost or the protected research preview.');}
function resetCapture(){pixels=null;regions=null;source=null;recorded=false;$('review').checked=false;$('mapping').textContent='';ctx.clearRect(0,0,view.width,view.height);}
function stop(){epoch++;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;if(model){model.close();model=null;}}
function clear(){stop();resetCapture();records=[];report=null;captureId=0;$('calibration').textContent='';$('results').textContent='';status('Session cleared.');}
function bind(id,fn){$(id).addEventListener('click',async()=>{if(busy)return;lock(true);try{assertLocal();await fn();}catch(e){status(e instanceof Error?e.message:'Operation failed.');}finally{lock(false);}});}
function snapshot(){if(!stream||video.readyState<2||!video.videoWidth)throw Error('Start the camera and wait for the live image.');resetCapture();const scale=Math.min(1,640/Math.max(video.videoWidth,video.videoHeight));view.width=Math.max(1,Math.round(video.videoWidth*scale));view.height=Math.max(1,Math.round(video.videoHeight*scale));ctx.drawImage(video,0,0,view.width,view.height);pixels=ctx.getImageData(0,0,view.width,view.height);source='camera';captureId++; }
function drawRegions(rs){ctx.strokeStyle='#e7b097';ctx.lineWidth=1.5;for(const r of rs){ctx.beginPath();ctx.ellipse(r.cx,r.cy,r.rx,r.ry,Math.atan2(r.uy,r.ux),0,2*Math.PI);ctx.stroke();}}
const colors=[[.25,.25,.25],[.5,.5,.5],[.75,.75,.75],[.2,.3,.4],[.65,.25,.3],[.3,.65,.25],[.25,.3,.7],[.45,.32,.24],[.66,.51,.42],[.35,.48,.6],[.28,.19,.16],[.72,.52,.43]];
const fixture=()=>colors.map((expected,i)=>({id:'p'+(i+1),role:i<7?'fit':'holdout',expected,cx:(i%4+.5)/4,cy:(Math.floor(i/4)+.5)/3,rx:.075,ry:.10}));
$('manifest').value=JSON.stringify(fixture(),null,2);
bind('start',async()=>{if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera unavailable on this origin.');stop();const token=epoch;const s=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}}});if(epoch!==token||document.hidden){s.getTracks().forEach(t=>t.stop());return;}stream=s;video.srcObject=s;try{await video.play();}catch(e){stop();throw e;}status('Camera active locally.');});
bind('stop',()=>{stop();status('Camera stopped.');});
bind('clear',clear);
bind('snap',()=>{snapshot();status('Reference frame captured locally. Edit the manifest to match your target.');});
bind('fixture',()=>{stop();resetCapture();view.width=640;view.height=480;const manifest=fixture();for(const p of manifest){ctx.fillStyle='rgb('+p.expected.map(v=>Math.round(v*255)).join(',')+')';ctx.fillRect((p.cx-.12)*640,(p.cy-.155)*480,.24*640,.31*480);}pixels=ctx.getImageData(0,0,640,480);source='synthetic';$('manifest').value=JSON.stringify(manifest,null,2);status('Synthetic target loaded.');});
bind('calibrate',()=>{
 if(!pixels)throw Error('Capture a reference frame first.');
 const m=JSON.parse($('manifest').value);
 if(!Array.isArray(m)||m.length>128||m.some(p=>!p||![p.cx,p.cy,p.rx,p.ry].every(Number.isFinite)||p.rx<=0||p.ry<=0||p.cx-p.rx<0||p.cx+p.rx>1||p.cy-p.ry<0||p.cy+p.ry>1)||new Set(m.map(p=>p.id)).size!==m.length)throw Error('Invalid reference coordinates or duplicate patch IDs.');
 for(let i=0;i<m.length;i++)for(let j=i+1;j<m.length;j++)if(Math.abs(m[i].cx-m[j].cx)<m[i].rx+m[j].rx&&Math.abs(m[i].cy-m[j].cy)<m[i].ry+m[j].ry)throw Error('Patch sampling boxes must not overlap.');
 const samples=m.map((p,i)=>{const q=sampleRegion(pixels,{cx:p.cx*pixels.width,cy:p.cy*pixels.height,rx:p.rx*pixels.width,ry:p.ry*pixels.height,ux:1,uy:0});return {id:'patch-'+(i+1),role:p.role,expected:p.expected,observed:q.status==='research_only'?q.medianRGB:null};});
 report={source,referenceProvenance:source==='synthetic'?'synthetic_fixture':$('target').value,...calibrationReport(samples)};show('calibration',report);status('Reference errors evaluated. No correction has been authorized for skin.');
});
bind('face',async()=>{
 if(!stream||video.readyState<2)throw Error('Start the camera before mapping.');
 const token=epoch;if(!model){const loaded=await loadMediaPipeLandmarker();if(epoch!==token||!stream||document.hidden){loaded.close();return;}model=loaded;}
 video.pause();let f;try{snapshot();f=model.detect(video,performance.now());}finally{if(stream&&!document.hidden)await video.play();}if(f.faces.length!==1){resetCapture();throw Error('Exactly one face is required.');}
 const g=faceGeometry(f.faces[0],video.videoWidth,video.videoHeight);
 if(g.outOfFrameFraction>0){resetCapture();throw Error('Face is not fully in frame.');}
 regions=candidateRegions(f.faces[0].points,pixels.width,pixels.height,{yaw:g.yawDegrees,pitch:g.pitchDegrees,roll:g.rollDegrees});
 if(!regions){resetCapture();throw Error('Candidate regions unavailable; return to a frontal pose.');}
 drawRegions(regions);show('mapping',{status:'candidate_only',regions:regions.map(r=>({id:r.id,quality:sampleRegion(pixels,r).status})),note:'Inspect the overlay manually. Snapshot/landmark temporal alignment is not yet verified.'});status('Review the overlay before recording.');
});
bind('record',()=>{
 if(!regions||!pixels||source!=='camera'||recorded||!$('review').checked)throw Error('A fresh camera capture and explicit region review are required.');
 const condition=$('condition').value.trim();
 if(!['fixed-light','changed-light','changed-pose','other'].includes(condition))throw Error('Use fixed-light, changed-light, changed-pose or other; no personal text.');
 if(records.length>117)throw Error('Session record limit reached; export and clear.');
 const samples=regions.map(r=>({region:r.id,...sampleRegion(pixels,r)}));let added=0;
 for(const r of samples)if(r.status==='research_only'){records.push({captureId:'capture-'+captureId,region:r.region,condition,reviewed:true,a:r.medianEncodedA});added++;}
 recorded=true;show('mapping',{status:'camera_encoded_research_only',recorded:added,regions:samples.map(r=>({id:r.region,status:r.status,total:r.total,excluded:r.excluded,medianEncodedA:r.medianEncodedA??null}))});status('Capture recorded once. No calibrated skin measurement.');
});
bind('repeat',()=>show('results',repeatability(records)));
bind('export',()=>{const result={schema:'fv07-workbench-0.1',skinMeasurementEligible:false,calibrated:false,uncertainty:'not_quantified',reference:report,regionalRepeatability:repeatability(records),observations:records.map(r=>({...r}))};const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='chroma-research.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Numeric research report exported.');});
window.addEventListener('pagehide',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();resetCapture();status('Camera stopped and frame cleared while hidden.');}});
if(!allowedHost){lock(false);status('Research origin not permitted. No camera or research actions are available here.');}
