import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = new URL('../dist/', import.meta.url);
const forbidden = [
  'YOUCAM_API_KEY',
  'YOUCAM_SPIKE_TOKEN',
  'Authorization: Bearer',
  'providerTaskId',
  'data:image',
  'blob:',
  'readAsDataURL',
  'MediaStream',
  'temporary mask URL',
  'signed provider URL',
  'raw provider payload',
  ...[process.env.YOUCAM_API_KEY, process.env.YOUCAM_SPIKE_TOKEN]
    .map((value) => value?.trim())
    .filter((value) => value),
];

const requiredPairs = [
  {
    trigger: 'URL.createObjectURL',
    cleanup: 'URL.revokeObjectURL',
    description: 'object URL creation without bundled revocation support',
  },
];

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

const rootPath = ROOT.pathname;
try {
  const rootStat = await stat(rootPath);
  if (!rootStat.isDirectory()) throw new Error('dist is not a directory');
} catch {
  console.error('Client privacy verification requires a completed production build in dist/.');
  process.exit(1);
}

const violations = [];
for (const file of await filesUnder(rootPath)) {
  const content = await readFile(file);
  const text = content.toString('utf8');
  for (const marker of forbidden) {
    if (text.includes(marker)) {
      violations.push(`${relative(rootPath, file)} contains ${JSON.stringify(marker)}`);
    }
  }
  for (const pair of requiredPairs) {
    if (text.includes(pair.trigger) && !text.includes(pair.cleanup)) {
      violations.push(`${relative(rootPath, file)} contains ${pair.description}`);
    }
  }
}

const modelSource = await readFile(new URL('../src/domain/model.ts', import.meta.url), 'utf8');
const durableBurstStart = modelSource.indexOf('export interface RednessEvidenceBurst');
const durableBurstEnd = modelSource.indexOf('export interface RednessProviderRequest');
if (durableBurstStart < 0 || durableBurstEnd <= durableBurstStart) {
  violations.push('src/domain/model.ts durable burst scan boundary is missing');
} else {
  const durableBurstSource = modelSource.slice(durableBurstStart, durableBurstEnd);
  for (const marker of [
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
    'MediaStream',
  ]) {
    if (durableBurstSource.includes(marker)) {
      violations.push(`src/domain/model.ts durable burst contains ${JSON.stringify(marker)}`);
    }
  }
}

const persistenceSource = await readFile(
  new URL('../src/adapters/persistence/localObservationStore.ts', import.meta.url),
  'utf8',
);
const serializerStart = persistenceSource.indexOf('export function toPersistedDemoData');
const serializerEnd = persistenceSource.indexOf('export function saveStructuredDemoData');
if (serializerStart < 0 || serializerEnd <= serializerStart) {
  violations.push('localObservationStore serializer scan boundary is missing');
} else {
  const serializerSource = persistenceSource.slice(serializerStart, serializerEnd);
  for (const marker of [
    'activeRednessBurst',
    'Blob',
    'File',
    'imageBytes',
    'base64',
    'objectUrl',
    'signedUrl',
    'providerTask',
    'rawPayload',
    'MediaStream',
  ]) {
    if (serializerSource.includes(marker)) {
      violations.push(
        `localObservationStore serializer includes runtime/image marker ${JSON.stringify(marker)}`,
      );
    }
  }
}

const calibrationContractSource = await readFile(
  new URL('../src/domain/calibration/redness/types.ts', import.meta.url),
  'utf8',
);
const calibrationPersistenceSource = await readFile(
  new URL('../src/adapters/persistence/rednessCalibrationStore.ts', import.meta.url),
  'utf8',
);
const calibrationRegistrySource = await readFile(
  new URL('../src/domain/calibration/redness/registry.ts', import.meta.url),
  'utf8',
);
const calibrationComponentSource = await readFile(
  new URL('../src/features/calibration-redness/RednessCalibration.tsx', import.meta.url),
  'utf8',
);
const calibrationCollectorSource = await readFile(
  new URL('../src/features/calibration-redness/RednessCalibrationCollector.tsx', import.meta.url),
  'utf8',
);
const calibrationCollectionSource = await readFile(
  new URL('../src/features/calibration-redness/rednessCalibrationCollection.ts', import.meta.url),
  'utf8',
);
const calibrationDurableSource = [
  calibrationContractSource,
  calibrationPersistenceSource,
  calibrationRegistrySource,
].join('\n');
for (const marker of [
  /\bBlob\b/,
  /\bFile\b/,
  /\bimageBytes\b/i,
  /\bbase64\b/i,
  /\bdataUrl\b/i,
  /\bobjectUrl\b/i,
  /\bsignedUrl\b/i,
  /\bproviderTaskId\b/i,
  /\brawProviderPayload\b/i,
  /\bthumbnail\b/i,
  /\bmaskImage\b/i,
  /\bname\??\s*:/i,
  /\bemail\??\s*:/i,
]) {
  if (marker.test(calibrationDurableSource)) {
    violations.push(`calibration durable/export source contains ${String(marker)}`);
  }
}
if (!calibrationContractSource.includes('includesFaceImage: false')) {
  violations.push('calibration observation contract permits face-image persistence');
}
if (
  !calibrationPersistenceSource.includes(
    "REDNESS_CALIBRATION_STORAGE_KEY = 'face-value:calibration:redness:v1'",
  ) ||
  /\bSTORAGE_KEY\b/.test(calibrationPersistenceSource) ||
  /\bDEMO_JOURNEY_STORAGE_KEY\b/.test(calibrationPersistenceSource)
) {
  violations.push('calibration persistence is not isolated behind its own storage key');
}
const clearStart = calibrationPersistenceSource.indexOf(
  'export function clearRednessCalibrationData',
);
const clearEnd = calibrationPersistenceSource.indexOf(
  'export function exportRednessCalibrationData',
);
const clearSource = calibrationPersistenceSource.slice(clearStart, clearEnd);
if (
  clearStart < 0 ||
  clearEnd <= clearStart ||
  !clearSource.includes('removeItem(REDNESS_CALIBRATION_STORAGE_KEY)') ||
  /\.clear\s*\(/.test(clearSource)
) {
  violations.push('calibration clear operation is broader than its isolated storage key');
}
for (const networkOrImagePrimitive of [
  'fetch(',
  'navigator.sendBeacon',
  'XMLHttpRequest',
  'URL.createObjectURL',
  'new Blob',
  'FileReader',
]) {
  if (
    [calibrationComponentSource, calibrationCollectorSource, calibrationCollectionSource].some(
      (source) => source.includes(networkOrImagePrimitive),
    )
  ) {
    violations.push(
      `calibration instrument contains forbidden network/image primitive ${networkOrImagePrimitive}`,
    );
  }
}

if (violations.length) {
  console.error('Forbidden client-bundle markers detected:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Client privacy verified across ${(await filesUnder(rootPath)).length} built files.`);
