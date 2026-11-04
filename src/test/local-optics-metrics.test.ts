import { describe, expect, it } from 'vitest';
import {
  backgroundChromaticityEstimate,
  compareCaptures,
  eulerFromMatrix,
  FACE_LANDMARK_COUNT,
  faceGeometry,
  LANDMARK,
  measureCapture,
  shadingAsymmetry,
  type CaptureSample,
  type DetectedFace,
  type PixelFrame,
} from '../features/local-optics/opticsMetrics';

// SIMULATED inputs: geometric landmark sets and synthetic pixel frames. They test the arithmetic
// and the honesty rules, not the landmark model or a real camera.

const W = 360;
const H = 270;

interface FaceSpec {
  cx?: number; // normalized
  cy?: number;
  iod?: number; // outer-eye distance as a fraction of frame width
  rollDeg?: number;
  yawDeg?: number;
  pitchDeg?: number;
  jitter?: number; // pixels
  seed?: number;
}

function rotationMatrix(yawDeg: number, pitchDeg: number, rollDeg: number): number[] {
  const [y, p, r] = [yawDeg, pitchDeg, rollDeg].map((d) => (d * Math.PI) / 180);
  const Rx = [
    [1, 0, 0],
    [0, Math.cos(p), -Math.sin(p)],
    [0, Math.sin(p), Math.cos(p)],
  ];
  const Ry = [
    [Math.cos(y), 0, Math.sin(y)],
    [0, 1, 0],
    [-Math.sin(y), 0, Math.cos(y)],
  ];
  const Rz = [
    [Math.cos(r), -Math.sin(r), 0],
    [Math.sin(r), Math.cos(r), 0],
    [0, 0, 1],
  ];
  const mul = (a: number[][], b: number[][]) =>
    a.map((row, i) => b[0].map((_, j) => row.reduce((s, _v, k) => s + a[i][k] * b[k][j], 0)));
  const R = mul(mul(Rz, Ry), Rx);
  // column-major 4x4
  return [R[0][0], R[1][0], R[2][0], 0, R[0][1], R[1][1], R[2][1], 0, R[0][2], R[1][2], R[2][2], 0, 0, 0, 0, 1];
}

function face({ cx = 0.5, cy = 0.5, iod = 0.25, rollDeg = 0, yawDeg = 0, pitchDeg = 0, jitter = 0, seed = 1 }: FaceSpec = {}): DetectedFace {
  const iodPx = iod * W;
  const centerX = cx * W;
  const centerY = cy * H;
  const roll = (rollDeg * Math.PI) / 180;
  let state = seed;
  const noise = () => {
    state = (state * 16807) % 2147483647;
    return ((state / 2147483647) * 2 - 1) * jitter;
  };
  const place = (dx: number, dy: number) => {
    const x = centerX + dx * Math.cos(roll) - dy * Math.sin(roll) + noise();
    const y = centerY + dx * Math.sin(roll) + dy * Math.cos(roll) + noise();
    return { x: x / W, y: y / H, z: 0 };
  };
  const points = Array.from({ length: FACE_LANDMARK_COUNT }, (_, i) => {
    const t = (i / FACE_LANDMARK_COUNT) * Math.PI * 2;
    return place(Math.cos(t) * iodPx * 0.75, Math.sin(t) * iodPx * 0.95);
  });
  points[LANDMARK.rightEyeOuter] = place(-iodPx / 2, -iodPx * 0.15);
  points[LANDMARK.leftEyeOuter] = place(iodPx / 2, -iodPx * 0.15);
  return { points, matrix: rotationMatrix(yawDeg, pitchDeg, rollDeg) };
}

