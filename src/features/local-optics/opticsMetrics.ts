/**
 * Local optical comparability: EXPERIMENTAL measurement of capture conditions.
 *
 * Pure functions over (a) face landmarks from a browser-local model and (b) camera-processed
 * pixels. Nothing here is connected to the production evaluator, YouCam thresholds, or any
 * verdict. Tolerances are exploratory and unvalidated; they exist so differences can be read,
 * not so a capture can be certified.
 */

export const LOCAL_OPTICS_METRICS_VERSION = 'fv-local-optics-metrics-0.1';
export const LOCAL_OPTICS_TOLERANCES_VERSION = 'fv-local-optics-tolerances-0.1-unvalidated';

/** How a value was obtained. Only `measured` and `model_estimate` can support a tolerance check. */
export type Provenance = 'measured' | 'model_estimate' | 'estimate' | 'reported' | 'unavailable';

export interface Point3 {
  x: number; // normalized 0..1 across frame width
  y: number; // normalized 0..1 across frame height
  z: number;
}

export interface DetectedFace {
  points: Point3[];
  /** 4x4 facial transformation matrix, column-major, when the model provides one. */
  matrix: number[] | null;
}

export interface LandmarkFrame {
  faces: DetectedFace[];
}

/** Minimal pixel buffer, same layout as ImageData (RGBA, row-major). */
export interface PixelFrame {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface FaceBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// MediaPipe Face Mesh topology indices (478-point Face Landmarker output).
export const LANDMARK = {
  rightEyeOuter: 33,
  leftEyeOuter: 263,
  noseTip: 1,
  chin: 152,
  forehead: 10,
} as const;
export const FACE_LANDMARK_COUNT = 478;

export interface FaceGeometry {
  box: FaceBox;
  /** Fraction of landmarks outside the frame. Greater than 0 means the face is cut off. */
  outOfFrameFraction: number;
  centerX: number;
  centerY: number;
  /** Smallest distance from the face box to a frame edge, normalized. Negative when cut off. */
  edgeMargin: number;
  /** Outer-eye-corner distance as a fraction of frame width. */
  interocularFraction: number;
  faceHeightFraction: number;
  /** In-image head roll from the eye line, degrees. Measured from landmark positions. */
  rollDegrees: number;
  /** Model-estimated head rotation from the transformation matrix, degrees. */
  yawDegrees: number | null;
  pitchDegrees: number | null;
}

const degrees = (radians: number) => (radians * 180) / Math.PI;

export function faceBox(points: Point3[]): FaceBox {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const p of points) {
    left = Math.min(left, p.x);
    right = Math.max(right, p.x);
    top = Math.min(top, p.y);
    bottom = Math.max(bottom, p.y);
  }
  return { left, top, right, bottom };
}

/**
 * Euler angles from a column-major 4x4 rotation, using R = Rz(roll) * Ry(yaw) * Rx(pitch).
 * Only differences between captures are compared, so a consistent convention matters more than
 * the absolute sign, which has not been verified against MediaPipe on a device.
 */
export function eulerFromMatrix(matrix: number[]): { yaw: number; pitch: number; roll: number } {
  const r00 = matrix[0];
  const r10 = matrix[1];
  const r20 = matrix[2];
  const r21 = matrix[6];
  const r22 = matrix[10];
  return {
    yaw: degrees(Math.asin(Math.max(-1, Math.min(1, -r20)))),
    pitch: degrees(Math.atan2(r21, r22)),
    roll: degrees(Math.atan2(r10, r00)),
  };
}

