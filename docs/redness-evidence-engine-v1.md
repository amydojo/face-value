# Canonical redness evidence engine v1

**Implementation issue:** #51

**Effective date:** July 28, 2026

**Scope:** calm visible redness only

## Source traceability

The implementation was reconstructed from the connected canonical documents,
read in full at the revisions below.

| Authority      | Exact title                                               | Document ID                                    | Revision ID                                                                                                   | Controls                                                                                              |
| -------------- | --------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1              | FACE VALUE — RednessEvidence Data Contract v1 [CANON]     | `1vB_VeeqqKU3qJayBxgld61e9Qki78afXGArcBkAmMKw` | `AIroW34auwas6hWAqSpX8iYKtiSDmx-mexjEuhTFTp_jd2kkzpFLgeYANbGKczPTK9BgTw-SuOVJYRpb0PF8qfT-UqJHwtkzoUvfZ-GET0U` | Redness types, evaluator precedence, action mapping, invariants, and acceptance fixtures              |
| 2              | FACE VALUE — Redness Trial Evidence Framework v1 [CANON]  | `1wuo_AF91yWbSsoOrrwZixvWxHTSz3Frk9OplV5tXq1Y` | `AIroW34EHjae0PvAbQa90yBU7Kehdc5zKsJFNzg4Tkezp2Cu8PHWnTg5io9kYofkNaH-Noa1yi69rjFV1hF7jimxIQZnQngOcKQOUScrgrM` | Scientific meaning, redness evidence hierarchy, provisional thresholds, safety separation, and claims |
| 3              | FACE VALUE — Success Profile Registry v0.1 [CANON]        | `1RCNd_XuhkJxQw-yrbi8cKPI2s5dv050ZDhp1Ix6JumA` | `AIroW35vSEuGzTtjmc-jE3MLnu_KMj6lzz5wn2GupSkiAFIrD3HOpRGT2kmapcrDNK81jRu3x9Ma7CUUiwreWrxNBpT1WspwHs1rexpwRjk` | Shared evidence principles, provider signal roles, and future multi-concern compatibility             |
| 4              | FACE VALUE — Evidence Engine Conversion Pack v0.1 [CANON] | `1dOuuA02Dmn7vcEA5lHJzSCPJM-PSNM8hAwacp-sTX1k` | `AIroW36-k4UXk21rfd3IwQb6oPPLCJBPL_x_mP9-55MuUgSrPRr0bWZ16xN-FxRleOsBj9ru9-i4PA5pEqGNm9d-Qna-HHF72ZYBVcul6HQ` | Portable deterministic architecture and shared implementation guidance                                |
| 5              | FACE VALUE — Evidence Engine Source Manifest v0.1 [CANON] | `1tGhMqpmbEPEG3RjU0zzucjvgkXRRwyA9-6lI467Nd2M` | `AIroW35DZCQZ4ahhdK0Q8ikLrahEbb2EoEqpjc8HY_le0QYx8lvYWvBbhF0ElWf2SNCW6qzbxO7KZPrJXfrkWLT7UPgToO2U3ivjgs91e9E` | Provenance of the portable source bundle                                                              |
| Reference only | FACE VALUE — Redness Calibration Harness v1 [BUILD SPEC]  | `1WLn5ccRvWGJUOazWkwhs-y0IYUuOjO_ezj8OaC0D7Xw` | `AIroW36cX1ynjxDZkROFxgL1CTBVwwClioNCU0AK99HLzr7LD7BP3KS4g5ylgYtf6M3jq2FrE0PUYc3VVNvVJWGcl_f7TmjzVEOemdQ0ZOg` | A later calibration phase; not implemented here                                                       |

When vocabulary differs, the table order is the conflict-resolution order. The
redness contract remains narrow rather than blending concern-specific and
shared enums.

## Production path

```text
YouCam Skin Analysis v2.1
  → hd_redness.raw_score durable normalization
  → honest capture/session evidence adapter
  → deterministic redness evaluator
  → versioned RednessEvaluationSnapshot
  → one VerdictViewModel adapter
  → existing reveal, record, Home, and archive surfaces
```

`ui_score` is neither normalized nor accepted into `RednessEvidence`. A higher
HD redness raw score is more favorable, so the deciding delta is endpoint minus
baseline. Acne, texture, and moisture cannot rescue the redness result. Masks
and a patient anchor can only validate or corroborate.

