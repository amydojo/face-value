import { describe, expect, it } from 'vitest';
import {
  baselineTemplate,
  CaptureGuide,
  gateSpeedFor,
  GUIDE,
  mismatchReasons,
  rejectionMessage,
  retainedBaselineMeasurement,
  type BaselineTemplate,
  type Observation,
} from '../features/local-optics/guidance';
import type { CaptureMeasurement } from '../features/local-optics/opticsMetrics';

// Portrait 360×480 frame; a well-framed face: 0.30 of the width between the outer eye corners.
const good = (t: number, patch: Partial<NonNullable<Observation['face']>> = {}, rest: Partial<Observation> = {}): Observation => ({
  t,
  frame: { width: 360, height: 480 },
  faceCount: 1,
  face: { centerX: 0.5, centerY: 0.47, interocular: 0.3, roll: 1, yaw: 2, pitch: 8, edgeMargin: 0.12, outOfFrame: false, ...patch },
  speed: 0.2,
  light: { faceLuma: 140, clipped: 0, shading: 0.05 },
  frameIntervalMs: 33,
  ...rest,
});

/** Feeds readings every `step` ms and returns every state. */
function run(guide: CaptureGuide, from: number, count: number, make: (t: number, i: number) => Observation, step = 100) {
  return Array.from({ length: count }, (_, i) => guide.update(make(from + i * step, i)));
}

describe('stability window and automatic burst', () => {
  it('never fires on one passing reading; fires once after enough consecutive aligned readings', () => {
    const guide = new CaptureGuide();
    const states = run(guide, 0, 30, (t) => good(t));
    const first = states.findIndex((s) => s.fire);
    expect(first).toBeGreaterThan(0);
    // ≥ GUIDE.stableMs of aligned readings and ≥ GUIDE.stableObservations of them.
    expect(first * 100).toBeGreaterThanOrEqual(GUIDE.stableMs);
    expect(first + 1).toBeGreaterThanOrEqual(GUIDE.stableObservations);
    expect(states.filter((s) => s.fire)).toHaveLength(1);
    expect(states[first].instruction.id).toBe('aligned');
  });

  it('one failing reading restarts the window', () => {
    const guide = new CaptureGuide();
    // Aligned, but the head tilts past the roll limit on every 6th reading.
    const states = run(guide, 0, 60, (t, i) => good(t, { roll: i % 6 === 5 ? 12 : 1 }));
    expect(states.some((s) => s.fire)).toBe(false);
    expect(Math.max(...states.map((s) => s.hold))).toBeLessThan(1);
  });

  it('readings too fast for the time window still need GUIDE.stableMs', () => {
    const guide = new CaptureGuide();
    const states = run(guide, 0, 80, (t) => good(t), 20);
    const first = states.findIndex((s) => s.fire);
    expect(first).toBeGreaterThan(0);
    expect(first * 20).toBeGreaterThanOrEqual(GUIDE.stableMs);
  });

  it('reset() requires a fresh window before firing again', () => {
    const guide = new CaptureGuide();
    run(guide, 0, 20, (t) => good(t));
    guide.reset();
    const again = run(guide, 2000, 3, (t) => good(t));
    expect(again.some((s) => s.fire)).toBe(false);
    expect(run(guide, 2300, 20, (t) => good(t)).filter((s) => s.fire)).toHaveLength(1);
  });
});