export function faceGeometry(face: DetectedFace, frameWidth: number, frameHeight: number): FaceGeometry {
  const box = faceBox(face.points);
  const outside = face.points.filter((p) => p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1).length;
  const right = face.points[LANDMARK.rightEyeOuter];
  const left = face.points[LANDMARK.leftEyeOuter];
  const dx = (left.x - right.x) * frameWidth;
  const dy = (left.y - right.y) * frameHeight;
  const euler = face.matrix ? eulerFromMatrix(face.matrix) : null;
  return {
    box,
    outOfFrameFraction: outside / face.points.length,
    centerX: (box.left + box.right) / 2,
    centerY: (box.top + box.bottom) / 2,
    edgeMargin: Math.min(box.left, box.top, 1 - box.right, 1 - box.bottom),
    interocularFraction: Math.hypot(dx, dy) / frameWidth,
    faceHeightFraction: box.bottom - box.top,
    rollDegrees: degrees(Math.atan2(dy, dx)),
    yawDegrees: euler?.yaw ?? null,
    pitchDegrees: euler?.pitch ?? null,
  };
}

/** Root-mean-square landmark displacement between consecutive frames, in interocular units. */
export function landmarkMotion(frames: DetectedFace[], frameWidth: number, frameHeight: number): number | null {
  if (frames.length < 2) return null;
  let total = 0;
  let pairs = 0;
  for (let i = 1; i < frames.length; i += 1) {
    const a = frames[i - 1].points;
    const b = frames[i].points;
    if (a.length !== b.length || a.length === 0) return null;
    const iod = faceGeometry(frames[i], frameWidth, frameHeight).interocularFraction * frameWidth;
    if (!(iod > 0)) return null;
    let sum = 0;
    for (let j = 0; j < a.length; j += 1) {
      const dx = (b[j].x - a[j].x) * frameWidth;
      const dy = (b[j].y - a[j].y) * frameHeight;
      sum += dx * dx + dy * dy;
    }
    total += Math.sqrt(sum / a.length) / iod;
    pairs += 1;
  }
  return total / pairs;
}

// ---------- Pixels ----------

/** Relative luma of camera-processed (gamma-encoded) sRGB values, 0..255. Not illuminance. */
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export interface RegionLight {
  pixelCount: number;
  meanLuma: number;
  lumaSpread: number;
  clippedHighlightFraction: number;
  crushedShadowFraction: number;
}

type Region = { left: number; top: number; right: number; bottom: number };

function forEachPixel(
  frame: PixelFrame,
  region: Region,
  visit: (r: number, g: number, b: number, x: number) => void,
  exclude?: Region,
) {
  const x0 = Math.max(0, Math.floor(region.left * frame.width));
  const x1 = Math.min(frame.width, Math.ceil(region.right * frame.width));
  const y0 = Math.max(0, Math.floor(region.top * frame.height));
  const y1 = Math.min(frame.height, Math.ceil(region.bottom * frame.height));
  const ex = exclude && {
    x0: Math.floor(exclude.left * frame.width),
    x1: Math.ceil(exclude.right * frame.width),
    y0: Math.floor(exclude.top * frame.height),
    y1: Math.ceil(exclude.bottom * frame.height),
  };
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if (ex && x >= ex.x0 && x < ex.x1 && y >= ex.y0 && y < ex.y1) continue;
      const i = (y * frame.width + x) * 4;
      visit(frame.data[i], frame.data[i + 1], frame.data[i + 2], x);
    }
  }
}

export function regionLight(frame: PixelFrame, region: Region): RegionLight | null {
  let n = 0;
  let sum = 0;
  let sumSq = 0;
  let clipped = 0;
  let crushed = 0;
  forEachPixel(frame, region, (r, g, b) => {
    const l = luma(r, g, b);
    n += 1;
    sum += l;
    sumSq += l * l;
    if (r >= 250 || g >= 250 || b >= 250) clipped += 1;
    if (l <= 5) crushed += 1;
  });
  if (n === 0) return null;
  const mean = sum / n;
  return {
    pixelCount: n,
    meanLuma: mean,
    lumaSpread: Math.sqrt(Math.max(0, sumSq / n - mean * mean)),
    clippedHighlightFraction: clipped / n,
    crushedShadowFraction: crushed / n,
  };
}

/**
 * Left/right shading imbalance across the face box: (left - right) / (left + right), using image
 * left and right. A proxy for side lighting on processed pixels, not a light-direction estimate.
 */
