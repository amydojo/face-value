# Redness evidence burst verification

**Scope:** issue #63 only

**Implementation branch:** `agent/redness-evidence-burst`

**Exact base SHA:** `330f51975f162a2c15784114d7a448492973fcad`

**Focused correction starting SHA:** `c5c6caf7218114759af71c340f22ac245a64dd0e`

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
- minimum 1.8-second scan-complete dwell without delaying provider work
- stable analysis headline/support and primary-stack progress driven only by real work
- at least 700 milliseconds of legibility per visible progress position
- six-second tertiary slow-response copy and bounded attempt-two recheck copy
- decorative, `aria-hidden`, non-image-derived amber activity field
- immediate durable period commit with an approximately 800-millisecond confirmation presentation
- reduced-motion removal of settle, pulse, and traveling activity
- one canonical labeled specimen from registered product through Oracle collection
- one immutable saved product snapshot across Home, Previous Trials, detail, and reload
- sealed-result privacy while the already-known product identity remains visible

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
- Mobile WebKit proof of the readable dwell, latest-truth entry, primary progress
  hierarchy, activity-field boundary, reduced motion, and Safari contraction
- Oracle-phase proof that the same labeled specimen, chamber geometry, firmware,
  paper, record, Home, history, and reload agree on one product snapshot
- sealed-result DOM and accessibility proof with the known product label visible
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

The focused correction also captures these approved synthetic-fixture states:

| Evidence                                  | Capture                                                                                                                                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scan-complete readable dwell              | [Scan complete / You can relax](../face-value-specimen-acquisition/scan-complete-dwell.png)                                                                                                               |
| Measurement 1 analysis                    | [Primary progress and activity field](../face-value-specimen-acquisition/analysis-measurement-1.png)                                                                                                      |
| Measurement 2 analysis                    | [Truthful progressed state](../face-value-specimen-acquisition/analysis-measurement-2.png)                                                                                                                |
| Six-second slow response                  | [Tertiary finishing status](../face-value-specimen-acquisition/analysis-slow-response.png)                                                                                                                |
| Measurements confirmed                    | [Confirmation before comparison presentation](../face-value-specimen-acquisition/measurements-confirmed.png)                                                                                              |
| Sealed Oracle specimen                    | [Known labeled product; result still sealed](../../../e2e/oracle-reveal.spec.ts-snapshots/oracle-sealed-mobile-webkit-darwin.png)                                                                         |
| Revealed Oracle specimen                  | [Same product with authorized result](../../../e2e/oracle-reveal.spec.ts-snapshots/oracle-verdict-revealed-mobile-webkit-darwin.png)                                                                      |
| Saving and dispensing specimen continuity | [Saving](../../../e2e/oracle-reveal.spec.ts-snapshots/oracle-committing-mobile-webkit-darwin.png) · [Dispensing](../../../e2e/oracle-reveal.spec.ts-snapshots/oracle-dispensing-mobile-webkit-darwin.png) |
| Collected Evidence Record continuity      | [Collected record detail](../../../e2e/oracle-reveal.spec.ts-snapshots/oracle-evidence-detail-mobile-webkit-darwin.png)                                                                                   |
| Home latest-verdict product continuity    | [Same saved product snapshot](../../../e2e/oracle-reveal.spec.ts-snapshots/home-latest-verdict-partial-mobile-webkit-darwin.png)                                                                          |

The images contain no person, face image, provider task identifier, credential,
signed URL, or raw provider payload. The browser test also rejects console
errors, page errors, unhandled rejections, and horizontal overflow.

Automated and desktop-browser evidence is not physical-iPhone proof.

Physical testing of the focused correction has not yet occurred. The two
physical-iPhone findings were observed on starting head
`c5c6caf7218114759af71c340f22ac245a64dd0e`: the analysis wait felt passive and
the result sequence degraded the registered specimen. Browser verification may
prove the correction's contracts, but acceptance remains pending until the
exact updated PR head and exact matching preview are retested on hardware.

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
- [ ] Confirm **Scan complete / You can relax.** remains visible long enough to
      read and physically relax, for at least the 1.8-second presentation dwell.
- [ ] Confirm analysis begins with stable **Analyzing your scan / Checking three
      measurements for consistency.** copy.
- [ ] Confirm measurement indicators advance from 1 to 2 to 3 only after genuine
      provider completions and never show 0 of 3.
- [ ] Confirm progress is obvious in the primary status stack and never flashes
      through a visible position too quickly.
- [ ] Confirm the restrained amber activity field feels active but not like a
      filter, heatmap, landmark model, Face ID clone, or medical scan.
- [ ] Confirm a response with no genuine progress for six seconds adds
      **Finishing this measurement…** without moving the stable support copy.
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
      skipping any truthful state or shortening the 1.8-second dwell; traveling
      point activity must also stop.
- [ ] Confirm no horizontal overflow and that all controls remain reachable.
- [ ] Confirm the registered product stays visibly loaded, labeled, locked, and
      grounded through follow-up ready, follow-up, sealed, opening,
      transmitting, revealed, saving, dispensing, and collected states.
- [ ] Confirm brand, product, strength, volume, accession, firmware context, and
      paper agree throughout the active result sequence.
- [ ] Confirm the sealed DOM and accessibility tree expose no finding, score,
      delta, confidence, recommendation, evidence status, next step, or
      limitation despite the known product label remaining visible.
- [ ] Complete the Oracle and collect exactly one Evidence Record.
- [ ] Confirm Home, Previous Trials, Evidence Record detail, and reload show the
      same immutable face-free result and product snapshot.
- [ ] Confirm the specimen never becomes a generic silhouette, floats, changes
      chamber geometry, or disappears during saving and dispensing.
- [ ] Confirm Demo Lab fixtures remain internally consistent and continuing an
      already registered journey does not substitute a generic demo product.
- [ ] Record console/network anomalies and any remaining limitations.

Until every item is executed on the named device against the named exact
deployment, physical-device acceptance remains pending.
