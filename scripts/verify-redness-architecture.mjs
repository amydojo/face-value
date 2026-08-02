import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, relative } from 'node:path';

const root = new URL('../src/', import.meta.url);
const rootPath = root.pathname;

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

const sourceFiles = (await filesUnder(rootPath)).filter(
  (file) =>
    ['.ts', '.tsx'].includes(extname(file)) &&
    !file.endsWith('.test.ts') &&
    !file.endsWith('.test.tsx'),
);
const violations = [];

for (const file of sourceFiles) {
  const path = relative(rootPath, file);
  const source = await readFile(file, 'utf8');

  if (file.endsWith('.tsx')) {
    for (const scientificIdentifier of [
      'provisionalDetectablePoints',
      'provisionalStrongPoints',
      'classifyProvisionalEffect',
      'classifyCalibratedEffect',
      'classifyEffect',
      'activeDetectableBoundary',
      'rawScoreDelta',
      'evaluateRedness',
      'canonicalRednessFixtures',
    ]) {
      if (source.includes(scientificIdentifier)) {
        violations.push(`${path} contains scientific decision identifier ${scientificIdentifier}`);
      }
    }
  }

  for (const retiredDerivation of ['compareRednessSignals', 'analysisResultFromComparison']) {
    if (source.includes(retiredDerivation)) {
      violations.push(`${path} references retired verdict derivation ${retiredDerivation}`);
    }
  }
}

