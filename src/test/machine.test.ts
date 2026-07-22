import { expect, it } from 'vitest';
import { ANALYSIS_SCENARIOS } from '../fixtures/analysis-scenarios';
import { createEvidenceRecord, faceValueReducer, initialState } from '../app/machine';

const open = faceValueReducer(initialState, { type: 'OPEN_CABINET' });
const browse = faceValueReducer(open, { type: 'BROWSE_DRAWERS' });
const specimen = faceValueReducer(browse, { type: 'OPEN_DRAWER' });
const job = faceValueReducer(specimen, { type: 'ASSIGN_JOB', job: 'Post-acne pigmentation' });
const baseline = faceValueReducer(faceValueReducer(faceValueReducer(job, { type: 'BEGIN_CAPTURE', kind: 'baseline' }), { type: 'CONFIRM_CONTRACT', outcome: 'ready' }), { type: 'CAPTURE_ACCEPTED', metadata: { id:'b', kind:'baseline', source:'camera', mimeType:'image/jpeg', createdAt:'2026-01-01', orientationRule:'analysis-unmirrored' } });
const traced = faceValueReducer(baseline, { type: 'ADD_TRACE', trace: { id:'t', label:'VISIBLE SIGNAL', detail:'Settling', observedAt:'2026-01-02' } });

it('accepts valid transitions and rejects invalid transitions', () => {
  expect(open.stage).toBe('cabinet');
  expect(faceValueReducer(initialState, { type: 'OPEN_DRAWER' })).toBe(initialState);
  expect(browse.stage).toBe('browse');
  expect(faceValueReducer(browse, { type: 'PREVIOUS_DRAWER' })).toBe(browse);
});

it('uses explicit camera capture states and rejects mismatched capture metadata', () => {
  const contract = faceValueReducer(job, { type: 'BEGIN_CAPTURE', kind: 'baseline' });
  const camera = faceValueReducer(contract, { type: 'CONFIRM_CONTRACT', outcome: 'ready' });
  const requesting = faceValueReducer(camera, { type: 'CAMERA_REQUESTED' });
  const ready = faceValueReducer(requesting, { type: 'CAMERA_READY' });
  expect(faceValueReducer(ready, { type: 'CAMERA_CAPTURING' }).camera).toBe('capturing');
  const mismatched = faceValueReducer(camera, {
    type: 'CAPTURE_ACCEPTED',
    metadata: {
      id: 'wrong-kind',
      kind: 'followup',
      source: 'file',
      mimeType: 'image/jpeg',
      createdAt: '2026-01-01',
      orientationRule: 'analysis-unmirrored',
    },
  });
  expect(mismatched).toBe(camera);
});

it('keeps the stable disturbance branch comparable', () => {
  const disturbed = faceValueReducer(traced, { type: 'INTRODUCE_SECOND_PRODUCT' });
  const stable = faceValueReducer(disturbed, { type: 'RESOLVE_DISTURBANCE', resolution: 'cooling' });
  expect(stable.disturbance).toBe('returned_to_cooling');
  expect(stable.observation).toBe('active_stable');
});

it('persists lower confidence through analysis and record generation', () => {
  const disturbed = faceValueReducer(traced, { type: 'INTRODUCE_SECOND_PRODUCT' });
  const overlap = faceValueReducer(disturbed, { type: 'RESOLVE_DISTURBANCE', resolution: 'overlap' });
  const follow = faceValueReducer(faceValueReducer(overlap, { type: 'BEGIN_CAPTURE', kind: 'followup' }), { type: 'CONFIRM_CONTRACT', outcome: 'partially_comparable' });
  const captured = faceValueReducer(follow, { type: 'CAPTURE_ACCEPTED', metadata: { id:'f', kind:'followup', source:'file', mimeType:'image/jpeg', createdAt:'2026-01-03', orientationRule:'analysis-unmirrored' } });
  const analyzed = faceValueReducer(captured, { type: 'ANALYSIS_SUCCEEDED', result: ANALYSIS_SCENARIOS.overlap_reduced });
  expect(analyzed.confidence).toBe('possible');
  const progress = faceValueReducer(analyzed, { type: 'ENTER_PROGRESS' });
  const placement = faceValueReducer(progress, { type: 'SELECT_PLACEMENT', placement: 'retry_alone' });
  const sealed = faceValueReducer(placement, { type: 'SEAL_PLACEMENT' });
  expect(sealed.placementSealed).toBe(true);
  const recorded = faceValueReducer(sealed, { type: 'GENERATE_RECORD', now: '2026-01-04T00:00:00.000Z' });
  expect(recorded.record?.confidence).toBe('possible');
  expect(recorded.record?.disturbance).toBe('overlap_retained');
  expect(recorded.record?.finalPlacement).toBe('retry_alone');
});

it('generates a face-free record only after required evidence exists', () => {
  expect(() => createEvidenceRecord(initialState, '2026-01-01')).toThrow();
});
