import { EXPERIMENTAL_TOLERANCES, type CaptureMeasurement } from './opticsMetrics';

// Live capture guidance for the Local Optics experiment.
//
// The guide turns live landmark-model readings into ONE instruction at a time and decides when an
// automatic burst may start. Its thresholds are guidance targets for framing a phone selfie, not
// quality gates: every burst is still judged by measureCapture's unchanged gates, and a follow-up
// is still judged by compareCaptures' unchanged experimental tolerances. Nothing here is a
// validated or clinical threshold.

export const GUIDE_VERSION = 'fv-guided-capture-guide-0.1-unvalidated';
export const BASELINE_TEMPLATE_VERSION = 'fv-guided-baseline-0.1';

/** One live model reading, derived from a single video frame and replaced by the next one. */
export interface Observation {
  t: number; // ms, monotonic
  frame: { width: number; height: number };
  faceCount: number;
  /** Present only when exactly one face is in view. */
  face: {
    centerX: number;
    centerY: number;
    /** Outer-eye distance as a fraction of frame width (the metric compareCaptures uses). */
    interocular: number;
    roll: number;
    yaw: number | null;
    pitch: number | null;
    edgeMargin: number;
    outOfFrame: boolean;
  } | null;
  /** RMS landmark speed since the previous reading, interocular distances per second. */
  speed: number | null;
  light: { faceLuma: number; clipped: number; shading: number | null } | null;
  /** Expected time between analysed frames in a burst on this device, ms. */
  frameIntervalMs: number;
}

/**
 * The minimum kept from an accepted baseline to guide a follow-up: framing, head pose and coarse
 * light, rounded. No landmarks, contours, facial proportions, pixels or device identifiers.
 */
export interface BaselineTemplate {
  version: typeof BASELINE_TEMPLATE_VERSION;
  orientation: 'portrait' | 'landscape';
  centerX: number;
  centerY: number;
  interocular: number;
  roll: number;
  yaw: number | null;
  pitch: number | null;
  faceLuma: number | null;
  shading: number | null;
}

export type InstructionId =
  | 'preparing'
  | 'looking'
  | 'no_face'
  | 'multiple_faces'
  | 'rotate'
  | 'move_back'
  | 'move_closer'
  | 'center'
  | 'level'
  | 'turn'
  | 'chin'
  | 'glare'
  | 'dark'
  | 'light_match'
  | 'side_light'
  | 'hold_still'
  | 'aligned';

export type GuideCategory = 'face' | 'alignment' | 'light' | 'stillness' | 'ready';

export interface Instruction {
  id: InstructionId;
  category: GuideCategory;
  title: string;
  detail: string;
}

export function instructionFor(id: InstructionId, followUp: boolean, baselineOrientation?: string): Instruction {
  const make = (category: GuideCategory, title: string, detail: string): Instruction => ({ id, category, title, detail });
  switch (id) {
    case 'preparing':
      return make('face', 'Preparing the face guide', 'This takes a moment the first time');
    case 'looking':
      return make('face', 'Looking for your face', 'Hold your phone at eye level');
    case 'no_face':
      return make('face', 'Bring your face into view', 'Face the screen in even light');
    case 'multiple_faces':
      return make('face', 'Only one face, please', 'Make sure no one else is in view');
    case 'rotate':
      return make(
        'alignment',
        baselineOrientation === 'landscape' ? 'Turn your phone sideways' : 'Turn your phone upright',
        'Hold it the way you did for your baseline',
      );
    case 'move_back':
      return make('alignment', 'Move back a little', followUp ? 'Fit your face to the outline' : 'Keep your whole face in view');
    case 'move_closer':
      return make('alignment', 'Move a little closer', followUp ? 'Fit your face to the outline' : 'Fill the outline with your face');
    case 'center':
      return make('alignment', 'Center your face', followUp ? 'Line it up with the outline' : 'Keep it inside the outline');
    case 'level':
      return make('alignment', 'Level your head', 'Keep your eyes level');
    case 'turn':
      return make('alignment', followUp ? 'Turn to match your baseline' : 'Face the camera', followUp ? 'Follow the arrow slightly' : 'Look straight at the screen');
    case 'chin':
      return make('alignment', followUp ? 'Adjust your chin' : 'Look straight ahead', followUp ? 'Match the angle of your baseline' : 'Keep your chin level');
    case 'glare':
      return make('light', 'Too much glare', 'Turn away from bright light');
    case 'dark':
      return make('light', 'Find more light', 'Face a window or a soft lamp');
    case 'light_match':
      return make('light', 'Lighting has changed', 'Use the same spot and light as your baseline');
    case 'side_light':
      return make('light', 'Light is coming from the side', 'Face the light the way you did before');
    case 'hold_still':
      return make('stillness', 'Hold still', 'Rest your elbows if you can');
    case 'aligned':
      return make('ready', 'Hold still', 'Capturing automatically');
  }
}

