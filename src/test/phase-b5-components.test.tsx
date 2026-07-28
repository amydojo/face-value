import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { HD_REDNESS_PROTOCOL } from '../adapters/analysis/youcam/contracts';
import {
  FixtureCameraKitAdapter,
  type CameraKitAdapter,
} from '../adapters/camera/youcam-camera-kit';
import { saveStructuredDemoData } from '../adapters/persistence/localObservationStore';
import { FaceValueProvider } from '../app/FaceValueProvider';
import { StageFocusManager } from '../app/StageFocusManager';
import { initialState, type PhaseBFaceValueState } from '../app/phaseBMachine';
import type { CaptureMetadata, DurableSkinSignal, EvidenceRecordData } from '../domain/model';
import { createRegisteredProduct } from '../domain/phaseB5';
import { analysisResultFromComparison, compareRednessSignals } from '../domain/youcamEvidence';
import { FaceValueApplication } from '../features/FaceValueApplication';
import { HumanButterProductionJourney } from '../features/HumanButterProductionJourney';
import { CameraViewport } from '../features/capture-contract/CameraViewport';

const BASELINE_AT = '2026-07-01T12:00:00.000Z';
const FOLLOW_UP_AT = '2026-07-15T12:00:00.000Z';

const signal = (rawScore: number, capturedAt: string): DurableSkinSignal => ({
  provider: 'youcam',
  apiVersion: '2.1',
  mode: 'hd',
  concern: 'hd_redness',
  region: null,
  scoreType: 'raw_score',
  captureProtocolVersion: 'face-value-youcam-1',
  rawScore,
  capturedAt,
  captureQuality: 'accepted',
});

const metadata = (kind: 'baseline' | 'followup', createdAt: string): CaptureMetadata => ({
  id: `${kind}-component`,
  kind,
  source: 'camera',
  mimeType: 'image/jpeg',
  createdAt,
  orientationRule: 'analysis-unmirrored',
});

const sealedState = (): PhaseBFaceValueState => {
  const registeredProduct = createRegisteredProduct(
    {
      brand: 'Naturium',
      productName: 'Azelaic Topical Acid',
      strength: '10%',
      volume: '30 ml',
    },
    BASELINE_AT,
  );
  const baseline = signal(93.3356, BASELINE_AT);
  const followUp = signal(100, FOLLOW_UP_AT);
  const comparison = compareRednessSignals(baseline, followUp);
  return {
    ...initialState,
    stage: 'analysis',
    cabinet: 'open',
    observation: 'review_due',
    processing: 'succeeded',
    comparison: 'comparable',
    confidence: 'possible',
    selectedSpecimenId: registeredProduct.id,
    assignedJob: registeredProduct.assignedJob,
    captureKind: 'followup',
    baselineCapture: metadata('baseline', BASELINE_AT),
    followupCapture: metadata('followup', FOLLOW_UP_AT),
    analysis: analysisResultFromComparison(comparison),
    registeredProduct,
    baselineLockedAt: BASELINE_AT,
    followUpEligibleAt: FOLLOW_UP_AT,
    baselineContext: {
      makeup: false,
      recentHeatOrExercise: false,
      recentCleansingOrSkincare: false,
      routineOrTreatmentChange: false,
      note: null,
    },
    followUpContext: {
      makeup: false,
      recentHeatOrExercise: false,
      recentCleansingOrSkincare: false,
      routineOrTreatmentChange: false,
      note: null,
    },
    demoTimelineAdvanced: false,
    resultRevealed: false,
    longitudinalEvidence: {
      protocol: HD_REDNESS_PROTOCOL,
      baseline,
      followUp,
      comparison,
    },
  };
};

const savedRecord = (overrides: Partial<EvidenceRecordData> = {}): EvidenceRecordData => ({
  id: 'ER-202607151230',
  specimenId: 'registered-product-20260701120000000',
  accession: 'FV–014',
  product: 'Azelaic Topical Acid',
  productBrand: 'Naturium',
  productStrength: '10%',
  productVolume: '30 ml',
  job: 'Reduce visible redness',
  observationWindow: `${BASELINE_AT} to ${FOLLOW_UP_AT}`,
  comparison: 'comparable',
  finding: 'A small favorable shift showed up.',
  nonFinding: 'Visible redness moved in the intended direction.',
  confidence: 'possible',
  disturbance: 'none',
  finalPlacement: 'paused',
  recommendedAction: 'wait',
  claimBoundary:
    'Possible directional evidence only. This does not establish product efficacy or clinical significance.',
  createdAt: '2026-07-15T12:30:00.000Z',
  includesFaceImage: false,
  ...overrides,
});

