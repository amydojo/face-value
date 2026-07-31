# Redness evidence burst verification

**Scope:** issue #63 only

**Implementation branch:** `agent/redness-evidence-burst`

**Exact base SHA:** `330f51975f162a2c15784114d7a448492973fcad`

**Physical-iPhone acceptance:** Pending

This record covers the three-measurement baseline and follow-up evidence burst.
It does not claim issue #64 trial-truth inputs, issue #65 calibration, or a
physical-device result from synthetic browser evidence.

## Implemented contract

- three accepted distinct current frames per period
- at most five capture attempts per period
- a fresh exposure and movement gate before every accepted frame
- three independent sequential YouCam Skin Analysis v2.1 requests
- one automatic same-frame retry for a failed provider request
- reducer-owned generation identity and atomic period commit
- canonical evaluator ownership of medians, direction agreement, and result
- face-free accepted and rejected durable metadata
- no durable partial burst or image-bearing state
- legacy record readability without reinterpretation
- explicit scan-complete, measurement 1/2/3, and confirmed waiting states
- progress driven only by resolved analyses, with delayed and bounded-recheck copy
- reduced-motion removal of settle and pulse animations

## Automated verification

The exact command results and final head SHA are recorded in the draft pull
request. Required coverage includes:

- distinct decoded-frame proof and duplicate identifier rejection
- hard five-attempt capture ceiling
- duplicate provider settlement and stale-generation rejection
- atomic baseline and follow-up commits
- actual accepted score arrays and rejected evidence at the evaluator boundary
- exactly-once comparison and Evidence Record creation
- persistence, legacy migration, architecture, privacy, and threshold guards
- Mobile WebKit baseline, follow-up, rejection, provider-failure, reload, and
  immutable record continuity
- Mobile WebKit proof that zero progress is never rendered, active indicators
  advance only after resolved analyses, and slow/recheck copy is state-bound
- console, page-error, unhandled-rejection, and horizontal-overflow checks

## Privacy-safe browser evidence

The checked-in images are reproducible outputs from
`e2e/redness-burst-preview.spec.ts` against the exact Vercel preview recorded in
the draft pull request. The Mobile WebKit run uses synthetic camera frames and
provider-shaped fixtures so the evidence remains safe to commit.

| Evidence                                    | Capture                                                                           |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| Recoverable capture rejection               | [Automatic replacement](./recoverable-rejection.png)                              |
| Baseline burst progression                  | [One of three baseline measurements accepted](./baseline-burst-progression.png)   |
| Follow-up burst progression                 | [One of three follow-up measurements accepted](./follow-up-burst-progression.png) |
| Selected terminal provider-failure behavior | [No partial measurements saved](./provider-failure.png)                           |
| Immutable record continuity after reload    | [Full face-free Evidence Record](./final-immutable-evidence-record.png)           |

The images contain no person, face image, provider task identifier, credential,
signed URL, or raw provider payload. The browser test also rejects console
errors, page errors, unhandled rejections, and horizontal overflow.

Automated and desktop-browser evidence is not physical-iPhone proof.

## Exact-head physical-iPhone checklist

The draft pull request records the exact PR head SHA and exact Vercel preview
deployment used for this handoff.

- [ ] Record PR head SHA from the draft pull request.
- [ ] Record exact Vercel preview deployment.
- [ ] Record iPhone model.
- [ ] Record iOS version.
- [ ] Record Safari version.
- [ ] Confirm initial camera permission and denied-to-allowed recovery.
- [ ] Complete one ordinary baseline burst through one continuous ritual.
- [ ] Prove three distinct accepted baseline frame events.
- [ ] Prove three genuine baseline provider analyses.
- [ ] Confirm the frozen still receives a soft dark veil after live capture ends.
- [ ] Confirm Scan complete appears before Analyzing measurement 1.
- [ ] Confirm measurement indicators advance from 1 to 2 to 3 only after genuine
      provider completions and never show 0 of 3.
- [ ] Confirm a response taking longer than four seconds shows the calm delayed copy.
- [ ] Reload and confirm face-free baseline burst continuity.
- [ ] Advance the authorized test timeline without rewriting timestamps.
- [ ] Complete one ordinary follow-up burst through one continuous ritual.
- [ ] Prove three distinct accepted follow-up frame events.
- [ ] Prove three genuine follow-up provider analyses.
- [ ] Confirm Measurements confirmed appears before existing comparison processing.
- [ ] Exercise recoverable exposure or movement replacement.
- [ ] Exercise provider failure during measurement two or three and confirm one
      same-frame retry with Rechecking this measurement copy only during attempt two.
- [ ] Confirm a second provider failure stops the burst without durable partial
      evidence.
- [ ] Retry and confirm obsolete generation completions are ignored.
- [ ] Exit the route mid-burst and confirm camera tracks and provider work stop.
- [ ] Confirm no camera indicator remains after success, failure, retry, or exit.
- [ ] Exercise Safari chrome expansion and contraction at portrait width.
- [ ] Enable Reduce Motion and confirm the settle and pulse are removed without
      skipping any truthful state.
- [ ] Confirm no horizontal overflow and that all controls remain reachable.
- [ ] Complete the Oracle and collect exactly one Evidence Record.
- [ ] Confirm Home, Previous Trials, Evidence Record detail, and reload show the
      same immutable face-free snapshot.
- [ ] Record console/network anomalies and any remaining limitations.

Until every item is executed on the named device against the named exact
deployment, physical-device acceptance remains pending.
