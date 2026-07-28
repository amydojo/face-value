# Redness Calibration Engineering Plan

**Status:** Planning and architecture only  
**Protocol version:** `redness-calibration-v1.1`  
**Repository baseline:** `amydojo/face-value` at `7d80f0bdb64b508b40b604c4001617917354ac5e`  
**Prepared:** July 28, 2026  
**Scope:** Perfect Corp YouCam Skin Analysis v2.1 `hd_redness.raw_score` only

> This plan defines a preliminary engineering characterization of repeatability, workflow sensitivity, and no-treatment longitudinal variability. It is not clinical validation, does not estimate product efficacy, and does not authorize any threshold, confidence, verdict, reducer, persistence, or production-behavior change.

## 1. Repository findings

### 1.1 Verified production signal path

The verified production path remains:

```text
camera or selected image Blob
→ Face Value upload-slot API
→ direct browser PUT to provider-signed URL
→ Perfect Corp YouCam Skin Analysis v2.1 task
→ bounded task polling
→ select output where type === "hd_redness"
→ read finite raw_score
→ SkinAnalysisSignal.rawScore
→ normalizeSkinAnalysisSignal
→ DurableSkinSignal.rawScore
→ buildMvpRednessEvaluation
→ evaluateRedness
→ immutable RednessEvaluationSnapshot
→ compatibility and presentation adapters
→ reducer-owned result and saved Evidence Record
```

The raw provider response is not passed into the reducer or React. `api/_youcam.ts` selects `record.raw_score`, requires a finite JavaScript `number`, and returns it without normalization, rescaling, clipping, rounding, or percentage conversion. Durable normalization reconstructs a narrow object by value. Display formatting rounds only at the presentation boundary.

### 1.2 Repository score contract versus provider contract

The application and provider contracts must be distinguished.

| Property | Repository-enforced contract | External provider contract |
| --- | --- | --- |
| Provider | `youcam` | Perfect Corp YouCam Skin Analysis |
| API version | `2.1` | v2.1 |
| Mode | `hd` | HD skin analysis |
| Concern | `hd_redness` | redness severity concern |
| Region | `null` | whole provider concern output |
| Score type | `raw_score` | raw model analysis score |
| Runtime type | finite JavaScript `number` | floating-point value |
| Range | no range check in the repository | documented as `1` through `100` |
| Polarity | higher is more favorable | higher indicates a healthier or more favorable skin condition |
| Consumer-adjusted score | forbidden for evidence | `ui_score`, an adjusted integer score |
| Comparison unit | raw-score points | raw-score points, not percentage change |

The repository fact remains authoritative for current behavior: Face Value accepts any finite `rawScore` and does not enforce the documented provider range.

The provider documentation adds a separate contract expectation:

1. `raw_score` is documented as a floating-point value from `1` to `100`;
2. higher values are more favorable;
3. `ui_score` is adjusted to be more favorable for consumer presentation;
4. Face Value must continue to forbid `ui_score` from evidence, calibration, threshold comparison, and exports.

A live finite score outside `1` through `100` must never be clamped, rounded into range, or silently discarded. It must:

1. remain unchanged in the raw face-free export;
2. be flagged as `providerContractAnomaly: true`;
3. retain the safe provider and protocol provenance;
4. be excluded from primary statistical analysis only under this predeclared provider-contract anomaly rule;
5. remain visible in anomaly counts and a sensitivity appendix;
6. never be excluded because it is statistically unusual, far from a median, or inconvenient for a result.

Fixture values such as `93.3356` and `100` do not prove the provider scale. The range statement comes from external provider documentation, not from fixture inference.

### 1.3 Current provisional operating boundaries

The active repository configuration remains read-only:

| Boundary | Raw-score points | Current classification behavior |
| --- | ---: | --- |
| Worsening boundary | `-5` | `delta <= -5` |
| No-detectable-change band | between `-5` and `+5` | `-5 < delta < +5` |
| Detectable improvement boundary | `+5` | `+5 <= delta < +10` |
| Strong improvement boundary | `+10` | `delta >= +10` |

Configuration provenance:

```text
version = redness-provisional-v1
source = provisional_fixture
provisional = true
config hash = sha256:66571af3c662f4da1de469d763b884ad46eb37ee77df0aa060e4b2db280feed5
```

The plan characterizes false-change behavior around the fixed 5-point and 10-point boundaries. It does not validate, approve, calibrate, replace, or activate either boundary.

### 1.4 Verdict, confidence, and action authority

Scientific and product decisions remain under `src/domain/evidence/redness` and `src/app/phaseBMachine.ts`, not calibration code or React.

1. `buildMvpRednessEvaluation` constructs the production evidence input.
2. `evaluateRedness` separately determines effect, measurement quality, attribution, evidence quality, safety, direction agreement, and action.
3. `phaseBMachine.ts` invokes the production evaluation after matched durable baseline and follow-up signals exist.
4. The reducer persists the immutable snapshot.
5. architecture verification prevents scientific decision identifiers from moving into React and prevents retired verdict paths from returning.

The future harness must remain a sibling engineering system. It must not call the production evaluator, create a `RednessEvaluationSnapshot`, dispatch production reducer events, create an Evidence Record, or write calibration output into production trial state.

### 1.5 Existing failure and cancellation states

The current provider and camera layers expose enough information to map:

| Existing source | Examples |
| --- | --- |
| Browser or Camera Kit | SDK unavailable, unsupported browser, permission denied, camera unavailable, preview stalled, unsupported resolution, invalid capture |
| Upload | invalid type, invalid size, invalid upload slot, signed upload failure |
| Provider task | provider rejection, missing raw score, unknown task status, invalid task response, timeout |
| Session access | unconfigured or unauthorized protected session |
| Local protocol | protocol mismatch before provider invocation |
| Cancellation | `AbortError`, navigation, unmount, explicit leave |

Every calibration attempt, including every failed, cancelled, anomalous, and replaced attempt, must remain represented in the in-memory dataset and export.

### 1.6 Existing development and route risks

The Demo Lab is gated by both:

```ts
import.meta.env.DEV
VITE_SHOW_DEMO_CONTROLS === "true"
```

Its route and markers are expected to be absent from ordinary production bundles.

The current `/youcam-calibration` route does not use that gate. It is directly routed. In development and test mode, `createSkinAnalysisProvider()` silently returns a singleton fixture provider. The current calibration screen submits every capture with role `followup`, so a development run receives the fixed fixture value `100` instead of live provider measurements.

These are critical hardening requirements for any future harness:

1. human collection must require explicit `live` provider mode;
2. provider mode must be visible in the screen, report, and export;
3. fixtures must be restricted to automated tests;
4. the calibration route must be absent from ordinary consumer builds;
5. live collection must use a dedicated protected deployment or equivalent protected engineering environment.

### 1.7 Current calibration utility

The current utility is a small same-session score collector. It:

1. accepts a selected JPEG or PNG;
2. uses the frozen HD redness protocol;
3. holds the file and scores in React memory;
4. reports consecutive deltas, absolute consecutive deltas, median absolute delta, maximum absolute delta, minimum, and maximum;
5. writes no calibration data into production trial state.

It does not model participants, days, formal sessions, independent reacquisition, variability layers, provider-contract anomalies, participant-level summaries, no-treatment differences, nested inference, completeness states, face-free exports, or the protocol in this document.

### 1.8 Privacy and persistence boundaries

The current application already satisfies the requested application-side image boundary:

1. image bytes remain transient in the capture and provider-call lifecycle;
2. signed upload URLs, upload URLs, file IDs, task IDs, and raw provider payloads are not normalized into durable state;
3. the reducer receives metadata and normalized scores, not image Blobs;
4. saved evidence declares `includesFaceImage: false`;
5. client privacy checks scan for secrets, image data URLs, blob APIs, provider task markers, signed URL markers, and raw payload markers;
6. safe diagnostics record stage, role, outcome, and safe code only.

The repository cannot establish Perfect Corp's server-side retention or deletion behavior. Application storage claims and provider-processing claims must remain separate.

### 1.9 Reusable infrastructure

A future harness may reuse lower-level infrastructure without entering the production state machine:

1. `YouCamSkinAnalysisProvider`;
2. the frozen `HD_REDNESS_PROTOCOL`;
3. Camera Kit adapter, quality normalization, capture profiles, and teardown;
4. `AbortController` cancellation;
5. safe provider-error and diagnostics patterns;
6. pure TypeScript statistics and runtime validation;
7. Demo Lab-style build-time exclusion;
8. isolated, allowlisted face-free export patterns.

