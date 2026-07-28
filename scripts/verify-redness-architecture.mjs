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
  violations.push('Demo fixture state invents the pending EvidenceRecordViewModel integration');
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

const reducer = await readFile(new URL('../src/app/phaseBMachine.ts', import.meta.url), 'utf8');
if (!reducer.includes('buildMvpRednessEvaluation')) {
  violations.push('phaseBMachine.ts is not wired to the canonical redness evidence adapter');
}

if (violations.length) {
  console.error('Redness architecture verification failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Redness architecture verified across ${sourceFiles.length} production source files.`);