/** Band check with hysteresis: a value must clear `enter` to become OK and leave `keep` to fail. */
interface Band {
  enter: number;
  keep: number;
}

export const GUIDE = {
  version: GUIDE_VERSION,
  // Timing
  dwellMs: 450, // a new instruction must be the top issue this long before it is shown…
  minShowMs: 900, // …and the shown one stays at least this long (unless the face is lost).
  lostFaceMs: 700, // no face this long before "Bring your face into view"
  stableMs: 800, // continuous aligned-and-still time before an automatic burst
  stableObservations: 5, // …and at least this many consecutive readings
  // First-scan framing (no baseline). Size is outer-eye distance over the frame's short side.
  size: { min: { enter: 0.22, keep: 0.2 }, max: { enter: 0.4, keep: 0.43 } },
  edgeMargin: { enter: 0.04, keep: 0.02 },
  centerX: { enter: 0.07, keep: 0.1 }, // |x − 0.5|
  centerY: { min: { enter: 0.36, keep: 0.33 }, max: { enter: 0.6, keep: 0.63 } },
  roll: { enter: 4, keep: 6 },
  yaw: { enter: 10, keep: 14 },
  pitch: { enter: 20, keep: 25 }, // model estimate; neutral is not 0 on every face, so only extremes
  // Light and stillness, for every scan. Glare stays inside measureCapture's clipped-highlight gate.
  clipped: { enter: EXPERIMENTAL_TOLERANCES.maxFaceClippedFraction * 0.75, keep: EXPERIMENTAL_TOLERANCES.maxFaceClippedFraction },
  minFaceLuma: { enter: 45, keep: 38 },
  // Stillness predicts measureCapture's motion gate (maxLandmarkMotion interocular distances per
  // ANALYSED frame): the speed at which one frame interval reaches the gate, with a margin.
  speedGateFraction: { enter: 0.65, keep: 0.85 },
  speedMedianOf: 3,
  // Follow-up matching: inside compareCaptures' experimental tolerances, with a margin to enter.
  match: {
    interocularRelative: { enter: EXPERIMENTAL_TOLERANCES.interocularRelative * 0.6, keep: EXPERIMENTAL_TOLERANCES.interocularRelative * 0.9 },
    center: { enter: EXPERIMENTAL_TOLERANCES.centerOffset * 0.65, keep: EXPERIMENTAL_TOLERANCES.centerOffset * 0.9 },
    roll: { enter: EXPERIMENTAL_TOLERANCES.rollDegrees * 0.7, keep: EXPERIMENTAL_TOLERANCES.rollDegrees * 0.9 },
    yaw: { enter: EXPERIMENTAL_TOLERANCES.yawDegrees * 0.75, keep: EXPERIMENTAL_TOLERANCES.yawDegrees * 0.9 },
    pitch: { enter: EXPERIMENTAL_TOLERANCES.pitchDegrees * 0.75, keep: EXPERIMENTAL_TOLERANCES.pitchDegrees * 0.9 },
    faceLumaRelative: { enter: EXPERIMENTAL_TOLERANCES.faceLumaRelative * 0.7, keep: EXPERIMENTAL_TOLERANCES.faceLumaRelative * 0.9 },
    shading: { enter: EXPERIMENTAL_TOLERANCES.shadingAsymmetry * 0.7, keep: EXPERIMENTAL_TOLERANCES.shadingAsymmetry * 0.9 },
  },
  // Default target outline for a first scan, in frame coordinates.
  target: { centerX: 0.5, centerY: 0.47, size: 0.3 },
} as const;

