// Materializes the Local Optics experiment's MediaPipe runtime and face-landmarker model as
// same-origin static files under public/, verifying every byte against the pinned manifest.
//
//   npm run prepare:local-optics                 # model from Google's published URL
//   npm run prepare:local-optics -- --model f    # model from a local file (must match the pin)
//   ... -- --out dir                             # write somewhere other than public/
//
// Output is git-ignored. Nothing is fetched at runtime from a third party.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = join(ROOT, 'src/features/local-optics/local-optics-assets.json');

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function verifyBytes(label, bytes, expected) {
  const actual = { sha256: sha256(bytes), bytes: bytes.length };
  if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) {
    throw new Error(
      `${label} does not match the pinned manifest: expected ${expected.bytes} bytes ${expected.sha256}, ` +
        `got ${actual.bytes} bytes ${actual.sha256}`,
    );
  }
  return actual;
}

export async function prepareLocalOpticsAssets({
  root = ROOT,
  out,
  modelPath,
  fetchImpl = globalThis.fetch,
  log = console.log,
} = {}) {
  const manifest = JSON.parse(await readFile(join(root, 'src/features/local-optics/local-optics-assets.json'), 'utf8'));
  const target = out ?? join(root, 'public', manifest.publicBase);
  const pkgDir = join(root, 'node_modules', manifest.runtime.package);
  const pkg = JSON.parse(await readFile(join(pkgDir, 'package.json'), 'utf8'));
  if (pkg.version !== manifest.runtime.version) {
    throw new Error(`${manifest.runtime.package} ${pkg.version} is installed; the manifest pins ${manifest.runtime.version}`);
  }

  for (const file of manifest.runtime.files) {
    const bytes = await readFile(join(pkgDir, file.name));
    verifyBytes(file.name, bytes, file);
    await mkdir(dirname(join(target, file.name)), { recursive: true });
    await writeFile(join(target, file.name), bytes);
  }

  let modelBytes;
  if (modelPath) {
    modelBytes = await readFile(resolve(modelPath));
  } else {
    const response = await fetchImpl(manifest.model.sourceUrl);
    if (!response.ok) throw new Error(`Model download failed: ${response.status} ${manifest.model.sourceUrl}`);
    modelBytes = Buffer.from(await response.arrayBuffer());
  }
  verifyBytes(manifest.model.name, modelBytes, manifest.model);
  await writeFile(join(target, manifest.model.name), modelBytes);

  await writeFile(
    join(target, 'NOTICE.txt'),
    [
      'Local Optics experiment assets. Not part of the Face Value product.',
      `${manifest.runtime.package}@${manifest.runtime.version} (${manifest.runtime.license}), npm ${manifest.runtime.npmIntegrity}`,
      `${manifest.model.variant} (${manifest.model.license}), ${manifest.model.sourceUrl}, sha256 ${manifest.model.sha256}`,
      'Copyright Google LLC. Licensed under the Apache License, Version 2.0: https://www.apache.org/licenses/LICENSE-2.0',
      '',
    ].join('\n'),
  );
  log(`Local Optics assets verified and written to ${target}`);
  return { target, files: [...manifest.runtime.files.map((f) => f.name), manifest.model.name] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  prepareLocalOpticsAssets({ modelPath: value('--model'), out: value('--out') }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

export { MANIFEST_PATH };
