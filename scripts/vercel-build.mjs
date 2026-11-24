// Vercel build entry. Identical to standard build everywhere except an explicit lab deployment
// of an experimental branch, which also prepares the same-origin MediaPipe assets (model
// downloaded from Google's published URL and refused unless it matches the pinned SHA-256) and
// opts the experimental route into the bundle. Production and every other branch are unchanged.
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXPERIMENT_BRANCH = 'experiment/local-optical-comparability';
// The Living Trial branch builds the experiment only inside the optics-lab project; anywhere else
// (including a preview in face-value, which vercel.json also suppresses) it is the standard build.
export const TRIAL_BRANCH = 'feat/fv05-living-trial';
export const FOUNDATION_BRANCH = 'feat/fv06-foundation-lock';
export const CHROMA_BRANCH = 'experiment/fv07-chroma';
// face-value-optics-lab: a separate, Vercel-Authentication-protected project with no provider
// credentials. It is not linked to Git, so API deployments into it are production-targeted; any
// deployment of the experiment branch there is the experiment. Never the face-value project.
export const OPTICS_LAB_PROJECT_ID = 'prj_LqZsxoGOjWRLSTLRbAJkyDqAgavI';

export function buildPlan(env) {
  const ref = env.VERCEL_GIT_COMMIT_REF;
  const lab = env.VERCEL_PROJECT_ID === OPTICS_LAB_PROJECT_ID;
  if (env.VERCEL === '1' && lab && ref === CHROMA_BRANCH && env.VERCEL_ENV === 'preview') {
    return { experiment: true, steps: ['npm run prepare:local-optics', 'npm run build'], env: { VITE_LOCAL_OPTICS_EXPERIMENT: 'true', VITE_FV07_RESEARCH: 'true' } };
  }
  const experiment =
    env.VERCEL === '1' &&
    lab && (ref === EXPERIMENT_BRANCH || ref === TRIAL_BRANCH || ref === FOUNDATION_BRANCH);
  if (!experiment) return { experiment: false, steps: ['npm run build'], env: { VITE_LOCAL_OPTICS_EXPERIMENT: 'false' } };
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
      ? `Local Optics experiment build for ${process.env.VERCEL_GIT_COMMIT_REF}`
      : 'Standard build (Local Optics experiment not included)',
  );
  for (const step of plan.steps) {
    execSync(step, { stdio: 'inherit', env: { ...process.env, ...plan.env } });
  }
}