const homeState = (
  records: EvidenceRecordData[],
  overrides: Partial<PhaseBFaceValueState> = {},
): PhaseBFaceValueState => ({
  ...initialState,
  stage: 'cabinet',
  cabinet: 'open',
  observation: 'none',
  oracleRevealState: 'done',
  record: records[0] ?? null,
  archive: records,
  ...overrides,
});

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

it('renders the no-history home with direct trial and previous-trials navigation', async () => {
  const user = userEvent.setup();
  saveStructuredDemoData(homeState([]));
  render(
    <FaceValueProvider>
      <StageFocusManager />
      <FaceValueApplication />
    </FaceValueProvider>,
  );

  expect(screen.getByRole('heading', { name: 'Your trials' })).toBeVisible();
  expect(screen.getByText('NO TRIAL IN PROGRESS')).toBeVisible();
  expect(document.querySelector('[data-latest-verdict-cassette]')).toBeNull();
  expect(screen.getByRole('button', { name: 'Previous trials, 0 saved results' })).toBeVisible();

  await user.click(screen.getByRole('button', { name: 'START A NEW TRIAL' }));
  expect(screen.getByRole('heading', { name: 'What are you putting on trial?' })).toBeVisible();
});

it('keeps active-trial status calm while exposing the latest verdict and real history count', async () => {
  const user = userEvent.setup();
  const latest = savedRecord();
  const older = savedRecord({
    id: 'ER-202606291230',
    product: 'Barrier Support Serum With A Deliberately Long Product Name',
    productBrand: 'Example Laboratory',
    observationWindow: '2026-06-15T12:00:00.000Z to 2026-06-29T12:00:00.000Z',
    createdAt: '2026-06-29T12:30:00.000Z',
  });
  const active = sealedState();
  saveStructuredDemoData(
    homeState([latest, older], {
      ...active,
      stage: 'waiting_for_followup',
      observation: 'waiting',
      analysis: null,
      processing: 'idle',
      followupCapture: null,
      longitudinalEvidence: {
        ...active.longitudinalEvidence,
        followUp: null,
        comparison: null,
      },
      record: latest,
      archive: [latest, older],
    }),
  );
  render(
    <FaceValueProvider>
      <StageFocusManager />
      <FaceValueApplication />
    </FaceValueProvider>,
  );

  expect(document.querySelector('[data-home-state="active"] > p')).toHaveTextContent(
    'FOLLOW-UP READY',
  );
  expect(screen.getByLabelText('Active trial for Naturium Azelaic Topical Acid')).toBeVisible();
  expect(document.querySelector('[data-cassette-variant="latest-verdict"]')).toHaveAttribute(
    'data-cassette-state',
    'partially-revealed',
  );
  expect(screen.queryByRole('button', { name: 'START A NEW TRIAL' })).not.toBeInTheDocument();

  const previousTrials = screen.getByRole('button', {
    name: 'Previous trials, 2 saved results',
  });
  expect(previousTrials).toBeVisible();
  await user.click(previousTrials);
  expect(screen.getByRole('heading', { name: 'Previous trials' })).toBeVisible();
  expect(screen.getAllByRole('button', { name: /Open saved result/ })).toHaveLength(2);
});

