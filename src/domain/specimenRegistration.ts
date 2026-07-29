export type SpecimenRegistrationPhase =
  'idle' | 'preparing' | 'aligning' | 'scanning' | 'processing' | 'verified' | 'ready';

export type SpecimenRegistrationTiming = Readonly<
  Record<Exclude<SpecimenRegistrationPhase, 'idle' | 'ready'>, number>
>;

export const specimenRegistrationTiming = {
  normal: {
    preparing: 300,
    aligning: 500,
    scanning: 1_800,
    processing: 600,
    verified: 600,
  },
  reduced: {
    preparing: 150,
    aligning: 150,
    scanning: 450,
    processing: 250,
    verified: 350,
  },
} as const satisfies Record<'normal' | 'reduced', SpecimenRegistrationTiming>;

export const specimenRegistrationPhases = [
  'preparing',
  'aligning',
  'scanning',
  'processing',
  'verified',
] as const satisfies readonly Exclude<SpecimenRegistrationPhase, 'idle' | 'ready'>[];

export interface SpecimenRegistrationSnapshot {
  registrationId: string | null;
  phase: SpecimenRegistrationPhase;
  scanProgress: number;
  isRegistering: boolean;
  isVerified: boolean;
  isReady: boolean;
  reducedMotion: boolean;
}

export function specimenRegistrationMilestones(timing: SpecimenRegistrationTiming) {
  const aligning = timing.preparing;
  const scanning = aligning + timing.aligning;
  const processing = scanning + timing.scanning;
  const verified = processing + timing.processing;
  const ready = verified + timing.verified;

  return {
    preparing: 0,
    aligning,
    scanning,
    processing,
    verified,
    ready,
  } as const;
}