export function shadingAsymmetry(frame: PixelFrame, box: FaceBox): number | null {
  const mid = (box.left + box.right) / 2;
  const left = regionLight(frame, { ...box, right: mid });
  const right = regionLight(frame, { ...box, left: mid });
  if (!left || !right || left.meanLuma + right.meanLuma === 0) return null;
  return (left.meanLuma - right.meanLuma) / (left.meanLuma + right.meanLuma);
}

/**
 * Mean rg-chromaticity of the scene OUTSIDE an expanded face box. This is an estimate of scene
 * colour: it moves with background content and automatic white balance. It never uses skin
 * pixels, and it is not a colour-cast measurement (that needs a neutral reference in frame).
 */
export function backgroundChromaticityEstimate(
  frame: PixelFrame,
  box: FaceBox,
): { r: number; g: number; pixelCount: number } | null {
  const pad = 0.08;
  const exclude = {
    left: box.left - pad,
    top: box.top - pad,
    right: box.right + pad,
    bottom: Math.max(box.bottom + pad, 1), // neck and clothing below the face are excluded too
  };
  let n = 0;
  let rs = 0;
  let gs = 0;
  forEachPixel(
    frame,
    { left: 0, top: 0, right: 1, bottom: 1 },
    (r, g, b) => {
      const s = r + g + b;
      if (s < 30 || r >= 250 || g >= 250 || b >= 250) return; // too dark or clipped to carry chroma
      rs += r / s;
      gs += g / s;
      n += 1;
    },
    exclude,
  );
  const minimum = frame.width * frame.height * 0.05;
  if (n < minimum) return null;
  return { r: rs / n, g: gs / n, pixelCount: n };
}

/** Mean absolute luma change between two equally sized frames (whole frame), 0..255. */
export function frameDifference(a: PixelFrame, b: PixelFrame): number | null {
  if (a.width !== b.width || a.height !== b.height) return null;
  let sum = 0;
  const n = a.width * a.height;
  for (let i = 0; i < n * 4; i += 4) {
    sum += Math.abs(luma(a.data[i], a.data[i + 1], a.data[i + 2]) - luma(b.data[i], b.data[i + 1], b.data[i + 2]));
  }
  return sum / n;
}

// ---------- One capture ----------

export interface CameraReport {
  /** Settings the browser reported for the track. Keys absent here were not exposed. */
  settings: Record<string, string | number | boolean>;
}

export interface CaptureSample {
  landmarks: LandmarkFrame | null; // null when no landmark model is loaded
  pixels: PixelFrame;
}

export type RejectionReason =
  | 'landmark_model_unavailable'
  | 'no_face'
  | 'multiple_faces'
  | 'face_out_of_frame'
  | 'unstable_face_count'
  | 'motion'
  | 'clipped_highlights'
  | 'too_few_frames';

export interface Measured<T> {
  value: T | null;
  provenance: Provenance;
  note?: string;
}

export interface CaptureMeasurement {
  version: typeof LOCAL_OPTICS_METRICS_VERSION;
  frameCount: number;
  frameSize: { width: number; height: number };
  faceCounts: number[];
  rejections: RejectionReason[];
  roll: Measured<number>;
  yaw: Measured<number>;
  pitch: Measured<number>;
  interocular: Measured<number>;
  faceHeight: Measured<number>;
  centerX: Measured<number>;
  centerY: Measured<number>;
  edgeMargin: Measured<number>;
  landmarkMotion: Measured<number>;
  pixelMotion: Measured<number>;
  faceLuma: Measured<number>;
  faceLumaSpread: Measured<number>;
  faceClipped: Measured<number>;
  shadingAsymmetry: Measured<number>;
  frameLuma: Measured<number>;
  backgroundChroma: Measured<{ r: number; g: number }>;
  colorCast: Measured<never>;
  camera: CameraReport;
}

export const EXPERIMENTAL_TOLERANCES = {
  version: LOCAL_OPTICS_TOLERANCES_VERSION,
  // Per-capture gates
  maxLandmarkMotion: 0.02, // interocular units per frame, RMS
  maxFaceClippedFraction: 0.02,
  minFrames: 5,
  // Between-capture differences
  rollDegrees: 5,
  yawDegrees: 8,
  pitchDegrees: 8,
  interocularRelative: 0.1,
  centerOffset: 0.06,
  faceLumaRelative: 0.15,
  shadingAsymmetry: 0.1,
} as const;

