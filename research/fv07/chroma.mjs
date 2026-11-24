// FV07 offline synthetic research only. No camera, DOM, persistence or production imports.
// Assumes normalized encoded sRGB / D65, not arbitrary camera RGB.
function linearize(v){if(!Number.isFinite(v)||v<0||v>1)throw new RangeError("Expected normalized encoded sRGB");return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;}

function encode(v){if(!Number.isFinite(v)||v<0||v>1)throw new RangeError("Expected normalized linear sRGB");return v<=0.0031308?12.92*v:1.055*v**(1/2.4)-0.055;}

function rgb3(rgb){if(!Array.isArray(rgb)||rgb.length!==3||rgb.some(x=>!Number.isFinite(x)||x<0||x>1))throw new RangeError("Expected three normalized sRGB channels");return rgb;}

function lab(rgb){const [r,g,b]=rgb3(rgb).map(linearize);const xyz=[(0.4124564*r+0.3575761*g+0.1804375*b)/0.95047,0.2126729*r+0.7151522*g+0.072175*b,(0.0193339*r+0.119192*g+0.9503041*b)/1.08883];const d=6/29;const [x,y,z]=xyz.map(t=>t>d**3?Math.cbrt(t):t/(3*d*d)+4/29);return {L:116*y-16,a:500*(x-y),b:200*(y-z)};}

function neutralCorrect(sample,observed,expected){rgb3(sample);rgb3(observed);rgb3(expected);if([...sample,...observed,...expected].some(x=>x<=0||x>=1))return {status:"abstain",reason:"channel_at_boundary"};const target=expected.map(linearize);const reference=observed.map(linearize);if(reference.some(x=>x<0.02)||target.some(x=>x<0.02))return {status:"abstain",reason:"reference_too_dark_for_fixture"};const corrected=sample.map((x,i)=>linearize(x)*target[i]/reference[i]);if(corrected.some(x=>!Number.isFinite(x)||x<=0||x>=1))return {status:"abstain",reason:"correction_out_of_range"};return {status:"synthetic_only",rgb:corrected.map(encode)};}

function experiment(){const reference=[0.5,0.5,0.5];const samples=[[0.72,0.5,0.42],[0.5,0.32,0.25],[0.27,0.17,0.12]];const gains=[[1,1,1],[1.2,0.9,0.8],[0.7,0.7,0.7]];const distort=(rgb,gain)=>rgb.map((x,i)=>encode(linearize(x)*gain[i]));return {schema:"fv07-synthetic-chroma-0.1",scope:"synthetic encoded sRGB only; not calibrated camera or skin data",skinMeasurementEligible:false,rows:samples.flatMap((sample,patch)=>gains.map((gain,condition)=>{const observed=distort(sample,gain);const ref=distort(reference,gain);const corrected=neutralCorrect(observed,ref,reference);return {patch,condition,referenceA:lab(sample).a,observedA:lab(observed).a,correctedA:corrected.status==="synthetic_only"?lab(corrected.rgb).a:null,status:corrected.status};}))};}

export {linearize,encode,lab,neutralCorrect,experiment};