it('starts with real registration and ends session one at Baseline locked', async () => {
  const user = userEvent.setup();
  render(
    <FaceValueProvider>
      <StageFocusManager />
      <FaceValueApplication />
    </FaceValueProvider>,
  );

  await user.click(screen.getByRole('button', { name: 'START A PRODUCT TRIAL' }));
  await waitFor(() =>
    expect(
      screen.getByRole('heading', {
        name: 'What are you putting on trial?',
      }),
    ).toHaveFocus(),
  );

  await user.click(screen.getByRole('button', { name: 'REGISTER PRODUCT' }));
  const brandField = screen.getByRole('textbox', { name: /^Brand/ });
  expect(brandField).toHaveFocus();
  await user.type(brandField, 'Naturium');
  await user.click(screen.getByRole('button', { name: 'REGISTER PRODUCT' }));
  const productNameField = screen.getByRole('textbox', {
    name: /^Product name/,
  });
  expect(productNameField).toHaveFocus();
  await user.type(productNameField, 'Azelaic Topical Acid');
  await user.type(screen.getByLabelText('Strength or concentration'), '10%');

  const supportedJobs = screen.getAllByRole('radio');
  expect(supportedJobs).toHaveLength(1);
  expect(supportedJobs[0]).toBeChecked();
  expect(
    screen.queryByRole('radio', { name: /dryness|pigmentation|acne/i }),
  ).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'REGISTER PRODUCT' }));
  expect(screen.getByRole('heading', { name: 'Your product is ready.' })).toBeVisible();
  expect(screen.getByText('Naturium')).toBeVisible();
  expect(screen.getByText('Azelaic Topical Acid')).toBeVisible();
  expect(screen.getByText('REDUCE VISIBLE REDNESS')).toBeVisible();

  await user.click(screen.getByRole('button', { name: 'TAKE GUIDED BASELINE' }));
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  expect(screen.queryByRole('button', { name: /shutter|take photo/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /use this capture/i })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'START GUIDED CAPTURE' }));

  await waitFor(
    () =>
      expect(
        screen.getByRole('heading', {
          name: 'Anything meaningfully different today?',
        }),
      ).toBeVisible(),
    { timeout: 2_500 },
  );
  await user.click(screen.getByRole('button', { name: 'NOTHING DIFFERENT' }));
  expect(screen.getByRole('heading', { name: 'Baseline locked.' })).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /follow-up|compare now|continue/i }),
  ).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'DONE' }));
  expect(screen.getByRole('heading', { name: 'Your trials' })).toBeVisible();
  expect(screen.getByText(/DAY 1 OF 14/)).toBeVisible();
  expect(screen.getByText(/FOLLOW-UP IN 14 DAYS/)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'TAKE FOLLOW-UP' })).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', {
      name: 'ADVANCE DEMO TIMELINE',
    }),
  ).not.toBeInTheDocument();
});

it('updates only Face, Position, and Light and closes camera on unmount', async () => {
  const user = userEvent.setup();
  const adapter = new FixtureCameraKitAdapter({ autoAdvance: false });
  const onReady = vi.fn();
  const { unmount } = render(
    <CameraViewport
      kind="baseline"
      cameraState="ready"
      onRequesting={vi.fn()}
      onReady={onReady}
      onCapturing={vi.fn()}
      onFailure={vi.fn()}
      onAccepted={vi.fn()}
      onDelete={vi.fn()}
      onBack={vi.fn()}
      cameraAdapter={adapter}
    />,
  );
  expect(adapter.sessionStartCount).toBe(0);
  expect(screen.getByRole('button', { name: 'START GUIDED CAPTURE' })).toBeVisible();
  expect(screen.getAllByText('Start guided capture when you are ready.')).toHaveLength(2);

  await user.click(screen.getByRole('button', { name: 'START GUIDED CAPTURE' }));
  await waitFor(() => expect(adapter.sessionStartCount).toBe(1));
  expect(screen.getAllByText('Opening camera…')).toHaveLength(2);
  expect(onReady).not.toHaveBeenCalled();

  act(() => {
    adapter.emitPreviewLive();
    adapter.emitQuality({
      hasFace: true,
      position: 'good',
      frontal: 'good',
      lighting: 'notgood',
    });
  });
  expect(onReady).toHaveBeenCalledOnce();
  const quality = screen.getByLabelText('Capture quality');
  const rows = within(quality).getAllByRole('definition');
  expect(rows.map((row) => row.textContent)).toEqual(['✓', '✓', '—']);
  expect(screen.getAllByText('Find more even light.')).toHaveLength(2);

  act(() => {
    adapter.emitQuality({
      hasFace: true,
      position: 'good',
      frontal: 'good',
      lighting: 'good',
    });
  });
  expect(
    within(quality)
      .getAllByRole('definition')
      .map((row) => row.textContent),
  ).toEqual(['✓', '✓', '✓']);
  expect(screen.getAllByText('Hold still…')).toHaveLength(2);
  expect(screen.queryByText(/frontal/i)).not.toBeInTheDocument();

  unmount();
  expect(adapter.cancelCount).toBe(1);
});

