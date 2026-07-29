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

if (violations.length) {
  console.error('Forbidden client-bundle markers detected:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Client privacy verified across ${(await filesUnder(rootPath)).length} built files.`);
