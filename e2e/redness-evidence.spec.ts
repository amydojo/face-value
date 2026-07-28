import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  analysisResultFromRednessEvaluation,
  placementForRednessAction,
  rednessComparisonFromEvaluation,
} from '../src/adapters/analysis/youcam/rednessEvidenceAdapter';
import { loadStructuredDemoData } from '../src/adapters/persistence/localObservationStore';
import {
  canonicalRednessFixtures,
  evaluateRedness,
  type RednessEvaluationSnapshot,
} from '../src/domain/evidence/redness';
import type {
  DurableSkinSignal,
  EvidenceRecordData,
  RecommendedAction,
  RegisteredProduct,
} from '../src/domain/model';
import { persistedSealedTrial, STORAGE_KEY } from './phase-b5-fixtures';

const captureEvidence = process.env.CAPTURE_REDNESS_EVIDENCE === 'true';
const evidenceDirectory = resolve('docs/verification/redness-evidence-51');

const EMPTY_CONTEXT = {
  makeup: false,
  recentHeatOrExercise: false,
  recentCleansingOrSkincare: false,
  routineOrTreatmentChange: false,
  note: null,
};

const cases = [
  {
    key: 'C',
    slug: 'directional-test-longer',
    title: 'Directional improvement',
    action: 'TEST LONGER',
    effect: 'directional_improvement',
    measurement: 'adequate',
    attribution: 'strong',
    evidence: 'possible',
    safety: 'clear',
  },
  {
    key: 'A',
    slug: 'clear-improvement-keep',
    title: 'Clear improvement',
    action: 'KEEP USING IT',
    effect: 'strong_improvement',
    measurement: 'adequate',
    attribution: 'strong',
    evidence: 'likely',
    safety: 'clear',
  },
  {
    key: 'B',
    slug: 'clean-null-not-proving',
    title: 'Clean null',
    action: 'NOT PROVING ITS JOB',
    effect: 'no_detectable_change',
    measurement: 'strong',
    attribution: 'strong',
    evidence: 'likely',
    safety: 'clear',
  },
  {
    key: 'D',
    slug: 'product-overlap-retry-alone',
    title: 'Product overlap',
    action: 'RETRY IT ALONE',
    effect: 'strong_improvement',
    measurement: 'adequate',
    attribution: 'blocked',
    evidence: 'possible',
    safety: 'clear',
  },
  {
    key: 'G',
    slug: 'invalid-capture-unreadable',
    title: 'Invalid capture',
    action: 'TEST LONGER',
    effect: 'strong_improvement',
    measurement: 'invalid',
    attribution: 'strong',
    evidence: 'insufficient',
    safety: 'clear',
  },
  {
    key: 'F',
    slug: 'safety-interruption',
    title: 'Safety interruption',
    action: 'SAFETY INTERRUPTION',
    effect: 'worsened',
    measurement: 'adequate',
    attribution: 'strong',
    evidence: 'likely',
    safety: 'interrupted',
  },
] as const;

function compatibilityAction(
  action: RednessEvaluationSnapshot['interpretation']['recommendedAction'],
): RecommendedAction {
  switch (action) {
    case 'keep':
      return 'keep';
    case 'test_longer':
      return 'wait';
    case 'retry_alone':
    case 'not_proving_job':
      return 'reassess';
    case 'safety_interruption':
      return 'seek_professional_guidance';
  }
}

function signalFor(score: number, capturedAt: string): DurableSkinSignal {
  return {
    provider: 'youcam',
    apiVersion: '2.1',
    mode: 'hd',
    concern: 'hd_redness',
    region: null,
    scoreType: 'raw_score',
    captureProtocolVersion: 'face-value-youcam-1',
    rawScore: score,
    capturedAt,
    captureQuality: 'accepted',
  };
}

function recordFor(
  snapshot: RednessEvaluationSnapshot,
  index: number,
  title: string,
): EvidenceRecordData {
  const action = snapshot.interpretation.recommendedAction;
  return {
    id: `ER-REDNESS-${index + 1}`,
    specimenId: snapshot.productId,
    accession: `FV–0${index + 1}`,
    product: `${title} Fixture`,
    productBrand: 'Face Value',
    job: 'Reduce visible redness',
    observationWindow: `${snapshot.baseline.sessions[0].capturedAt} to ${snapshot.endpoint.sessions[0].capturedAt}`,
    comparison:
      snapshot.measurementQuality === 'invalid'
        ? 'not_comparable'
        : snapshot.attributionQuality === 'blocked'
          ? 'partially_comparable'
          : 'comparable',
    finding: snapshot.interpretation.finding,
    nonFinding: snapshot.interpretation.nonFinding,
    confidence: snapshot.evidenceQuality,
    disturbance: snapshot.secondProductStatus === 'active_overlap' ? 'overlap_retained' : 'none',
    finalPlacement: placementForRednessAction(action),
    recommendedAction: compatibilityAction(action),
    claimBoundary: snapshot.interpretation.claimBoundary.join(' '),
    createdAt: snapshot.evaluatedAt,
    includesFaceImage: false,
    evidenceSource: 'YouCam Skin Analysis v2.1',
    comparisonDirection:
      snapshot.rawScoreDelta === null
        ? undefined
        : snapshot.rawScoreDelta > 0
          ? 'favorable'
          : snapshot.rawScoreDelta < 0
            ? 'unfavorable'
            : 'unchanged',
    limitations: [...snapshot.interpretation.limitations],
    baselineRawScore: snapshot.baselineRawMedian ?? undefined,
    followUpRawScore: snapshot.endpointRawMedian ?? undefined,
    baselineContext: EMPTY_CONTEXT,
    followUpContext: EMPTY_CONTEXT,
    demoOriginated: false,
    rednessEvaluation: snapshot,
  };
}

