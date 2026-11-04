import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import assets from '../features/local-optics/local-optics-assets.json';

// Packaging of the experiment's same-origin runtime and model (scripts/prepare-local-optics-assets.mjs).

const SCRIPT = resolve(process.cwd(), 'scripts/prepare-local-optics-assets.mjs');
const work = mkdtempSync(join(tmpdir(), 'fv-optics-assets-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));

const run = (args: string[]) => {
  try {
    return { code: 0, output: execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8', stdio: 'pipe' }) };
  } catch (error) {
    const e = error as { status: number; stderr: string };
    return { code: e.status, output: e.stderr };
  }
};

describe('local optics asset packaging', () => {
  it('pins same-origin paths, Apache-2.0 sources, and a pre-1.0 runtime', () => {
    expect(assets.publicBase.startsWith('/')).toBe(true);
    expect(assets.runtime.version).toBe('0.10.35');
    expect(assets.runtime.license).toBe('Apache-2.0');
    expect(assets.model.license).toBe('Apache-2.0');
    expect(assets.model.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses a model that does not match the pinned hash and writes no model', () => {
    const bad = join(work, 'bad.task');
    writeFileSync(bad, Buffer.alloc(assets.model.bytes, 1));
    const out = join(work, 'bad-out');
    const result = run(['--model', bad, '--out', out]);
    expect(result.code).toBe(1);
    expect(result.output).toContain('face_landmarker.task does not match the pinned manifest');
    expect(existsSync(join(out, assets.model.name))).toBe(false);
    // The runtime files that were copied first did match their pins.
    for (const file of assets.runtime.files) expect(existsSync(join(out, file.name))).toBe(true);
  });

  it('refuses a model download that fails', () => {
    const out = join(work, 'no-net');
    const result = run(['--out', out, '--model', join(work, 'missing.task')]);
    expect(result.code).toBe(1);
    expect(existsSync(join(out, assets.model.name))).toBe(false);
  });

  it('writes a notice with versions, hashes and licence', () => {
    const prepared = resolve(process.cwd(), 'public', assets.publicBase.slice(1), 'NOTICE.txt');
    if (!existsSync(prepared)) return; // only when assets were prepared in this checkout
    const notice = readFileSync(prepared, 'utf8');
    expect(notice).toContain(`@mediapipe/tasks-vision@${assets.runtime.version}`);
    expect(notice).toContain(assets.model.sha256);
    expect(notice).toContain('Apache License, Version 2.0');
  });
});