const median = (values: number[]): number | null => {
  const finite = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (finite.length === 0) return null;
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[mid] : (finite[mid - 1] + finite[mid]) / 2;
};

const unavailable = <T,>(note: string): Measured<T> => ({ value: null, provenance: 'unavailable', note });

export function measureCapture(samples: CaptureSample[], camera: CameraReport): CaptureMeasurement {
  const first = samples[0]?.pixels;
  const width = first?.width ?? 0;
  const height = first?.height ?? 0;
  const modelLoaded = samples.length > 0 && samples.every((s) => s.landmarks !== null);
  // Face counts exist only where a landmark model looked; without one they are unknown, not zero.
  const faceCounts = modelLoaded ? samples.map((s) => s.landmarks!.faces.length) : [];
  const rejections = new Set<RejectionReason>();
  if (samples.length < EXPERIMENTAL_TOLERANCES.minFrames) rejections.add('too_few_frames');
  if (!modelLoaded) rejections.add('landmark_model_unavailable');

  const single = modelLoaded && faceCounts.every((c) => c === 1);
  if (modelLoaded) {
    if (faceCounts.every((c) => c === 0)) rejections.add('no_face');
    else if (faceCounts.some((c) => c > 1)) rejections.add('multiple_faces');
    else if (!single) rejections.add('unstable_face_count');
  }

  const faces = single ? samples.map((s) => s.landmarks!.faces[0]) : [];
  const geometry = faces.map((f) => faceGeometry(f, width, height));
  if (geometry.some((g) => g.outOfFrameFraction > 0)) rejections.add('face_out_of_frame');

  const noFace = single ? undefined : modelLoaded ? 'No single stable face in every frame' : 'Landmark model not loaded';
  const fromGeometry = (pick: (g: FaceGeometry) => number | null, provenance: Provenance): Measured<number> => {
    if (!single) return unavailable(noFace!);
    const value = median(geometry.map(pick).filter((v): v is number => v !== null));
    return value === null ? unavailable('Model did not provide this value') : { value, provenance };
  };

  const motion = single ? landmarkMotion(faces, width, height) : null;
  if (motion !== null && motion > EXPERIMENTAL_TOLERANCES.maxLandmarkMotion) rejections.add('motion');

  const diffs: number[] = [];
  for (let i = 1; i < samples.length; i += 1) {
    const d = frameDifference(samples[i - 1].pixels, samples[i].pixels);
    if (d !== null) diffs.push(d);
  }

  const lastPixels = samples.at(-1)?.pixels;
  const lastBox = geometry.at(-1)?.box;
  const faceLights = single
    ? samples.map((s, i) => regionLight(s.pixels, geometry[i].box)).filter((l): l is RegionLight => l !== null)
    : [];
  const faceClipped = median(faceLights.map((l) => l.clippedHighlightFraction));
  if (faceClipped !== null && faceClipped > EXPERIMENTAL_TOLERANCES.maxFaceClippedFraction) {
    rejections.add('clipped_highlights');
  }
  const asymmetries = single
    ? samples.map((s, i) => shadingAsymmetry(s.pixels, geometry[i].box)).filter((v): v is number => v !== null)
    : [];
  const frameLights = samples
    .map((s) => regionLight(s.pixels, { left: 0, top: 0, right: 1, bottom: 1 }))
    .filter((l): l is RegionLight => l !== null);
  const chroma = lastPixels && lastBox ? backgroundChromaticityEstimate(lastPixels, lastBox) : null;

  const lightNote = 'Camera-processed pixels with automatic exposure; relative, not illuminance';
  const value = (v: number | null, provenance: Provenance, note: string, missing: string): Measured<number> =>
    v === null ? unavailable(missing) : { value: v, provenance, note };

  return {
    version: LOCAL_OPTICS_METRICS_VERSION,
    frameCount: samples.length,
    frameSize: { width, height },
    faceCounts,
    rejections: [...rejections],
    roll: fromGeometry((g) => g.rollDegrees, 'measured'),
    yaw: fromGeometry((g) => g.yawDegrees, 'model_estimate'),
    pitch: fromGeometry((g) => g.pitchDegrees, 'model_estimate'),
    interocular: fromGeometry((g) => g.interocularFraction, 'measured'),
    faceHeight: fromGeometry((g) => g.faceHeightFraction, 'measured'),
    centerX: fromGeometry((g) => g.centerX, 'measured'),
    centerY: fromGeometry((g) => g.centerY, 'measured'),
    edgeMargin: fromGeometry((g) => g.edgeMargin, 'measured'),
    landmarkMotion: value(motion, 'measured', 'RMS landmark movement per frame', noFace ?? 'Fewer than two frames'),
    pixelMotion: value(
      median(diffs),
      'measured',
      'Whole-frame change; mixes subject, camera, scene and exposure changes',
      'Fewer than two frames',
    ),
    faceLuma: value(median(faceLights.map((l) => l.meanLuma)), 'measured', lightNote, noFace ?? 'No face region'),
    faceLumaSpread: value(median(faceLights.map((l) => l.lumaSpread)), 'measured', lightNote, noFace ?? 'No face region'),
    faceClipped: value(faceClipped, 'measured', 'Share of face pixels with a channel at 250 or above', noFace ?? 'No face region'),
    shadingAsymmetry: value(median(asymmetries), 'measured', 'Image-left vs image-right face luma; a side-light proxy', noFace ?? 'No face region'),
    frameLuma: value(median(frameLights.map((l) => l.meanLuma)), 'measured', lightNote, 'No frames'),
    backgroundChroma: chroma
      ? {
          value: { r: chroma.r, g: chroma.g },
          provenance: 'estimate',
          note: 'Scene outside the face; moves with background content and auto white balance',
        }
      : unavailable(single ? 'Too little usable background' : (noFace ?? 'No face region to exclude')),
    colorCast: unavailable('Needs a neutral reference target in frame; skin colour is never used'),
    camera,
  };
}

