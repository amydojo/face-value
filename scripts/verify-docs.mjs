import { access, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const currentAuthorityFiles = [
  'README.md',
  'design-qa.md',
  'docs/README.md',
  'docs/product-contract.md',
  'docs/architecture.md',
  'docs/state-model.md',
  'docs/production-journey-integration.md',
  'docs/camera-contract.md',
  'docs/redness-evidence-engine-v1.md',
  'docs/youcam-evidence-engine-contract.md',
  'docs/youcam-evidence-engine-roadmap.md',
  'docs/oracle-reveal-v1.md',
  'docs/design-contract.md',
  'docs/source-of-truth-manifest.md',
  'docs/verification/face-value-specimen-acquisition/README.md',
  'docs/verification/redness-evidence-burst-63/README.md',
];

const staleAssertionFiles = currentAuthorityFiles.filter((file) => file !== 'docs/README.md');

const requiredFiles = [
  ...currentAuthorityFiles,
  'docs/youcam-phase-b5-implementation.md',
  'scripts/verify-docs.mjs',
];

const highRiskStaleAssertions = [
  {
    pattern: /one responsive, fixture-backed golden path/i,
    explanation: 'Production is no longer fixture-backed.',
  },
  {
    pattern: /MockOpticalAnalysisAdapter is the only analysis implementation/i,
    explanation: 'The deployed YouCam provider is implemented.',
  },
  {
    pattern: /One `SAVE_RESULT` activation performs one reducer-owned transaction/i,
    explanation: 'Current durable creation occurs at EVIDENCE_COLLECTED.',
  },
  {
    pattern: /The archive label is \*\*Past Results\*\*/i,
    explanation: 'Current product vocabulary is Previous Trials.',
  },
  {
    pattern: /production Camera Kit path opens only/i,
    explanation: 'Production uses NativeBrowserCameraAdapter.',
  },
  {
    pattern: /production previews default to the official Camera Kit/i,
    explanation: 'Production uses the first-party browser video surface.',
  },
  {
    pattern: /physical iPhone acceptance[^\n]*passed/i,
    explanation: 'The final exact-head physical acceptance record remains pending.',
  },
  {
    pattern: /ordinary trials store one accepted baseline raw score/i,
    explanation: 'Ordinary periods now require three independently analyzed observations.',
  },
  {
    pattern: /#63 will (?:replace|change|add)/i,
    explanation: 'Issue #63 is current implementation truth in authority documents.',
  },
];

const requiredAssertions = [
  {
    file: 'README.md',
    pattern: /NativeBrowserCameraAdapter/,
    explanation: 'README must identify the production camera.',
  },
  {
    file: 'README.md',
    pattern: /Previous Trials/,
    explanation: 'README must use current archive vocabulary.',
  },
  {
    file: 'README.md',
    pattern: /#63[\s\S]*#64[\s\S]*#65/,
    explanation: 'README must distinguish implemented #63 from planned #64 and #65.',
  },
  {
    file: 'README.md',
    pattern: /three distinct decoded frames and three independent YouCam analyses/,
    explanation: 'README must describe the current three-measurement evidence volume.',
  },
  {
    file: 'docs/README.md',
    pattern: /Conflict-resolution order/,
    explanation: 'The documentation authority index must define conflict resolution.',
  },
  {
    file: 'docs/product-contract.md',
    pattern: /Reduce visible redness/,
    explanation: 'The current supported job must remain explicit.',
  },
  {
    file: 'docs/state-model.md',
    pattern: /EVIDENCE_COLLECTED/,
    explanation: 'The current exactly-once boundary must remain documented.',
  },
  {
    file: 'docs/state-model.md',
    pattern: /ActiveRednessBurst/,
    explanation: 'The runtime-only burst generation authority must remain documented.',
  },
  {
    file: 'docs/camera-contract.md',
    pattern: /Camera Kit 2\.5 renderer is retained only in development/,
    explanation: 'Camera Kit must remain diagnostic only.',
  },
  {
    file: 'docs/camera-contract.md',
    pattern: /requestVideoFrameCallback/,
    explanation: 'Decoded-frame currentness must remain explicit.',
  },
  {
    file: 'docs/youcam-evidence-engine-contract.md',
    pattern: /retry the failed provider request\s+once on the same captured frame/,
    explanation: 'The selected provider-failure policy must remain unambiguous.',
  },
  {
    file: 'docs/verification/redness-evidence-burst-63/README.md',
    pattern: /Physical-iPhone acceptance:\*\* Pending/,
    explanation: 'Physical-device acceptance must remain honest until hardware proof exists.',
  },
  {
    file: 'docs/youcam-phase-b5-implementation.md',
    pattern: /Historical record — superseded for current production behavior/,
    explanation: 'The historical implementation record must be visibly superseded.',
  },
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function stripCodeFences(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, '');
}

function localMarkdownTargets(markdown) {
  const targets = [];
  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  let match;
  while ((match = linkPattern.exec(stripCodeFences(markdown))) !== null) {
    let target = match[1].trim();
    if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
    target = target.split(/\s+["']/)[0];
    if (
      !target ||
      target.startsWith('#') ||
      target.startsWith('http://') ||
      target.startsWith('https://') ||
      target.startsWith('mailto:') ||
      target.startsWith('data:')
    ) {
      continue;
    }
    targets.push(decodeURIComponent(target.split('#')[0]));
  }
  return targets;
}

const errors = [];
const contents = new Map();

for (const relativePath of requiredFiles) {
  const absolutePath = resolve(root, relativePath);
  if (!(await exists(absolutePath))) {
    errors.push(`${relativePath}: required documentation file is missing.`);
    continue;
  }
  const metadata = await stat(absolutePath);
  if (!metadata.isFile()) {
    errors.push(`${relativePath}: required path is not a file.`);
    continue;
  }
  contents.set(relativePath, await readFile(absolutePath, 'utf8'));
}

for (const relativePath of currentAuthorityFiles) {
  const markdown = contents.get(relativePath);
  if (markdown === undefined) continue;

  for (const target of localMarkdownTargets(markdown)) {
    const resolvedTarget = resolve(root, dirname(relativePath), target);
    if (!(await exists(resolvedTarget))) {
      errors.push(`${relativePath}: local Markdown target does not exist: ${target}`);
    }
  }
}

for (const relativePath of staleAssertionFiles) {
  const markdown = contents.get(relativePath);
  if (markdown === undefined) continue;
  for (const { pattern, explanation } of highRiskStaleAssertions) {
    if (pattern.test(markdown)) {
      errors.push(`${relativePath}: stale assertion matched ${pattern}. ${explanation}`);
    }
  }
}

for (const { file, pattern, explanation } of requiredAssertions) {
  const markdown = contents.get(file);
  if (markdown === undefined) continue;
  if (!pattern.test(markdown)) {
    errors.push(`${file}: required assertion missing (${pattern}). ${explanation}`);
  }
}

if (errors.length > 0) {
  console.error('Documentation verification failed:\n');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Documentation verification passed for ${currentAuthorityFiles.length} current authority files.`,
  );
}
