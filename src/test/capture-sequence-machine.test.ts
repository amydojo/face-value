import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CaptureIssue,
  CaptureQuality,
  CaptureSignalSample,
} from '../domain/captureAcquisition';
import {
  CAPTURE_GEOMETRY,
  CAPTURE_TIMING,
  calculateFaceOccupancy,
  createCaptureSequenceState,
  getCaptureInstruction,
  getHighestPriorityCaptureIssue,
  occupancyIssue,
  reduceCaptureSequence,
  type CaptureSequenceState,
} from '../features/capture-sequence';

const validQuality = (): CaptureQuality => ({
  facePresent: true,
  distanceValid: true,
  alignmentValid: true,
  angleValid: true,
  lightingValid: true,
  stillnessValid: true,
});

const validSample = (): CaptureSignalSample => ({
  quality: validQuality(),
  faceBounds: null,
  registeredRegions: [],
});

const sampleWith = (
  quality: Partial<CaptureQuality>,
  issues: Partial<Omit<CaptureSignalSample, 'quality'>> = {},
): CaptureSignalSample => ({
  ...validSample(),
  ...issues,
  quality: { ...validQuality(), ...quality },
});

describe('Face Value capture acquisition machine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const clock = () => performance.now();
  const tick = (state: CaptureSequenceState, milliseconds: number, reducedMotion = false) => {
    vi.advanceTimersByTime(milliseconds);
    return reduceCaptureSequence(state, { type: 'TICK', at: clock() }, { reducedMotion });
  };
  const signal = (
    state: CaptureSequenceState,
    sample: CaptureSignalSample,
    reducedMotion = false,
  ) =>
    reduceCaptureSequence(
      state,
      { type: 'SIGNALS_RECEIVED', sample, at: clock() },
      { reducedMotion },
    );

  const reachLocking = () => {
    let state = createCaptureSequenceState(clock());
    state = signal(state, validSample());
    state = tick(state, CAPTURE_TIMING.returnValidMs);
    state = tick(state, CAPTURE_TIMING.validHoldMs);
    expect(state.phase).toBe('locking');
    return state;
  };

  it('runs one deliberate searching → aligning → locking → scanning → captured ritual', () => {
    let state = createCaptureSequenceState(clock());
    state = signal(state, validSample());
    state = tick(state, CAPTURE_TIMING.returnValidMs - 1);
    expect(state.phase).toBe('searching');

    state = tick(state, 1);
    expect(state.phase).toBe('aligning');
    expect(state.validSince).toBe(clock());

    state = tick(state, CAPTURE_TIMING.validHoldMs - 1);
    expect(state.phase).toBe('aligning');
    state = tick(state, 1);
    expect(state.phase).toBe('locking');

    state = tick(state, CAPTURE_TIMING.guideConnectionMs + CAPTURE_TIMING.mechanicalPauseMs - 1);
    expect(state.phase).toBe('locking');
    state = tick(state, 1);
    expect(state.phase).toBe('scanning');

    state = reduceCaptureSequence(state, {
      type: 'CAPTURE_AVAILABLE',
      image: 'blob:synthetic-specimen',
      at: clock(),
    });
    state = tick(state, CAPTURE_TIMING.scanMs - 1);
    expect(state.phase).toBe('scanning');
    state = tick(state, 1);
    expect(state.phase).toBe('captured');
    expect(state.capturedImage).toBe('blob:synthetic-specimen');
    expect(state.handoffReady).toBe(false);

    state = tick(state, CAPTURE_TIMING.capturedHoldMs);
    expect(state.handoffReady).toBe(true);
  });

  it('debounces invalid input and requires longer hysteresis before returning valid', () => {
    let state = createCaptureSequenceState(clock());
    state = signal(state, validSample());
    state = tick(state, CAPTURE_TIMING.returnValidMs);
    expect(state.quality.facePresent).toBe(true);

    state = signal(state, sampleWith({ facePresent: false }));
    state = tick(state, CAPTURE_TIMING.enterInvalidMs - 1);
    expect(state.quality.facePresent).toBe(true);
    state = signal(state, validSample());
    state = tick(state, CAPTURE_TIMING.enterInvalidMs);
    expect(state.quality.facePresent).toBe(true);

    state = signal(state, sampleWith({ facePresent: false }));
    state = tick(state, CAPTURE_TIMING.enterInvalidMs);
    expect(state.quality.facePresent).toBe(false);
    state = signal(state, validSample());
    state = tick(state, CAPTURE_TIMING.returnValidMs - 1);
    expect(state.quality.facePresent).toBe(false);
    state = tick(state, 1);
    expect(state.quality.facePresent).toBe(true);
  });

  it('holds a specific issue until replacement guidance is stable', () => {
    let state = createCaptureSequenceState(clock());
    state = signal(
      state,
      sampleWith({ alignmentValid: false, stillnessValid: false }, { alignmentIssue: 'move-left' }),
    );
    state = tick(state, CAPTURE_TIMING.returnValidMs);
    state = tick(state, CAPTURE_TIMING.enterInvalidMs);
    expect(state.activeIssue).toBe('move-left');

    state = signal(
      state,
      sampleWith(
        { alignmentValid: false, stillnessValid: false },
        { alignmentIssue: 'move-right' },
      ),
    );
    state = tick(state, CAPTURE_TIMING.enterInvalidMs - 1);
    expect(state.activeIssue).toBe('move-left');
    state = tick(state, 1);
    expect(state.activeIssue).toBe('move-right');
  });

  it('ignores a brief lock flicker but cancels a meaningful lost frame', () => {
    let state = reachLocking();
    state = signal(state, sampleWith({ facePresent: false }));
    state = tick(state, CAPTURE_TIMING.loseLockMs - 1);
    expect(state.phase).toBe('locking');
    state = signal(state, validSample());
    state = tick(state, 10);
    expect(state.phase).toBe('locking');

    state = signal(state, sampleWith({ facePresent: false }));
    state = tick(state, CAPTURE_TIMING.loseLockMs);
    expect(state.phase).toBe('aligning');
    expect(state.frameLost).toBe(true);
    expect(getCaptureInstruction(state)).toEqual({
      primary: 'Frame lost',
      secondary: 'Return to the guide',
    });
  });

  it('cancels scanning and discards a pending bitmap when reliable capture is lost', () => {
    let state = reachLocking();
    state = tick(state, CAPTURE_TIMING.guideConnectionMs + CAPTURE_TIMING.mechanicalPauseMs);
    expect(state.phase).toBe('scanning');
    state = reduceCaptureSequence(state, {
      type: 'CAPTURE_AVAILABLE',
      image: 'blob:must-not-commit',
      at: clock(),
    });
    state = signal(state, sampleWith({ facePresent: false }));
    state = tick(state, CAPTURE_TIMING.loseLockMs);
    expect(state.phase).toBe('aligning');
    expect(state.capturedImage).toBeNull();
    expect(state.handoffReady).toBe(false);
  });

  it('does not cross the capture boundary while a late scan-loss guard is pending', () => {
    let state = reachLocking();
    state = tick(state, CAPTURE_TIMING.guideConnectionMs + CAPTURE_TIMING.mechanicalPauseMs);
    state = tick(state, CAPTURE_TIMING.scanMs - 100);
    state = signal(state, sampleWith({ stillnessValid: false }));
    state = tick(state, 100);
    expect(state.phase).toBe('scanning');
    expect(state.scanComplete).toBe(false);
    state = tick(state, CAPTURE_TIMING.loseLockMs - 100);
    expect(state.phase).toBe('aligning');
    expect(state.scanComplete).toBe(false);
    expect(state.capturedImage).toBeNull();
  });

  it('uses a non-traveling 300ms scan in reduced motion', () => {
    let state = reachLocking();
    state = tick(state, CAPTURE_TIMING.guideConnectionMs + CAPTURE_TIMING.mechanicalPauseMs, true);
    state = reduceCaptureSequence(
      state,
      {
        type: 'CAPTURE_AVAILABLE',
        image: 'blob:reduced-motion-specimen',
        at: clock(),
      },
      { reducedMotion: true },
    );
    state = tick(state, CAPTURE_TIMING.reducedMotionScanMs - 1, true);
    expect(state.phase).toBe('scanning');
    state = tick(state, 1, true);
    expect(state.phase).toBe('captured');
  });

  it('uses the persistent low-light copy only when low light is explicitly known for eight seconds', () => {
    let state = createCaptureSequenceState(clock());
    state = signal(
      state,
      sampleWith({ lightingValid: false, stillnessValid: false }, { lightingIssue: 'low-light' }),
    );
    state = tick(state, CAPTURE_TIMING.persistentLowLightMs - 1);
    expect(state.persistentLowLight).toBe(false);
    state = tick(state, 1);
    expect(state.persistentLowLight).toBe(true);
    expect(getCaptureInstruction(state)).toEqual({
      primary: 'Lighting is still too low',
      secondary: 'Try facing a window and keep the camera open',
    });
  });

  it('runs the ritual in native frame-quality mode without inventing face geometry', () => {
    const frameSample: CaptureSignalSample = {
      verificationMode: 'frame-quality',
      frameReady: true,
      quality: {
        facePresent: false,
        distanceValid: false,
        alignmentValid: false,
        angleValid: false,
        lightingValid: true,
        stillnessValid: true,
      },
      lightingIssue: null,
      faceBounds: null,
      registeredRegions: [],
    };
    let state = createCaptureSequenceState(clock());
    state = signal(state, frameSample);
    expect(state.phase).toBe('aligning');
    state = tick(state, CAPTURE_TIMING.returnValidMs);
    state = tick(state, CAPTURE_TIMING.validHoldMs);
    expect(state.phase).toBe('locking');
    expect(state.faceBounds).toBeNull();
    expect(state.registeredRegions).toEqual([]);
    expect(state.activeIssue).toBeNull();
  });

  it('cancels a native lock when the real preview frame is lost', () => {
    const frameSample: CaptureSignalSample = {
      verificationMode: 'frame-quality',
      frameReady: true,
      quality: {
        facePresent: false,
        distanceValid: false,
        alignmentValid: false,
        angleValid: false,
        lightingValid: true,
        stillnessValid: true,
      },
    };
    let state = createCaptureSequenceState(clock());
    state = signal(state, frameSample);
    state = tick(state, CAPTURE_TIMING.returnValidMs);
    state = tick(state, CAPTURE_TIMING.validHoldMs);
    expect(state.phase).toBe('locking');
    state = signal(state, { ...frameSample, frameReady: false });
    state = tick(state, CAPTURE_TIMING.loseLockMs);
    expect(state.phase).toBe('aligning');
    expect(state.frameLost).toBe(true);
    expect(getCaptureInstruction(state).primary).toBe('Frame lost');
  });
});