type RGB = [number, number, number];
function frame(paint: (x: number, y: number) => RGB): PixelFrame {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const [r, g, b] = paint(x / W, y / H);
      const i = (y * W + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { width: W, height: H, data };
}

const inBox = (f: DetectedFace, x: number, y: number) => {
  const g = faceGeometry(f, W, H);
  return x >= g.box.left && x <= g.box.right && y >= g.box.top && y <= g.box.bottom;
};

/** A scene: neutral grey background, a face region painted with `skin`. */
const scene = (f: DetectedFace, skin: RGB = [180, 140, 120], background: RGB = [120, 120, 120]) =>
  frame((x, y) => (inBox(f, x, y) ? skin : background));

const samples = (faces: (DetectedFace[] | null)[], pixels: (i: number) => PixelFrame): CaptureSample[] =>
  faces.map((f, i) => ({ landmarks: f === null ? null : { faces: f }, pixels: pixels(i) }));

const steady = (spec: FaceSpec = {}, n = 8, paint?: (f: DetectedFace) => PixelFrame) => {
  const f = face(spec);
  const px = paint ? paint(f) : scene(f);
  return measureCapture(samples(Array.from({ length: n }, () => [f]), () => px), { settings: {} });
};

describe('landmark geometry (simulated landmarks)', () => {
  it('measures size, position and in-image roll', () => {
    const g = faceGeometry(face({ cx: 0.4, cy: 0.55, iod: 0.3, rollDeg: 10 }), W, H);
    expect(g.interocularFraction).toBeCloseTo(0.3, 3);
    expect(g.centerX).toBeCloseTo(0.4, 2);
    expect(g.centerY).toBeCloseTo(0.55, 2);
    expect(g.rollDegrees).toBeCloseTo(10, 1);
    expect(g.outOfFrameFraction).toBe(0);
  });

  it('recovers yaw, pitch and roll from a transformation matrix', () => {
    const e = eulerFromMatrix(rotationMatrix(12, -7, 4));
    expect(e.yaw).toBeCloseTo(12, 6);
    expect(e.pitch).toBeCloseTo(-7, 6);
    expect(e.roll).toBeCloseTo(4, 6);
  });

  it('labels roll measured and yaw/pitch model-estimated', () => {
    const m = steady({ yawDeg: 6 });
    expect(m.rejections).toEqual([]);
    expect(m.roll.provenance).toBe('measured');
    expect(m.yaw).toMatchObject({ provenance: 'model_estimate' });
    expect(m.yaw.value).toBeCloseTo(6, 4);
  });

  it('yaw and pitch are unavailable, not zero, when the model gives no matrix', () => {
    const f = { ...face(), matrix: null };
    const m = measureCapture(samples(Array.from({ length: 6 }, () => [f]), () => scene(f)), { settings: {} });
    expect(m.yaw).toMatchObject({ value: null, provenance: 'unavailable' });
    expect(m.roll.provenance).toBe('measured');
  });
});

describe('capture gates', () => {
  it('missing face: rejected, nothing face-derived is measured', () => {
    const blank = frame(() => [120, 120, 120]);
    const m = measureCapture(samples(Array.from({ length: 6 }, () => []), () => blank), { settings: {} });
    expect(m.rejections).toContain('no_face');
    for (const key of ['roll', 'yaw', 'interocular', 'centerX', 'faceLuma', 'shadingAsymmetry', 'backgroundChroma'] as const) {
      expect(m[key].provenance).toBe('unavailable');
    }
    expect(m.frameLuma).toMatchObject({ provenance: 'measured', value: 120 });
  });

  it('multiple faces: rejected rather than picking one', () => {
    const a = face({ cx: 0.3 });
    const b = face({ cx: 0.7, seed: 2 });
    const m = measureCapture(samples([[a], [a, b], [a], [a], [a], [a]], () => scene(a)), { settings: {} });
    expect(m.rejections).toContain('multiple_faces');
    expect(m.interocular.provenance).toBe('unavailable');
  });

  it('a face that comes and goes is rejected as unstable', () => {
    const a = face();
    const m = measureCapture(samples([[a], [], [a], [a], [a], [a]], () => scene(a)), { settings: {} });
    expect(m.rejections).toContain('unstable_face_count');
  });

  it('no landmark model: landmark properties unavailable, pixel properties still measured', () => {
    const px = frame(() => [100, 100, 100]);
    const m = measureCapture(samples(Array.from({ length: 6 }, () => null), () => px), { settings: {} });
    expect(m.rejections).toEqual(['landmark_model_unavailable']);
    expect(m.faceCounts).toEqual([]); // unknown, not zero
    expect(m.roll).toMatchObject({ provenance: 'unavailable', note: 'Landmark model not loaded' });
    expect(m.frameLuma).toMatchObject({ provenance: 'measured', value: 100 });
    expect(m.pixelMotion).toMatchObject({ provenance: 'measured', value: 0 });
  });

  it('crop: a face past the frame edge is rejected and its margin is negative', () => {
    const m = steady({ cx: 0.92, iod: 0.3 });
    expect(m.rejections).toContain('face_out_of_frame');
    expect(m.edgeMargin.value!).toBeLessThan(0);
  });

  it('too few frames is a rejection', () => {
    expect(steady({}, 3).rejections).toContain('too_few_frames');
  });
});

describe('motion', () => {
  it('a still face measures near zero; a jittering face is rejected', () => {
    const still = steady();
    expect(still.landmarkMotion.value).toBeCloseTo(0, 6);
    const shaky = Array.from({ length: 8 }, (_, i) => [face({ jitter: 4, seed: i + 3 })]);
    const px = scene(face());
    const m = measureCapture(samples(shaky, () => px), { settings: {} });
    expect(m.landmarkMotion.value!).toBeGreaterThan(0.02);
    expect(m.rejections).toContain('motion');
  });

  it('pixel motion measures whole-frame change', () => {
    const dark = frame(() => [50, 50, 50]);
    const light = frame(() => [90, 90, 90]);
    const m = measureCapture(samples(Array.from({ length: 6 }, () => null), (i) => (i % 2 ? dark : light)), { settings: {} });
    expect(m.pixelMotion.value).toBeCloseTo(40, 1);
  });
});

describe('lighting and colour limits', () => {
  it('face brightness and clipping come from the face region only', () => {
    const m = steady({}, 6, (f) => scene(f, [200, 200, 200], [20, 20, 20]));
    // The face box is a rectangle, so a few background pixels at its corners are included.
    expect(m.faceLuma.value!).toBeGreaterThan(190);
    expect(m.frameLuma.value!).toBeLessThan(200);
    const clipped = steady({}, 6, (f) => scene(f, [255, 255, 255]));
    expect(clipped.rejections).toContain('clipped_highlights');
  });

  it('side shading has a sign: brighter image-left is positive', () => {
    const f = face();
    const g = faceGeometry(f, W, H);
    const mid = (g.box.left + g.box.right) / 2;
    const px = frame((x) => (x < mid ? [180, 180, 180] : [90, 90, 90]));
    expect(shadingAsymmetry(px, g.box)!).toBeCloseTo(1 / 3, 2);
  });

  it('scene colour is estimated from outside the face, never from skin', () => {
    const f = face();
    const g = faceGeometry(f, W, H);
    const neutral = backgroundChromaticityEstimate(scene(f, [220, 90, 60], [120, 120, 120]), g.box)!;
    expect(neutral.r).toBeCloseTo(1 / 3, 3);
    expect(neutral.g).toBeCloseTo(1 / 3, 3);
    const otherSkin = backgroundChromaticityEstimate(scene(f, [90, 70, 60], [120, 120, 120]), g.box)!;
    expect(otherSkin.r).toBeCloseTo(neutral.r, 6);
  });

  it('scene colour is unavailable when the face leaves no background', () => {
    const f = face({ iod: 0.62 });
    expect(backgroundChromaticityEstimate(scene(f), faceGeometry(f, W, H).box)).toBeNull();
  });

  it('colour cast is always unavailable; scene colour is only an estimate', () => {
    const m = steady();
    expect(m.colorCast).toMatchObject({ value: null, provenance: 'unavailable' });
    expect(m.colorCast.note).toMatch(/neutral reference/);
    expect(m.backgroundChroma.provenance).toBe('estimate');
  });
});

describe('comparing two captures', () => {
  it('identical captures are within experimental tolerances, with colour cast not assessed', () => {
    const c = compareCaptures(steady(), steady());
    expect(c.overall).toBe('within_experimental_tolerances');
    expect(c.notAssessed.join(' ')).toMatch(/Colour cast/);
    expect(c.tolerancesVersion).toMatch(/unvalidated/);
  });

  it('pose, size, position and brightness changes are named', () => {
    const c = compareCaptures(
      steady(),
      steady({ rollDeg: 9, yawDeg: 12, iod: 0.3, cx: 0.58 }, 8, (f) => scene(f, [120, 95, 80])),
    );
    expect(c.overall).toBe('not_comparable');
    const outside = c.rows.filter((r) => r.status === 'outside_experimental_tolerance').map((r) => r.property);
    expect(outside).toEqual(expect.arrayContaining(['Roll', 'Yaw', 'Apparent size', 'Horizontal position', 'Face brightness']));
  });

  it('estimates are shown without a tolerance verdict', () => {
    const c = compareCaptures(steady(), steady({}, 8, (f) => scene(f, undefined, [150, 110, 90])));
    const chroma = c.rows.filter((r) => r.property.startsWith('Background chromaticity'));
    expect(chroma.every((r) => r.status === 'shown_without_tolerance')).toBe(true);
    expect(c.overall).toBe('within_experimental_tolerances');
  });

  it('a property measured on only one side is never within tolerance', () => {
    const noModel = measureCapture(samples(Array.from({ length: 6 }, () => null), () => frame(() => [120, 120, 120])), {
      settings: {},
    });
    const c = compareCaptures(steady(), noModel);
    expect(c.overall).toBe('not_comparable');
    for (const property of ['Roll', 'Yaw', 'Apparent size', 'Face brightness']) {
      expect(c.rows.find((r) => r.property === property)?.status).toBe('not_measured');
    }
    expect(c.reasons).toContain('Comparison rejected: landmark_model_unavailable');
  });

  it('no face on either side is not comparable, never within tolerance', () => {
    const blank = frame(() => [120, 120, 120]);
    const none = measureCapture(samples(Array.from({ length: 6 }, () => []), () => blank), { settings: {} });
    const c = compareCaptures(none, none);
    expect(c.overall).toBe('not_comparable');
    expect(c.rows.some((r) => r.status === 'within_experimental_tolerance')).toBe(false);
  });
});
