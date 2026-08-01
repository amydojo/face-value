import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAPTURE_TIMING, useAnalysisWaitPresentation } from '../features/capture-sequence';

describe('analysis wait presentation timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps scan complete until the 1.8 second capture dwell finishes', () => {
    const onPresentationComplete = vi.fn();
    const { result, rerender } = renderHook(
      ({ dwellFinished }) =>
        useAnalysisWaitPresentation({
          active: true,
          generationId: 'generation-1',
          scanCompleteDwellFinished: dwellFinished,
          activeMeasurement: 1,
          allMeasurementsComplete: false,
          evidenceCommitted: false,
          onPresentationComplete,
        }),
      { initialProps: { dwellFinished: false } },
    );

    expect(CAPTURE_TIMING.scanCompleteDwellMs).toBe(1_800);
    expect(result.current.phase).toBe('scan-complete');
    act(() => vi.advanceTimersByTime(1_799));
    expect(result.current.phase).toBe('scan-complete');

    rerender({ dwellFinished: true });
    expect(result.current).toMatchObject({ phase: 'analysis', measurement: 1, completedCount: 0 });
    expect(onPresentationComplete).not.toHaveBeenCalled();
  });

  it('never leads real work and enters at the latest truthful state after the dwell', () => {
    const onPresentationComplete = vi.fn();
    const { result, rerender } = renderHook(
      ({ dwellFinished, activeMeasurement, complete }) =>
        useAnalysisWaitPresentation({
          active: true,
          generationId: 'generation-fast',
          scanCompleteDwellFinished: dwellFinished,
          activeMeasurement,
          allMeasurementsComplete: complete,
          evidenceCommitted: complete,
          onPresentationComplete,
        }),
      {
        initialProps: {
          dwellFinished: false,
          activeMeasurement: null as number | null,
          complete: false,
        },
      },
    );

    rerender({ dwellFinished: true, activeMeasurement: null, complete: false });
    expect(result.current.phase).toBe('scan-complete');
    expect(result.current.measurement).toBeNull();

    rerender({ dwellFinished: true, activeMeasurement: null, complete: true });
    expect(result.current).toEqual({ phase: 'confirmed', measurement: null, completedCount: 3 });
    expect(result.current.phase).not.toBe('analysis');
  });

  it('holds each visible progress state for 700ms and confirmation for 800ms', () => {
    const onPresentationComplete = vi.fn();
    const { result, rerender } = renderHook(
      ({ activeMeasurement, complete, committed }) =>
        useAnalysisWaitPresentation({
          active: true,
          generationId: 'generation-legible',
          scanCompleteDwellFinished: true,
          activeMeasurement,
          allMeasurementsComplete: complete,
          evidenceCommitted: committed,
          onPresentationComplete,
        }),
      {
        initialProps: {
          activeMeasurement: 1 as number | null,
          complete: false,
          committed: false,
        },
      },
    );

    expect(result.current.measurement).toBe(1);
    rerender({ activeMeasurement: 2, complete: false, committed: false });
    act(() => vi.advanceTimersByTime(CAPTURE_TIMING.analysisProgressMinimumMs - 1));
    expect(result.current.measurement).toBe(1);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.measurement).toBe(2);

    rerender({ activeMeasurement: null, complete: true, committed: true });
    act(() => vi.advanceTimersByTime(CAPTURE_TIMING.analysisProgressMinimumMs - 1));
    expect(result.current.measurement).toBe(2);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.phase).toBe('confirmed');

    act(() => vi.advanceTimersByTime(CAPTURE_TIMING.analysisConfirmationHoldMs - 1));
    expect(onPresentationComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onPresentationComplete).toHaveBeenCalledTimes(1);
    expect(onPresentationComplete).toHaveBeenCalledWith('generation-legible');
  });
});
