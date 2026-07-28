import { useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import {
  clearStructuredDemoData,
  loadStructuredDemoData,
  saveStructuredDemoData,
  type PersistedDemoData,
} from '../adapters/persistence/localObservationStore';
import {
  clearDemoPreview,
  demoJourneyRequested,
  loadDemoJourney,
  loadDemoPreview,
  saveDemoJourney,
  type DemoLaunch,
  type DemoEnvelope,
} from '../adapters/persistence/demoJourneyStore';
import type { AppStage } from '../domain/model';
import { DEMO_LAB_ENABLED } from '../features/demo-lab/demoLabAccess';
import {
  fixtureNowForDemoStartingPoint,
  ordinaryDemoRuntime,
  type DemoRuntime,
} from '../domain/demoLab';
import { FaceValueContext } from './faceValueContext';
import {
  faceValueReducer,
  initialState,
  normalizePhaseBState,
  type PhaseBFaceValueState,
} from './phaseBMachine';

function restoredStageFor(persisted: PersistedDemoData): AppStage {
  const hasBaseline = Boolean(persisted.longitudinalEvidence.baseline);
  const hasFollowUp = Boolean(persisted.longitudinalEvidence.followUp);
  const hasComparison = Boolean(persisted.longitudinalEvidence.comparison && persisted.analysis);
  const hasRegisteredTrial = Boolean(persisted.registeredProduct && hasBaseline);

  if (persisted.stage === 'archive') return 'archive';
  if (persisted.stage === 'record' && persisted.record) return 'record';
  if (persisted.oracleRevealState === 'done') return 'cabinet';
  if (persisted.oracleRevealState === 'collected' && persisted.record) {
    return 'analysis';
  }
  if (hasComparison) return 'analysis';
  if (hasBaseline && hasFollowUp) {
    return persisted.stage === 'followup_context' ? 'followup_context' : 'analysis';
  }

  if (hasRegisteredTrial) {
    if (persisted.stage === 'baseline_context') return 'baseline_context';
    if (persisted.stage === 'baseline_locked') return 'baseline_locked';
    if (persisted.stage === 'followup_ready') return 'followup_ready';
    if (persisted.stage === 'analysis_failure') return 'analysis_failure';
    if (persisted.stage === 'comparison_refused') {
      return 'comparison_refused';
    }
    if (persisted.stage === 'camera') {
      return persisted.captureKind === 'followup' ? 'followup_ready' : 'baseline_locked';
    }
    return 'waiting_for_followup';
  }

  if (persisted.registeredProduct) {
    return persisted.stage === 'product_registration' ? 'product_registration' : 'job';
  }
  if (persisted.stage === 'product_registration') {
    return 'product_registration';
  }
  if (
    persisted.archive.length > 0 ||
    persisted.observation !== 'none' ||
    persisted.assignedJob !== null
  ) {
    return 'cabinet';
  }
  return 'welcome';
}

function hydratePersistedState(
  persisted: PersistedDemoData,
  options: {
    preserveStage: boolean;
    resumeComparison: boolean;
    synthetic: boolean;
  },
): PhaseBFaceValueState {
  const completeSignalsAwaitingComparison = Boolean(
    persisted.longitudinalEvidence.baseline &&
    persisted.longitudinalEvidence.followUp &&
    !persisted.longitudinalEvidence.comparison &&
    !persisted.analysis,
  );
  const restoredStage =
    options.preserveStage && persisted.stage ? persisted.stage : restoredStageFor(persisted);
  const hasPendingRelease = Boolean(
    restoredStage === 'analysis' && persisted.oracleRevealState === 'dispensing',
  );
  const hasPendingDecision = Boolean(
    restoredStage === 'analysis' && persisted.oracleRevealState === 'verdict_revealed',
  );
  const hasCollectedEvidence = Boolean(
    restoredStage === 'analysis' && persisted.oracleRevealState === 'collected' && persisted.record,
  );

  const hydrated = normalizePhaseBState({
    ...initialState,
    ...persisted,
    stage: completeSignalsAwaitingComparison ? 'analysis' : restoredStage,
    cabinet:
      restoredStage === 'welcome' ||
      restoredStage === 'product_registration' ||
      restoredStage === 'job'
        ? 'closed'
        : 'open',
    processing: persisted.analysis ? 'succeeded' : 'idle',
    analysisRole: null,
    activeAnalysisRequestId: null,
    pendingAnalysisCapture: null,
    analysisError: null,
    announcement: options.synthetic
      ? 'Synthetic demo data restored. No physical capture was used.'
      : hasCollectedEvidence
        ? 'Your recorded evidence was restored. Done returns to Your trials.'
        : hasPendingRelease
          ? 'Your evidence dispense was restored.'
          : hasPendingDecision
            ? 'Your result was restored and is ready to keep.'
            : completeSignalsAwaitingComparison
              ? 'Your matched scans were restored. Comparison is resuming.'
              : restoredStage === 'welcome'
                ? initialState.announcement
                : 'Your trial was restored. Raw images were not saved.',
  });

  return completeSignalsAwaitingComparison && options.resumeComparison
    ? faceValueReducer(hydrated, { type: 'COMPARISON_CREATED' })
    : hydrated;
}

interface ProviderHydration {
  state: PhaseBFaceValueState;
  demoRuntime: DemoRuntime;
}

function hydrationFromDemoEnvelope(envelope: DemoEnvelope): ProviderHydration {
  const state = hydratePersistedState(envelope.state, {
    preserveStage: true,
    resumeComparison: envelope.startingPoint !== 'comparison_processing',
    synthetic: true,
  });
  return {
    state,
    demoRuntime: {
      mode: envelope.mode,
      startingPoint: envelope.startingPoint,
      resultFixture: envelope.resultFixture,
      fixtureNow: fixtureNowForDemoStartingPoint(
        envelope.startingPoint,
        state.baselineLockedAt,
      ),
    },
  };
}

function hydrateProvider(): ProviderHydration {
  if (typeof localStorage === 'undefined') {
    return {
      state: initialState,
      demoRuntime: ordinaryDemoRuntime,
    };
  }

  if (DEMO_LAB_ENABLED) {
    const preview = typeof sessionStorage === 'undefined' ? null : loadDemoPreview();
    if (preview) return hydrationFromDemoEnvelope(preview);

    const search = globalThis.location?.search ?? '';
    if (demoJourneyRequested(search)) {
      const journey = loadDemoJourney();
      if (journey) return hydrationFromDemoEnvelope(journey);
    }
  }

  const persisted = loadStructuredDemoData();
  return {
    state: persisted
      ? hydratePersistedState(persisted, {
          preserveStage: false,
          resumeComparison: true,
          synthetic: false,
        })
      : initialState,
    demoRuntime: ordinaryDemoRuntime,
  };
}

export function FaceValueProvider({ children }: { children: ReactNode }) {
  const [hydration] = useState(hydrateProvider);
  const [state, dispatch] = useReducer(faceValueReducer, hydration.state);
  const demoRuntime = hydration.demoRuntime;

  useEffect(() => {
    if (DEMO_LAB_ENABLED && demoRuntime.mode === 'preview') {
      clearDemoPreview();
      return;
    }

    if (
      DEMO_LAB_ENABLED &&
      demoRuntime.mode === 'journey' &&
      demoRuntime.startingPoint &&
      demoRuntime.resultFixture
    ) {
      const launch: DemoLaunch = {
        mode: 'journey',
        startingPoint: demoRuntime.startingPoint,
        resultFixture: demoRuntime.resultFixture,
        state,
      };
      saveDemoJourney(launch);
      return;
    }

    if (
      state.stage === 'welcome' &&
      state.archive.length === 0 &&
      state.assignedJob === null &&
      state.registeredProduct === null
    ) {
      clearStructuredDemoData();
      return;
    }
    saveStructuredDemoData(state);
  }, [demoRuntime, state]);

  const value = useMemo(() => ({ state, dispatch, demoRuntime }), [demoRuntime, state]);
  return <FaceValueContext.Provider value={value}>{children}</FaceValueContext.Provider>;
}