// ---------- Two captures ----------

export type ComparisonStatus =
  | 'within_experimental_tolerance'
  | 'outside_experimental_tolerance'
  | 'shown_without_tolerance'
  | 'not_measured';

export interface ComparisonRow {
  property: string;
  provenance: Provenance;
  baseline: number | null;
  comparison: number | null;
  difference: number | null;
  tolerance: number | null;
  status: ComparisonStatus;
  note?: string;
}

export interface CaptureComparison {
  metricsVersion: typeof LOCAL_OPTICS_METRICS_VERSION;
  tolerancesVersion: typeof LOCAL_OPTICS_TOLERANCES_VERSION;
  rows: ComparisonRow[];
  rejections: { baseline: RejectionReason[]; comparison: RejectionReason[] };
  /**
   * `not_comparable` when a capture was rejected or a measured property is outside tolerance;
   * `insufficient_evidence` when a required property could not be measured on both captures;
   * otherwise `within_experimental_tolerances` for the measured properties only.
   */
  overall: 'not_comparable' | 'insufficient_evidence' | 'within_experimental_tolerances';
  reasons: string[];
  notAssessed: string[];
}

const SUPPORTS_TOLERANCE: Provenance[] = ['measured', 'model_estimate'];

function row(
  property: string,
  a: Measured<number>,
  b: Measured<number>,
  tolerance: number | null,
  difference: (x: number, y: number) => number = (x, y) => y - x,
): ComparisonRow {
  const provenance = a.provenance === 'unavailable' ? b.provenance : a.provenance;
  if (a.value === null || b.value === null) {
    return {
      property,
      provenance: 'unavailable',
      baseline: a.value,
      comparison: b.value,
      difference: null,
      tolerance,
      status: 'not_measured',
      note: a.note ?? b.note,
    };
  }
  const d = difference(a.value, b.value);
  const checkable = tolerance !== null && SUPPORTS_TOLERANCE.includes(a.provenance) && SUPPORTS_TOLERANCE.includes(b.provenance);
  return {
    property,
    provenance,
    baseline: a.value,
    comparison: b.value,
    difference: d,
    tolerance,
    status: !checkable
      ? 'shown_without_tolerance'
      : Math.abs(d) <= tolerance
        ? 'within_experimental_tolerance'
        : 'outside_experimental_tolerance',
    note: a.note,
  };
}