describe('capture issue priority and geometry', () => {
  const issueFor = (quality: Partial<CaptureQuality>, issue: CaptureIssue) =>
    getHighestPriorityCaptureIssue(
      { ...validQuality(), ...quality },
      {
        distanceIssue: issue === 'too-close' ? issue : null,
        alignmentIssue: issue === 'move-left' ? issue : null,
        angleIssue: issue === 'level-head' ? issue : null,
        lightingIssue: issue === 'backlight' ? issue : null,
      },
    );

  it('selects exactly one issue in missing, distance, position, angle, light, movement order', () => {
    expect(issueFor({ facePresent: false }, 'too-close')).toBe('face-missing');
    expect(issueFor({ distanceValid: false }, 'too-close')).toBe('too-close');
    expect(issueFor({ alignmentValid: false }, 'move-left')).toBe('move-left');
    expect(issueFor({ angleValid: false }, 'level-head')).toBe('level-head');
    expect(issueFor({ lightingValid: false }, 'backlight')).toBe('backlight');
    expect(issueFor({ stillnessValid: false }, 'movement')).toBe('movement');
  });

  it('calculates conservative one-axis occupancy against the canonical oval', () => {
    expect(
      calculateFaceOccupancy({
        x: 0,
        y: 0,
        width: CAPTURE_GEOMETRY.guideOvalWidth * 0.78,
        height: CAPTURE_GEOMETRY.guideOvalHeight * 0.82,
      }),
    ).toBeCloseTo(0.78);
    expect(occupancyIssue(CAPTURE_GEOMETRY.minimumOccupancy - 0.001)).toBe('too-far');
    expect(occupancyIssue(CAPTURE_GEOMETRY.idealOccupancy)).toBeNull();
    expect(occupancyIssue(CAPTURE_GEOMETRY.maximumOccupancy + 0.001)).toBe('too-close');
    expect(calculateFaceOccupancy(null)).toBeNull();
  });
});
