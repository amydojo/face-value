export const DEMO_STARTING_POINTS = [
  {
    id: 'followup_ready',
    label: 'Follow-up ready',
    description: 'Open the real Home state with the follow-up action ready.',
    frequent: true,
  },
  {
    id: 'verdict_ready',
    label: 'Verdict ready',
    description: 'Open the real sealed result cassette before reveal.',
    frequent: true,
  },
  {
    id: 'evidence_recorded',
    label: 'Evidence recorded',
    description: 'Open the real saved-result completion state.',
    frequent: true,
  },
  {
    id: 'home_saved_result',
    label: 'Home with saved result',
    description: 'Open Home with the latest saved verdict.',
    frequent: true,
  },
  {
    id: 'previous_trials',
    label: 'Previous Trials',
    description: 'Open the real saved-results archive.',
    frequent: true,
  },
  {
    id: 'new_trial',
    label: 'New trial',
    description: 'Open the ordinary Face Value welcome state.',
    frequent: false,
  },
  {
    id: 'product_registered',
    label: 'Product registered',
    description: 'Open the registered-product handoff before baseline capture.',
    frequent: false,
  },
  {
    id: 'baseline_ready',
    label: 'Baseline ready',
    description: 'Open the real baseline camera entry state.',
    frequent: false,
  },
  {
    id: 'baseline_locked',
    label: 'Baseline locked',
    description: 'Open the real locked-baseline completion state.',
    frequent: false,
  },
  {
    id: 'comparison_processing',
    label: 'Comparison processing',
    description: 'Hold the real comparison-processing state for review.',
    frequent: false,
  },
  {
    id: 'cassette_revealed',
    label: 'Cassette revealed',
    description: 'Open the real revealed verdict and recommendation.',
    frequent: false,
  },
  {
    id: 'saved_result',
    label: 'Saved result · current route',
    description: 'Open the current production saved-result route through the integration adapter.',
    frequent: false,
  },
] as const;

export type DemoStartingPoint = (typeof DEMO_STARTING_POINTS)[number]['id'];

export const DEMO_RESULT_FIXTURES = [
  {
    id: 'clear_favorable_change',
    label: 'Clear favorable change',
    canonicalKey: 'A',
  },
  {
    id: 'early_favorable_change',
    label: 'Early favorable change',
    canonicalKey: 'C',
  },
  {
    id: 'no_clear_change',
    label: 'No clear change',
    canonicalKey: 'B',
  },
  {
    id: 'product_overlap',
    label: 'Product overlap',
    canonicalKey: 'D',
  },
  {
    id: 'invalid_comparison',
    label: 'Invalid comparison',
    canonicalKey: 'G',
  },
  {
    id: 'worsening',
    label: 'Worsening',
    canonicalKey: 'E',
  },
  {
    id: 'safety_interruption',
    label: 'Safety interruption',
    canonicalKey: 'F',
  },
] as const;

export type DemoResultFixtureId = (typeof DEMO_RESULT_FIXTURES)[number]['id'];
export type DemoCanonicalFixtureKey = (typeof DEMO_RESULT_FIXTURES)[number]['canonicalKey'];

export type DemoLaunchMode = 'preview' | 'journey';

export type DemoRuntimeMode = 'ordinary' | DemoLaunchMode;

export interface DemoRuntime {
  mode: DemoRuntimeMode;
  startingPoint: DemoStartingPoint | null;
  resultFixture: DemoResultFixtureId | null;
}

export const ordinaryDemoRuntime: DemoRuntime = {
  mode: 'ordinary',
  startingPoint: null,
  resultFixture: null,
};

const startingPointIds = new Set<string>(DEMO_STARTING_POINTS.map(({ id }) => id));
const resultFixtureIds = new Set<string>(DEMO_RESULT_FIXTURES.map(({ id }) => id));

export function isDemoStartingPoint(value: unknown): value is DemoStartingPoint {
  return typeof value === 'string' && startingPointIds.has(value);
}

export function isDemoResultFixtureId(value: unknown): value is DemoResultFixtureId {
  return typeof value === 'string' && resultFixtureIds.has(value);
}

export function canonicalKeyForDemoFixture(
  fixtureId: DemoResultFixtureId,
): DemoCanonicalFixtureKey {
  const fixture = DEMO_RESULT_FIXTURES.find(({ id }) => id === fixtureId);
  if (!fixture) {
    throw new Error(`Unknown canonical demo result fixture: ${fixtureId}`);
  }
  return fixture.canonicalKey;
}