/** Where the outline should be and how the face differs from it, for the overlay. */
export interface GuideTarget {
  centerX: number;
  centerY: number;
  /** Outer-eye distance in pixels of the frame, for drawing a generic face-sized outline. */
  interocularPx: number;
  roll: number;
}

export interface GuideState {
  instruction: Instruction;
  /** True while every check passes (with hysteresis); the hold window is counting. */
  aligned: boolean;
  /** 0..1 progress through the stability window. */
  hold: number;
  /** True once: start an automatic burst now. */
  fire: boolean;
  /** Failing checks this reading, by category, for the light / alignment / stillness rail. */
  blocking: Record<'alignment' | 'light' | 'stillness', boolean>;
  target: GuideTarget | null;
  /** Direction from the face to the outline in the MIRRORED preview (−1..1 per axis), when off. */
  nudge: { x: number; y: number } | null;
  corrections: number;
  shown: InstructionId[];
}

/** Landmark speed (interocular distances per second) at which one analysed frame meets the motion gate. */
export function gateSpeedFor(frameIntervalMs: number): number {
  return EXPERIMENTAL_TOLERANCES.maxLandmarkMotion / (Math.max(1000 / 120, frameIntervalMs) / 1000);
}

const orientationOf = (frame: { width: number; height: number }) => (frame.height >= frame.width ? 'portrait' : 'landscape');

const round = (value: number | null, digits: number) =>
  value === null || !Number.isFinite(value) ? null : Math.round(value * 10 ** digits) / 10 ** digits;

/** Builds the follow-up template from an ACCEPTED capture's medians. */
export function baselineTemplate(m: CaptureMeasurement): BaselineTemplate | null {
  if (m.rejections.length > 0) return null;
  const { centerX, centerY, interocular, roll } = m;
  if (centerX.value === null || centerY.value === null || interocular.value === null || roll.value === null) return null;
  return {
    version: BASELINE_TEMPLATE_VERSION,
    orientation: orientationOf(m.frameSize),
    centerX: round(centerX.value, 3)!,
    centerY: round(centerY.value, 3)!,
    interocular: round(interocular.value, 3)!,
    roll: round(roll.value, 1)!,
    yaw: round(m.yaw.value, 1),
    pitch: round(m.pitch.value, 1),
    faceLuma: round(m.faceLuma.value, 0),
    shading: round(m.shadingAsymmetry.value, 3),
  };
}

/**
 * What a follow-up comparison needs from the baseline measurement and nothing more: face-box
 * height and edge margin (which together with size and position describe facial proportions)
 * are dropped.
 */
export function retainedBaselineMeasurement(m: CaptureMeasurement): CaptureMeasurement {
  return {
    ...m,
    faceHeight: { value: null, provenance: 'unavailable', note: 'Not retained for the baseline' },
    edgeMargin: { value: null, provenance: 'unavailable', note: 'Not retained for the baseline' },
  };
}

type CheckId = Exclude<InstructionId, 'preparing' | 'looking' | 'no_face' | 'multiple_faces' | 'aligned'>;

const PRIORITY: CheckId[] = [
  'rotate',
  'move_back',
  'move_closer',
  'center',
  'level',
  'turn',
  'chin',
  'glare',
  'dark',
  'light_match',
  'side_light',
  'hold_still',
];

const CATEGORY: Record<CheckId, 'alignment' | 'light' | 'stillness'> = {
  rotate: 'alignment',
  move_back: 'alignment',
  move_closer: 'alignment',
  center: 'alignment',
  level: 'alignment',
  turn: 'alignment',
  chin: 'alignment',
  glare: 'light',
  dark: 'light',
  light_match: 'light',
  side_light: 'light',
  hold_still: 'stillness',
};