`CameraViewport` must not be reused as-is because it dispatches production trial events. A calibration-specific orchestrator may depend on lower-level camera and provider adapters only.

## 2. Research sources and provenance

This plan uses repository facts for current application behavior and external sources only for measurement-study design and the provider's published score contract.

| Source | Role in this plan | Authority and limitation |
| --- | --- | --- |
| Face Value repository at the baseline SHA above | current code path, type enforcement, thresholds, evaluator ownership, route behavior, privacy boundary | authoritative for repository behavior only |
| [Perfect Corp, AI Skin Analysis v2.1 documentation](https://docs.perfectcorp.com/reference/ai_skin_analysis/v2.1) | `raw_score` and `ui_score` definitions, documented `1` to `100` range, favorable polarity, image-quality requirements | authoritative provider contract; does not prove Face Value currently range-checks |
| [NIST/SEMATECH Engineering Statistics Handbook, Chapter 2](https://www.nist.gov/publications/nistsematech-engineering-statistics-handbook-chapter-2-measurement-process) | separation of repeatability, stability, and time-related variability; nested measurement-process framing | general measurement-process guidance, not a Face Value validation standard |
| [CLSI EP05 Plus, Evaluation of Precision of Quantitative Measurement Procedures](https://clsi.org/shop/standards/ep05-plus/) | repeated days, runs or sessions, replicates, and nested precision-study structure | clinical laboratory precision guidance used as design inspiration; this pilot is not an EP05-conformant medical-device study |
| [Bland and Altman, 1986, Statistical methods for assessing agreement between two methods of clinical measurement](https://pubmed.ncbi.nlm.nih.gov/2868172/) | repeatability and agreement framing; relation of within-subject SD to repeatability limits | foundational agreement source; the present pilot has a smaller nested sample and must label estimates exploratory |

Interpretation rules:

1. NIST and CLSI support separating short-term repeatability from day-to-day or longer-term variability rather than treating every image as an independent observation.
2. CLSI's formal designs are substantially larger than this submission pilot. Referencing CLSI does not make the pilot a formal precision validation.
3. Bland–Altman repeatability concepts support reporting a repeatability coefficient, but the small sample, nested dependence, and possible non-normality require raw and robust summaries beside the coefficient.
4. Provider documentation defines the expected score contract. It does not authorize clinical claims or threshold promotion.

## 3. Research question

For Perfect Corp YouCam v2.1 `hd_redness.raw_score`, under Face Value's guided capture workflow:

1. What is the immediate fixed technical instability when device, participant position, and lighting are held as still as practical?
2. What is the production-workflow repeatability when the participant independently moves away and reacquires the guided pose?
3. How much do session operational scores vary across predeclared sessions and days when no treatment intervention is expected to produce change?
4. How often do predeclared no-treatment session-median differences cross the current provisional `±5` and `±10` operating boundaries?
5. Which named capture-condition perturbations shift scores or increase failure rates?
6. Is the collected characterization operationally complete enough to justify a later independent threshold study?

The study unit is nested:

```text
participant
→ day
→ session
→ independent recapture
```

Individual images are not independent population observations.

## 4. Claims and non-claims

### 4.1 Permitted claims

The report may state:

1. observed raw-score distributions;
2. immediate fixed technical instability in the tested setup;
3. production-workflow within-session repeatability;
4. participant-specific and aggregate no-treatment longitudinal variability;
5. predeclared false-change rates at `±5` and `±10`;
6. named perturbation shifts and failure rates;
7. completeness and protocol deviations;
8. whether the tested workflow is operationally ready for a separate independent threshold study.

A favorable threshold-comparison statement is limited to:

> In the tested sample, observed variability was separated from the current provisional operating boundaries. The boundaries remain provisional and require independent evaluation.

### 4.2 Prohibited claims

The report must not state or imply:

1. clinical validity, diagnostic validity, clinical significance, or efficacy;
2. a minimum clinically important difference;
3. population-level performance from the one-participant dry run;
4. formal validation from three to five participants;
5. independence of individual images;
6. that no-treatment longitudinal variability is pure measurement error;
7. generalization to untested people, skin tones, devices, cameras, browsers, environments, or times;
8. that `5` or `10` points is validated, approved, scientifically established, or safe to promote;
9. that a score is invalid merely because it is statistically unusual;
10. that provider-side image deletion has been verified;
11. that the harness may alter thresholds or verdict behavior.

## 5. Nested study structure and protocol tiers

### 5.1 Common hierarchy

Every formal observation belongs to exactly one:

```text
participantId
dayOrdinal
sessionOrdinalWithinDay
recaptureOrdinalWithinSession
```

Each participant follows the same schedule:

```text
3 days
× 2 predeclared sessions per day
× 3 independent accepted recaptures per session
= 18 controlled captures per participant
```

The two daily sessions use predeclared time-window labels such as `window_a` and `window_b`. Exact clock times are recorded only to the precision approved in the privacy plan. The same window definitions should be used across days for that participant.

### 5.2 Tier A: engineering dry run

Required design:

```text
1 participant
× 3 days
× 2 sessions per day
× 3 independent recaptures per session
= 18 controlled captures
```

Purpose:

1. prove the protected live-provider workflow;
2. discover capture, session, export, and protocol problems;
3. verify that independent reacquisition is operationally possible;
4. exercise failure, replacement, anomaly, and privacy paths;
5. generate participant-specific engineering descriptors.

This tier is explicitly incapable of supporting participant-level generalization. Its primary recommendation state is `engineering_dry_run_only` unless the data are incomplete or a technical concern state has precedence.

### 5.3 Tier B: preliminary submission characterization

Minimum:

```text
3 participants
× 3 days
× 2 sessions per day
× 3 independent recaptures per session
= 54 controlled captures
```

Preferred:

```text
5 participants
× 3 days
× 2 sessions per day
× 3 independent recaptures per session
= 90 controlled captures
```

Purpose:

1. obtain participant-level summaries;
2. characterize variability across a small tested sample;
3. estimate exploratory aggregate technical and longitudinal noise descriptors;
4. measure no-treatment false-change behavior at the fixed provisional boundaries;
5. decide whether a larger independent threshold study is justified.

This tier remains preliminary. It is not a formal precision, validation, clinical, or population study.

### 5.4 Independence law

Raw images and recaptures are nested, not independent.

The report must not:

1. describe 54 or 90 images as 54 or 90 independent participants;
2. calculate population confidence intervals by treating images as independent;
3. generate every possible pair of sessions and treat those pairs as independent;
4. pool participants without preserving participant IDs and participant-level summaries;
5. let one participant's repeated captures masquerade as broader population evidence.

## 6. Three variability layers

### 6.1 Layer 1: fixed technical floor

Purpose: estimate immediate camera and provider instability under the most fixed practical setup.

Conditions:

1. fixed device and front camera;
2. fixed camera profile;
3. fixed participant position and device mount;
4. fixed lighting;
5. neutral expression;
6. minimal repositioning;
7. same live provider and protocol;
8. short collection interval.

This layer is diagnostic only. It is not the primary Face Value workflow estimate because real users must independently reacquire the guided pose.

The fixed-floor block is separate from the 18, 54, and 90 formal controlled-capture totals. Before collection, the implementation must predeclare its capture count. Six accepted captures are the recommended engineering default because they provide more than one immediate difference while keeping the block short. This count is an engineering operating choice, not a scientific validity threshold.

### 6.2 Layer 2: production-workflow repeatability

Purpose: estimate the repeatability of the workflow Face Value actually asks a user to perform.

For every formal recapture:

1. complete the prior capture and provider result;
2. perform full camera reset where practical;
3. move out of the prior pose;
4. independently return to the marked approximate position;
5. reacquire the guided face, pose, lighting, and resolution gates;
6. capture only after the existing readiness gate accepts the pose;
7. repeat until three accepted independent recaptures form the session.

This is the primary technical estimate for Face Value.

### 6.3 Layer 3: no-treatment longitudinal variability

Purpose: characterize how session operational scores vary across separate sessions and days when no product intervention is expected to create a change.

Conditions:

1. three days per participant;
2. two predeclared time windows per day;
3. fixed device and environment where practical;
4. the same guided capture and independent-recapture workflow;
5. no product intervention introduced for the purpose of producing a redness change;
6. structured context and protocol deviations recorded;
7. session operational score derived before longitudinal comparisons.

This layer includes:

1. camera and provider instability;
2. workflow reacquisition variability;
3. session setup variability;
4. short-term biological variability;
5. day-to-day biological variability;
6. unmeasured context that remains after standardization.

It must never be described as pure measurement error.

### 6.4 Layer separation

The report must present all layers separately.

```text
fixed technical floor
≠ production-workflow repeatability
≠ no-treatment longitudinal variability
≠ named perturbation sensitivity
```

No perturbation capture may enter controlled repeatability or longitudinal estimates.

## 7. Formal controlled and longitudinal protocol

### 7.1 Participant setup

For each participant, assign:

1. a random pseudonymous local `participantId`;
2. a participant ordinal;
3. one device setup ID;
4. one environment setup ID;
5. one frozen camera profile;
6. one frozen provider protocol;
7. two predeclared daily time-window labels;
8. a study tier.

Do not collect names, emails, account IDs, precise location, or free-form personal history.

### 7.2 Day and session schedule

Each participant completes:

| Day | Session | Time-window label | Accepted recaptures |
| ---: | ---: | --- | ---: |
| 1 | 1 | `window_a` | 3 |
| 1 | 2 | `window_b` | 3 |
| 2 | 1 | `window_a` | 3 |
| 2 | 2 | `window_b` | 3 |
| 3 | 1 | `window_a` | 3 |
| 3 | 2 | `window_b` | 3 |

Time-window definitions are fixed before the participant's first formal capture. If a session occurs outside its window, retain the session and mark a protocol deviation. Do not silently relabel the window after collection.

### 7.3 Independent recapture procedure

For each of the three formal recaptures:

1. start from no active accepted image;
2. initiate the camera through an explicit user action;
3. acquire the production guided pose;
4. capture one image;
5. submit through explicit live provider mode;
6. record the attempt before classifying the outcome;
7. finish or tear down the capture flow;
8. move out of position;
9. independently reacquire the pose for the next recapture.

A burst of multiple frames from one uninterrupted held pose does not satisfy independent recapture.

### 7.4 Primary session unit

The operational score for a complete formal session is:

```text
sessionOperationalScore =
median of the 3 accepted independent raw_score recaptures
```

With exactly three accepted values, the median is the middle ordered value.

The raw recaptures remain primary inputs for within-session technical statistics and remain preserved in export. The session median is not a replacement for raw evidence.

### 7.5 Attempt and replacement policy

Each formal session targets exactly three accepted independent recaptures.

Each intended recapture slot may have at most three recorded attempts. Therefore, a formal session has an engineering cap of nine total attempts.

This cap is an operational workflow policy:

```text
EWP-ATTEMPT-01
maximum 3 attempts per intended recapture slot
maximum 9 attempts per 3-recapture session
```

Rationale: bound participant burden and prevent unlimited discretionary retries. It is not a scientific validity threshold.

A failed attempt may be replaced only when its canonical outcome is:

```text
provider_failure
invalid_or_missing_score
upload_failure
cancelled_capture
face_detection_failure
protocol_deviation
provider_contract_anomaly
```

Replacement rules:

1. retain the original attempt;
2. assign a new capture ID and attempt ordinal;
3. link the replacement through `replacesCaptureId`;
4. preserve the intended recapture slot;
5. count only an accepted, protocol-conforming, in-contract score toward the three-recapture target;
6. never replace an accepted score because of its numerical value;
7. never trim, winsorize, clamp, or remove an accepted score based on z score, IQR, MAD, distance from median, or threshold relation.

If a slot remains unresolved after three attempts, the session is incomplete.

### 7.6 No-treatment context

Before the first participant is enrolled, define the structured context fields needed to interpret deviations without collecting identity. At minimum:

```text
makeup_present
recent_heat_or_exercise
recent_cleansing_or_skincare
routine_or_treatment_change
acute_visible_irritation_reported
time_window_missed
device_or_environment_changed
```

These fields describe protocol context. They do not diagnose a condition and do not authorize score exclusion unless the predeclared protocol says the capture is a protocol deviation.

## 8. Perturbation protocol

### 8.1 Separation from controlled characterization

Perturbations are exploratory sensitivity blocks. They must not enter:

1. fixed technical floor estimates;
2. production-workflow pooled SD;
3. RC95;
4. formal session medians;
5. no-treatment longitudinal differences;
6. false-change rates at `±5` or `±10`;
7. empirical technical or longitudinal N95.

### 8.2 Required named conditions

Use six named perturbations:

```text
brighter_lighting
dimmer_lighting
closer_distance
farther_distance
frozen_yaw_side
expression_change
```

The yaw side, left or right, is selected before collection and remains fixed for the pilot.

Only one condition changes in a perturbation block.

### 8.3 Submission-pilot sample

Run perturbations on one designated participant.

Minimum exploratory block:

```text
3 matched pairs per condition
× 2 captures per pair
× 6 conditions
= 36 perturbation captures
```

Preferred exploratory block:

```text
5 matched pairs per condition
× 2 captures per pair
× 6 conditions
= 60 perturbation captures
```

These totals exclude failed and replacement attempts.

### 8.4 Pairing and order

Each matched pair contains:

```text
one controlled capture
one perturbed capture
```

Pair order is counterbalanced before collection:

```text
pair 1: control → perturbation
pair 2: perturbation → control
pair 3: control → perturbation
```

For five pairs:

```text
pair 4: perturbation → control
pair 5: control → perturbation
```

The order schedule is frozen before scores are visible. A failed side of a pair may be replaced under the same retention rules, but a pair is complete only when both sides are accepted.

### 8.5 Perturbation completeness

Perturbation completion is reported separately and never blocks the controlled report:

```text
controlledCharacterization:
  complete | incomplete

longitudinalCharacterization:
  complete | incomplete

perturbationCharacterization:
  complete | partial | not_run
```

Definitions:

1. `complete`: every required named condition has at least three complete matched pairs;
2. `partial`: at least one condition has a complete pair, but the minimum block is not complete for every condition;
3. `not_run`: no complete perturbation pair exists.

## 9. Inclusion, exclusion, anomaly, and reason codes

### 9.1 Canonical capture outcomes

Every attempt receives exactly one canonical outcome:

```ts
type RednessCalibrationCaptureOutcome =
  | 'usable_capture'
  | 'provider_failure'
  | 'invalid_or_missing_score'
  | 'upload_failure'
  | 'cancelled_capture'
  | 'face_detection_failure'
  | 'protocol_deviation'
  | 'provider_contract_anomaly';
```

### 9.2 Outcome definitions

| Outcome | Exact rule | Primary analysis |
| --- | --- | --- |
| `usable_capture` | live provider returns a finite score within the documented provider range and all protocol requirements pass | included |
| `provider_failure` | provider or protected API returns a terminal failure other than a missing score or upload failure | excluded, retained |
| `invalid_or_missing_score` | no finite `raw_score` is returned | excluded, retained |
| `upload_failure` | upload slot or image transfer fails | excluded, retained |
| `cancelled_capture` | user, navigation, unmount, or abort cancels the attempt | excluded, retained |
| `face_detection_failure` | camera or provider face-quality requirement prevents a valid capture | excluded, retained |
| `protocol_deviation` | a predeclared controlled condition, time window, device, environment, pose, or protocol requirement is not met | excluded from the affected primary layer, retained |
| `provider_contract_anomaly` | provider returns a finite live `raw_score` outside documented `1` to `100` | excluded from primary analysis by predeclared contract rule, retained unchanged |

### 9.3 Value-based exclusion prohibition

A finite, in-contract, protocol-conforming score remains included even when it:

1. is the minimum or maximum;
2. creates a large SD or MAD;
3. crosses `±5` or `±10`;
4. appears inconsistent with neighboring scores;
5. looks implausible to a reviewer;
6. changes the recommendation state.

No statistical outlier rule is permitted in the primary analysis.

### 9.4 Sensitivity appendix

The report must include a secondary, clearly labeled sensitivity appendix that shows:

1. provider-contract anomaly values unchanged;
2. primary results excluding contract anomalies;
3. descriptive results including finite contract anomalies;
4. the number and provenance of anomalies.

This is not permission to treat anomalies as valid provider output. It preserves auditability.

## 10. Statistical plan

### 10.1 Analysis hierarchy

Analysis follows the study hierarchy.

```text
raw recapture
→ formal session summary
→ predeclared session-median difference
→ participant-level summary
→ exploratory aggregate summary
```

Do not flatten the hierarchy into one independent image table.

### 10.2 Raw recapture statistics

For each complete formal session, report from the three accepted raw recaptures:

1. minimum;
2. maximum;
3. mean;
4. median;
5. sample standard deviation using denominator `n - 1`;
6. unscaled median absolute deviation;
7. range;
8. largest absolute residual from the session median;
9. recapture-order values;
10. capture and failure counts.

Definitions for accepted raw scores \(x_1, x_2, x_3\):

\[
\bar{x} = \frac{1}{3}\sum_{i=1}^{3}x_i
\]

\[
s = \sqrt{\frac{\sum_{i=1}^{3}(x_i-\bar{x})^2}{2}}
\]

\[
MAD = \operatorname{median}(|x_i-\operatorname{median}(x)|)
\]

\[
range = \max(x)-\min(x)
\]

\[
largestResidual = \max_i |x_i-\operatorname{median}(x)|
\]

MAD remains unscaled. If a normal-consistency-scaled MAD is ever added, it must be a separately named field.

### 10.3 Pooled within-session SD

For all complete production-workflow sessions in the selected analysis scope:

\[
s_{pooled}
=
\sqrt{
\frac{
\sum_{j=1}^{m}(n_j-1)s_j^2
}{
\sum_{j=1}^{m}(n_j-1)
}
}
\]

For formal sessions, \(n_j = 3\).

Scopes reported separately:

1. each participant;
2. all preliminary-characterization participants, with participant clustering retained;
3. fixed technical floor, when run;
4. production-workflow sessions.

Do not pool perturbation sessions into this estimate.

### 10.4 Repeatability coefficient

Report:

\[
RC95
=
1.96 \times \sqrt{2} \times s_{pooled}
\]

Label:

```text
Exploratory RC95 under a normal-error approximation
```

Assumptions:

1. within-session errors are approximately independent after independent reacquisition;
2. variance is sufficiently stable across the analyzed sessions;
3. the distribution is not severely skewed or heavy-tailed;
4. the participant and protocol remain stable inside each formal session.

Limitations:

1. three recaptures per session yield imprecise session SDs;
2. repeated sessions and participants are nested;
3. serial provider behavior may violate independence;
4. pooled SD may hide heterogeneity;
5. RC95 is not biological significance, efficacy, or threshold validation.

RC95 must be shown beside raw SD, MAD, range, residual, and order-drift summaries.

### 10.5 Session operational scores

For every complete formal session:

```text
sessionOperationalScore = median(rawRecaptureScores)
```

Use session operational scores for:

1. within-day session comparison;
2. day-to-day comparison;
3. no-treatment false-change testing;
4. participant longitudinal summaries;
5. threshold behavior at `±5` and `±10`.

### 10.6 Predeclared no-treatment differences

Do not create all possible session pairs.

For each participant, compute exactly seven signed session-median differences.

Within-day window difference:

```text
day1: window_b − window_a
day2: window_b − window_a
day3: window_b − window_a
```

Adjacent-day same-window difference:

```text
window_a: day2 − day1
window_a: day3 − day2
window_b: day2 − day1
window_b: day3 − day2
```

These differences are still correlated within participant and day. They are not independent population observations.

At three participants:

```text
7 predeclared differences per participant
= 21 longitudinal differences
```

At five participants:

```text
7 predeclared differences per participant
= 35 longitudinal differences
```

The report must preserve participant and difference-type labels.

For each participant and for the exploratory aggregate, summarize the predeclared differences with:

1. mean signed difference;
2. median signed difference;
3. mean absolute difference;
4. median absolute difference;
5. maximum absolute difference;
6. counts by difference type, day, and time-window label.

These are descriptive between-session and day-to-day drift summaries. They do not create additional pairs.

### 10.7 Empirical technical N95

Define the exploratory empirical technical noise boundary from predeclared adjacent recapture differences inside complete formal sessions:

```text
recapture 2 − recapture 1
recapture 3 − recapture 2
```

Let \(a_k\) be the absolute value of each predeclared adjacent difference.

\[
technicalN95_{empirical}
=
Q_{0.95}(a_k)
\]

Use one predeclared quantile algorithm, recorded in the report and tests. Type 7 quantiles are the implementation default.

Label:

```text
Exploratory empirical technical N95
```

Caution: adjacent differences share recaptures and are not independent. This metric is descriptive and must be shown with its raw distribution and participant-level values.

### 10.8 Empirical longitudinal N95

Let \(d_k\) be the seven predeclared no-treatment session-median differences per participant.

\[
longitudinalN95_{empirical}
=
Q_{0.95}(|d_k|)
\]

Report:

1. each participant's empirical longitudinal N95;
2. the pooled exploratory value;
3. the number of contributing participants and differences;
4. the raw absolute-difference distribution;
5. a small-sample warning.

Label:

```text
Exploratory empirical longitudinal N95
```

It includes real short-term biological variability and must not be called pure measurement noise.

### 10.9 False-change rates at the provisional boundaries

Using only the predeclared no-treatment session-median differences:

\[
falseChangeRate_{5}
=
\frac{\#(|d_k| \ge 5)}{\#(valid\ d_k)}
\]

\[
falseChangeRate_{10}
=
\frac{\#(|d_k| \ge 10)}{\#(valid\ d_k)}
\]

Report for each boundary:

1. numerator and denominator;
2. overall absolute crossing rate;
3. favorable-direction crossings;
4. unfavorable-direction crossings;
5. participant-level rates;
6. aggregate exploratory rate;
7. confidence interval method and warning.

A boundary crossing under no treatment is an observed false-change event for this characterization. It is not proof that the boundary is invalid.

### 10.10 Participant-level summaries

For each participant, report:

1. six session medians;
2. all 18 raw controlled scores;
3. pooled within-session SD;
4. RC95;
5. technical N95;
6. seven predeclared longitudinal differences;
7. longitudinal N95;
8. false-change counts at `±5` and `±10`;
9. failure and rejection rates;
10. provider-contract anomaly count;
11. day and time-window labels;
12. capture-order summaries;
13. protocol deviations;
14. completeness.

Aggregate reports must not replace participant-level tables.

### 10.11 Confidence intervals

Confidence intervals are exploratory and must carry:

```text
Small-sample warning:
Only 3 to 5 participants are planned. Interval estimates may be unstable,
asymmetric, and highly sensitive to a single participant or day.
```

Preferred approach for the preliminary tier:

1. resample participants as the top-level cluster;
2. retain each selected participant's days, sessions, and recaptures together;
3. recompute aggregate RC95, N95 values, and false-change rates;
4. report percentile bootstrap intervals and the number of successful resamples;
5. do not produce a reassuring interval when too few distinct resamples exist.

For the one-participant dry run:

1. do not report a participant-generalizable confidence interval;
2. optional day-block bootstrap intervals may be shown as workflow diagnostics only;
3. label them as unstable and non-generalizable.

No interval may be calculated by treating images or all session pairs as independent.

### 10.12 Absolute residual versus session median

For every accepted raw recapture, compute:

\[
absoluteResidual_{ij}
=
|x_{ij}-sessionMedian_j|
\]

Report a descriptive scatter or table of absolute residual versus session median, separated by participant. This checks whether variability appears to change across the observed score level.

Any correlation or trend line is descriptive only. With the planned sample, it must not be used to fit a universal variance model.

### 10.13 Capture-order drift

Within every complete formal session, retain recapture order `1`, `2`, and `3`.

Report:

1. `recapture3 - recapture1`;
2. ordinary least-squares slope of score on order for that session;
3. participant median slope;
4. count of positive, negative, and zero slopes;
5. raw order plots or tables.

With only three points per session, order drift is a diagnostic for warming, settling, fatigue, or serial provider behavior. It is not a validated time trend.

### 10.14 Rejection and failure rates

Report by participant, day, session, layer, and condition:

```text
attemptFailureRate =
non-usable attempts / all recorded attempts
```

Also report counts for every canonical outcome. Do not combine provider-contract anomalies with ordinary provider failures.

### 10.15 Coefficient of variation and ICC

Coefficient of variation is not a primary metric because the repository does not establish a meaningful ratio-scale zero for Face Value interpretation.

ICC is not part of this pilot's primary or required analysis. The nested participant sample is too small for ICC to carry the meaning reviewers may assign to it, and the protocol already specifies direct variance, repeatability, N95, and false-change summaries.

## 11. Threshold comparison method

### 11.1 Frozen read-only snapshot

The report reads and records, but never mutates:

```text
detectable boundary = 5
strong boundary = 10
version = redness-provisional-v1
source = provisional_fixture
provisional = true
config hash = sha256:66571af3c662f4da1de469d763b884ad46eb37ee77df0aa060e4b2db280feed5
```

If this snapshot changes, the harness must fail closed for the current protocol version and require plan review. It must not silently follow changed thresholds.

### 11.2 Primary comparison unit

Primary threshold behavior uses:

```text
predeclared no-treatment differences
between formal session medians
```

It does not use individual raw images as independent threshold trials.

RC95 may be displayed beside the boundaries as a technical descriptor, but the primary false-change comparison at `5` and `10` uses session medians.

### 11.3 Required threshold table

| Boundary | Predeclared differences crossing | Denominator | False-change rate | Participant range | Exploratory CI |
| --- | ---: | ---: | ---: | ---: | --- |
| `±5` | observed | valid predeclared differences | observed | observed | small-sample |
| `±10` | observed | valid predeclared differences | observed | observed | small-sample |

Also display:

1. exploratory technical N95;
2. exploratory longitudinal N95;
3. participant-specific longitudinal N95;
4. signed crossing direction;
5. completeness and anomaly counts.

### 11.4 Interpretation

Allowed interpretations:

```text
separation_observed_in_tested_sample
overlap_observed_in_tested_sample
inconclusive_due_to_sample_or_completeness
```

These are descriptive report findings, not recommendation states and not threshold approval.

A separation finding may use only:

> In the tested sample, observed variability was separated from the current provisional operating boundaries. The boundaries remain provisional and require independent evaluation.

The report must not infer that a provisional boundary is scientifically established because the same boundary was used to judge separation.

## 12. Deterministic recommendation model

### 12.1 Recommendation states

```ts
type RednessCalibrationRecommendationState =
  | 'engineering_dry_run_only'
  | 'preliminary_characterization_complete'
  | 'controlled_repeatability_concern'
  | 'high_workflow_sensitivity'
  | 'high_longitudinal_variability'
  | 'ready_for_independent_threshold_study'
  | 'insufficient_data';
```

One primary state is selected. All other triggered concern rules remain in `secondaryFindings`.

### 12.2 Inputs

```text
studyTier
participantCount
controlledCharacterization completeness
longitudinalCharacterization completeness
perturbationCharacterization completeness
RC95 for production workflow
fixed-floor RC95, if run
empirical technical N95
empirical longitudinal N95
false-change counts at ±5 and ±10
attempt failure rates
provider-contract anomaly counts
protocol deviations
report and interval completeness
```

### 12.3 Rule precedence

Rules run in the exact order below. The first matching state is primary.

#### RCR01: `insufficient_data`

Select when any condition is true:

1. required participant count for the declared tier is not met;
2. any required participant lacks three days;
3. any required day lacks two formal sessions;
4. any formal session lacks exactly three accepted independent recaptures;
5. controlled characterization is incomplete;
6. longitudinal characterization is incomplete;
7. a provider, protocol, app build, camera profile, device setup, or environment mismatch makes the planned comparison invalid;
8. session medians or required predeclared differences cannot be computed;
9. the threshold snapshot does not match the frozen configuration;
10. live-versus-fixture provenance is missing;
11. the dataset was collected in fixture mode.

Perturbation characterization does not trigger `insufficient_data` for the controlled report.

#### RCR02: `engineering_dry_run_only`

Select when:

1. the declared tier is `engineering_dry_run`;
2. one participant completed the required 18 controlled captures;
3. controlled and longitudinal characterization are complete;
4. RCR01 did not match.

Concern rules still appear as secondary findings. The dry run cannot produce `preliminary_characterization_complete` or `ready_for_independent_threshold_study`.

#### RCR03: `controlled_repeatability_concern`

For the preliminary tier, select when any condition is true:

```text
productionWorkflowRC95 >= 5
empiricalTechnicalN95 >= 5
```

This rule uses the existing 5-point boundary as a concern screen. It does not validate or invalidate the boundary.

Also trigger a secondary finding when either descriptor reaches `10`.

#### RCR04: `high_workflow_sensitivity`

Select when RCR01 through RCR03 did not match and at least one predeclared engineering review policy is met.

```text
EWP-WORKFLOW-01:
productionWorkflowRC95 >= 2 × fixedFloorRC95
AND absolute difference >= 1 raw-score point

EWP-WORKFLOW-02:
usable-capture failure rate in formal workflow > 0.20
```

Rationale:

1. the ratio policy identifies a workflow estimate substantially larger than the fixed setup;
2. the one-point absolute guard avoids a large ratio caused by a near-zero denominator;
3. the 20 percent failure policy identifies operational burden likely to distort real use.

These are engineering review policies, not scientific validity criteria. If the fixed technical floor was not run, EWP-WORKFLOW-01 is unavailable, not false.

Named perturbation results may appear as secondary workflow-sensitivity findings but do not determine this primary state and do not block controlled-report computation.

#### RCR05: `high_longitudinal_variability`

Select when RCR01 through RCR04 did not match and any condition is true:

```text
empiricalLongitudinalN95 >= 5
at least one participant has a predeclared no-treatment difference with |difference| >= 5
```

This state means no-treatment session-median variability overlapped the current detectable operating boundary in the tested sample. It does not prove that the boundary is invalid.

Crossings at `10` add a secondary high-severity finding.

#### RCR06: `ready_for_independent_threshold_study`

Select when all conditions are true:

1. the declared tier is preliminary submission characterization;
2. five participants completed the full 90 controlled captures;
3. controlled and longitudinal characterization are complete;
4. live provenance, anomaly reporting, participant summaries, aggregate summaries, and small-sample intervals are complete;
5. no earlier concern rule matched;
6. the protected workflow completed without unresolved architecture or privacy failures;
7. the report was generated from the frozen plan and statistical implementation;
8. a reviewer can reproduce every summary from the face-free export.

This state means only that the engineering characterization is operationally mature enough to design a separate independent threshold study. It does not approve `5` or `10`.

#### RCR07: `preliminary_characterization_complete`

Select when:

1. at least three participants completed the full minimum 54 controlled captures;
2. controlled and longitudinal characterization are complete;
3. no earlier concern rule matched;
4. the preferred five-participant readiness conditions are not all met.

This state means the preliminary characterization is complete, not validated.

### 12.4 Required recommendation copy

| State | Required statement |
| --- | --- |
| `insufficient_data` | `The required controlled or longitudinal dataset is incomplete or incompatible. No characterization recommendation is available.` |
| `engineering_dry_run_only` | `The one-participant engineering dry run is complete. It may reveal workflow problems but cannot support participant-level generalization.` |
| `controlled_repeatability_concern` | `Controlled production-workflow repeatability overlapped the current provisional detectable boundary in the tested sample. The boundary remains provisional.` |
| `high_workflow_sensitivity` | `The reacquisition workflow introduced materially more instability or operational failure than the fixed technical setup under a predeclared engineering review policy.` |
| `high_longitudinal_variability` | `No-treatment session-median variability overlapped the current provisional detectable boundary in the tested sample. This includes biological and workflow variability.` |
| `preliminary_characterization_complete` | `The minimum preliminary characterization is complete. Results remain preliminary and do not validate the current operating boundaries.` |
| `ready_for_independent_threshold_study` | `The preferred preliminary characterization is operationally complete and reproducible enough to justify designing a separate independent threshold study.` |

Every recommendation includes:

```text
Prototype engineering characterization, not clinical validation.
No threshold or verdict behavior was changed.
```

No state may use `validated`, `approved`, `scientifically established`, `safe to promote`, or equivalent wording for the 5-point or 10-point boundaries.

## 13. Privacy and export model

### 13.1 Transient in-memory data

During one active attempt, memory may contain:

1. one image Blob;
2. sanitized file name and content type;
3. upload slot response;
4. signed upload URL and headers;
5. provider file ID and task ID;
6. normalized result;
7. current capture record.

Release transient values after success, failure, cancellation, route leave, or unmount. Construct export records by allowlist, never by spreading provider responses.

### 13.2 Allowed persistence and export

The first implementation remains memory-only until explicit export.

A face-free export may include:

1. protocol and schema versions;
2. random pseudonymous local participant IDs;
3. participant, day, session, recapture, and attempt ordinals;
4. study tier and variability layer;
5. predeclared time-window labels;
6. coarse platform and browser family;
7. app build, provider API, capture protocol, and camera profile versions;
8. non-identifying device and environment setup IDs;
9. structured condition labels;
10. capture outcome and replacement linkage;
11. finite raw scores, including flagged provider-contract anomalies;
12. session medians;
13. statistical summaries;
14. completeness states;
15. read-only threshold snapshot;
16. recommendation and triggered rules;
17. privacy assertions.

### 13.3 Forbidden data

Never persist or export:

```text
face images
image Blobs or Files
base64 or data URLs
object URLs
signed URLs
upload URLs
provider file IDs
provider task IDs
authorization headers
API or protected-session credentials
cookies
raw provider payloads
mask images or mask URLs
names
email addresses
account IDs
phone numbers
precise location
IP addresses
full user agents
device serial numbers
advertising identifiers
free-form personal notes
```

### 13.4 Storage isolation

Any later resume support requires a separately reviewed calibration namespace and validator. It must not use:

```text
face-value:structured-demo:v1
face-value:demo-lab:journey:v1
FaceValueState
EvidenceRecordData
LongitudinalSkinEvidence
```

Ordinary consumer builds must contain no calibration route, storage key, collection controls, fixture provenance, or report code.

## 14. Proposed TypeScript data model

The model is explicitly redness-specific. Do not introduce a universal `SkinSignalCalibration<T>` abstraction.

```ts
export const REDNESS_CALIBRATION_PROTOCOL_VERSION =
  'redness-calibration-v1.1' as const;

export const REDNESS_CALIBRATION_EXPORT_SCHEMA =
  'redness-calibration-export-v1.1' as const;

export type RednessCalibrationStudyTier =
  | 'engineering_dry_run'
  | 'preliminary_submission_characterization';

export type RednessCalibrationVariabilityLayer =
  | 'fixed_technical_floor'
  | 'production_workflow_repeatability'
  | 'no_treatment_longitudinal'
  | 'capture_condition_perturbation';

export type RednessCalibrationTimeWindow =
  | 'window_a'
  | 'window_b';

export type RednessCalibrationConditionLabel =
  | 'controlled'
  | 'brighter_lighting'
  | 'dimmer_lighting'
  | 'closer_distance'
  | 'farther_distance'
  | 'left_yaw'
  | 'right_yaw'
  | 'expression_change';

export type RednessCalibrationCaptureOutcome =
  | 'usable_capture'
  | 'provider_failure'
  | 'invalid_or_missing_score'
  | 'upload_failure'
  | 'cancelled_capture'
  | 'face_detection_failure'
  | 'protocol_deviation'
  | 'provider_contract_anomaly';

export type ControlledCharacterizationCompleteness =
  | 'complete'
  | 'incomplete';

export type LongitudinalCharacterizationCompleteness =
  | 'complete'
  | 'incomplete';

export type PerturbationCharacterizationCompleteness =
  | 'complete'
  | 'partial'
  | 'not_run';

export interface RednessCalibrationSignalProtocol {
  provider: 'youcam';
  apiVersion: '2.1';
  mode: 'hd';
  concern: 'hd_redness';
  region: null;
  scoreType: 'raw_score';
  captureProtocolVersion: 'face-value-youcam-1';
}

export interface RednessCalibrationParticipant {
  participantId: string;
  participantOrdinal: number;
  studyTier: RednessCalibrationStudyTier;
  deviceSetupId: string;
  environmentSetupId: string;
  plannedDayCount: 3;
  plannedSessionsPerDay: 2;
  plannedRecapturesPerSession: 3;
}

export interface RednessCalibrationCaptureRecord {
  captureId: string;
  participantId: string;
  participantOrdinal: number;
  dayOrdinal: 1 | 2 | 3;
  sessionOrdinalWithinDay: 1 | 2;
  recaptureOrdinalWithinSession: 1 | 2 | 3;
  attemptOrdinalForRecapture: 1 | 2 | 3;
  studyTier: RednessCalibrationStudyTier;
  variabilityLayer: RednessCalibrationVariabilityLayer;
  timeWindow: RednessCalibrationTimeWindow;
  condition: RednessCalibrationConditionLabel;
  pairId: string | null;
  pairOrder: 'control_first' | 'perturbation_first' | null;
  outcome: RednessCalibrationCaptureOutcome;
  rawScore: number | null;
  providerContractAnomaly: boolean;
  providerCode: string | null;
  protocolDeviationCodes: string[];
  replacesCaptureId: string | null;
  capturedAtRounded: string;
  providerMode: 'live' | 'fixture_for_automated_test';
  appBuildVersion: string;
  cameraProfileId: string;
  signalProtocol: RednessCalibrationSignalProtocol;
}

export interface RednessCalibrationSessionSummary {
  participantId: string;
  dayOrdinal: 1 | 2 | 3;
  sessionOrdinalWithinDay: 1 | 2;
  timeWindow: RednessCalibrationTimeWindow;
  targetAcceptedRecaptures: 3;
  acceptedCaptureIds: [string, string, string] | null;
  rawScores: [number, number, number] | null;
  sessionMedian: number | null;
  mean: number | null;
  sampleStandardDeviation: number | null;
  medianAbsoluteDeviation: number | null;
  minimum: number | null;
  maximum: number | null;
  range: number | null;
  largestAbsoluteResidualFromMedian: number | null;
  recaptureThreeMinusOne: number | null;
  orderSlope: number | null;
  attemptCount: number;
  outcomeCounts: Record<RednessCalibrationCaptureOutcome, number>;
  complete: boolean;
}

export type RednessCalibrationLongitudinalDifferenceType =
  | 'within_day_window_b_minus_a'
  | 'adjacent_day_window_a'
  | 'adjacent_day_window_b';

export interface RednessCalibrationLongitudinalDifference {
  differenceId: string;
  participantId: string;
  differenceType: RednessCalibrationLongitudinalDifferenceType;
  fromDayOrdinal: 1 | 2 | 3;
  toDayOrdinal: 1 | 2 | 3;
  fromSessionMedian: number;
  toSessionMedian: number;
  signedDifference: number;
  absoluteDifference: number;
  crossesFivePointBoundary: boolean;
  crossesTenPointBoundary: boolean;
}

export interface RednessCalibrationDistributionSummary {
  count: number;
  minimum: number;
  maximum: number;
  mean: number;
  median: number;
  sampleStandardDeviation: number | null;
  medianAbsoluteDeviation: number;
  range: number;
}

export interface RednessCalibrationParticipantReport {
  participantId: string;
  participantOrdinal: number;
  studyTier: RednessCalibrationStudyTier;
  sessions: RednessCalibrationSessionSummary[];
  longitudinalDifferences: RednessCalibrationLongitudinalDifference[];
  pooledWithinSessionStandardDeviation: number | null;
  repeatabilityCoefficient95: number | null;
  empiricalTechnicalN95: number | null;
  empiricalLongitudinalN95: number | null;
  falseChangeRateAtFive: number | null;
  falseChangeRateAtTen: number | null;
  failureRate: number;
  providerContractAnomalyCount: number;
  controlledCompleteness: ControlledCharacterizationCompleteness;
  longitudinalCompleteness: LongitudinalCharacterizationCompleteness;
  perturbationCompleteness: PerturbationCharacterizationCompleteness;
}

export interface RednessCalibrationAggregateReport {
  participantCount: number;
  controlledCaptureTarget: 18 | 54 | 90;
  participantReports: RednessCalibrationParticipantReport[];
  pooledWithinSessionStandardDeviation: number | null;
  repeatabilityCoefficient95: number | null;
  empiricalTechnicalN95: number | null;
  empiricalLongitudinalN95: number | null;
  falseChangeRateAtFive: number | null;
  falseChangeRateAtTen: number | null;
  confidenceIntervals: {
    method: 'participant_cluster_percentile_bootstrap' | 'not_available';
    successfulResamples: number;
    smallSampleWarning: true;
    rc95: readonly [number, number] | null;
    technicalN95: readonly [number, number] | null;
    longitudinalN95: readonly [number, number] | null;
    falseChangeRateAtFive: readonly [number, number] | null;
    falseChangeRateAtTen: readonly [number, number] | null;
  };
  controlledCompleteness: ControlledCharacterizationCompleteness;
  longitudinalCompleteness: LongitudinalCharacterizationCompleteness;
  perturbationCompleteness: PerturbationCharacterizationCompleteness;
}

export interface RednessCalibrationBoundarySnapshot {
  detectablePoints: 5;
  strongPoints: 10;
  version: 'redness-provisional-v1';
  source: 'provisional_fixture';
  provisional: true;
  configHash:
    'sha256:66571af3c662f4da1de469d763b884ad46eb37ee77df0aa060e4b2db280feed5';
}

export type RednessCalibrationRecommendationState =
  | 'engineering_dry_run_only'
  | 'preliminary_characterization_complete'
  | 'controlled_repeatability_concern'
  | 'high_workflow_sensitivity'
  | 'high_longitudinal_variability'
  | 'ready_for_independent_threshold_study'
  | 'insufficient_data';

export interface RednessCalibrationRecommendation {
  state: RednessCalibrationRecommendationState;
  statement: string;
  triggeredRuleIds: string[];
  secondaryFindings: string[];
  thresholdApproval: false;
  verdictBehaviorChanged: false;
}

export interface RednessCalibrationExport {
  schemaVersion: typeof REDNESS_CALIBRATION_EXPORT_SCHEMA;
  protocolVersion: typeof REDNESS_CALIBRATION_PROTOCOL_VERSION;
  generatedAtRounded: string;
  studyTier: RednessCalibrationStudyTier;
  providerMode: 'live' | 'fixture_for_automated_test';
  signalProtocol: RednessCalibrationSignalProtocol;
  boundarySnapshot: RednessCalibrationBoundarySnapshot;
  participants: RednessCalibrationParticipant[];
  captures: RednessCalibrationCaptureRecord[];
  aggregateReport: RednessCalibrationAggregateReport | null;
  recommendation: RednessCalibrationRecommendation;
  privacy: {
    includesFaceImage: false;
    includesImageBlob: false;
    includesSignedOrUploadUrl: false;
    includesProviderTaskId: false;
    includesRawProviderPayload: false;
    includesPersonalIdentifier: false;
  };
}
```

Runtime validation must reject:

1. duplicate participant, capture, pair, or difference IDs;
2. invalid nesting ordinals;
3. a usable record without a finite in-range score;
4. an anomaly record without a finite out-of-range score;
5. a failed record that silently carries a primary score;
6. broken or cyclic replacement links;
7. a complete formal session without exactly three accepted recaptures;
8. a session median not equal to the median of its preserved raw scores;
9. missing live-versus-fixture provenance;
10. protocol or threshold-snapshot drift;
11. prohibited keys at any object depth.

## 15. Implementation boundaries and test strategy

### 15.1 Allowed future implementation

A future harness PR may add:

1. redness-specific types and validators;
2. pure statistical functions;
3. hand-calculated and independently verified fixtures;
4. a calibration-specific live acquisition orchestrator;
5. explicit live and automated-fixture provider modes;
6. protected route and deployment gates;
7. memory-only nested session state;
8. explicit face-free JSON export;
9. participant-level and aggregate report generation;
10. unit, integration, E2E, privacy, architecture, and physical-device verification.

### 15.2 Forbidden future implementation

The harness PR must not change:

```text
src/domain/evidence/redness/thresholds.ts
src/domain/evidence/redness/evaluateRedness.ts
effect classifications
action precedence
confidence rules
safety rules
attribution rules
RednessEvaluationSnapshot semantics
production verdict copy
production reducer behavior
production Evidence Record behavior
production trial persistence
```

It must not:

1. create a universal skin-signal calibration abstraction;
2. collect another concern;
3. call `evaluateRedness`;
4. dispatch production result events;
5. write into `FaceValueState`;
6. create an Evidence Record;
7. silently use fixtures for human collection;
8. weaken production Camera Kit gates;
9. expose calibration in consumer navigation;
10. commit or activate a threshold;
11. make a clinical claim.

### 15.3 Provider provenance tests

Prove:

1. human sessions can start only in `live` mode;
2. `live` mode cannot resolve to `FixtureSkinAnalysisProvider`;
3. automated tests can inject fixture mode;
4. fixture datasets cannot receive a human-pilot recommendation;
5. provider mode appears in every capture, report, and export;
6. ordinary builds expose no calibration route.

### 15.4 Statistical unit tests

Use hand-calculated fixtures and an independent Python or R cross-check for:

1. mean, median, minimum, maximum, range;
2. sample SD;
3. unscaled MAD;
4. largest residual from session median;
5. pooled within-session SD;
6. RC95;
7. session median;
8. exactly seven predeclared longitudinal differences;
9. technical N95 and longitudinal N95 quantiles;
10. false-change rates at `±5` and `±10`;
11. capture-order slope;
12. provider-contract anomaly exclusion and sensitivity output;
13. participant-level and aggregate summaries;
14. clustered bootstrap resampling;
15. recommendation precedence.

### 15.5 Independence tests

Prove:

1. all-pairs session generation is absent;
2. only the seven predeclared differences per participant exist;
3. participant IDs remain attached through aggregate analysis;
4. bootstrap resamples participants as clusters;
5. raw captures are never counted as participants;
6. perturbations never enter controlled or longitudinal estimates.

### 15.6 Failure and replacement tests

Prove:

1. every canonical outcome maps correctly;
2. every failed attempt remains after replacement;
3. replacement links are valid and acyclic;
4. a replacement receives a new ID;
5. attempt caps are enforced;
6. unusual in-range finite scores remain included;
7. finite out-of-range scores become provider-contract anomalies;
8. no z-score, IQR, MAD, or threshold-based outlier deletion exists;
9. cancellation aborts provider work and releases image references;
10. stale completion cannot mutate finalized attempts.

### 15.7 Privacy tests

Prove:

1. exports use an allowlist serializer;
2. recursive forbidden-key checks reject image, URL, task, file, token, cookie, authorization, payload, identity, and full-user-agent markers;
3. all privacy assertions are false as specified;
4. no calibration state enters production trial storage;
5. no face image, upload URL, signed URL, task ID, or raw payload appears in logs;
6. ordinary production bundles contain no calibration route, storage key, or fixture labels.

### 15.8 Physical-device verification

The future preliminary-characterization PR must not claim provider repeatability from fixtures. Manual evidence must include:

1. one exact-head protected deployment;
2. physical-device and camera-profile provenance;
3. live-provider provenance;
4. completed one-participant dry run before preliminary collection;
5. completed three-participant minimum or five-participant preferred characterization;
6. separate perturbation completeness;
7. cancellation, failure, replacement, and anomaly paths;
8. face-free export inspection;
9. browser storage inspection;
10. no console or page errors.

## 16. Open questions, governance decisions, and risks

### 16.1 Decisions required before implementation

1. **Protected deployment:** dedicated Vercel preview, separate engineering project, or equivalent protected environment.
2. **Provider retention:** confirm Perfect Corp image retention, deletion, data-processing, and regional handling.
3. **Participant governance:** define consent, access, withdrawal, and who may view face-free exports.
4. **Time windows:** choose reproducible `window_a` and `window_b` definitions without exposing precise personal schedules.
5. **No-treatment condition:** define prohibited product or routine changes during each participant's three-day collection.
6. **Fixed technical-floor count:** approve the recommended six captures or another predeclared diagnostic count.
7. **Yaw side:** freeze left or right before the designated participant's perturbation run.
8. **Lighting steps:** define brighter and dimmer conditions with a repeatable physical preset or lux target.
9. **Distance steps:** define closer and farther offsets with physical markers.
10. **Expression:** define one reproducible expression change.
11. **Device metadata:** choose the minimum coarse metadata needed for reproducibility without fingerprinting.
12. **Timestamp precision:** rounded minute, coarse time window only, or elapsed offsets.
13. **Bootstrap implementation:** approve resample count, random seed policy, and behavior when intervals are unstable.
14. **Provider model version:** determine whether Perfect Corp can expose model-version provenance.
15. **Current route retirement:** remove or replace the existing `/youcam-calibration` utility when the canonical harness is built.
16. **Independent threshold-study governance:** define who approves a later study protocol and how it remains independent from the provisional 5-point and 10-point assumptions.

### 16.2 Key risks

| Risk | Consequence | Mitigation |
| --- | --- | --- |
| fixture data mistaken for live data | invalid characterization | explicit provider mode and live-only human gate |
| directly exposed calibration route | engineering tool leaks into consumer deployment | build-time exclusion and dedicated protected deployment |
| individual images treated as independent | falsely narrow uncertainty and overstated evidence | nested IDs, participant summaries, cluster resampling |
| short three-recapture sessions | imprecise SD and RC95 | show raw distributions, MAD, N95, and small-sample warnings |
| three to five participants | weak generalization | preliminary label and independent later study |
| biological change during no-treatment period | longitudinal variance not pure measurement error | explicitly label mixed biological and workflow variability |
| provider model changes silently | sessions become incomparable | version capture where possible and fail on known drift |
| out-of-range finite score | silent contract violation | preserve, flag, exclude by predeclared anomaly rule, sensitivity appendix |
| guided gate blocks perturbations | incomplete perturbation blocks | treat failure as sensitivity evidence; do not weaken gate |
| arbitrary operational policies mistaken for science | false validity claims | label every policy with `EWP` ID, rationale, and non-scientific status |
| threshold comparison becomes threshold approval | circular reasoning | descriptive false-change analysis only; separate independent study |

## 17. Future build sequence and acceptance criteria

### 17.1 Required sequence

1. merge the approved plan;
2. build pure types, runtime validation, and independently checked statistical fixtures;
3. implement protected live acquisition and visible provider provenance;
4. run the one-participant engineering dry run;
5. fix workflow, protocol, privacy, or export problems found in the dry run;
6. run the three-participant minimum or five-participant preferred preliminary characterization;
7. generate the face-free participant-level and aggregate report;
8. review fixed 5-point and 10-point no-treatment false-change behavior;
9. decide whether an independent threshold study is justified.

Any threshold change remains a separate future proposal.

### 17.2 Exact acceptance criteria for the future harness PR

#### Repository and scope

- [ ] The branch is based on then-current `origin/main`.
- [ ] The PR states that this is preliminary engineering characterization, not clinical validation.
- [ ] Only YouCam v2.1 `hd_redness.raw_score` is supported.
- [ ] No universal skin-signal abstraction is introduced.
- [ ] No threshold, evaluator, reducer, verdict, confidence, action, safety, attribution, persistence, copy, or Evidence Record behavior changes.
- [ ] The 5-point and 10-point boundaries are read-only and snapshotted by version and hash.

#### Access and provenance

- [ ] Ordinary production builds contain no calibration route or markers.
- [ ] Human collection requires a protected deployment and explicit live mode.
- [ ] Fixture mode is automated-test only.
- [ ] Provider mode is present in every capture, report, and export.
- [ ] The existing direct calibration route is removed, replaced, or properly gated.

#### Nested protocol

- [ ] The hierarchy is participant → day → session → independent recapture.
- [ ] The engineering dry run supports exactly 1 participant, 3 days, 2 sessions per day, and 3 accepted recaptures per session.
- [ ] The preliminary tier supports at least 3 and preferably 5 participants with the same nested schedule.
- [ ] Controlled targets are exactly 18, 54, or 90 accepted captures.
- [ ] Every formal session computes the median of exactly 3 accepted independent recaptures.
- [ ] Full camera reset and independent pose reacquisition occur where practical.
- [ ] Time-window labels are predeclared.
- [ ] No-treatment context is structured and preserved.
- [ ] Individual images are never treated as independent participant observations.

#### Variability layers

- [ ] Fixed technical floor, production workflow, no-treatment longitudinal variability, and perturbations are separate.
- [ ] No-treatment longitudinal variability is never labeled pure measurement error.
- [ ] Perturbations never enter controlled or longitudinal estimates.
- [ ] Perturbation completion does not block controlled report computation.
- [ ] Completeness states are reported separately.

#### Perturbations

- [ ] One designated participant runs the named perturbations.
- [ ] Each condition supports 3 matched pairs minimum and 5 preferred.
- [ ] Pair order is counterbalanced and frozen before scores are visible.
- [ ] Minimum and preferred perturbation totals are 36 and 60 accepted captures.
- [ ] Only one condition changes per block.

#### Inclusion, replacement, and anomalies

- [ ] Every attempt receives one canonical outcome.
- [ ] Every failed or replaced attempt remains preserved.
- [ ] Replacement links and attempt caps are validated.
- [ ] Unusual in-range finite scores are never excluded based on value.
- [ ] Scores are never clamped.
- [ ] Finite out-of-range live scores are flagged as provider-contract anomalies.
- [ ] Contract anomalies remain in raw export and are excluded from primary analysis only by the predeclared anomaly rule.
- [ ] A sensitivity appendix includes finite anomalies descriptively.

#### Statistics

- [ ] Raw sessions report mean, median, min, max, sample SD, unscaled MAD, range, largest residual, and order drift.
- [ ] Pooled within-session SD is degrees-of-freedom weighted.
- [ ] RC95 equals `1.96 × sqrt(2) × pooled within-session SD`.
- [ ] Exactly seven predeclared no-treatment differences are generated per participant.
- [ ] All-pairs session comparisons are absent.
- [ ] Empirical technical and longitudinal N95 are labeled exploratory.
- [ ] False-change rates at `±5` and `±10` use session medians.
- [ ] Participant-level summaries remain visible beside aggregate summaries.
- [ ] Confidence intervals use participant clustering and carry a small-sample warning.
- [ ] Absolute residual versus session median and capture-order drift are reported descriptively.
- [ ] ICC is absent from primary analysis.
- [ ] Coefficient of variation is absent as a primary metric.

#### Recommendations

- [ ] Only the seven approved recommendation states exist.
- [ ] `stable_enough_for_provisional_use` is absent.
- [ ] Rule precedence is deterministic and tested.
- [ ] Engineering review policies are labeled `EWP` with rationale.
- [ ] No recommendation validates or approves the 5-point or 10-point boundary.
- [ ] The favorable separation sentence matches Section 4 exactly.
- [ ] `ready_for_independent_threshold_study` means operational readiness only.

#### Privacy

- [ ] No names, emails, accounts, precise location, IP addresses, full user agents, serial numbers, images, image URLs, signed URLs, task IDs, credentials, cookies, masks, or raw provider payloads enter export or persistence.
- [ ] Exports are allowlisted and runtime-validated.
- [ ] First implementation is memory-only except explicit face-free export.
- [ ] Production persistence remains byte-compatible.
- [ ] Provider-side retention remains an explicit external governance question.

#### Verification

- [ ] Pure statistical fixtures are independently cross-checked.
- [ ] Unit tests cover exact formulas, nesting, anomaly rules, false-change rates, completeness, and recommendation precedence.
- [ ] Integration tests cover live provenance, all outcomes, cancellation, replacement, stale completion, and attempt caps.
- [ ] Architecture checks block calibration imports into the production evaluator, reducer, verdict view model, and trial persistence.
- [ ] Privacy checks recursively reject forbidden keys and scan ordinary bundles.
- [ ] Existing repository checks and E2E tests pass without threshold or verdict snapshot changes.
- [ ] The one-participant dry run is completed before preliminary collection.
- [ ] The preliminary face-free report is generated from a protected exact-head deployment.
- [ ] Browser storage and logs are manually inspected.
- [ ] No threshold is committed or activated.

## Review conclusion

The repository has a narrow live-provider boundary, durable raw-score normalization, deterministic redness evaluator, architecture guards, and strong application-side face-image exclusion. The existing calibration utility is insufficient and has two critical risks: direct route exposure and silent fixture selection in development.

The corrected study design is nested and tiered. The primary operational unit is the median of three independent recaptures within a formal session. Raw recaptures estimate production-workflow repeatability; formal session medians estimate no-treatment longitudinal variability and fixed-boundary false-change behavior. Perturbations remain separate.

The next move is to approve and merge this plan, build the pure statistical core, prove protected live provenance, run the one-participant dry run, repair the workflow, and only then collect the three-to-five-participant preliminary characterization. The harness PR must not change thresholds or verdict behavior. Any later threshold study or threshold proposal remains independent and separately governed.