describe('one stable instruction at a time', () => {
  it('does not flicker when a reading wobbles around a threshold', () => {
    const guide = new CaptureGuide();
    // Size settles inside, then jitters ±0.008 around the entry edge (0.22) for 6 s.
    run(guide, 0, 15, (t) => good(t));
    const states = run(guide, 1500, 60, (t, i) => good(t, { interocular: 0.22 + (i % 2 ? 0.008 : -0.008) }));
    expect(new Set(states.map((s) => s.instruction.id))).toEqual(new Set(['aligned']));
  });

  it('alternating problems change the instruction at most once per minimum display time', () => {
    const guide = new CaptureGuide();
    const states = run(guide, 0, 80, (t, i) =>
      Math.floor(i / 3) % 2 ? good(t, { centerX: 0.75 }) : good(t, { roll: 15 }),
    );
    const switches = states.filter((s, i) => i > 0 && s.instruction.id !== states[i - 1].instruction.id).length;
    expect(switches).toBeLessThanOrEqual(Math.ceil((80 * 100) / GUIDE.minShowMs));
  });

  it('a new instruction waits for the dwell time', () => {
    const guide = new CaptureGuide();
    run(guide, 0, 20, (t) => good(t, { centerX: 0.8 }));
    const states = run(guide, 2000, 3, (t) => good(t, { roll: 15 }));
    expect(states.map((s) => s.instruction.id)).toEqual(['center', 'center', 'center']);
  });

  it('shows the highest-priority problem: cut off before size before position before pose', () => {
    const guide = new CaptureGuide();
    const cutOff = run(guide, 0, 10, (t) => good(t, { outOfFrame: true, edgeMargin: -0.02, centerX: 0.8, roll: 20 })).at(-1)!;
    expect(cutOff.instruction.id).toBe('move_back');
    expect(cutOff.blocking).toEqual({ alignment: true, light: false, stillness: false });
    const far = run(new CaptureGuide(), 0, 10, (t) => good(t, { interocular: 0.12, roll: 20 })).at(-1)!;
    expect(far.instruction.id).toBe('move_closer');
    const tilted = run(new CaptureGuide(), 0, 10, (t) => good(t, { roll: 20 }, { speed: 4 })).at(-1)!;
    expect(tilted.instruction.id).toBe('level');
    const shaky = run(new CaptureGuide(), 0, 10, (t) => good(t, {}, { speed: 4 })).at(-1)!;
    expect(shaky.instruction).toMatchObject({ id: 'hold_still', category: 'stillness' });
    const glare = run(new CaptureGuide(), 0, 10, (t) => good(t, {}, { light: { faceLuma: 200, clipped: 0.05, shading: 0 } })).at(-1)!;
    expect(glare.instruction).toMatchObject({ id: 'glare', category: 'light' });
  });

  it('two faces are reported immediately; a brief face loss keeps the instruction', () => {
    const guide = new CaptureGuide();
    run(guide, 0, 10, (t) => good(t, { centerX: 0.8 }));
    const blink = run(guide, 1000, 3, (t) => ({ ...good(t), faceCount: 0, face: null }));
    expect(blink.map((s) => s.instruction.id)).toEqual(['center', 'center', 'center']);
    const lost = run(guide, 1300, 10, (t) => ({ ...good(t), faceCount: 0, face: null })).at(-1)!;
    expect(lost.instruction.id).toBe('no_face');
    const two = guide.update({ ...good(2400), faceCount: 2, face: null });
    expect(two.instruction.id).toBe('multiple_faces');
  });

  it('counts corrections: each corrective instruction shown once per switch', () => {
    const guide = new CaptureGuide();
    run(guide, 0, 15, (t) => good(t, { centerX: 0.8 }));
    run(guide, 1500, 15, (t) => good(t, { interocular: 0.12 }));
    const final = run(guide, 3000, 20, (t) => good(t)).at(-1)!;
    expect(final.corrections).toBe(2);
    expect(final.shown).toEqual(['center', 'move_closer', 'aligned']);
  });

  it('stillness predicts the per-frame motion gate: the same hand is too fast on a slow device', () => {
    // 33 ms between analysed frames: the gate is 0.02 / 0.033 ≈ 0.6 interocular/s; 0.2 passes.
    expect(run(new CaptureGuide(), 0, 20, (t) => good(t)).some((s) => s.fire)).toBe(true);
    // 150 ms between frames: the same 0.2/s moves 0.03 interocular per frame, over the 0.02 gate.
    const slow = run(new CaptureGuide(), 0, 20, (t) => good(t, {}, { frameIntervalMs: 150 }));
    expect(slow.some((s) => s.fire)).toBe(false);
    expect(slow.at(-1)!.instruction.id).toBe('hold_still');
    expect(gateSpeedFor(1000 / 60)).toBeCloseTo(1.2, 5);
  });

  it('first scan: the outline closes around an acceptable face and stays inside the framing limits', () => {
    const fits = new CaptureGuide().update(good(0, { centerX: 0.53, centerY: 0.5, interocular: 0.33 }));
    expect(fits.target).toMatchObject({ centerX: 0.53, centerY: 0.5, interocularPx: expect.closeTo(0.33 * 360, 6) });
    const far = new CaptureGuide().update(good(0, { centerX: 0.9, interocular: 0.1 }));
    expect(far.target).toMatchObject({ centerX: 0.5 + GUIDE.centerX.enter, interocularPx: expect.closeTo(GUIDE.size.min.enter * 360, 6) });
  });

  it('points the overlay nudge toward the outline in the mirrored preview', () => {
    // Face at x = 0.3 in camera pixels is at 0.7 on the mirrored screen; the outline is at 0.5.
    const state = run(new CaptureGuide(), 0, 10, (t) => good(t, { centerX: 0.3 })).at(-1)!;
    expect(state.nudge!.x).toBeLessThan(0);
  });
});

