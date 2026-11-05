// Vercel build entry. Identical to `npm run build` everywhere except a Vercel *preview* of the
// Local Optics experiment branch, which also prepares the same-origin MediaPipe assets (model
// downloaded from Google's published URL and refused unless it matches the pinned SHA-256) and
// opts the experimental route into the bundle. Production and every other branch are unchanged.
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXPERIMENT_BRANCH = 'experiment/local-optical-comparability';

export function buildPlan(env) {
  const experiment =
    env.VERCEL === '1' && env.VERCEL_ENV === 'preview' && env.VERCEL_GIT_COMMIT_REF === EXPERIMENT_BRANCH;
  if (!experiment) return { experiment: false, steps: ['npm run build'], env: {} };
  const model = env.LOCAL_OPTICS_MODEL_PATH ? ` -- --model ${JSON.stringify(env.LOCAL_OPTICS_MODEL_PATH)}` : '';
  return {
    experiment: true,
    steps: [`npm run prepare:local-optics${model}`, 'npm run build'],
    env: { VITE_LOCAL_OPTICS_EXPERIMENT: 'true' },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const plan = buildPlan(process.env);
  console.log(
    plan.experiment
      ? `Local Optics experiment preview build for ${EXPERIMENT_BRANCH}`
      : 'Standard build (Local Optics experiment not included)',
  );
  for (const step of plan.steps) {
    execSync(step, { stdio: 'inherit', env: { ...process.env, ...plan.env } });
  }
}