The evaluator keeps effect, measurement quality, attribution quality, evidence
quality, safety, and action as separate fields. Its action set is exactly:
`keep`, `test_longer`, `retry_alone`, `not_proving_job`, and
`safety_interruption`.

## Operating threshold configuration

These are provisional Face Value operating boundaries, not clinical meaningful
change:

| Field                       | Value                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| Detectable boundary         | 5 raw-score points                                                                                  |
| Strong boundary             | 10 raw-score points                                                                                 |
| Source                      | `provisional_fixture`                                                                               |
| Version                     | `redness-provisional-v1`                                                                            |
| Provisional                 | `true`                                                                                              |
| Configuration SHA-256 input | `source=provisional_fixture;version=redness-provisional-v1;detectable=5;strong=10;provisional=true` |
| Configuration SHA-256       | `66571af3c662f4da1de469d763b884ad46eb37ee77df0aa060e4b2db280feed5`                                  |

Boundary behavior is `delta <= -5` worsened, `-5 < delta < +5` no detectable
change, `+5 <= delta < +10` directional improvement, and `delta >= +10`
strong improvement. Product registration freezes its observation window;
evaluation uses that window rather than replacing every product with a
universal interval.

Every provisional result displays: “Production thresholds require repeat-scan
calibration.”

## Current MVP evidence honesty

The current capture flow collects one baseline image and one endpoint image. The
adapter therefore records one session and one accepted raw score per period.
It does not manufacture bursts, repeated sessions, masks, registration,
patient-observed change, symptoms, adherence, or provider model metadata.

Missing inputs are named in the snapshot. Cross-session lighting, pose, crop,
face-size, and color metrics are not persisted, so current MVP measurement
quality remains limited even when the captures passed the existing guided
capture gate. This permits a directional result but cannot silently become
strong evidence.

## Persistence and migration

Each completed canonical record owns its immutable
`RednessEvaluationSnapshot`. The snapshot contains accepted period values and
medians, raw delta, threshold configuration, separate quality and safety
dimensions, action, deterministic copy, missing evidence, rule IDs, audit
trace, and version metadata. It contains no face image or raw provider payload.

The existing local-storage envelope and record type remain readable:

- canonical records render from their saved snapshot and are never
  re-evaluated during hydration;
- pre-engine records render through their legacy presentation fields without
  synthesizing a canonical snapshot;
- a legacy record is not upgraded as if it contained masks, anchors,
  symptoms, repeated sessions, or other absent evidence;
- a future engine or threshold evaluation cannot mutate an already saved
  snapshot.

## Acceptance fixture matrix

| Fixture                                     | Effect                    | Measurement | Attribution | Evidence       | Safety           | Action                |
| ------------------------------------------- | ------------------------- | ----------- | ----------- | -------------- | ---------------- | --------------------- |
| A — clear improvement                       | `strong_improvement`      | `adequate`  | `strong`    | `likely`       | `clear`          | `keep`                |
| B — clean null                              | `no_detectable_change`    | `strong`    | `strong`    | `likely`       | `clear`          | `not_proving_job`     |
| C — too early                               | `directional_improvement` | `adequate`  | `strong`    | `possible`     | `clear`          | `test_longer`         |
| D — product overlap                         | `strong_improvement`      | `adequate`  | `blocked`   | `possible`     | `clear`          | `retry_alone`         |
| E — objective worsening, no severe symptoms | `worsened`                | `adequate`  | `strong`    | `likely`       | `check_required` | `not_proving_job`     |
| F — worsening with symptoms                 | `worsened`                | `adequate`  | `strong`    | `likely`       | `interrupted`    | `safety_interruption` |
| G — invalid capture with favorable delta    | `strong_improvement`      | `invalid`   | `strong`    | `insufficient` | `clear`          | `test_longer`         |

## Retired path

The former sign-only `compareRednessSignals` and
`analysisResultFromComparison` production helpers were removed. Registered
redness trials can create a result only through
`buildMvpRednessEvaluation`. The generic legacy reducer remains for navigation
and old persisted-state compatibility; the current application does not
dispatch its caller-supplied prototype analysis event.

`npm run verify:redness-architecture` fails if retired derivation symbols
return, if the production React journey dispatches the retired analysis path,
or if scientific decision identifiers move into React components.

## Explicit exclusions

This slice does not redesign any PR #48 or PR #50 surface, implement active
breakouts or post-acne dark marks, build the calibration harness, make clinical
claims, add an LLM decision, persist face images, or personalize thresholds by
skin tone. The provider does not currently report its analysis-model version,
and the snapshot records that absence explicitly.