const template: BaselineTemplate = {
  version: 'fv-guided-baseline-0.1',
  orientation: 'portrait',
  centerX: 0.5,
  centerY: 0.47,
  interocular: 0.3,
  roll: 1,
  yaw: 2,
  pitch: 8,
  faceLuma: 140,
  shading: 0.05,
};

describe('baseline matching', () => {
  it('guides size, light and orientation relative to the baseline, and fires when matched', () => {
    expect(run(new CaptureGuide(template), 0, 10, (t) => good(t, { interocular: 0.36 })).at(-1)!.instruction.id).toBe('move_back');
    expect(run(new CaptureGuide(template), 0, 10, (t) => good(t, { interocular: 0.25 })).at(-1)!.instruction.id).toBe('move_closer');
    // 0.36 would be fine for a first scan, but it is 20% larger than this baseline.
    expect(run(new CaptureGuide(), 0, 10, (t) => good(t, { interocular: 0.36 })).at(-1)!.instruction.id).toBe('aligned');
    const brighter = run(new CaptureGuide(template), 0, 10, (t) => good(t, {}, { light: { faceLuma: 175, clipped: 0, shading: 0.05 } })).at(-1)!;
    expect(brighter.instruction).toMatchObject({ id: 'light_match', category: 'light' });
    const sideways = new CaptureGuide(template).update(good(0, {}, { frame: { width: 480, height: 360 } }));
    expect(sideways.instruction).toMatchObject({ id: 'rotate', title: 'Turn your phone upright' });
    const matched = run(new CaptureGuide(template), 0, 20, (t) => good(t, { centerX: 0.52, interocular: 0.31 }));
    expect(matched.filter((s) => s.fire)).toHaveLength(1);
    expect(matched.at(-1)!.target).toMatchObject({ centerX: 0.5, centerY: 0.47, roll: 1 });
  });

  it('the outline target comes from the template, not from any face shape', () => {
    const state = new CaptureGuide(template).update(good(0));
    expect(state.target).toEqual({ centerX: 0.5, centerY: 0.47, interocularPx: 0.3 * 360, roll: 1 });
  });
});

const measurement = (patch: Partial<CaptureMeasurement> = {}): CaptureMeasurement => {
  const m = (value: number | null) => ({ value, provenance: value === null ? ('unavailable' as const) : ('measured' as const) });
  return {
    version: 'fv-local-optics-metrics-0.1',
    frameCount: 12,
    frameSize: { width: 270, height: 360 },
    faceCounts: Array(12).fill(1),
    rejections: [],
    roll: m(1.2345),
    yaw: m(-2.26),
    pitch: m(8.94),
    interocular: m(0.30049),
    faceHeight: m(0.41),
    centerX: m(0.50123),
    centerY: m(0.4789),
    edgeMargin: m(0.11),
    landmarkMotion: m(0.004),
    pixelMotion: m(0.3),
    faceLuma: m(141.4),
    faceLumaSpread: m(40),
    faceClipped: m(0),
    shadingAsymmetry: m(0.0512),
    frameLuma: m(120),
    backgroundChroma: { value: { r: 0.33, g: 0.33 }, provenance: 'estimate' },
    colorCast: { value: null, provenance: 'unavailable' },
    camera: { settings: { width: 1080, height: 1440, facingMode: 'user' } },
    ...patch,
  };
};

