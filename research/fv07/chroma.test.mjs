import test from 'node:test';
import assert from 'node:assert/strict';
import { lab, linearize, encode, neutralCorrect, experiment } from './chroma.mjs';

const near = (actual, expected, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} vs ${expected}`);
test('sRGB D65 known reference colors and transfer function', () => {
  near(lab([0,0,0]).L,0);
  near(lab([1,1,1]).L,100,0.001);
  near(lab([1,0,0]).a,80.0925,0.001);
  near(lab([0.5,0.5,0.5]).a,0,0.001);
  for (const x of [0,0.01,0.04,0.1,0.5,1]) near(encode(linearize(x)),x);
});
test('known diagonal gain inversion on synthetic patches only', () => {
  const result = experiment();
  assert.equal(result.skinMeasurementEligible,false);
  assert.equal(result.rows.length,9);
  assert.ok(result.rows.some(r=>Math.abs(r.observedA-r.referenceA)>8));
  for(const row of result.rows) {
    assert.equal(row.status,'synthetic_only');
    near(row.correctedA,row.referenceA);
  }
});
test('invalid inputs and untrustworthy reference abstain or fail closed', () => {
  for(const x of [NaN,Infinity,-0.01,1.01]) assert.throws(()=>lab([x,0.5,0.5]));
  assert.equal(neutralCorrect([1,0.4,0.4],[0.5,0.5,0.5],[0.5,0.5,0.5]).status,'abstain');
  assert.equal(neutralCorrect([0.4,0.4,0.4],[0.01,0.01,0.01],[0.5,0.5,0.5]).status,'abstain');
  assert.equal(neutralCorrect([0.9,0.9,0.9],[0.2,0.2,0.2],[0.5,0.5,0.5]).status,'abstain');
});
