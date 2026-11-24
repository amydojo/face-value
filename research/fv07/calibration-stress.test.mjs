import test from 'node:test';
import assert from 'node:assert/strict';
import {fitNeutralRamp,applyRamp,stressExperiment} from './calibration-stress.mjs';
const report=stressExperiment();
const row=(scenario,method)=>report.summary.find(r=>r.scenario===scenario&&r.method===method);
test('complete held-out fixture matrix and no skin eligibility',()=>{
 assert.equal(report.skinMeasurementEligible,false);
 assert.equal(report.rows.length,108);
 assert.equal(report.summary.length,18);
 for(const r of report.summary) assert.equal(r.reported+r.abstained,6);
});
test('gain-only and affine model recovery on separate color patches',()=>{
 assert.ok(row('diagonal_gain','raw').meanAbsoluteDeltaA>6);
 assert.ok(row('diagonal_gain','neutral').meanAbsoluteDeltaA<1e-5);
 assert.ok(row('gain_offset','neutral').meanAbsoluteDeltaA>2);
 assert.ok(row('gain_offset','ramp').meanAbsoluteDeltaA<1e-5);
});
test('nonlinear and channel mixing counterexamples remain visible',()=>{
 assert.ok(row('tone_curve','ramp').meanAbsoluteDeltaA>row('tone_curve','raw').meanAbsoluteDeltaA);
 assert.ok(row('channel_mixing','ramp').meanDeltaE76>6);
});
test('clipping never silently disappears into floating point boundary',()=>{
 assert.equal(row('severe_clipping','raw').abstained,2);
 assert.equal(row('severe_clipping','neutral').abstained,2);
 assert.equal(row('severe_clipping','ramp').abstained,6);
 assert.equal(row('severe_clipping','ramp').meanAbsoluteDeltaA,null);
});
test('invalid and degenerate reference fits abstain',()=>{
 const e=[[.25,.25,.25],[.5,.5,.5],[.75,.75,.75]];
 const fit=fitNeutralRamp(e,[[.5,.5,.5],[.5,.5,.5],[.5,.5,.5]]);
 assert.equal(fit.status,'abstain');
 assert.equal(applyRamp([.4,.4,.4],fit).status,'abstain');
 assert.equal(fitNeutralRamp(e,[[.25,.25,.25],[.5,.5,.5],[1,.75,.75]]).status,'abstain');
});