describe('what a baseline keeps', () => {
  it('a template is framing, pose and coarse light only, rounded, from an accepted capture', () => {
    const t = baselineTemplate(measurement())!;
    expect(Object.keys(t).sort()).toEqual(
      ['centerX', 'centerY', 'faceLuma', 'interocular', 'orientation', 'pitch', 'roll', 'shading', 'version', 'yaw'].sort(),
    );
    expect(t).toMatchObject({ orientation: 'portrait', centerX: 0.501, interocular: 0.3, roll: 1.2, yaw: -2.3, faceLuma: 141 });
    expect(JSON.stringify(t)).not.toMatch(/points|landmark|width|height|faceHeight|edge|deviceId|data:/);
    expect(baselineTemplate(measurement({ rejections: ['motion'] }))).toBeNull();
  });

  it('the retained baseline measurement drops face-box height and edge margin', () => {
    const kept = retainedBaselineMeasurement(measurement());
    expect(kept.faceHeight.value).toBeNull();
    expect(kept.edgeMargin.value).toBeNull();
    expect(kept.interocular.value).toBe(0.30049);
  });
});

describe('plain-language outcomes', () => {
  it('maps gate failures and mismatches to one actionable message', () => {
    expect(rejectionMessage(['motion']).title).toBe('Too much movement');
    expect(rejectionMessage(['motion', 'face_out_of_frame']).title).toBe('Part of your face was cut off');
    expect(rejectionMessage(['clipped_highlights']).title).toBe('Too much glare');
    expect(
      mismatchReasons([
        { property: 'Face brightness', status: 'outside_experimental_tolerance' },
        { property: 'Yaw', status: 'outside_experimental_tolerance' },
        { property: 'Roll', status: 'within_experimental_tolerance' },
      ]),
    ).toEqual(['The light is different from your baseline', 'Your head angle changed']);
  });
});

describe('stillness filtering', () => {
  it('one jittery speed reading does not restart the window; sustained movement does', () => {
    const spiky = run(new CaptureGuide(), 0, 30, (t, i) => good(t, {}, { speed: i % 4 === 3 ? 2 : 0.2 }));
    expect(spiky.filter((s) => s.fire)).toHaveLength(1);
    const moving = run(new CaptureGuide(), 0, 30, (t, i) => good(t, {}, { speed: i % 4 < 2 ? 2 : 0.2 }));
    expect(moving.some((s) => s.fire)).toBe(false);
  });
});

describe('the instruction follows the detected condition', () => {
  it('a resolved problem is replaced after the dwell, not held for the minimum display time', () => {
    const guide = new CaptureGuide();
    run(guide, 0, 3, (t) => good(t, { centerX: 0.8 })); // "center" on screen from about 450 ms
    // Centred now, but the head tilts: "center" no longer applies.
    const states = run(guide, 600, 8, (t) => good(t, { roll: 15 }));
    const switchedAt = states.findIndex((s) => s.instruction.id === 'level');
    expect(switchedAt).toBeGreaterThan(-1);
    expect(600 + switchedAt * 100 - 500).toBeLessThan(GUIDE.minShowMs); // shown < 900 ms after "center"
  });

  it('a problem that is still present keeps its minimum display time when a higher one appears', () => {
    const guide = new CaptureGuide();
    run(guide, 0, 6, (t) => good(t, { roll: 15 })); // "level" shown at about 500 ms
    // Still tilted, and now also too far: "move_closer" outranks "level", but "level" stays ≥ 900 ms.
    const states = run(guide, 600, 12, (t) => good(t, { roll: 15, interocular: 0.12 }));
    const at = states.findIndex((s) => s.instruction.id === 'move_closer');
    expect(600 + at * 100 - 500).toBeGreaterThanOrEqual(GUIDE.minShowMs);
  });

  it('“moving” and “about to capture” read differently', () => {
    const shaky = run(new CaptureGuide(), 0, 10, (t) => good(t, {}, { speed: 4 })).at(-1)!;
    const ready = run(new CaptureGuide(), 0, 10, (t) => good(t)).at(-1)!;
    expect(shaky.instruction.title).toBe('Hold steady');
    expect(ready.instruction).toMatchObject({ id: 'aligned', title: 'Hold it there', detail: 'Capturing automatically' });
  });
});
