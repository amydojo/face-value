import test from 'node:test';
import assert from 'node:assert/strict';
import {integratedDrift} from './integrated-drift.mjs';
test('synthetic integrated pipeline distinguishes repeated precision from condition drift',()=>{
 const x=integratedDrift();
 assert.equal(x.observationCount,27);
 assert.equal(x.repeats.rows.length,9);
 assert.equal(x.drift.length,6);
 assert.equal(x.skinMeasurementEligible,false);
 assert.equal(x.uncertainty,'not_quantified');
 for(const d of x.drift){assert.ok(Number.isFinite(d.deltaA));assert.ok(d.withinConditionSD<1);assert.ok(Math.abs(d.deltaA)>d.withinConditionSD);}
 const gain=x.referenceReports.find(r=>r.condition==='channel-gain');
 assert.equal(gain.affine.n,5);
 assert.ok(gain.affine.meanAbsA<gain.raw.meanAbsA);
});