it('focuses the single fallback when guided capture is unavailable', async () => {
  const user = userEvent.setup();
  const unavailableAdapter: CameraKitAdapter = {
    async start(options) {
      options.onFailure('sdk-unavailable');
      return {
        captureProfileId: 'youcam-camera-kit-hd-1080p',
        cancel: vi.fn(),
      };
    },
  };
  render(
    <CameraViewport
      kind="baseline"
      cameraState="unsupported"
      onRequesting={vi.fn()}
      onReady={vi.fn()}
      onCapturing={vi.fn()}
      onFailure={vi.fn()}
      onAccepted={vi.fn()}
      onDelete={vi.fn()}
      onBack={vi.fn()}
      cameraAdapter={unavailableAdapter}
    />,
  );
  expect(screen.getByRole('button', { name: 'START GUIDED CAPTURE' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'START GUIDED CAPTURE' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Guided capture is unavailable.');
  await waitFor(() => expect(screen.getByLabelText('Choose a face photo')).toHaveFocus());
  expect(screen.getByText('Choose a photo to continue. Your trial has not changed.')).toBeVisible();
});

it('recovers a stalled preview only from one fresh restart tap', async () => {
  const user = userEvent.setup();
  const adapter = new FixtureCameraKitAdapter({
    stallFirstSession: true,
  });
  const onReady = vi.fn();
  const onBack = vi.fn();
  render(
    <CameraViewport
      kind="baseline"
      cameraState="idle"
      onRequesting={vi.fn()}
      onReady={onReady}
      onCapturing={vi.fn()}
      onFailure={vi.fn()}
      onAccepted={vi.fn()}
      onDelete={vi.fn()}
      onBack={onBack}
      cameraAdapter={adapter}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'START GUIDED CAPTURE' }));
  expect(adapter.sessionStartCount).toBe(1);
  const restart = await screen.findByRole('button', {
    name: 'RESTART CAMERA',
  });
  await waitFor(() => expect(restart).toHaveFocus());
  expect(screen.getByText('The camera preview did not start.')).toBeVisible();
  expect(onReady).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'RESTART CAMERA' }));
  expect(adapter.sessionStartCount).toBe(2);
  await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
  expect(screen.queryByRole('button', { name: 'RESTART CAMERA' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '← Back' }));
  expect(onBack).toHaveBeenCalledOnce();
  expect(adapter.cancelCount).toBeGreaterThanOrEqual(1);
});

