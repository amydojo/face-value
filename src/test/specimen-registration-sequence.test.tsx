import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSpecimenRegistrationSequence } from '../features/first-trial/useSpecimenRegistrationSequence';

afterEach(() => {
  vi.useRealTimers();
});

describe('useSpecimenRegistrationSequence', () => {
  it('aborts timers on unmount without completing or updating after disposal', () => {
    vi.useFakeTimers();
    const onReady = vi.fn();
    const { result, unmount } = renderHook(() =>
      useSpecimenRegistrationSequence({
        initiallyReady: false,
        reducedMotion: false,
        onReady,
      }),
    );

    act(() => result.current.start('registration-a'));
    expect(result.current.phase).toBe('preparing');
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(10_000));
    expect(onReady).not.toHaveBeenCalled();
  });

  it('prevents a stale registration from completing a newer registration', () => {
    vi.useFakeTimers();
    const onReady = vi.fn();
    const { result } = renderHook(() =>
      useSpecimenRegistrationSequence({
        initiallyReady: false,
        reducedMotion: false,
        onReady,
      }),
    );

    act(() => result.current.start('registration-a'));
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.phase).toBe('aligning');

    act(() => result.current.start('registration-b'));
    expect(result.current.phase).toBe('preparing');
    expect(result.current.registration.registrationId).toBe('registration-b');

    act(() => vi.advanceTimersByTime(3_500));
    expect(result.current.phase).toBe('verified');
    expect(result.current.isReady).toBe(false);
    expect(onReady).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(300));
    expect(result.current.phase).toBe('ready');
    expect(result.current.registration.registrationId).toBe('registration-b');
    expect(onReady).toHaveBeenCalledTimes(1);

    act(() => result.current.start('registration-b'));
    expect(result.current.phase).toBe('ready');
    expect(vi.getTimerCount()).toBe(0);
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