const CORRECTIVE = new Set<InstructionId>([...PRIORITY, 'no_face', 'multiple_faces']);

/**
 * Stateful guide. Feed it every live observation; it returns one stable instruction, the hold
 * progress, and `fire` exactly once when the stability window completes.
 */
export class CaptureGuide {
  private ok = new Map<string, boolean>();
  private shownId: InstructionId = 'looking';
  private shownAt = -Infinity;
  private candidate: InstructionId | null = null;
  private candidateSince = 0;
  private lastFaceAt: number | null = null;
  private startedAt: number | null = null;
  private stableSince: number | null = null;
  private stableCount = 0;
  private fired = false;
  private correctionCount = 0;
  private shownLog: InstructionId[] = [];
  /** Recent landmark speeds; the stillness check uses their median to ignore single-reading jitter. */
  private speeds: number[] = [];

  constructor(private readonly baseline: BaselineTemplate | null = null) {}

  get followUp(): boolean {
    return this.baseline !== null;
  }

  /** Clears hold progress and hysteresis, e.g. after a burst, a pause or an orientation change. */
  reset(): void {
    this.ok.clear();
    this.speeds = [];
    this.stableSince = null;
    this.stableCount = 0;
    this.fired = false;
    this.candidate = null;
  }

  private band(key: string, value: number, limit: Band, comparison: 'max' | 'min' = 'max'): boolean {
    const was = this.ok.get(key) ?? false;
    const bound = was ? limit.keep : limit.enter;
    const pass = comparison === 'max' ? value <= bound : value >= bound;
    this.ok.set(key, pass);
    return pass;
  }

  private range(key: string, value: number, min: Band, max: Band): -1 | 0 | 1 {
    const low = this.band(`${key}:min`, value, min, 'min');
    const high = this.band(`${key}:max`, value, max, 'max');
    return !low ? -1 : !high ? 1 : 0;
  }