function collectedState(snapshot: RednessEvaluationSnapshot, record: EvidenceRecordData) {
  const baselineAt = snapshot.baseline.sessions[0].capturedAt;
  const endpointAt = snapshot.endpoint.sessions[0].capturedAt;
  const product: RegisteredProduct = {
    id: snapshot.productId,
    accession: record.accession,
    brand: record.productBrand ?? 'Face Value',
    productName: record.product,
    strength: null,
    volume: null,
    assignedJob: 'Reduce visible redness',
    protocolId: 'youcam-redness-v1',
    expectedObservationWindowDays: {
      ...snapshot.expectedObservationWindowDays,
    },
    createdAt: baselineAt,
  };
  const analysis = analysisResultFromRednessEvaluation(snapshot);

  return {
    ...persistedSealedTrial,
    stage: 'analysis',
    selectedSpecimenId: product.id,
    assignedJob: product.assignedJob,
    observation: 'complete',
    placement: placementForRednessAction(snapshot.interpretation.recommendedAction),
    placementSealed: true,
    comparison: analysis.comparison,
    confidence: snapshot.evidenceQuality,
    disturbance: snapshot.secondProductStatus === 'active_overlap' ? 'overlap_retained' : 'none',
    baselineCapture: {
      ...persistedSealedTrial.baselineCapture,
      id: `${record.id}-baseline`,
      createdAt: baselineAt,
    },
    followupCapture: {
      ...persistedSealedTrial.followupCapture,
      id: `${record.id}-endpoint`,
      createdAt: endpointAt,
    },
    analysis,
    record,
    archive: [record],
    longitudinalEvidence: {
      protocol: {
        provider: 'youcam',
        apiVersion: '2.1',
        mode: 'hd',
        concern: 'hd_redness',
        region: null,
        scoreType: 'raw_score',
        captureProtocolVersion: 'face-value-youcam-1',
      },
      baseline: signalFor(snapshot.baselineRawMedian!, baselineAt),
      followUp: signalFor(snapshot.endpointRawMedian!, endpointAt),
      comparison: rednessComparisonFromEvaluation(snapshot),
      evaluation: snapshot,
    },
    registeredProduct: product,
    baselineLockedAt: baselineAt,
    followUpEligibleAt: endpointAt,
    baselineContext: EMPTY_CONTEXT,
    followUpContext: EMPTY_CONTEXT,
    demoTimelineAdvanced: false,
    resultRevealed: true,
    oracleRevealState: 'collected',
    oracleEvidenceDispensed: true,
    oracleCollectionStarted: true,
    oracleCommittedAt: record.createdAt,
  };
}

async function loadState(page: Page, state: ReturnType<typeof collectedState>) {
  await page.goto('/');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: STORAGE_KEY,
    value: state,
  });
  await page.reload();
}

test.beforeAll(async () => {
  if (captureEvidence) {
    await mkdir(evidenceDirectory, { recursive: true });
  }
});

for (const [index, scenario] of cases.entries()) {
  test(`renders canonical redness evidence: ${scenario.title}`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(`page: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        runtimeErrors.push(`console: ${message.text()}`);
      }
    });
    await page.setViewportSize({ width: 390, height: 844 });

    const snapshot = evaluateRedness(structuredClone(canonicalRednessFixtures[scenario.key]));
    const record = recordFor(snapshot, index, scenario.title);
    const state = collectedState(snapshot, record);
    const serializedState = JSON.stringify(state);
    const memoryStorage = {
      getItem: () => serializedState,
      removeItem: () => undefined,
    } as unknown as Storage;
    expect(loadStructuredDemoData(memoryStorage)).not.toBeNull();
    await loadState(page, state);

    await expect(page.getByRole('heading', { name: 'EVIDENCE RECORDED' })).toBeVisible();
    await expect(page.locator('[data-result-summary]')).toContainText(
      snapshot.interpretation.finding,
    );
    await expect(page.locator('[data-result-summary]')).toContainText(scenario.action);

    await page.getByRole('button', { name: 'VIEW EVIDENCE' }).click();
    const detail = page.locator('[data-evidence-detail]');
    await expect(page.getByRole('heading', { name: 'EVIDENCE DETAIL' })).toBeVisible();
    await expect(detail).toContainText(scenario.measurement.toUpperCase());
    await expect(detail).toContainText(scenario.attribution.toUpperCase());
    await expect(detail).toContainText(scenario.evidence.toUpperCase());
    await expect(detail).toContainText(scenario.safety.toUpperCase());
    await expect(detail).toContainText(scenario.effect.replaceAll('_', ' ').toUpperCase());
    await expect(detail).toContainText('provisional_fixture');
    await expect(detail).toContainText('redness-provisional-v1');
    await expect(detail).toContainText('Production thresholds require repeat-scan calibration.');
    await expect(detail).not.toContainText(/ui_score|uiScore/);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    expect(runtimeErrors).toEqual([]);

    if (captureEvidence) {
      await page.screenshot({
        path: resolve(
          evidenceDirectory,
          `${String(index + 1).padStart(2, '0')}-${scenario.slug}.png`,
        ),
        fullPage: true,
      });
      if (scenario.key === 'A') {
        await detail.screenshot({
          path: resolve(evidenceDirectory, '07-evidence-detail-provisional-metadata.png'),
        });
      }
    }
  });
}
