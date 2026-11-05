import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM build script without type declarations
import { buildPlan, EXPERIMENT_BRANCH, OPTICS_LAB_PROJECT_ID } from '../../scripts/vercel-build.mjs';

// The experiment reaches a Vercel build only as a preview of its own branch.

const BRANCH = EXPERIMENT_BRANCH as string;
const LAB = OPTICS_LAB_PROJECT_ID as string;
const plan = (env: Record<string, string | undefined>) =>
  buildPlan(env) as { experiment: boolean; steps: string[]; env: Record<string, string> };

describe('Vercel build plan', () => {
  it('vercel.json builds through the gated script', () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as { buildCommand: string };
    expect(config.buildCommand).toBe('node scripts/vercel-build.mjs');
  });

  it('pushing the experiment branch never auto-deploys it from Git (deploys are explicit)', () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
      git?: { deploymentEnabled?: Record<string, boolean> };
    };
    expect(config.git?.deploymentEnabled).toEqual({ [BRANCH]: false });
  });

  it('production, other previews and local builds are the standard build', () => {
    for (const env of <Array<Record<string, string | undefined>>>[
      { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' },
      { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: BRANCH },
      { VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'fix/p0b-visible-safety-guidance' },
      { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: BRANCH },
      { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: BRANCH, VERCEL_PROJECT_ID: 'prj_EYUVxgQe5Byl5AfwAtBhY8T8WEF0' },
      { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main', VERCEL_PROJECT_ID: LAB },
      {},
    ]) {
      expect(plan(env)).toEqual({ experiment: false, steps: ['npm run build'], env: {} });
    }
  });

  it('a preview of the experiment branch prepares verified assets and opts the route in', () => {
    expect(plan({ VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: BRANCH })).toEqual({
      experiment: true,
      steps: ['npm run prepare:local-optics', 'npm run build'],
      env: { VITE_LOCAL_OPTICS_EXPERIMENT: 'true' },
    });
  });

  it('the protected optics-lab project builds the experiment branch even when production-targeted', () => {
    expect(plan({ VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: BRANCH, VERCEL_PROJECT_ID: LAB }).experiment).toBe(true);
  });
});