it('keeps one canonical machine through reveal, dispense, collection, and Done', async () => {
  const user = userEvent.setup();
  saveStructuredDemoData(sealedState());
  render(
    <FaceValueProvider>
      <StageFocusManager />
      <HumanButterProductionJourney />
    </FaceValueProvider>,
  );

  expect(screen.getByText('VERDICT READY')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'The result is in.' })).toBeVisible();
  const preRevealTree = document.body.textContent ?? '';
  expect(preRevealTree).not.toContain('A small favorable shift showed up.');
  expect(preRevealTree).not.toContain(
    'This prototype cannot yet tell whether the shift is larger than normal scan variation.',
  );
  expect(preRevealTree).not.toContain('TEST LONGER');
  expect(preRevealTree).not.toContain('93.34');
  expect(document.body.innerHTML).not.toContain('A small favorable shift showed up.');
  expect(screen.queryByRole('button', { name: 'Keep this result' })).not.toBeInTheDocument();

  const machine = document.querySelector('[data-oracle-machine]');
  const machineControl = document.querySelector('[data-oracle-handle]');
  expect(machine).toHaveAttribute('data-oracle-state', 'sealed');
  expect(machineControl).toHaveAttribute('data-oracle-control-label', 'REVEAL');
  await user.click(
    screen.getByRole('button', {
      name: /Reveal sealed result for Azelaic Topical Acid/i,
    }),
  );
  expect(machine).toHaveAttribute('data-oracle-state', 'opening');
  expect(screen.getByText('REVEALING RESULT')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Preparing your evidence record.' })).toBeVisible();
  expect(machineControl).toHaveAttribute('data-oracle-control-label', 'REVEAL');
  expect(machineControl).toHaveAttribute('data-oracle-control-busy', 'true');
  fireEvent.animationEnd(document.querySelector('[data-oracle-motion="opening"]')!);
  expect(machine).toHaveAttribute('data-oracle-state', 'transmitting');
  expect(machineControl).toHaveAttribute('data-oracle-control-label', 'none');
  expect(screen.queryByText('TEST LONGER')).not.toBeInTheDocument();
  fireEvent.animationEnd(document.querySelector('[data-oracle-motion="transmission"]')!);
  expect(machine).toHaveAttribute('data-oracle-state', 'verdict_revealed');
  expect(screen.getByRole('heading', { name: 'The result is in.' })).toBeVisible();
  expect(screen.getByText('A small favorable shift showed up.')).toBeVisible();
  const recommendationRegion = screen.getByLabelText('Result recommendation');
  expect(recommendationRegion.querySelector('p')).toHaveTextContent(
    'Visible redness moved in the intended direction.',
  );
  expect(document.querySelector('[data-firmware-state="resolved"]')).toHaveTextContent(
    'TEST LONGER',
  );
  expect(document.querySelector('[data-firmware-state="resolved"]')).toHaveTextContent('TRIAL 014');
  expect(
    document.querySelector('[data-fv-part="screen-header"] [data-oracle-trial-identity]'),
  ).toHaveTextContent('FV–014');
  expect(machineControl).toHaveAttribute('data-oracle-control-label', 'KEEP');
  expect(document.querySelector('[data-oracle-machine]')).toBe(machine);
  const amber = screen.getByRole('button', {
    name: 'Keep this result',
  });
  fireEvent.click(amber);
  fireEvent.click(amber);
  expect(machine).toHaveAttribute('data-oracle-state', 'committing');
  expect(machineControl).toHaveAttribute('data-oracle-control-label', 'none');
  expect(screen.queryByText('EVIDENCE RECORDED')).not.toBeInTheDocument();
  expect(screen.getByText('SAVING RESULT')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Saving your result.' })).toBeVisible();
  const savingFirmware = document.querySelector<HTMLElement>('[data-firmware-state="resolved"]')!;
  expect(savingFirmware).toHaveTextContent('RECORD STATUS');
  expect(savingFirmware).toHaveTextContent('SAVING');
  expect(savingFirmware).not.toHaveTextContent('EVIDENCE RECORD');
  expect(savingFirmware).not.toHaveTextContent('IN PROGRESS');
  expect(within(savingFirmware).queryByText('STATUS', { exact: true })).not.toBeInTheDocument();
  expect(within(savingFirmware).queryByText('RECORDING', { exact: true })).not.toBeInTheDocument();
  const paperDuringCommit = document.querySelector<HTMLButtonElement>('[data-oracle-paper]')!;
  expect(paperDuringCommit).toHaveTextContent('FV–014');
  fireEvent.animationEnd(document.querySelector('[data-oracle-motion="commit"]')!);
  expect(machine).toHaveAttribute('data-oracle-state', 'dispensing');
  expect(machineControl).toHaveAttribute('data-oracle-control-label', 'none');
  expect(screen.getByText('SAVING RESULT')).toBeVisible();
  expect(savingFirmware).toHaveTextContent('RECORD STATUS');
  expect(savingFirmware).toHaveTextContent('SAVING');
  expect(screen.queryByRole('button', { name: /Evidence record for/ })).not.toBeInTheDocument();
  const paper = document.querySelector<HTMLButtonElement>('[data-oracle-paper]')!;
  expect(paper).toBe(paperDuringCommit);
  expect(paper).toHaveAttribute('data-paper-coordinate-system', 'oracle-machine');
  expect(paper).toHaveAttribute('data-paper-rotation', '0');
  expect(paper).toHaveAttribute('data-paper-scale', '1');
  expect(paper).toHaveAttribute('data-paper-horizontal-offset', '0');
  fireEvent.animationEnd(paper);
  expect(screen.getByText('RESULT READY')).toBeVisible();
  expect(screen.getByText('Take your evidence record.')).toBeVisible();
  expect(screen.queryByText('EVIDENCE READY')).not.toBeInTheDocument();
  const collectible = screen.getByRole('button', {
    name: /Evidence record for Naturium · Azelaic Topical Acid/i,
  });
  expect(collectible).toBeVisible();
  expect(collectible).toHaveFocus();
  await user.click(collectible);
  fireEvent.animationEnd(paper);

  expect(machine).toHaveAttribute('data-oracle-state', 'collected');
  expect(machineControl).toHaveAttribute('data-oracle-control-label', 'none');
  expect(document.querySelector('[data-oracle-paper]')).toBeNull();
  await waitFor(() => expect(screen.getByRole('button', { name: 'DONE' })).toHaveFocus());
  expect(screen.getByRole('button', { name: 'VIEW EVIDENCE' })).toBeVisible();
  expect(screen.getAllByRole('heading', { name: 'EVIDENCE RECORDED' })).toHaveLength(1);
  expect(screen.queryByText('Evidence recorded.', { exact: true })).not.toBeInTheDocument();
  expect(screen.getByText('Your result is saved.')).toBeVisible();
  expect(screen.getAllByText('FV–014').length).toBeGreaterThan(0);
  expect(screen.getByText('Naturium · Azelaic Topical Acid')).toBeVisible();
  expect(screen.getByText('A small favorable shift showed up.')).toBeVisible();
  expect(screen.getByText('TEST LONGER')).toBeVisible();
  expect(document.querySelector('[data-result-summary]')).toBeVisible();
  expect(document.querySelector('[data-result-actions]')).toBeVisible();

  await user.click(screen.getByRole('button', { name: 'VIEW EVIDENCE' }));
  const detail = screen.getByRole('heading', {
    name: 'EVIDENCE DETAIL',
  }).parentElement!;
  expect(within(detail).getByText('FV–014')).toBeVisible();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('heading', { name: 'EVIDENCE DETAIL' })).not.toBeInTheDocument();

  await waitFor(() => {
    const stored = JSON.parse(localStorage.getItem('face-value:structured-demo:v1') ?? '{}') as {
      archive?: Array<{ id: string }>;
      record?: { id: string; accession: string };
    };
    expect(stored.archive).toHaveLength(1);
    expect(stored.archive?.[0].id).toBe(stored.record?.id);
    expect(stored.record?.accession).toBe('FV–014');
  });

  await user.click(screen.getByRole('button', { name: 'DONE' }));
  expect(screen.getByRole('heading', { name: 'Your trials' })).toBeVisible();
  expect(screen.getByText('NO TRIAL IN PROGRESS')).toBeVisible();
  expect(document.querySelector('[data-latest-verdict-cassette]')).toBeVisible();
  expect(document.querySelector('[data-cassette-variant="latest-verdict"]')).toHaveAttribute(
    'data-cassette-state',
    'partially-revealed',
  );
  const latestPaper = document.querySelector('[data-latest-verdict-record]')!;
  expect(latestPaper).toHaveTextContent('RESULT');
  expect(latestPaper).not.toHaveTextContent('COMPARABLE');
  expect(screen.getAllByText('LATEST VERDICT').length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: 'START A NEW TRIAL' })).toBeVisible();

  await user.click(
    screen.getByRole('button', {
      name: 'View trial FV–014 for Naturium · Azelaic Topical Acid',
    }),
  );
  expect(screen.getByRole('heading', { name: 'SAVED RESULT' })).toBeVisible();
  expect(screen.getAllByText('TEST LONGER').length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button', { name: 'Your trials' }));

  await user.click(
    screen.getByRole('button', {
      name: 'Previous trials, 1 saved result',
    }),
  );
  expect(screen.getByRole('heading', { name: 'Previous trials' })).toBeVisible();
  const archived = screen.getByRole('button', {
    name: /Open saved result FV–014 for Azelaic Topical Acid/i,
  });
  expect(within(archived).getAllByText('FV–014').length).toBeGreaterThan(0);
  await user.click(archived);
  expect(screen.getAllByText('FV–014').length).toBeGreaterThanOrEqual(3);
});