  /** Every check that currently fails, in priority order, plus overlay hints. */
  private failing(o: Observation): { failing: CheckId[]; target: GuideTarget; nudge: GuideState['nudge'] } {
    const face = o.face!;
    const failing: CheckId[] = [];
    const short = Math.min(o.frame.width, o.frame.height);
    const b = this.baseline;
    const sizeShort = (face.interocular * o.frame.width) / short;

    // Follow-up: the baseline's outline. First scan: the nearest acceptable framing to where the
    // face is now, so the outline closes around the face as soon as the framing is acceptable.
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    const target: GuideTarget = b
      ? { centerX: b.centerX, centerY: b.centerY, interocularPx: b.interocular * o.frame.width, roll: b.roll }
      : {
          centerX: clamp(face.centerX, 0.5 - GUIDE.centerX.enter, 0.5 + GUIDE.centerX.enter),
          centerY: clamp(face.centerY, GUIDE.centerY.min.enter, GUIDE.centerY.max.enter),
          interocularPx: clamp(sizeShort, GUIDE.size.min.enter, GUIDE.size.max.enter) * short,
          roll: 0,
        };

    if (b && orientationOf(o.frame) !== b.orientation) failing.push('rotate');

    // Size and cut-off. Any landmark outside the frame fails measureCapture's gate.
    if (face.outOfFrame || !this.band('edge', face.edgeMargin, GUIDE.edgeMargin, 'min')) failing.push('move_back');
    if (b) {
      const relative = (face.interocular - b.interocular) / b.interocular;
      if (!this.band('size', Math.abs(relative), GUIDE.match.interocularRelative)) {
        failing.push(relative > 0 ? 'move_back' : 'move_closer');
      }
    } else {
      const size = this.range('size', sizeShort, GUIDE.size.min, GUIDE.size.max);
      if (size === 1) failing.push('move_back');
      if (size === -1) failing.push('move_closer');
    }

    // Position.
    const dx = face.centerX - (b ? b.centerX : GUIDE.target.centerX);
    const dy = face.centerY - (b ? b.centerY : GUIDE.target.centerY);
    const centered = b
      ? this.band('cx', Math.abs(dx), GUIDE.match.center) && this.band('cy', Math.abs(dy), GUIDE.match.center)
      : this.band('cx', Math.abs(dx), GUIDE.centerX) &&
        this.range('cy', face.centerY, GUIDE.centerY.min, GUIDE.centerY.max) === 0;
    if (!centered) failing.push('center');

    // Head pose.
    if (!this.band('roll', Math.abs(face.roll - target.roll), b ? GUIDE.match.roll : GUIDE.roll)) failing.push('level');
    if (face.yaw !== null) {
      const yawTarget = b?.yaw ?? 0;
      if (!this.band('yaw', Math.abs(face.yaw - yawTarget), b ? GUIDE.match.yaw : GUIDE.yaw)) failing.push('turn');
    }
    if (face.pitch !== null) {
      const off = b?.pitch !== null && b?.pitch !== undefined ? Math.abs(face.pitch - b.pitch) : Math.abs(face.pitch);
      if (!this.band('pitch', off, b ? GUIDE.match.pitch : GUIDE.pitch)) failing.push('chin');
    }

    // Light.
    if (o.light) {
      if (!this.band('clipped', o.light.clipped, GUIDE.clipped)) failing.push('glare');
      if (!this.band('dark', o.light.faceLuma, GUIDE.minFaceLuma, 'min')) failing.push('dark');
      if (b?.faceLuma) {
        const relative = (o.light.faceLuma - b.faceLuma) / b.faceLuma;
        if (!this.band('luma', Math.abs(relative), GUIDE.match.faceLumaRelative)) failing.push('light_match');
      }
      if (b && b.shading !== null && o.light.shading !== null) {
        if (!this.band('shading', Math.abs(o.light.shading - b.shading), GUIDE.match.shading)) failing.push('side_light');
      }
    }

    // Stillness: the median of the last few speeds, so one jittery model reading neither passes nor
    // breaks the window on its own. Until two speeds exist, the phone does not count as still.
    if (o.speed !== null) this.speeds = [...this.speeds, o.speed].slice(-GUIDE.speedMedianOf);
    const sorted = [...this.speeds].sort((a, b) => a - b);
    const speed = sorted.length >= 2 ? sorted[Math.floor((sorted.length - 1) / 2)] : null;
    const gateSpeed = gateSpeedFor(o.frameIntervalMs);
    const speedBand = { enter: gateSpeed * GUIDE.speedGateFraction.enter, keep: gateSpeed * GUIDE.speedGateFraction.keep };
    if (speed === null || !this.band('speed', speed, speedBand)) failing.push('hold_still');

    // From the face toward the outline on screen. The preview is mirrored, so screen x runs 1 − x.
    const ox = face.centerX - target.centerX;
    const oy = face.centerY - target.centerY;
    const off = Math.hypot(ox, oy);
    const nudge = failing.includes('center') && off > 0 ? { x: ox / off, y: -oy / off } : null;
    return { failing: PRIORITY.filter((id) => failing.includes(id)), target, nudge };
  }

