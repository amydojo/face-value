from pathlib import Path

path = Path('scripts/verify-redness-architecture.mjs')
source = path.read_text()

over_scoped = """      'canonicalRednessFixtures',
      'safety_interruption',
      'retry_alone',
      'not_proving_job',
"""
scoped_base = """      'canonicalRednessFixtures',
"""
if source.count(over_scoped) != 1:
    raise RuntimeError('Expected one over-scoped scientific identifier list')
source = source.replace(over_scoped, scoped_base)

anchor = """if (violations.length) {
"""
scoped_guard = """const trialTruthPresentationFiles = sourceFiles.filter((file) =>
  relative(rootPath, file).startsWith('features/trial-truth/'),
);
for (const file of trialTruthPresentationFiles) {
  const path = relative(rootPath, file);
  const source = await readFile(file, 'utf8');
  for (const forbiddenDecisionIdentifier of [
    'safety_interruption',
    'retry_alone',
    'not_proving_job',
  ]) {
    if (source.includes(forbiddenDecisionIdentifier)) {
      violations.push(
        `${path} contains trial-truth scientific decision identifier ${forbiddenDecisionIdentifier}`,
      );
    }
  }
}

if (violations.length) {
"""
if source.count(anchor) != 1:
    raise RuntimeError('Expected one architecture verifier conclusion block')
source = source.replace(anchor, scoped_guard)
path.write_text(source)
