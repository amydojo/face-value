import { readdir, readFile } from 'node:fs/promises';
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

if (violations.length) {
  console.error('Redness architecture verification failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Redness architecture verified across ${sourceFiles.length} production source files.`);
