import { expect, it } from 'vitest';
import { createEvidenceRecord, faceValueReducer, initialState } from '../app/machine';
import { ANALYSIS_SCENARIOS } from '../fixtures/analysis-scenarios';

const open = faceValueReducer(initialState, { type: 'OPEN_CABINET' });
const browse = faceValueReducer(open, { type: 'BROWSE_DRAWERS' });
const specimen = faceValueReducer(browse, { type: 'OPEN_DRAWER' });
const job = faceValueReducer(specimen, {
  type: 'ASSIGN_JOB',
  job: 'Post-acne pigmentation',
});
const baselineContract = faceValueReducer(job, {
  type: 'BEGIN_CAPTURE',
  kind: 'baseline',
});
const baselineCamera = faceValueReducer(baselineContract, {
  type: 'CONFIRM_CONTRACT',
  outcome: 'ready',
});
const baseline = faceValueReducer(baselineCamera, {
  type: 'CAPTURE_ACCEPTED',
  metadata: {
    id: 'b',
    kind: 'baseline',
    source: 'camera',
    mimeType: 'image/jpeg',
    createdAt: '2026-01-01',
    orientationRule: 'analysis-unmirrored',
  },
});
const traced = faceValueReducer(baseline, {
  type: 'ADD_TRACE',
  trace: {
    id: 't',
    label: 'VISIBLE SIGNAL',
    detail: 'Settling',
    observedAt: '2026-01-02',
  },
});

it('accepts valid transitions and rejects invalid transitions', () => {
  expect(open.stage).toBe('cabinet');
  expect(faceValueReducer(initialState, { type: 'OPEN_DRAWER' })).toBe(initialState);
  expect(browse.stage).toBe('browse');
  expect(faceValueReducer(browse, { type: 'PREVIOUS_DRAWER' })).toBe(browse);
  expect(faceValueReducer(specimen, { type: 'BACK' }).stage).toBe('browse');
});

it('uses explicit camera capture states and rejects mismatched capture metadata', () => {
  const requesting = faceValueReducer(baselineCamera, { type: 'CAMERA_REQUESTED' });
  const ready = faceValueReducer(requesting, { type: 'CAMERA_READY' });
  expect(faceValueReducer(ready, { type: 'CAMERA_CAPTURING' }).camera).toBe(
    'capturing',
  );

  const mismatched = faceValueReducer(baselineCamera, {
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
  expect(mismatched).toBe(baselineCamera);
});

it('keeps the stable disturbance branch comparable', () => {
  const disturbed = faceValueReducer(traced, { type: 'INTRODUCE_SECOND_PRODUCT' });
  const stable = faceValueReducer(disturbed, {
    type: 'RESOLVE_DISTURBANCE',
    resolution: 'cooling',
  });

  expect(stable.disturbance).toBe('returned_to_cooling');
  expect(stable.observation).toBe('active_stable');
  expect(stable.confidence).toBe('insufficient');
});

it('enforces lower-confidence semantics even if an adapter returns a stronger result', () => {
  const disturbed = faceValueReducer(traced, { type: 'INTRODUCE_SECOND_PRODUCT' });
  const overlap = faceValueReducer(disturbed, {
    type: 'RESOLVE_DISTURBANCE',
    resolution: 'overlap',
  });
  const followContract = faceValueReducer(overlap, {
    type: 'BEGIN_CAPTURE',
    kind: 'followup',
  });
  const followCamera = faceValueReducer(followContract, {
    type: 'CONFIRM_CONTRACT',
    outcome: 'comparable',
  });
  const captured = faceValueReducer(followCamera, {
    type: 'CAPTURE_ACCEPTED',
    metadata: {
      id: 'f',
      kind: 'followup',
      source: 'file',
      mimeType: 'image/jpeg',
      createdAt: '2026-01-03',
      orientationRule: 'analysis-unmirrored',
    },
  });
  const analyzed = faceValueReducer(captured, {
    type: 'ANALYSIS_SUCCEEDED',
    result: ANALYSIS_SCENARIOS.likely_change,
  });

  expect(analyzed.confidence).toBe('possible');
  expect(analyzed.comparison).toBe('partially_comparable');
  expect(analyzed.analysis?.confidence).toBe('possible');
  expect(analyzed.analysis?.comparison).toBe('partially_comparable');
  expect(analyzed.analysis?.recommendedAction).toBe('continue_with_overlap');
});

it('persists lower confidence through Progress Mode, re-shelving, and record generation', () => {
  const disturbed = faceValueReducer(traced, { type: 'INTRODUCE_SECOND_PRODUCT' });
  const overlap = faceValueReducer(disturbed, {
    type: 'RESOLVE_DISTURBANCE',
    resolution: 'overlap',
  });
  const follow = faceValueReducer(
    faceValueReducer(overlap, { type: 'BEGIN_CAPTURE', kind: 'followup' }),
    { type: 'CONFIRM_CONTRACT', outcome: 'partially_comparable' },
  );
  const captured = faceValueReducer(follow, {
    type: 'CAPTURE_ACCEPTED',
    metadata: {
      id: 'f',
      kind: 'followup',
      source: 'file',
      mimeType: 'image/jpeg',
      createdAt: '2026-01-03',
      orientationRule: 'analysis-unmirrored',
    },
  });
  const analyzed = faceValueReducer(captured, {
    type: 'ANALYSIS_SUCCEEDED',
    result: ANALYSIS_SCENARIOS.overlap_reduced,
  });
  const progress = faceValueReducer(analyzed, { type: 'ENTER_PROGRESS' });
  const placement = faceValueReducer(progress, {
    type: 'SELECT_PLACEMENT',
    placement: 'retry_alone',
  });
  const sealed = faceValueReducer(placement, { type: 'SEAL_PLACEMENT' });
  const recorded = faceValueReducer(sealed, {
    type: 'GENERATE_RECORD',
    now: '2026-01-04T00:00:00.000Z',
  });

  expect(sealed.placementSealed).toBe(true);
  expect(recorded.record?.confidence).toBe('possible');
  expect(recorded.record?.disturbance).toBe('overlap_retained');
  expect(recorded.record?.finalPlacement).toBe('retry_alone');
  expect(recorded.record?.includesFaceImage).toBe(false);
});

it('refuses record generation before placement is sealed', () => {
  const state = {
    ...initialState,
    stage: 'placement' as const,
    assignedJob: 'Post-acne pigmentation',
    analysis: ANALYSIS_SCENARIOS.no_change,
  };
  expect(
    faceValueReducer(state, {
      type: 'GENERATE_RECORD',
      now: '2026-01-04T00:00:00.000Z',
    }),
  ).toBe(state);
});

it('requires evidence before creating a face-free record', () => {
  expect(() => createEvidenceRecord(initialState, '2026-01-01')).toThrow();
});
