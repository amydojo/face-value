import type { EvidenceTrialState, PrimaryActionOwner, TrialPhase } from './evidenceTrial';

export type MachineActionId =
  | 'start-baseline-scan'
  | 'start-follow-up-scan'
  | 'reveal-verdict'
  | 'save-result'
  | 'retry-processing'
  | 'retry-release';

export type CassetteDoorState = 'closed' | 'releasing' | 'released' | 'opening' | 'open' | 'resealing';
export type GlassState = 'empty' | 'frosted' | 'clear' | 'scanning' | 'processing' | 'error';
export type ActuatorState = 'parked' | 'armed' | 'pressed' | 'locked' | 'complete' | 'error';

export type MachineConfiguration = {
  interactionMode: 'informational' | 'awaiting-external-input' | 'actionable' | 'busy' | 'complete' | 'error';
  primaryActionOwner: PrimaryActionOwner;
  status: { primary: string; secondary?: string };
  actuator: { state: ActuatorState; actionId?: MachineActionId; accessibleLabel?: string };
  doorState: CassetteDoorState;
  glassState: GlassState;
  specimenVisibility: 'absent' | 'obscured' | 'visible' | 'presented';
};

const pageOwned = (primary: string, secondary?: string): MachineConfiguration => ({
  interactionMode: 'awaiting-external-input',
  primaryActionOwner: 'page',
  status: { primary, secondary },
  actuator: { state: 'parked' },
  doorState: 'closed',
  glassState: 'frosted',
  specimenVisibility: 'obscured',
});

const machineOwned = (
  primary: string,
  secondary: string,
  actionId: MachineActionId,
  accessibleLabel: string,
  error = false,
): MachineConfiguration => ({
  interactionMode: error ? 'error' : 'actionable',
  primaryActionOwner: 'machine',
  status: { primary, secondary },
  actuator: { state: error ? 'error' : 'armed', actionId, accessibleLabel },
  doorState: 'closed',
  glassState: error ? 'error' : 'frosted',
  specimenVisibility: 'obscured',
});

const processing = (primary: string, secondary: string): MachineConfiguration => ({
  interactionMode: 'busy',
  primaryActionOwner: 'none',
  status: { primary, secondary },
  actuator: { state: 'locked' },
  doorState: 'closed',
  glassState: 'processing',
  specimenVisibility: 'obscured',
});

export function resolveMachineConfiguration(state: EvidenceTrialState): MachineConfiguration {
  switch (state.phase) {
    case 'empty':
    case 'registering':
      return pageOwned('STANDBY', 'READY FOR PRODUCT');
    case 'registered':
    case 'job-selection':
      return pageOwned(state.assignedJob ? 'JOB SELECTED' : 'AWAITING JOB', state.assignedJob ?? 'CHOOSE ONE BELOW');
    case 'job-assigned':
    case 'baseline-required':
      return machineOwned('BASELINE READY', 'PRESS TO SCAN', 'start-baseline-scan', 'Take baseline scan');
    case 'baseline-capturing':
      return processing('CAPTURING BASELINE', 'LATCH LOCKED');
    case 'baseline-recorded':
      return pageOwned('BASELINE RECORDED', 'DAY 0');
    case 'trial-active':
      return {
        interactionMode: 'informational',
        primaryActionOwner: 'none',
        status: { primary: 'TRIAL ACTIVE', secondary: 'EVIDENCE ACCUMULATING' },
        actuator: { state: 'complete' },
        doorState: 'closed',
        glassState: 'frosted',
        specimenVisibility: 'visible',
      };
    case 'follow-up-required':
      return machineOwned('FOLLOW-UP READY', 'PRESS TO SCAN', 'start-follow-up-scan', 'Take follow-up scan');
    case 'follow-up-capturing':
      return processing('CAPTURING FOLLOW-UP', 'LATCH LOCKED');
    case 'processing':
      return processing('COMPARING SCANS', 'LATCH LOCKED');
    case 'processing-error':
      return machineOwned('PROCESS INTERRUPTED', 'PRESS TO RETRY', 'retry-processing', 'Retry evidence processing', true);
    case 'verdict-ready':
      if (state.recoverableError?.code === 'release') {
        return machineOwned('RELEASE INTERRUPTED', 'PRESS TO RETRY', 'retry-release', 'Retry Evidence Record release', true);
      }
      if (state.disposition) {
        return machineOwned(
          'SAVE READY',
          'PRESS TO SAVE',
          'save-result',
          'Save result and release Evidence Record',
        );
      }
      return machineOwned('VERDICT READY', 'PRESS TO RELEASE', 'reveal-verdict', 'Release Evidence Record');
    case 'verdict-revealing':
    case 'verdict-revealed':
      return {
        interactionMode: 'busy',
        primaryActionOwner: 'none',
        status: { primary: 'RELEASING RECORD', secondary: 'LATCH LOCKED' },
        actuator: { state: 'locked' },
        doorState: 'opening',
        glassState: 'clear',
        specimenVisibility: 'presented',
      };
    case 'record-presented':
      return {
        interactionMode: 'complete',
        primaryActionOwner: 'artifact',
        status: { primary: 'RECORD RELEASED', secondary: 'TAKE YOUR EVIDENCE' },
        actuator: { state: 'complete' },
        doorState: 'open',
        glassState: 'clear',
        specimenVisibility: 'presented',
      };
    case 'record-collected':
    case 'disposition-required':
      return {
        interactionMode: 'complete',
        primaryActionOwner: 'page',
        status: { primary: 'RESULT RECORDED', secondary: state.evidenceRecord?.id },
        actuator: { state: 'complete' },
        doorState: 'open',
        glassState: 'clear',
        specimenVisibility: 'presented',
      };
    case 'complete':
    case 'archived':
      return {
        interactionMode: 'complete',
        primaryActionOwner: 'none',
        status: { primary: 'EVIDENCE SAVED', secondary: state.evidenceRecord?.id },
        actuator: { state: 'complete' },
        doorState: 'resealing',
        glassState: 'clear',
        specimenVisibility: 'presented',
      };
  }
}

export type TrialScreenConfig = {
  primaryActionOwner: PrimaryActionOwner;
  machinePrimary?: boolean;
  artifactPrimary?: boolean;
  pagePrimary?: boolean;
};

export function assertSinglePrimaryAction(config: TrialScreenConfig): void {
  const count = [config.machinePrimary, config.artifactPrimary, config.pagePrimary].filter(Boolean).length;
  if (count > 1) throw new Error('A screen may not expose competing primary actions.');
  const expected = config.primaryActionOwner === 'none' ? 0 : 1;
  if (count !== expected) throw new Error(`Primary action ownership mismatch for ${config.primaryActionOwner}.`);
}

export const stablePhaseFromLegacy = (phase: TrialPhase): TrialPhase => {
  if (phase === 'verdict-revealing' || phase === 'verdict-revealed') return 'verdict-ready';
  if (phase === 'baseline-capturing') return 'baseline-required';
  if (phase === 'follow-up-capturing') return 'follow-up-required';
  return phase;
};