const REQUIRED = ['Roll', 'Yaw', 'Pitch', 'Apparent size', 'Horizontal position', 'Vertical position', 'Face brightness', 'Side shading'];

export function compareCaptures(a: CaptureMeasurement, b: CaptureMeasurement): CaptureComparison {
  const t = EXPERIMENTAL_TOLERANCES;
  const relative = (x: number, y: number) => (x === 0 ? Infinity : (y - x) / x);
  const rows: ComparisonRow[] = [
    row('Roll', a.roll, b.roll, t.rollDegrees),
    row('Yaw', a.yaw, b.yaw, t.yawDegrees),
    row('Pitch', a.pitch, b.pitch, t.pitchDegrees),
    row('Apparent size', a.interocular, b.interocular, t.interocularRelative, relative),
    row('Horizontal position', a.centerX, b.centerX, t.centerOffset),
    row('Vertical position', a.centerY, b.centerY, t.centerOffset),
    row('Face brightness', a.faceLuma, b.faceLuma, t.faceLumaRelative, relative),
    row('Side shading', a.shadingAsymmetry, b.shadingAsymmetry, t.shadingAsymmetry),
    row('Face brightness spread', a.faceLumaSpread, b.faceLumaSpread, null),
    row('Whole-frame brightness', a.frameLuma, b.frameLuma, null),
    row('Background chromaticity r', pick(a.backgroundChroma, 'r'), pick(b.backgroundChroma, 'r'), null),
    row('Background chromaticity g', pick(a.backgroundChroma, 'g'), pick(b.backgroundChroma, 'g'), null),
  ];
  const reasons: string[] = [];
  for (const r of a.rejections) reasons.push(`Baseline rejected: ${r}`);
  for (const r of b.rejections) reasons.push(`Comparison rejected: ${r}`);
  for (const r of rows) if (r.status === 'outside_experimental_tolerance') reasons.push(`${r.property} outside experimental tolerance`);
  const missingRequired = rows.filter((r) => REQUIRED.includes(r.property) && r.status === 'not_measured');
  for (const r of missingRequired) reasons.push(`${r.property} not measured`);
  // A rotated or resized frame changes what every geometric value means.
  const frameChanged = a.frameSize.width !== b.frameSize.width || a.frameSize.height !== b.frameSize.height;
  if (frameChanged) {
    reasons.push(
      `Frame size or orientation changed (${a.frameSize.width}×${a.frameSize.height} → ${b.frameSize.width}×${b.frameSize.height})`,
    );
  }
  const rejected = a.rejections.length > 0 || b.rejections.length > 0 || frameChanged;
  const outside = rows.some((r) => r.status === 'outside_experimental_tolerance');
  return {
    metricsVersion: LOCAL_OPTICS_METRICS_VERSION,
    tolerancesVersion: LOCAL_OPTICS_TOLERANCES_VERSION,
    rows,
    rejections: { baseline: a.rejections, comparison: b.rejections },
    overall:
      rejected || outside ? 'not_comparable' : missingRequired.length > 0 ? 'insufficient_evidence' : 'within_experimental_tolerances',
    reasons,
    notAssessed: [
      'Colour cast (no neutral reference target in frame)',
      'Illuminance and light colour temperature (no photometric sensor access)',
      'Lens, focus and exposure settings unless the browser reported them',
    ],
  };
}

function pick(m: Measured<{ r: number; g: number }>, key: 'r' | 'g'): Measured<number> {
  return m.value === null ? { value: null, provenance: m.provenance, note: m.note } : { value: m.value[key], provenance: m.provenance, note: m.note };
}
