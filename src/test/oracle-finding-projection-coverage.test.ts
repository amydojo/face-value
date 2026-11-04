import { describe, expect, it } from 'vitest';
import { canonicalRednessFixtures, evaluateRedness } from '../domain/evidence/redness';
import choreography from '../styles/oracle-specimen-choreography.css?raw';
import { decisionGrid, evaluateLiveScenario } from './support/rednessScenarios';

// The Oracle paints its verdict through `[aria-label*='<finding>'] [data-oracle-finding]::after`.
// A finding missing from those selectors silently falls back to unstyled DOM text, and one
// whose selector was removed would break saved records that still carry it.

/** Findings that intentionally render as live DOM text (pre-existing V1 behavior). */
const PLAIN_TEXT_FINDINGS = new Set([
  'Reported symptoms interrupted this trial.',
  'No readable redness finding was available.',
]);

/** Every finding V1 could save. Saved records keep these forever, so their projection stays. */
const V1_FINDINGS = [
  'Visible redness improved across comparable scans.',
  'Visible redness moved in a favorable direction.',
  'No detectable improvement showed up.',
  'This comparison was not readable.',
  'The trial did not isolate this product.',
  'Visible redness worsened across comparable scans.',
];

const selectorCount = (finding: string): number =>
  choreography.split(`[aria-label*='${finding}']`).length - 1;

function emittedFindings(): Set<string> {
  const findings = new Set<string>();
  for (const { scenario } of decisionGrid()) findings.add(evaluateLiveScenario(scenario).interpretation.finding);
  for (const input of Object.values(canonicalRednessFixtures))
    findings.add(evaluateRedness(structuredClone(input)).interpretation.finding);
  return findings;
}

describe('Oracle finding projection coverage', () => {
  it('projects every finding the engine can emit, except the documented plain-text findings', () => {
    const missing = [...emittedFindings()]
      .filter((finding) => !PLAIN_TEXT_FINDINGS.has(finding))
      .filter((finding) => selectorCount(finding) !== 4)
      .map((finding) => `${finding} (${selectorCount(finding)} selectors)`);
    expect(missing).toEqual([]);
  });

  it('keeps the projection for every finding a V1 record may have saved', () => {
    for (const finding of V1_FINDINGS) expect(selectorCount(finding)).toBe(4);
  });
});
