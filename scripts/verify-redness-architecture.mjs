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

const evidenceRecordComponent = await readFile(
  new URL('../src/features/evidence-record/EvidenceRecord.tsx', import.meta.url),
  'utf8',
);
for (const forbiddenEvidenceRecordDependency of [
  'evaluateRedness',
  'buildMvpRednessEvaluation',
  'classifyEffect',
  'PROVISIONAL_REDNESS_THRESHOLDS',
  "domain/evidence/redness/thresholds",
]) {
  if (evidenceRecordComponent.includes(forbiddenEvidenceRecordDependency)) {
    violations.push(
      `EvidenceRecord.tsx references scientific decision dependency ${forbiddenEvidenceRecordDependency}`,
    );
  }
}

const evidenceRecordAdapter = await readFile(
  new URL(
    '../src/features/evidence-record/evidenceRecordViewModel.ts',
    import.meta.url,
  ),
  'utf8',
);
for (const forbiddenPresentationDependency of [
  'evaluateRedness',
  'buildMvpRednessEvaluation',
  'classifyEffect',
  'PROVISIONAL_REDNESS_THRESHOLDS',
  "domain/evidence/redness/thresholds",
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