const captureSourceFiles = sourceFiles.filter((file) => {
  const path = relative(rootPath, file);
  return (
    path.startsWith('features/capture-contract/') || path.startsWith('features/capture-sequence/')
  );
});
for (const file of captureSourceFiles) {
  const path = relative(rootPath, file);
  const source = await readFile(file, 'utf8');
  for (const forbiddenCaptureDependency of [
    'domain/evidence/redness',
    'evidence/redness/thresholds',
    'evaluateRedness',
    'baselineRawMedian',
    'endpointRawMedian',
    'rawScoreDelta',
    'classifyEffect',
    'PROVISIONAL_REDNESS_THRESHOLDS',
  ]) {
    if (source.includes(forbiddenCaptureDependency)) {
      violations.push(
        `${path} crosses the capture/evaluator boundary through ${forbiddenCaptureDependency}`,
      );
    }
  }
  if (/\bmedian\s*\(|\bdelta\s*=/.test(source)) {
    violations.push(`${path} calculates a median or delta inside capture presentation code`);
  }
}

for (const file of sourceFiles.filter((file) => file.endsWith('.tsx'))) {
  const path = relative(rootPath, file);
  const source = await readFile(file, 'utf8');
  if (/symptoms?.*(recommendedAction|safetyStatus)|severity.*safetyStatus/is.test(source)) {
    violations.push(`${path} maps symptoms or severity directly to verdict or safety state`);
  }
}

const evaluatorOwners = [];
for (const file of sourceFiles) {
  const source = await readFile(file, 'utf8');
  if (/export function evaluateRedness\s*\(/.test(source)) {
    evaluatorOwners.push(relative(rootPath, file));
  }
}
if (
  evaluatorOwners.length !== 1 ||
  evaluatorOwners[0] !== 'domain/evidence/redness/evaluateRedness.ts'
) {
  violations.push(
    `Canonical redness evaluator must have one owner; found ${evaluatorOwners.join(', ') || 'none'}`,
  );
}

const burstContract = await readFile(
  new URL('../src/domain/rednessEvidenceBurst.ts', import.meta.url),
  'utf8',
);
for (const requiredBound of [
  'REDNESS_BURST_REQUIRED_MEASUREMENTS = 3',
  'REDNESS_BURST_MAX_CAPTURE_ATTEMPTS = 5',
  'REDNESS_BURST_PROVIDER_MAX_ATTEMPTS = 2',
  'REDNESS_BURST_PROVIDER_CONCURRENCY = 1',
]) {
  if (!burstContract.includes(requiredBound)) {
    violations.push(`Redness burst bound changed or is missing: ${requiredBound}`);
  }
}

const model = await readFile(new URL('../src/domain/model.ts', import.meta.url), 'utf8');
const durableBurstStart = model.indexOf('export interface RednessEvidenceBurst');
const durableBurstEnd = model.indexOf('export interface RednessProviderRequest');
if (durableBurstStart < 0 || durableBurstEnd <= durableBurstStart) {
  violations.push('Durable RednessEvidenceBurst scan boundary is missing');
} else {
  const durableBurstSource = model.slice(durableBurstStart, durableBurstEnd);
  for (const forbiddenDurableField of [
    'Blob',
    'File',
    'image:',
    'imageBytes',
    'base64',
    'dataUrl',
    'objectUrl',
    'signedUrl',
    'providerTask',
    'rawPayload',
    'median',
  ]) {
    if (durableBurstSource.includes(forbiddenDurableField)) {
      violations.push(
        `Durable RednessEvidenceBurst contains forbidden field ${forbiddenDurableField}`,
      );
    }
  }
}

const cameraViewport = await readFile(
  new URL('../src/features/capture-contract/CameraViewport.tsx', import.meta.url),
  'utf8',
);
if (!cameraViewport.includes('analyzeRednessBurstFrames')) {
  violations.push('CameraViewport.tsx is not wired to the bounded burst orchestrator');
}
if (cameraViewport.includes('analyzeLongitudinalCapture')) {
  violations.push('CameraViewport.tsx invokes the single-capture provider path directly');
}

const captureGuidance = await readFile(
  new URL('../src/features/capture-sequence/guidance.ts', import.meta.url),
  'utf8',
);
if (!/alignment:\s*frameQualityMode\s*\?\s*'pending'/.test(captureGuidance)) {
  violations.push(
    'Native frame-quality presentation must not mark unmeasured alignment as passing',
  );
}

const cameraFactory = await readFile(
  new URL('../src/adapters/camera/youcam-camera-kit/index.ts', import.meta.url),
  'utf8',
);
if (!cameraFactory.includes(': new NativeBrowserCameraAdapter()')) {
  violations.push('Production camera factory no longer resolves to NativeBrowserCameraAdapter');
}

const thresholdSource = await readFile(
  new URL('../src/domain/evidence/redness/thresholds.ts', import.meta.url),
);
const thresholdHash = createHash('sha256').update(thresholdSource).digest('hex');
if (thresholdHash !== 'bcf1ac22bc1187f47122687e1c859c81e7d6c6b11d481ca7cddf241e5b00dfc6') {
  violations.push(`Frozen provisional threshold source changed byte-for-byte (${thresholdHash})`);
}

for (const file of sourceFiles) {
  const path = relative(rootPath, file);
  const source = await readFile(file, 'utf8');
  if (
    source.includes('ui_score') &&
    ![
      'adapters/analysis/youcam/rednessEvidenceAdapter.ts',
      'domain/evidence/redness/evaluateRedness.ts',
      'domain/evidence/redness/types.ts',
    ].includes(path)
  ) {
    violations.push(`${path} contains production ui_score use outside rejection guards`);
  }
}

const demoLabComponent = await readFile(
  new URL('../src/features/demo-lab/DemoLab.tsx', import.meta.url),
  'utf8',
);
for (const forbiddenDemoDependency of [
  'domain/evidence/redness',
  'evaluateRedness',
  'thresholds',
  'EvidenceRecord',
  'OracleRevealScene',
  'LatestVerdictCassette',
  'Archive',
]) {
  if (demoLabComponent.includes(forbiddenDemoDependency)) {
    violations.push(
      `DemoLab.tsx duplicates or directly derives a production screen through ${forbiddenDemoDependency}`,
    );
  }
}

for (const duplicatedScreenMarker of [
  'data-fv-screen="saved-result"',
  'data-fv-screen="previous-trials"',
  'data-fv-screen="oracle-reveal"',
  'data-latest-verdict-cassette',
]) {
  if (demoLabComponent.includes(duplicatedScreenMarker)) {
    violations.push(`DemoLab.tsx contains duplicated production markup ${duplicatedScreenMarker}`);
  }
}

const demoFixtureState = await readFile(
  new URL('../src/features/demo-lab/demoFixtureState.ts', import.meta.url),
  'utf8',
);
if (!demoFixtureState.includes('openCurrentSavedResultRoute')) {
  violations.push('Demo fixture state does not use the typed current saved-result route adapter');
}
if (demoFixtureState.includes('EvidenceRecordViewModel')) {
  violations.push('Demo fixture state bypasses the production EvidenceRecordViewModel adapter');
}
for (const presentationState of ['openDisclosure', 'technicalMetadataOpen']) {
  if (demoFixtureState.includes(presentationState)) {
    violations.push(
      `Demo fixture state mixes Evidence Record presentation state into scientific fixtures through ${presentationState}`,
    );
  }
}

const demoEvidenceRecordAdapter = await readFile(
  new URL('../src/features/demo-lab/evidenceRecordDemoAdapter.ts', import.meta.url),
  'utf8',
);
if (!demoEvidenceRecordAdapter.includes('EvidenceRecordDisclosureState')) {
  violations.push('Demo Evidence Record adapter is not typed against production disclosure state');
}
for (const scientificDependency of [
  'evaluateRedness',
  'canonicalRednessFixtures',
  'rawScoreDelta',
  'provisionalDetectablePoints',
  'provisionalStrongPoints',
]) {
  if (demoEvidenceRecordAdapter.includes(scientificDependency)) {
    violations.push(
      `Demo Evidence Record adapter contains scientific fixture logic through ${scientificDependency}`,
    );
  }
}

const archiveScreen = await readFile(
  new URL('../src/features/archive/Archive.tsx', import.meta.url),
  'utf8',
);
if (archiveScreen.includes('Demo controls') || archiveScreen.includes('Clear demo data')) {
  violations.push('Archive.tsx still exposes scattered demo controls');
}

const productionJourney = await readFile(
  new URL('../src/features/FaceValueApplication.tsx', import.meta.url),
  'utf8',
);
if (productionJourney.includes("type: 'ANALYSIS_SUCCEEDED'")) {
  violations.push(
    'FaceValueApplication.tsx can dispatch the retired caller-supplied analysis result path',
  );
}

const firstTrialScene = await readFile(
  new URL('../src/features/first-trial/FirstTrialScene.tsx', import.meta.url),
  'utf8',
);
for (const forbiddenFirstTrialDependency of [
  'domain/evidence/redness',
  'evidence/redness/thresholds',
  'adapters/analysis',
  'evaluateRedness',
  'classifyEffect',
  'PROVISIONAL_REDNESS_THRESHOLDS',
]) {
  if (firstTrialScene.includes(forbiddenFirstTrialDependency)) {
    violations.push(
      `FirstTrialScene.tsx crosses the evidence boundary through ${forbiddenFirstTrialDependency}`,
    );
  }
}
for (const forbiddenDraftPersistence of [
  'localStorage',
  'sessionStorage',
  'saveStructuredDemoData',
  'saveDemoJourney',
]) {
  if (firstTrialScene.includes(forbiddenDraftPersistence)) {
    violations.push(
      `FirstTrialScene.tsx persists presentation-only draft state through ${forbiddenDraftPersistence}`,
    );
  }
}
if (!productionJourney.includes('return <FirstTrialScene />')) {
  violations.push(
    'FaceValueApplication.tsx does not route the durable first-trial stages through FirstTrialScene',
  );
}
for (const splitFirstTrialCase of [
  "case 'welcome':",
  "case 'product_registration':",
  "case 'job':",
]) {
  if (productionJourney.includes(splitFirstTrialCase)) {
    violations.push(
      `FaceValueApplication.tsx still contains a split first-trial branch ${splitFirstTrialCase}`,
    );
  }
}

const oracleScene = await readFile(
  new URL('../src/features/oracle-reveal/OracleRevealScene.tsx', import.meta.url),
  'utf8',
);
const trialDisplayStart = oracleScene.indexOf('function TrialStateDisplay');
const trialDisplayEnd = oracleScene.indexOf('function OracleMachine');
const trialDisplaySource = oracleScene.slice(trialDisplayStart, trialDisplayEnd);
for (const forbiddenTrialClassification of ['score', 'threshold', 'classify', 'evaluate']) {
  if (trialDisplaySource.toLowerCase().includes(forbiddenTrialClassification)) {
    violations.push(
      `Oracle trial presentation classifies evidence through ${forbiddenTrialClassification}`,
    );
  }
}

const machineMarkerOwners = [];
for (const file of sourceFiles.filter((file) => file.endsWith('.tsx'))) {
  const source = await readFile(file, 'utf8');
  if (source.includes('data-oracle-machine')) {
    machineMarkerOwners.push(relative(rootPath, file));
  }
}
if (
  machineMarkerOwners.length !== 1 ||
  machineMarkerOwners[0] !== 'features/oracle-reveal/OracleRevealScene.tsx'
) {
  violations.push(
    `Oracle hardware marker must have one production owner; found ${machineMarkerOwners.join(', ') || 'none'}`,
  );
}

const specimenMarkerOwners = [];
const thermalLabelOwners = [];
for (const file of sourceFiles.filter((file) => file.endsWith('.tsx'))) {
  const source = await readFile(file, 'utf8');
  if (source.includes('data-oracle-specimen')) {
    specimenMarkerOwners.push(relative(rootPath, file));
  }
  if (source.includes('data-specimen-layer="thermal-evidence-label"')) {
    thermalLabelOwners.push(relative(rootPath, file));
  }
}
const identityLockSpecimenPath = 'features/oracle-reveal/IdentityLockSpecimen.tsx';
if (specimenMarkerOwners.length !== 1 || specimenMarkerOwners[0] !== identityLockSpecimenPath) {
  violations.push(
    `Oracle specimen marker must have one production owner; found ${specimenMarkerOwners.join(', ') || 'none'}`,
  );
}
if (thermalLabelOwners.length !== 1 || thermalLabelOwners[0] !== identityLockSpecimenPath) {
  violations.push(
    `Oracle thermal label must have one production owner; found ${thermalLabelOwners.join(', ') || 'none'}`,
  );
}
const identityLockSpecimen = await readFile(
  new URL('../src/features/oracle-reveal/IdentityLockSpecimen.tsx', import.meta.url),
  'utf8',
);
for (const flattenedSpecimenAsset of ['<img', '.png', '.jpg', '.webp']) {
  if (identityLockSpecimen.toLowerCase().includes(flattenedSpecimenAsset)) {
    violations.push(
      `IdentityLockSpecimen.tsx flattens the canonical specimen through ${flattenedSpecimenAsset}`,
    );
  }
}
if (oracleScene.includes('function OracleSpecimen')) {
  violations.push('OracleRevealScene.tsx retains a second specimen implementation');
}

const faceValueStyles = await readFile(
  new URL('../src/styles/FaceValue.module.css', import.meta.url),
  'utf8',
);
for (const retiredFirstTrialBridge of [
  'registeredScreen',
  'registeredSpecimen',
  'PRODUCT REGISTERED',
  'Your product is ready.',
]) {
  if (
    productionJourney.includes(retiredFirstTrialBridge) ||
    firstTrialScene.includes(retiredFirstTrialBridge) ||
    faceValueStyles.includes(retiredFirstTrialBridge)
  ) {
    violations.push(
      `Production first-trial source retains the legacy bridge marker ${retiredFirstTrialBridge}`,
    );
  }
}

const trialTruthReducer = await readFile(
  new URL('../src/app/trialTruthMachine.ts', import.meta.url),
  'utf8',
);
for (const requiredBoundary of [
  'trialTruthMatchesCurrentTrial',
  "case 'COMPARISON_CREATED'",
  'applyTrialTruthToRednessEvaluation',
]) {
  if (!trialTruthReducer.includes(requiredBoundary)) {
    violations.push(`Trial truth reducer boundary is missing ${requiredBoundary}`);
  }
}
for (const forbiddenTrialTruthDependency of ['adapters/camera', 'analysis/youcam/contracts']) {
  if (trialTruthReducer.includes(forbiddenTrialTruthDependency)) {
    violations.push(
      `Trial truth reducer crosses into camera or provider code through ${forbiddenTrialTruthDependency}`,
    );
  }
}

const trialTruthSurface = await readFile(
  new URL('../src/features/trial-truth/TrialTruthSurface.tsx', import.meta.url),
  'utf8',
);
for (const forbiddenUiDecision of [
  'evaluateRedness',
  'safetyStatus',
  'recommendedAction',
  'effectClassification',
  'attributionQuality',
]) {
  if (trialTruthSurface.includes(forbiddenUiDecision)) {
    violations.push(
      `TrialTruthSurface.tsx contains UI-side decision logic through ${forbiddenUiDecision}`,
    );
  }
}

const reducer = await readFile(new URL('../src/app/phaseBMachine.ts', import.meta.url), 'utf8');
if (!reducer.includes('buildMvpRednessEvaluation')) {
  violations.push('phaseBMachine.ts is not wired to the canonical redness evidence adapter');
}

const evidenceRecordComponent = await readFile(
  new URL('../src/features/evidence-record/EvidenceRecord.tsx', import.meta.url),
  'utf8',
);
for (const forbiddenEvidenceRecordDependency of [
  'evaluateRedness',
  'buildMvpRednessEvaluation',
  'classifyEffect',
  'PROVISIONAL_REDNESS_THRESHOLDS',
  'domain/evidence/redness/thresholds',
]) {
  if (evidenceRecordComponent.includes(forbiddenEvidenceRecordDependency)) {
    violations.push(
      `EvidenceRecord.tsx references scientific decision dependency ${forbiddenEvidenceRecordDependency}`,
    );
  }
}

const evidenceRecordAdapter = await readFile(
  new URL('../src/features/evidence-record/evidenceRecordViewModel.ts', import.meta.url),
  'utf8',
);
for (const forbiddenPresentationDependency of [
  'evaluateRedness',
  'buildMvpRednessEvaluation',
  'classifyEffect',
  'PROVISIONAL_REDNESS_THRESHOLDS',
  'domain/evidence/redness/thresholds',
]) {
  if (evidenceRecordAdapter.includes(forbiddenPresentationDependency)) {
    violations.push(
      `evidenceRecordViewModel.ts references scientific decision dependency ${forbiddenPresentationDependency}`,
    );
  }
}

const calibrationComponent = await readFile(
  new URL('../src/features/calibration-redness/RednessCalibration.tsx', import.meta.url),
  'utf8',
);
for (const forbiddenCalibrationCalculation of [
  'analyzeRednessCalibration',
  'empiricalQuantileR7',
  'participantClusterBootstrap',
  'withinClusterResidualSd',
  'repeatabilityCoefficient(',
  'iccAbsoluteAgreementSingle',
  'Math.',
]) {
  if (calibrationComponent.includes(forbiddenCalibrationCalculation)) {
    violations.push(
      `RednessCalibration.tsx performs scientific work through ${forbiddenCalibrationCalculation}`,
    );
  }
}

const calibrationAnalysisOwners = [];
for (const file of sourceFiles) {
  const source = await readFile(file, 'utf8');
  if (/export function analyzeRednessCalibration\s*\(/.test(source)) {
    calibrationAnalysisOwners.push(relative(rootPath, file));
  }
}
if (
  calibrationAnalysisOwners.length !== 1 ||
  calibrationAnalysisOwners[0] !== 'domain/calibration/redness/analysis.ts'
) {
  violations.push(
    `Calibration analysis must have one pure domain owner; found ${calibrationAnalysisOwners.join(', ') || 'none'}`,
  );
}

const productionEvaluator = await readFile(
  new URL('../src/domain/evidence/redness/evaluateRedness.ts', import.meta.url),
  'utf8',
);
for (const [owner, source] of [
  ['evaluateRedness.ts', productionEvaluator],
  ['thresholds.ts', thresholdSource.toString('utf8')],
]) {
  if (/from\s+['"][^'"]*calibration|import\s*\([^)]*calibration/i.test(source)) {
    violations.push(`${owner} imports calibration or exploratory registry authority`);
  }
}

const calibrationRegistry = await readFile(
  new URL('../src/domain/calibration/redness/registry.ts', import.meta.url),
  'utf8',
);
for (const frozenRegistryOutput of [
  "threshold_source: 'technical_calibration'",
  'approved_by: null',
  "status: 'exploratory'",
  'provisional: true',
  "entry.status !== 'exploratory'",
  'entry.approved_by !== null',
  'entry.provisional !== true',
]) {
  if (!calibrationRegistry.includes(frozenRegistryOutput)) {
    violations.push(`Exploratory registry freeze is missing ${frozenRegistryOutput}`);
  }
}

const calibrationFiles = sourceFiles.filter((file) => {
  const path = relative(rootPath, file);
  return (
    path.startsWith('domain/calibration/redness/') ||
    path.startsWith('features/calibration-redness/')
  );
});
for (const file of calibrationFiles) {
  const path = relative(rootPath, file);
  const source = await readFile(file, 'utf8');
  if (/provisional\s*:\s*false/.test(source)) {
    violations.push(`${path} attempts to emit non-provisional hackathon calibration output`);
  }
  if (/infer\w*SkinTone|classify\w*SkinTone|skinToneClassifier/i.test(source)) {
    violations.push(`${path} contains automated skin-tone inference`);
  }
}

const calibrationContract = await readFile(
  new URL('../src/domain/calibration/redness/types.ts', import.meta.url),
  'utf8',
);
const calibrationPersistence = await readFile(
  new URL('../src/adapters/persistence/rednessCalibrationStore.ts', import.meta.url),
  'utf8',
);
const calibrationDurableSource = `${calibrationContract}\n${calibrationPersistence}`;
for (const forbiddenCalibrationField of [
  /\bBlob\b/,
  /\bFile\b/,
  /\bthumbnail\b/i,
  /\bmaskImage\b/i,
  /\bimageBytes\b/i,
  /\bbase64\b/i,
  /\bdataUrl\b/i,
  /\bobjectUrl\b/i,
  /\bsignedUrl\b/i,
  /\bproviderTaskId\b/i,
  /\brawProviderPayload\b/i,
  /\bname\??\s*:/i,
  /\bemail\??\s*:/i,
]) {
  if (forbiddenCalibrationField.test(calibrationDurableSource)) {
    violations.push(
      `Calibration durable contract contains forbidden field ${forbiddenCalibrationField}`,
    );
  }
}
if (!calibrationContract.includes('includesFaceImage: false')) {
  violations.push('Calibration observations no longer freeze includesFaceImage to false');
}

const registryIsolation = await readFile(
  new URL('../src/domain/evidence/redness/calibrationRegistryIsolation.ts', import.meta.url),
  'utf8',
);
for (const requiredIsolationMarker of [
  "value.status === 'exploratory'",
  'value.approved_by === null',
  "reason: 'exploratory_not_approved'",
  'configuration: null',
]) {
  if (!registryIsolation.includes(requiredIsolationMarker)) {
    violations.push(`Production registry isolation is missing ${requiredIsolationMarker}`);
  }
}

const calibrationAnalysis = await readFile(
  new URL('../src/domain/calibration/redness/analysis.ts', import.meta.url),
  'utf8',
);
for (const requiredExclusionMarker of [
  'exclusions.push',
  "'hard_capture_failure'",
  "'explicit_intervention'",
  "'degraded_condition'",
  "'missing_or_non_finite_raw_score'",
  "'fewer_than_three_accepted_frames'",
]) {
  if (!calibrationAnalysis.includes(requiredExclusionMarker)) {
    violations.push(
      `Calibration analysis can hide invalid evidence; missing ${requiredExclusionMarker}`,
    );
  }
}
if (!calibrationComponent.includes('viewModel.exclusions.map')) {
  violations.push('Calibration instrument no longer renders excluded observations and reasons');
}
if (
  [
    "({ conditionType }) => conditionType === 'no_treatment_longitudinal'",
    '`${point.participantId}\\u001f${point.conditionId}`',
    'participantId: earlier.participantId',
    'within-participant',
  ].some((marker) => !calibrationAnalysis.includes(marker))
) {
  violations.push('Longitudinal calibration no longer proves within-participant pairing');
}
for (const requiredTechnicalMarker of [
  "conditionType }) => conditionType === 'standard'",
  'observation.participantId',
  'observation.sessionId',
  'observation.conditionId',
  "kind: 'matched_formal_recapture'",
  'technical = formalRecaptureComparisons(eligible)',
]) {
  if (!calibrationAnalysis.includes(requiredTechnicalMarker)) {
    violations.push(
      `Technical N95 formal-recapture boundary is missing ${requiredTechnicalMarker}`,
    );
  }
}
if (
  calibrationAnalysis.includes("kind: 'within_burst'") ||
  calibrationAnalysis.includes('eligible signed within-burst frame pairs')
) {
  violations.push(
    'Within-burst agreement evidence is being reused as a no-change threshold comparison',
  );
}

const liveProvenanceOwners = [];
for (const file of sourceFiles) {
  const source = await readFile(file, 'utf8');
  if (source.includes("collectionSource: 'live_provider'")) {
    liveProvenanceOwners.push(relative(rootPath, file));
  }
}
if (
  liveProvenanceOwners.length !== 1 ||
  liveProvenanceOwners[0] !== 'features/calibration-redness/rednessCalibrationCollection.ts'
) {
  violations.push(
    `Genuine live calibration provenance must have one completed internal owner; found ${liveProvenanceOwners.join(', ') || 'none'}`,
  );
}
for (const requiredImportBoundary of [
  "collectionSource: 'imported_unverified'",
  'REDNESS_CALIBRATION_MAX_SERIALIZED_BYTES',
  'rednessCalibrationUtf8Bytes(raw)',
]) {
  if (!calibrationPersistence.includes(requiredImportBoundary)) {
    violations.push(`Calibration persistence boundary is missing ${requiredImportBoundary}`);
  }
}
for (const requiredObservationBound of [
  'REDNESS_CALIBRATION_MAX_FIELD_BYTES',
  'REDNESS_CALIBRATION_MAX_OBSERVATION_BYTES',
  "'oversized_field'",
  "'oversized_observation'",
]) {
  if (
    !calibrationContract.includes(requiredObservationBound) &&
    !calibrationAnalysis.includes(requiredObservationBound)
  ) {
    const calibrationValidation = await readFile(
      new URL('../src/domain/calibration/redness/validation.ts', import.meta.url),
      'utf8',
    );
    if (!calibrationValidation.includes(requiredObservationBound)) {
      violations.push(
        `Calibration observation byte boundary is missing ${requiredObservationBound}`,
      );
    }
  }
}

const calibrationRouteOwners = [];
for (const file of sourceFiles) {
  const source = await readFile(file, 'utf8');
  if (/['"]\/calibration\/redness/.test(source)) {
    calibrationRouteOwners.push(relative(rootPath, file));
  }
}
const allowedCalibrationRouteOwners = ['app/router/AppRouter.tsx', 'features/demo-lab/DemoLab.tsx'];
if (
  calibrationRouteOwners.some((owner) => !allowedCalibrationRouteOwners.includes(owner)) ||
  !allowedCalibrationRouteOwners.every((owner) => calibrationRouteOwners.includes(owner))
) {
  violations.push(
    `Calibration route must exist only in the router and protected Demo Lab utility; found ${calibrationRouteOwners.join(', ') || 'none'}`,
  );
}

const calibrationRoute = await readFile(
  new URL('../api/calibration/redness.ts', import.meta.url),
  'utf8',
);
const vercelRoutes = await readFile(new URL('../vercel.json', import.meta.url), 'utf8');
if (!calibrationRoute.includes('serveProtectedDemo') || !calibrationRoute.includes('../demo.js')) {
  violations.push('Calibration route does not reuse the signed Demo Lab engineering session');
}
if (
  !vercelRoutes.includes('"src": "/calibration/redness/?"') ||
  !vercelRoutes.includes('"dest": "/api/calibration/redness"')
) {
  violations.push('Vercel does not route /calibration/redness through its protected handler');
}

for (const file of sourceFiles) {
  const path = relative(rootPath, file);
  const source = await readFile(file, 'utf8');
  for (const forbiddenClaim of [
    'Clinically validated',
    'Scientifically proven threshold',
    'Dermatologist approved',
    'Medical-grade accuracy',
    '95% clinically certain',
    'This product works',
    'Validated for all skin tones',
  ]) {
    if (source.toLocaleLowerCase('en-US').includes(forbiddenClaim.toLocaleLowerCase('en-US'))) {
      violations.push(`${path} contains forbidden scientific or clinical claim ${forbiddenClaim}`);
    }
  }
}

for (const requiredSignatureMarker of [
  "title: 'Observed change'",
  "title: 'Measurement support'",
  "title: 'Trial truth'",
  "title: 'Evidence boundaries'",
  "title: 'Supported next action'",
  "'Provider measurement'",
  "'Face Value deterministic evaluation'",
  "'Participant report'",
  "'Unavailable evidence'",
]) {
  if (!evidenceRecordAdapter.includes(requiredSignatureMarker)) {
    violations.push(`Evidence Record response signature is missing ${requiredSignatureMarker}`);
  }
}
if (!evidenceRecordComponent.includes('data-redness-response-signature')) {
  violations.push('EvidenceRecord.tsx no longer exposes the progressive Response Signature panel');
}
for (const file of sourceFiles.filter((file) => {
  const path = relative(rootPath, file);
  return path.startsWith('adapters/persistence/') || path === 'domain/model.ts';
})) {
  const path = relative(rootPath, file);
  const source = await readFile(file, 'utf8');
  if (/ResponseSignature/.test(source)) {
    violations.push(`${path} persists a parallel ResponseSignature authority`);
  }
}

const trialTruthPresentationFiles = sourceFiles.filter((file) =>
  relative(rootPath, file).startsWith('features/trial-truth/'),
);
for (const file of trialTruthPresentationFiles) {
  const path = relative(rootPath, file);
  const source = await readFile(file, 'utf8');
  for (const forbiddenDecisionIdentifier of [
    'safety_interruption',
    'retry_alone',
    'not_proving_job',
  ]) {
    if (source.includes(forbiddenDecisionIdentifier)) {
      violations.push(
        `${path} contains trial-truth scientific decision identifier ${forbiddenDecisionIdentifier}`,
      );
    }
  }
}

if (violations.length) {
  console.error('Redness architecture verification failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Redness architecture verified across ${sourceFiles.length} production source files.`);
