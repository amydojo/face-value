export interface ClockAdapter {
  now(): string;
}

export const systemClock: ClockAdapter = { now: () => new Date().toISOString() };
export const fixedClock = (iso: string): ClockAdapter => ({ now: () => iso });