  update(o: Observation): GuideState {
    this.startedAt ??= o.t;
    let raw: InstructionId;
    let failing: CheckId[] = [];
    let target: GuideTarget | null = null;
    let nudge: GuideState['nudge'] = null;

    if (o.faceCount === 1 && o.face) {
      this.lastFaceAt = o.t;
      ({ failing, target, nudge } = this.failing(o));
      raw = failing[0] ?? 'aligned';
    } else {
      this.ok.clear();
      this.speeds = [];
      const sinceFace = o.t - (this.lastFaceAt ?? this.startedAt);
      raw = o.faceCount > 1 ? 'multiple_faces' : sinceFace >= GUIDE.lostFaceMs ? 'no_face' : this.lastFaceAt === null ? 'looking' : this.shownId;
    }

    // Stability window: consecutive aligned readings only. One failing reading starts it again.
    if (raw === 'aligned') {
      this.stableSince ??= o.t;
      this.stableCount += 1;
    } else {
      this.stableSince = null;
      this.stableCount = 0;
    }
    const held = this.stableSince === null ? 0 : o.t - this.stableSince;
    const hold = Math.min(1, Math.min(held / GUIDE.stableMs, this.stableCount / GUIDE.stableObservations));

    this.show(raw, o.t);
    // Fire only after "Hold still" has actually been on screen: never mid-correction.
    const fire = !this.fired && hold >= 1 && this.shownId === 'aligned';
    if (fire) this.fired = true;
    const blocking = { alignment: false, light: false, stillness: false };
    for (const id of failing) blocking[CATEGORY[id]] = true;
    return {
      instruction: instructionFor(this.shownId, this.followUp, this.baseline?.orientation),
      aligned: raw === 'aligned',
      hold,
      fire,
      blocking,
      target,
      nudge,
      corrections: this.correctionCount,
      shown: [...this.shownLog],
    };
  }

  /** Instruction hysteresis in time: dwell before switching, minimum display once switched. */
  private show(raw: InstructionId, t: number): void {
    if (raw === this.shownId) {
      this.candidate = null;
      return;
    }
    if (raw !== this.candidate) {
      this.candidate = raw;
      this.candidateSince = t;
    }
    const urgent = raw === 'no_face' || raw === 'multiple_faces' || raw === 'rotate';
    // Reaching alignment is acknowledged after the dwell alone; the stability window guards it.
    const settled = raw === 'aligned' || this.shownId === 'looking' || this.shownId === 'preparing';
    const dwell = urgent ? 0 : GUIDE.dwellMs;
    const displayed = t - this.shownAt;
    if (t - this.candidateSince >= dwell && (urgent || settled || displayed >= GUIDE.minShowMs)) {
      this.shownId = raw;
      this.shownAt = t;
      this.candidate = null;
      this.shownLog.push(raw);
      if (CORRECTIVE.has(raw)) this.correctionCount += 1;
    }
  }
}

/** Plain-language reasons for a rejected burst, most actionable first. */
export function rejectionMessage(reasons: CaptureMeasurement['rejections']): { title: string; detail: string } {
  if (reasons.includes('landmark_model_unavailable')) return { title: 'Face guide unavailable', detail: 'The face model is not running' };
  if (reasons.includes('no_face')) return { title: 'Your face left the view', detail: 'Keep your face in the outline' };
  if (reasons.includes('multiple_faces')) return { title: 'Another face was in view', detail: 'Make sure only you are in frame' };
  if (reasons.includes('unstable_face_count')) return { title: 'Your face was not steady in view', detail: 'Keep your face in the outline' };
  if (reasons.includes('face_out_of_frame')) return { title: 'Part of your face was cut off', detail: 'Move back a little' };
  if (reasons.includes('motion')) return { title: 'Too much movement', detail: 'Hold still for a moment longer' };
  if (reasons.includes('clipped_highlights')) return { title: 'Too much glare', detail: 'Turn away from bright light' };
  return { title: 'Capture was incomplete', detail: 'Try again' };
}

/** Plain-language reasons a follow-up did not match, from compareCaptures' rows. */
export function mismatchReasons(rows: { property: string; status: string }[]): string[] {
  const off = new Set(rows.filter((r) => r.status === 'outside_experimental_tolerance').map((r) => r.property));
  const reasons: string[] = [];
  if (off.has('Face brightness') || off.has('Side shading')) reasons.push('The light is different from your baseline');
  if (off.has('Apparent size')) reasons.push('Your distance from the camera changed');
  if (off.has('Horizontal position') || off.has('Vertical position')) reasons.push('Your face sat in a different spot');
  if (off.has('Roll') || off.has('Yaw') || off.has('Pitch')) reasons.push('Your head angle changed');
  return reasons;
}
