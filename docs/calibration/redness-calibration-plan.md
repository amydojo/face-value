# Redness Calibration Engineering Plan

**Status:** Planning and architecture only  
**Protocol version:** `redness-calibration-v1`  
**Repository baseline:** `amydojo/face-value` at `7d80f0bdb64b508b40b604c4001617917354ac5e`  
**Prepared:** July 28, 2026  
**Scope:** YouCam Skin Analysis v2.1 `hd_redness.raw_score` only

> This plan defines an engineering protocol for repeatability, session stability, capture-condition sensitivity, and comparison with the current provisional Face Value operating boundaries. It is not clinical validation, does not estimate treatment efficacy, and does not authorize any threshold or verdict change.

## 1. Repository findings

### 1.1 Current signal path

The verified production path is:

```text
camera or selected image Blob
→ YouCam upload-slot API
→ direct browser PUT to provider-signed URL
→ YouCam Skin Analysis v2.1 task
→ poll task status
→ select output where type === "hd_redness"
→ read finite raw_score
→ SkinAnalysisSignal.rawScore
→ normalizeSkinAnalysisSignal
→ DurableSkinSignal.rawScore
→ buildMvpRednessEvaluation
→ evaluateRedness
→ immutable RednessEvaluationSnapshot
→ compatibility adapters
→ reducer-owned result and saved Evidence Record
```

The raw provider response is not passed into the reducer or UI. `readRawScore` selects `record.raw_score`, requires a finite JavaScript `number`, and returns it without normalization, rescaling, clipping, rounding, or percentage conversion. Display formatting rounds to two decimal places only at presentation time.

### 1.2 Verified score contract

| Property | Verified value |
| --- | --- |
| Provider | `youcam` |
| API version | `2.1` |
| Mode | `hd` |
| Concern | `hd_redness` |
| Region | `null` |
| Score type | `raw_score` |
| Capture protocol | `face-value-youcam-1` |
| Type | finite TypeScript and JavaScript `number` |
| Polarity | higher is a more favorable redness-related skin condition |
| Comparison | endpoint minus baseline, in raw-score points |
| Enforced range | none in the repository |
| Meaningful zero | not established in the repository |
| Percentage interpretation | forbidden |

The repository does not establish a bounded 0 to 100 measurement scale, even though deterministic fixtures include `93.3356` and `100`. Those fixture values must not be used to infer the provider scale.

### 1.3 Current provisional operating boundaries

The active configuration is `redness-provisional-v1`, source `provisional_fixture`, with:

| Boundary | Raw-score points | Current classification behavior |
| --- | ---: | --- |
| Worsening boundary | `-5` | `delta <= -5` |
| No detectable change band | between `-5` and `+5` | `-5 < delta < +5` |
| Detectable improvement boundary | `+5` | `+5 <= delta < +10` |
| Strong improvement boundary | `+10` | `delta >= +10` |

The configuration is explicitly provisional and carries the limitation: `Production thresholds require repeat-scan calibration.` This plan compares measured noise with these values. It does not replace them.

### 1.4 Verdict, confidence, and action authority

Scientific decisions are made under `src/domain/evidence/redness`, not in React.

1. `buildMvpRednessEvaluation` constructs the current evidence input.
2. `evaluateRedness` separately determines effect classification, measurement quality, attribution quality, evidence quality, safety status, direction agreement, and recommended action.
3. `phaseBMachine.ts` invokes that evaluation only after matched durable baseline and follow-up signals exist.
4. The reducer persists the resulting immutable snapshot and derives the existing result surfaces from it.
5. `verify-redness-architecture.mjs` prevents scientific decision identifiers from moving into React and prevents retired verdict paths from returning.

Calibration output must therefore remain an engineering report. It must not call the production evaluator, write a `RednessEvaluationSnapshot`, dispatch a verdict event, or alter reducer state.

### 1.5 Existing failure and cancellation states

The current provider and camera layers already distinguish or expose enough information to map:

| Existing source | Examples |
| --- | --- |
| Browser or Camera Kit | SDK unavailable, unsupported browser, permission denied, camera unavailable, preview stalled, unsupported resolution, invalid capture |
| Upload | invalid type, invalid size, invalid upload slot, signed upload failure |
| Provider task | provider rejection, missing raw score, unknown task status, invalid task response, timeout |
| Session access | unconfigured or unauthorized protected demo session |
| Local protocol | protocol mismatch before provider invocation |
| Cancellation | `AbortError`, navigation, unmount, or explicit leave |

The production reducer preserves previously accepted evidence on provider failure and cancellation. Calibration must preserve every failed attempt as a record rather than collapsing failures into a generic missing row.

### 1.6 Existing development gates

The Demo Lab is gated by both:

```ts
import.meta.env.DEV
VITE_SHOW_DEMO_CONTROLS === "true"
```

Its route, copy, and isolated storage are expected to be absent from ordinary production bundles.

The existing `/youcam-calibration` route does not use that gate. It is directly routed. In development and test mode, `createSkinAnalysisProvider()` returns a singleton fixture provider. Because the current calibration screen submits every capture with role `followup`, development runs receive the fixed fixture value `100` rather than live measurements. In production mode, the route constructs the live provider and relies on the protected YouCam session API.

This is a material architecture risk for a future harness. A live calibration session must never silently run against fixtures, and a consumer deployment must never expose the calibration workflow by default.

### 1.7 Current calibration utility

The current utility:

1. accepts one selected JPEG or PNG at a time;
2. uses the frozen HD redness protocol;
3. holds the selected file and scores in React memory;
4. reports scores, consecutive deltas, absolute consecutive deltas, median absolute consecutive delta, maximum absolute consecutive delta, minimum, and maximum;
5. writes no calibration data into production trial state.

It does not yet model sessions, condition blocks, paired perturbations, replacement attempts, reason codes, exports, pooled statistics, recommendation rules, or the protocol in this document.

### 1.8 Privacy and persistence boundaries

The application currently satisfies the requested application-side persistence boundary:

1. image bytes remain in component and provider-call memory;
2. signed upload URLs, file IDs, task IDs, and raw provider payloads are not normalized into durable state;
3. the reducer receives capture metadata and normalized score data, not image Blobs;
4. durable trial storage contains finite scores, protocol metadata, capture metadata, evaluation snapshots, and face-free records;
5. saved evidence explicitly declares `includesFaceImage: false`;
6. compiled-client privacy checks scan for secrets, image data URLs, blob URL APIs, provider task markers, signed URL markers, and raw payload markers;
7. safe diagnostics record stage, role, outcome, and provider code only.

The repository does not establish the provider's server-side image retention or deletion policy. That vendor boundary must be verified separately before any claim that uploaded images are deleted by YouCam.

### 1.9 Reusable infrastructure

A future harness may reuse lower-level infrastructure without entering the production trial state machine:

1. `YouCamSkinAnalysisProvider` and the frozen protocol contract;
2. the Camera Kit adapter, quality normalization, capture profiles, and teardown behavior;
3. `AbortController` cancellation;
4. safe provider error translation and diagnostic patterns;
5. pure TypeScript statistics and schema validation;
6. Demo Lab style build-time exclusion and isolated storage patterns.

The future harness must not reuse `CameraViewport` as-is because that component dispatches production trial events. It should reuse the lower-level camera and provider adapters through a calibration-specific orchestrator.

## 2. Verified current architecture

### 2.1 Authority map

| Concern | Current authority |
| --- | --- |
| Provider request and polling | `src/adapters/analysis/youcam/YouCamSkinAnalysisProvider.ts` |
| Provider response parsing | `api/_youcam.ts` |
| Frozen protocol | `src/adapters/analysis/youcam/contracts.ts` |
| Durable normalization | `src/domain/youcamEvidence.ts` |
| Capture and provider orchestration | `src/features/capture-contract/CameraViewport.tsx` |
| Camera Kit quality and profile | `src/adapters/camera/youcam-camera-kit/` |
| Evidence construction | `src/adapters/analysis/youcam/rednessEvidenceAdapter.ts` |
| Deterministic evaluation | `src/domain/evidence/redness/evaluateRedness.ts` |
| Provisional boundaries | `src/domain/evidence/redness/thresholds.ts` |
| Durable state transitions | `src/app/phaseBMachine.ts` |
| Trial persistence | `src/adapters/persistence/localObservationStore.ts` |
| Demo fixture isolation | `src/adapters/persistence/demoJourneyStore.ts` |
| Architecture enforcement | `scripts/verify-redness-architecture.mjs` |
| Client privacy enforcement | `scripts/verify-client-privacy.mjs` |

### 2.2 Architectural constraints for calibration

The calibration implementation must be a sibling engineering system, not a new production evidence engine.

```text
live calibration capture
→ existing lower-level camera adapter
→ existing live YouCam provider
→ calibration-specific normalized capture record
→ pure redness calibration statistics
→ calibration report
→ optional explicit face-free JSON export
```

It must not flow into:

```text
FaceValueState
LongitudinalSkinEvidence
RednessEvaluationInput
RednessEvaluationSnapshot
VerdictViewModel
EvidenceRecordData
production localStorage
```

## 3. Research question

For one person using one device and one front camera under a frozen `hd_redness.raw_score` protocol:

1. How variable are repeated usable measurements within one controlled capture session?
2. How much do controlled session means drift across three separate sessions?
3. How strongly does changing one capture condition at a time shift the score or increase capture failure?
4. How large are the current provisional 5-point and 10-point operating boundaries relative to the observed controlled repeatability coefficient and between-session drift?

The output is an engineering estimate for this pilot setup. It is not a population estimate and cannot establish performance across people, skin tones, devices, environments, or time.

## 4. Claims and non-claims

### 4.1 Permitted claims

The report may state:

1. the observed distribution of finite `hd_redness.raw_score` measurements;
2. estimated same-session repeatability for the tested setup;
3. observed drift across the three tested controlled sessions;
4. observed score shifts and failure rates under named capture perturbations;
5. the ratio between estimated noise and the current provisional operating boundaries;
6. whether the tested setup meets the deterministic engineering rules in Section 12.

### 4.2 Prohibited claims

The report must not state or imply:

1. clinical validity, diagnostic validity, or clinical significance;
2. treatment efficacy or product effectiveness;
3. a minimum clinically important difference;
4. generalizability to other people, devices, cameras, skin tones, or environments;
5. provider model accuracy;
6. that a 5-point or 10-point movement is biologically meaningful;
7. that an unusual score is an error merely because it is unusual;
8. that provider-side image deletion or retention has been verified from this repository;
9. that calibration results automatically authorize a threshold, confidence, verdict, or copy change.

## 5. Controlled repeatability protocol

### 5.1 Required setup

Each controlled session uses:

1. one person;
2. one physical device;
3. the same front camera and frozen Camera Kit profile;
4. the same application build, provider API version, concern, mode, region, score type, and capture protocol;
5. one fixed environment and lighting setup;
6. a fixed approximate camera-to-face distance, marked physically and held within plus or minus 5 cm;
7. a neutral expression with relaxed mouth, eyes open, and face directed forward;
8. no camera beauty filter, operating-system portrait effect, or post-capture enhancement;
9. no change to makeup, skincare, room lighting, device placement, or camera settings during the session.

A session begins with a fresh camera start and ends with full camera teardown. The environment setup and device setup receive non-identifying local IDs so all three sessions can be checked for consistency.

### 5.2 Session procedure

1. Record the protocol version, app build, camera profile, coarse platform and browser family, controlled setup IDs, approximate distance, light setup label, and structured capture-context fields.
2. Start the camera through an explicit user gesture.
3. Wait until the existing face, position, frontal, lighting, and resolution gates report ready.
4. Capture one image.
5. Submit the image through the live `YouCamSkinAnalysisProvider`.
6. Record the attempt before determining whether it is usable.
7. Return to the marked neutral pose.
8. Repeat until ten usable captures are recorded or the attempt cap is reached.
9. Close the camera and finalize the session. No score may be edited or removed after session finalization.

The target is exactly ten usable captures per controlled session. Additional successful captures are not added after the target is reached because optional extra captures create researcher discretion.

### 5.3 Attempt cap

A controlled session may use at most 20 total attempts to obtain ten usable captures.

If ten usable captures are not obtained within 20 attempts:

1. retain all attempts;
2. mark the session `incomplete`;
3. do not compute a final recommendation;
4. permit a new session only as a new session ID, never as an overwrite.

### 5.4 Failure and replacement law

A failed attempt may be replaced only when its outcome code is one of:

```text
provider_failure
invalid_or_missing_score
upload_failure
cancelled_capture
face_detection_failure
protocol_deviation
```

Replacement rules:

1. the failed record remains in the dataset;
2. the replacement receives a new capture ID and attempt index;
3. the replacement links to the failed attempt through `replacesCaptureId`;
4. the replacement occupies the same intended sequence slot;
5. only a usable replacement counts toward the ten-capture target;
6. a finite score from a protocol-conforming capture is usable even when it appears extreme;
7. an unusual finite score may not be replaced, hidden, winsorized, trimmed, or relabeled as failure based on its value.

## 6. Session replication and perturbation protocol

### 6.1 Three controlled sessions

Collect three separate controlled sessions.

Preferred schedule:

1. one session per day on three different days;
2. same device, camera profile, room, device mount, approximate distance, and light setup;
3. same application build and protocol version.

Minimum acceptable separation when different days are impractical:

1. at least 30 minutes between sessions;
2. full camera teardown and restart;
3. fresh repositioning at the marked setup;
4. the schedule limitation recorded in structured metadata.

Session metadata must include:

```text
session ordinal
session start and completion time
completion status
protocol and export schema versions
application build version
provider API version
capture protocol version
camera profile ID
coarse platform and browser family
device setup ID
environment setup ID
light setup label
approximate distance in centimeters
structured capture-context fields
attempt count
usable count
failure count by reason code
```

Do not store a person name, email, account ID, device serial number, IP address, precise location, full user agent, or free-form note that could contain an identifier.

### 6.2 Capture-condition sensitivity design

Vary one condition at a time. Every perturbation block uses matched pairs:

```text
control capture
perturbed capture
```

The order is counterbalanced across five pairs:

```text
pair 1: control → perturbation
pair 2: perturbation → control
pair 3: control → perturbation
pair 4: perturbation → control
pair 5: control → perturbation
```

Minimum per required perturbation:

1. five usable perturbed captures;
2. five usable adjacent control captures;
3. five usable paired differences;
4. at most 20 total attempts per block to complete the ten usable captures.

A perturbation block that cannot produce five usable pairs within 20 attempts is incomplete. Its failures remain evidence of capture sensitivity, but the overall recommendation becomes `insufficient_data` until the required block is completed.

### 6.3 Required perturbations

| Condition label | Controlled definition |
| --- | --- |
| `brighter_lighting` | increase only the light level by one documented setup step |
| `dimmer_lighting` | decrease only the light level by one documented setup step |
| `closer_distance` | reduce camera-to-face distance by 20 percent from control |
| `farther_distance` | increase camera-to-face distance by 20 percent from control |
| `left_angle` or `right_angle` | choose one side before collection and rotate head approximately 15 degrees; do not pool left and right |
| `expression_change` | use one standardized closed-mouth smile while holding pose, distance, and lighting constant |

The selected angle side is frozen for the required block. The opposite side may be collected as an optional separate block with its own condition label. It must never be merged into the required block.

If the existing guided-capture gate refuses an intended perturbation, do not weaken the production gate. Record `face_detection_failure` or `protocol_deviation`, as appropriate. Failure frequency is part of the sensitivity result.

### 6.4 Speed versus evidentiary value

Three captures per perturbation are fast but too vulnerable to one unusual observation and provide weak estimates of spread. Five paired captures are the minimum because they:

1. preserve a direct adjacent control for each perturbation;
2. permit a median paired shift that is not determined by one value;
3. expose repeated provider or face-detection failures;
4. keep the pilot feasible at 60 usable captures across six required blocks.

Ten paired captures per perturbation are recommended before making any separate threshold-governance decision. They improve variance estimation and reduce sensitivity to block order, but double the capture burden to 120 usable captures. The first implementation must support both a required minimum of five pairs and an optional ten-pair extended mode.

## 7. Inclusion and exclusion rules

### 7.1 Exact outcome codes

```ts
type RednessCalibrationCaptureOutcomeCode =
  | 'usable_capture'
  | 'provider_failure'
  | 'invalid_or_missing_score'
  | 'upload_failure'
  | 'cancelled_capture'
  | 'face_detection_failure'
  | 'protocol_deviation';
```

### 7.2 Usable capture

A capture is `usable_capture` only when all of the following are true:

1. the intended protocol and condition were followed;
2. the capture completed;
3. the live provider returned the frozen `hd_redness` concern;
4. `raw_score` is a finite number;
5. the provider, API version, mode, concern, region, score type, and capture protocol match the session;
6. the capture belongs to the intended session and sequence slot;
7. required Camera Kit quality gates passed for a controlled capture;
8. no disallowed image enhancement or protocol deviation was recorded.

A score is not excluded because it is far from the mean, median, neighboring score, current threshold, or expected visual appearance.

### 7.3 Failure codes

| Outcome code | Exact use |
| --- | --- |
| `provider_failure` | task creation, task polling, provider rejection, timeout, unknown status, or unreadable provider response not better represented below |
| `invalid_or_missing_score` | provider success payload lacks a finite `raw_score`, returns the wrong concern, or normalization rejects the score contract |
| `upload_failure` | upload-slot failure, invalid slot, signed PUT failure, or transfer interruption before task creation |
| `cancelled_capture` | user cancellation, navigation, unmount, superseded attempt, or `AbortError` before a usable result |
| `face_detection_failure` | no face, face outside bounds, face too small or large, nonfrontal pose, lighting gate failure, unsupported resolution, invalid capture, or stalled capture session |
| `protocol_deviation` | the capture completed under a condition that differs from its planned block, including wrong device, profile, distance, light setup, angle, expression, enhancement state, or protocol version |

Provider-specific error codes may be retained in a safe optional field for engineering diagnosis. They do not replace the canonical outcome code and must not include payloads, URLs, tokens, or identifiers.

### 7.4 Primary analysis inclusion

1. Controlled repeatability statistics include every `usable_capture` in a complete controlled session.
2. Perturbation statistics include every complete control and perturbation pair in its intended block.
3. Failed and cancelled attempts are excluded from score calculations because no valid score exists, but remain in failure-rate calculations.
4. Protocol deviations are excluded from the intended block's primary score calculation and remain in the export.
5. Optional exploratory summaries may show deviating captures in a separate section, never silently mixed with the primary estimate.
6. No value-based outlier exclusion is permitted.

## 8. Statistical plan

All score calculations use raw-score points. Calculations must be implemented as pure functions and verified against fixed reference fixtures.

### 8.1 Per-session summary

For usable scores \(x_1, \ldots, x_n\), report:

1. **Minimum**

   \[
   \min(x)
   \]

2. **Maximum**

   \[
   \max(x)
   \]

3. **Mean**

   \[
   \bar{x} = \frac{1}{n}\sum_{i=1}^{n}x_i
   \]

4. **Median**

   The middle ordered value, or the mean of the two middle values for even \(n\).

5. **Sample standard deviation**

   \[
   s = \sqrt{\frac{\sum_{i=1}^{n}(x_i-\bar{x})^2}{n-1}}
   \]

   Use the sample denominator \(n-1\), not the population denominator \(n\).

6. **Median absolute deviation**

   \[
   MAD = \operatorname{median}(|x_i-\operatorname{median}(x)|)
   \]

   Report the unscaled MAD. Do not silently multiply by `1.4826`.

7. **Range**

   \[
   \max(x)-\min(x)
   \]

8. **Largest change from session median**

   \[
   \max_i |x_i-\operatorname{median}(x)|
   \]

9. Counts for usable, failed, cancelled, replaced, and protocol-deviation attempts.

### 8.2 Pooled within-session standard deviation

For three complete sessions \(j=1,\ldots,k\), with usable count \(n_j\) and sample standard deviation \(s_j\):

\[
s_{pooled} =
\sqrt{
\frac{\sum_{j=1}^{k}(n_j-1)s_j^2}
{\sum_{j=1}^{k}(n_j-1)}
}
\]

This weights each session by its degrees of freedom. With the required design, \(k=3\) and \(n_j=10\).

### 8.3 Between-session mean drift

Let \(\bar{x}_j\) be each controlled session mean.

Primary drift:

\[
drift_{between} = \max_j(\bar{x}_j)-\min_j(\bar{x}_j)
\]

This is the maximum absolute pairwise difference among session means and cannot cancel positive and negative drift.

Also report signed drift from session 1:

\[
drift_j = \bar{x}_j-\bar{x}_1
\]

The signed values provide direction. The primary recommendation uses the unsigned maximum pairwise drift.

### 8.4 Repeatability coefficient

Use the required formula:

\[
RC = 1.96 \times \sqrt{2} \times s_{pooled}
\]

Interpretation: under the assumptions below, approximately 95 percent of absolute differences between two independent measurements collected under the same controlled conditions are expected to be less than or equal to the repeatability coefficient.

Assumptions:

1. within-session errors are approximately independent;
2. within-session variance is reasonably similar across sessions;
3. the error distribution is approximately symmetric and normal enough for the `1.96` multiplier;
4. the tested person, device, camera, protocol, and environment remain fixed;
5. no material time trend occurs within a session.

Limitations:

1. three sessions of ten captures provide an engineering estimate, not a validated population limit;
2. serial camera or provider behavior may violate independence;
3. skew or heavy tails can make the normal-based coefficient optimistic;
4. pooled variance can hide one unusually unstable session;
5. the coefficient does not measure biological change, efficacy, or clinical importance.

The report must therefore show standard deviation and RC beside median, MAD, range, and largest change from median. Classical and robust summaries must be visible together. No finite score is removed to make them agree.

### 8.5 Perturbation summary

For each matched pair \(i\):

\[
d_i = score_{perturbed,i}-score_{control,i}
\]

Report:

1. number of complete pairs;
2. mean paired shift;
3. median paired shift;
4. sample standard deviation of paired shifts;
5. MAD of paired shifts;
6. minimum and maximum paired shift;
7. range of paired shifts;
8. largest absolute paired shift;
9. attempt failure rate;
10. count by outcome code.

The primary condition effect used by recommendation rules is the absolute median paired shift:

\[
P_c = |\operatorname{median}(d_i)|
\]

The use of paired shifts reduces, but does not eliminate, short-term drift and order effects.

### 8.6 Why coefficient of variation is not primary

Coefficient of variation requires a meaningful ratio scale and a meaningful nonzero reference level. The repository confirms only a finite numeric score, favorable polarity, and point-difference semantics. It does not confirm a meaningful zero or a stable bounded scale. Coefficient of variation must therefore not be a primary metric. It may be added only after provider documentation establishes that interpretation and a separate review approves it.

## 9. Threshold comparison method

### 9.1 Read-only boundary snapshot

The report records, but never mutates:

```text
detectable boundary D = 5 raw-score points
strong boundary S = 10 raw-score points
threshold version = redness-provisional-v1
threshold source = provisional_fixture
threshold provisional = true
threshold configuration hash = sha256:66571af3c662f4da1de469d763b884ad46eb37ee77df0aa060e4b2db280feed5
```

The report must fail closed if these values cannot be read or do not match the expected frozen snapshot. A changed repository configuration requires a new calibration protocol version and review. The harness may not “follow” a changed threshold silently.

### 9.2 Boundary-to-noise ratios

For each boundary \(B\) in `{5, 10}`:

\[
boundaryNoiseRatio_B = \frac{B}{RC}
\]

Also report:

\[
driftRatio_B = \frac{drift_{between}}{B}
\]

Do not calculate a ratio when RC or the boundary is zero or nonfinite.

### 9.3 Engineering comparison labels

For a boundary or future observed absolute delta \(A\), compare it with RC:

| Label | Deterministic rule |
| --- | --- |
| `insufficient_evidence` | required controlled data are incomplete or RC is unavailable |
| `below_estimated_measurement_noise` | \(A < RC\) |
| `borderline_relative_to_noise` | \(RC \le A < 1.5 \times RC\) |
| `clearly_above_controlled_noise` | \(A \ge 1.5 \times RC\) |

The `1.5 × RC` margin is an explicit engineering review band, not a confidence interval and not a clinical threshold. The report must show the raw values and ratio so reviewers can challenge the policy without rerunning data collection.

For signed trial deltas, classification uses the absolute magnitude for noise comparison and reports the sign separately. This calibration report must not call the production effect classifier or alter current effect labels.

### 9.4 Required report table

| Quantity | Points | Relative to RC | Engineering label |
| --- | ---: | ---: | --- |
| Detectable boundary | `5` | `5 / RC` | derived by rule above |
| Strong boundary | `10` | `10 / RC` | derived by rule above |
| Between-session drift | observed | `drift / RC` | descriptive |
| Largest condition median shift | observed | `shift / RC` | descriptive |

No row may use “clinically meaningful,” “effective,” “validated,” or “accurate.”

## 10. Privacy model

### 10.1 Data that may exist in memory

During an active capture attempt, memory may contain:

1. one image `Blob`;
2. sanitized file name and content type;
3. upload slot response;
4. signed upload URL and headers;
5. provider file ID and task ID;
6. normalized provider result;
7. current calibration capture record.

These values must be released when the attempt completes, fails, is cancelled, or the page unmounts. A capture record must be constructed by allowlist, not by spreading a provider response.

### 10.2 Data that may be persisted or exported

The first implementation should default to memory-only collection. An explicit user action may export:

1. protocol and schema versions;
2. random non-identifying local session and capture IDs;
3. session ordinal and rounded timestamps;
4. coarse platform and browser family;
5. app build, provider API, capture protocol, and camera profile versions;
6. structured setup and condition labels;
7. attempt sequence, replacement linkage, status, and canonical outcome code;
8. finite `rawScore` for usable captures;
9. safe provider error code where present;
10. statistical summaries;
11. read-only provisional boundary snapshot;
12. deterministic recommendation and triggered rule IDs.

### 10.3 Data that must never be persisted or exported

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
API or demo-session credentials
cookies
raw provider payloads
mask images or mask URLs
full user agents
IP addresses
precise location
person names
email addresses
account IDs
device serial numbers
free-form personal notes
```

### 10.4 Storage isolation

If resume support is later approved, it must use a calibration-specific versioned storage namespace and validator. It must not use:

```text
face-value:structured-demo:v1
face-value:demo-lab:journey:v1
FaceValueState
EvidenceRecordData
LongitudinalSkinEvidence
```

Ordinary production builds must contain neither the calibration storage key nor calibration controls.

### 10.5 Current lifecycle verification

The current application lifecycle already prevents application persistence and export of face images, image Blobs, signed URLs, upload URLs, provider task IDs, and raw provider payloads. The selected image and signed-upload data are transient. Durable normalization reconstructs a narrow object by value.

Open privacy question: provider-side storage and deletion are not verifiable from this repository. Any future pilot consent or privacy statement must distinguish application storage from provider processing.

## 11. Proposed TypeScript data model

The first implementation is explicitly redness-specific. It may leave extension points through versioning, but it must not introduce a generic `SkinSignalCalibration<T>` abstraction or assume that acne, texture, moisture, masks, or future signals share the same polarity, scale, failure modes, or statistics.

```ts
export const REDNESS_CALIBRATION_PROTOCOL_VERSION =
  'redness-calibration-v1' as const;

export const REDNESS_CALIBRATION_EXPORT_SCHEMA =
  'redness-calibration-export-v1' as const;

export type RednessCalibrationProtocolVersion =
  typeof REDNESS_CALIBRATION_PROTOCOL_VERSION;

export interface RednessCalibrationSignalProtocol {
  provider: 'youcam';
  apiVersion: '2.1';
  mode: 'hd';
  concern: 'hd_redness';
  region: null;
  scoreType: 'raw_score';
  captureProtocolVersion: 'face-value-youcam-1';
}

export type RednessCalibrationConditionLabel =
  | 'controlled'
  | 'brighter_lighting'
  | 'dimmer_lighting'
  | 'closer_distance'
  | 'farther_distance'
  | 'left_angle'
  | 'right_angle'
  | 'expression_change';

export type RednessCalibrationCaptureStatus =
  | 'usable'
  | 'failed'
  | 'cancelled'
  | 'excluded_protocol_deviation';

export type RednessCalibrationFailureReason =
  | 'provider_failure'
  | 'invalid_or_missing_score'
  | 'upload_failure'
  | 'cancelled_capture'
  | 'face_detection_failure'
  | 'protocol_deviation';

export interface RednessCalibrationDeviceSetup {
  deviceSetupId: string;
  platformFamily: 'ios' | 'android' | 'desktop' | 'unknown';
  browserFamily: 'safari' | 'chrome' | 'firefox' | 'edge' | 'unknown';
  cameraFacing: 'front';
  cameraProfileId:
    | 'youcam-camera-kit-hd-1080p'
    | 'youcam-camera-kit-hd-1920p';
}

export interface RednessCalibrationEnvironmentSetup {
  environmentSetupId: string;
  lightSetupLabel: 'controlled_reference';
  approximateDistanceCm: number;
  makeupPresent: boolean;
  recentHeatOrExercise: boolean;
  recentCleansingOrSkincare: boolean;
  routineOrTreatmentChange: boolean;
}

export interface RednessCalibrationCaptureRecord {
  captureId: string;
  sessionId: string;
  sessionOrdinal: 1 | 2 | 3 | 'sensitivity';
  intendedSequenceIndex: number;
  attemptIndex: number;
  pairIndex: number | null;
  pairRole: 'control' | 'perturbation' | null;
  intendedCondition: RednessCalibrationConditionLabel;
  observedCondition: RednessCalibrationConditionLabel;
  capturedAt: string;
  status: RednessCalibrationCaptureStatus;
  outcomeCode:
    | 'usable_capture'
    | RednessCalibrationFailureReason;
  rawScore: number | null;
  safeProviderErrorCode: string | null;
  replacesCaptureId: string | null;
  protocol: RednessCalibrationSignalProtocol;
  appBuildVersion: string;
  deviceSetupId: string;
  environmentSetupId: string;
}

export interface RednessCalibrationSession {
  sessionId: string;
  protocolVersion: RednessCalibrationProtocolVersion;
  sessionOrdinal: 1 | 2 | 3 | 'sensitivity';
  sessionKind: 'controlled_repeatability' | 'condition_sensitivity';
  startedAt: string;
  completedAt: string | null;
  completionStatus: 'in_progress' | 'complete' | 'incomplete';
  targetUsableCaptures: number;
  maximumAttempts: number;
  device: RednessCalibrationDeviceSetup;
  environment: RednessCalibrationEnvironmentSetup;
  captures: RednessCalibrationCaptureRecord[];
}

export interface RednessCalibrationDistributionSummary {
  usableCount: number;
  failedCount: number;
  cancelledCount: number;
  protocolDeviationCount: number;
  minimum: number;
  maximum: number;
  mean: number;
  median: number;
  sampleStandardDeviation: number;
  medianAbsoluteDeviation: number;
  range: number;
  largestAbsoluteChangeFromMedian: number;
}

export interface RednessCalibrationConditionSummary {
  condition: Exclude<RednessCalibrationConditionLabel, 'controlled'>;
  completePairCount: number;
  attemptedCaptureCount: number;
  failedAttemptCount: number;
  failureRate: number;
  meanPairedShift: number;
  medianPairedShift: number;
  sampleStandardDeviationOfPairedShifts: number;
  medianAbsoluteDeviationOfPairedShifts: number;
  minimumPairedShift: number;
  maximumPairedShift: number;
  rangeOfPairedShifts: number;
  largestAbsolutePairedShift: number;
}

export interface RednessCalibrationStatisticalSummary {
  controlledSessions: RednessCalibrationDistributionSummary[];
  pooledWithinSessionStandardDeviation: number;
  betweenSessionMeanDrift: number;
  signedSessionMeanDriftFromSessionOne: [0, number, number];
  repeatabilityCoefficient: number;
  conditionSummaries: RednessCalibrationConditionSummary[];
  largestAbsoluteConditionMedianShift: number;
}

export interface RednessCalibrationBoundarySnapshot {
  version: 'redness-provisional-v1';
  source: 'provisional_fixture';
  provisionalDetectablePoints: 5;
  provisionalStrongPoints: 10;
  configHash:
    'sha256:66571af3c662f4da1de469d763b884ad46eb37ee77df0aa060e4b2db280feed5';
  provisional: true;
}

export type RednessCalibrationRecommendationState =
  | 'insufficient_data'
  | 'stable_enough_for_provisional_use'
  | 'borderline'
  | 'high_capture_sensitivity'
  | 'unstable_pilot';

export interface RednessCalibrationRecommendation {
  ruleVersion: 'redness-calibration-recommendation-v1';
  state: RednessCalibrationRecommendationState;
  triggeredRuleIds: string[];
  inputs: {
    repeatabilityCoefficient: number | null;
    betweenSessionMeanDrift: number | null;
    largestAbsoluteConditionMedianShift: number | null;
    maximumConditionFailureRate: number | null;
    detectableBoundaryPoints: 5;
    strongBoundaryPoints: 10;
  };
  statement: string;
  nonClaims: string[];
}

export interface RednessCalibrationExportV1 {
  schemaVersion: typeof REDNESS_CALIBRATION_EXPORT_SCHEMA;
  protocolVersion: RednessCalibrationProtocolVersion;
  generatedAt: string;
  signalProtocol: RednessCalibrationSignalProtocol;
  boundarySnapshot: RednessCalibrationBoundarySnapshot;
  sessions: RednessCalibrationSession[];
  summary: RednessCalibrationStatisticalSummary | null;
  recommendation: RednessCalibrationRecommendation;
  privacy: {
    includesFaceImage: false;
    includesImageBlob: false;
    includesSignedOrUploadUrl: false;
    includesProviderPayload: false;
    includesPersonalIdentifier: false;
  };
}
```

Runtime validation must reject:

1. a nonfinite score;
2. a usable record with `rawScore: null`;
3. a failed record with a finite score unless the failure is a separately retained protocol deviation;
4. protocol or version drift;
5. duplicate IDs or sequence slots;
6. broken replacement links;
7. a completed session below its target;
8. prohibited keys at any object depth.

## 12. Deterministic recommendation rules

### 12.1 Inputs

Let:

```text
D = 5, current provisional detectable boundary
S = 10, current provisional strong boundary
RC = repeatability coefficient
B = between-session mean drift
P = largest absolute median paired shift across required perturbations
F = maximum failed-attempt rate across required perturbation blocks
```

All comparisons use raw-score points.

### 12.2 Rule precedence

Rules run in this exact order. The first matching state wins.

#### Rule RCR01: `insufficient_data`

Select when any condition is true:

1. fewer than three complete controlled sessions exist;
2. any controlled session has fewer or more than ten usable captures;
3. a controlled session exceeded 20 attempts before completion;
4. any required perturbation has fewer than five complete usable pairs;
5. any perturbation block exceeded 20 attempts before completion;
6. protocol, app build, device setup, environment setup, or camera profile differs across controlled sessions;
7. RC, B, P, or F cannot be computed as finite values;
8. the boundary snapshot is missing or does not exactly match the frozen 5-point and 10-point configuration.

#### Rule RCR02: `unstable_pilot`

Select when data are sufficient and either:

```text
RC >= D
B >= D
```

This means controlled repeatability or controlled between-session drift reaches or exceeds the current detectable operating boundary. If `RC >= S` or `B >= S`, include an additional triggered rule noting overlap with the strong boundary. The state remains `unstable_pilot`.

#### Rule RCR03: `high_capture_sensitivity`

Select when data are sufficient, `RC < D`, `B < D`, and either:

```text
P >= D
F > 0.40
```

This separates a setup that is repeatable under control from one that shifts materially or fails often when one capture condition changes.

#### Rule RCR04: `stable_enough_for_provisional_use`

Select when all conditions are true:

```text
RC < 0.5 × D
B < 0.5 × D
P < D
F <= 0.40
```

This label means only that the tested setup's controlled noise and drift are comfortably below the current detectable boundary and that no required perturbation's median shift reaches that boundary. It does not validate the boundary, promote confidence, or authorize a verdict change.

#### Rule RCR05: `borderline`

Select for every complete dataset not selected by RCR02, RCR03, or RCR04.

Typical borderline inputs include:

```text
0.5 × D <= RC < D
0.5 × D <= B < D
P is elevated but remains below D
F is elevated but remains at or below 0.40
```

### 12.3 Recommendation statements

Each state uses deterministic restrained copy.

| State | Required statement |
| --- | --- |
| `insufficient_data` | `The required controlled and sensitivity dataset is incomplete. No calibration recommendation is available.` |
| `stable_enough_for_provisional_use` | `In this tested setup, controlled repeatability and session drift stayed comfortably below the current provisional detectable boundary. This supports continued provisional engineering use only.` |
| `borderline` | `Observed noise or drift approaches the current provisional detectable boundary. More controlled data are required before relying on the boundary.` |
| `high_capture_sensitivity` | `Controlled captures were more stable than one or more changed capture conditions. Capture standardization remains a material dependency.` |
| `unstable_pilot` | `Controlled repeatability or session drift overlaps the current provisional detectable boundary. The pilot is not stable enough to support that boundary.` |

Every recommendation includes:

```text
Prototype engineering calibration, not clinical validation.
No threshold or verdict behavior was changed.
```

## 13. Implementation boundaries

### 13.1 Allowed future changes

A future implementation PR may add:

1. redness-specific calibration types and runtime validators;
2. pure statistics and recommendation functions;
3. a calibration-specific acquisition orchestrator;
4. a protected calibration route or dedicated protected preview deployment;
5. explicit live-versus-fixture provenance;
6. memory-only session state;
7. explicit face-free JSON export;
8. unit, integration, E2E, privacy, and architecture tests;
9. calibration documentation and manual pilot evidence.

### 13.2 Forbidden future changes in the harness PR

The implementation PR must not change:

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

1. implement a generic universal skin-signal calibration engine;
2. collect or analyze another concern;
3. call `evaluateRedness`;
4. write calibration output into `FaceValueState`;
5. create an Evidence Record;
6. silently use fixture values in a live session;
7. weaken Camera Kit production quality gates;
8. expose the route in ordinary consumer navigation;
9. commit or activate a new threshold;
10. make clinical claims.

### 13.3 Live provider selection

The future harness must not rely on the current `createSkinAnalysisProvider()` default because development mode selects fixtures. It must use explicit dependency injection with visible provenance:

```ts
type CalibrationProviderMode = 'live' | 'fixture_for_automated_test';
```

Requirements:

1. a human pilot session can start only in `live` mode;
2. the report and export record provider mode;
3. fixture mode is available only to automated tests;
4. a fixture-mode dataset can never receive a non-test recommendation;
5. the UI must display `LIVE YOUCAM MEASUREMENTS` or `FIXTURE TEST DATA`;
6. ordinary production builds default to no calibration route.

### 13.4 Route and deployment gate

Before adding collection features, the future PR must replace the current directly routed calibration screen with a stronger gate.

Minimum gate:

1. explicit build-time `VITE_ENABLE_REDNESS_CALIBRATION=true`;
2. calibration route absent when the flag is not true;
3. protected server session required for every provider request;
4. no consumer navigation link;
5. a dedicated preview or engineering deployment, not the ordinary production deployment;
6. privacy verification proving calibration markers and storage keys are absent from ordinary builds.

The Demo Lab `DEV + explicit flag` pattern is useful for exclusion, but live provider calibration needs a separately configured protected deployment because local development currently uses fixtures and may not provide the deployed API environment.

## 14. Test strategy

### 14.1 Pure statistics tests

Use fixed hand-calculated fixtures to verify:

1. minimum and maximum;
2. odd and even median;
3. mean;
4. sample standard deviation with `n-1`;
5. unscaled MAD;
6. range;
7. largest absolute change from median;
8. pooled within-session standard deviation;
9. between-session mean drift;
10. signed drift from session 1;
11. `1.96 × sqrt(2) × pooled SD`;
12. paired condition summaries;
13. equality behavior at every recommendation boundary;
14. rejection of empty, one-value, and nonfinite inputs where a statistic is undefined.

Reference outputs should be cross-checked once against an independent implementation such as Python or R and then frozen as test fixtures.

### 14.2 Inclusion and replacement tests

Prove that:

1. every exact outcome code maps from the intended failure family;
2. failed attempts remain after replacement;
3. replacement links are valid and acyclic;
4. replacements reuse the intended sequence slot but receive new IDs;
5. unusual finite scores remain included;
6. no function removes a score based on z score, IQR, MAD, distance from median, or threshold relation;
7. protocol deviations remain exported but are not mixed into primary controlled summaries;
8. attempt caps produce incomplete sessions.

### 14.3 Recommendation matrix tests

Create fixtures for all five states and exact boundary equality:

```text
RC = 2.49, 2.50, 4.99, 5.00, 10.00
B = 2.49, 2.50, 4.99, 5.00, 10.00
P = 4.99, 5.00
F = 0.40, greater than 0.40
```

Prove rule precedence:

```text
insufficient_data
→ unstable_pilot
→ high_capture_sensitivity
→ stable_enough_for_provisional_use
→ borderline
```

### 14.4 Provider and acquisition tests

1. live mode cannot resolve to `FixtureSkinAnalysisProvider`;
2. automated tests can inject a fixture provider without network access;
3. provider failure, invalid score, upload failure, cancellation, and face-detection failure create the correct records;
4. cancellation aborts polling and releases the Blob reference;
5. duplicate activation creates one attempt;
6. stale completion cannot mutate a finalized or replaced attempt;
7. camera teardown occurs after success, failure, cancellation, route leave, and unmount;
8. condition pairing and counterbalanced order are deterministic.

### 14.5 Privacy and export tests

1. exports are created through an allowlist serializer;
2. recursive forbidden-key checks reject image, blob, URL, task, file, token, cookie, authorization, payload, and identifier markers;
3. exported `privacy` flags are all false as specified;
4. no calibration state is written to production trial storage;
5. ordinary production bundles contain no calibration route, controls, storage key, or fixture provenance;
6. logs contain no score-linked identity, image metadata, URLs, task IDs, or payloads.

### 14.6 Architecture tests

Extend architecture verification to fail when:

1. calibration imports the production evaluator;
2. calibration dispatches production reducer events;
3. production React imports calibration recommendation logic;
4. calibration writes `FaceValueState`, `EvidenceRecordData`, or `LongitudinalSkinEvidence`;
5. threshold constants are copied rather than read and snapshotted with version and hash;
6. another skin concern enters the first implementation;
7. live calibration uses the generic provider factory.

### 14.7 Manual verification

Automated fixtures cannot validate real provider repeatability. The future PR must include manual evidence for:

1. one exact-head protected deployment;
2. physical device and front-camera profile;
3. live provider provenance;
4. all three controlled sessions;
5. all six required perturbation blocks;
6. cancellation and retry;
7. JSON export inspection;
8. browser storage inspection;
9. no face image or URL in saved/exported data;
10. no console or page errors.

## 15. Open questions and risks

### 15.1 Decisions required before implementation

1. **Live deployment location:** dedicated protected Vercel preview, separate engineering project, or another protected environment.
2. **Provider retention:** YouCam image retention, deletion, and data-processing terms must be verified outside the repository.
3. **Angle side:** freeze left or right for the required pilot before collection.
4. **Lighting steps:** define reproducible brighter and dimmer setup instructions, preferably with a physical light preset or lux reading.
5. **Device metadata:** decide the minimum coarse device information needed for reproducibility without creating a fingerprint.
6. **Timestamp precision:** decide whether export timestamps should be rounded to the minute or stored as elapsed offsets.
7. **Extended perturbation mode:** decide whether the first pilot stops at five pairs or collects the recommended ten pairs.
8. **Pilot operator:** define who may access the protected harness and who reviews exports.
9. **Provider model version:** the repository records that YouCam does not currently report it; a silent upstream model change could affect comparability.
10. **Current route retirement:** decide whether the existing `/youcam-calibration` screen is removed or replaced when the real harness is built.

### 15.2 Key risks

| Risk | Consequence | Mitigation |
| --- | --- | --- |
| Development fixture silently mistaken for live data | invalid calibration | explicit provider mode, provenance, and live-only pilot gate |
| Existing calibration route directly accessible | engineering tool exposed | build-time exclusion plus protected deployment |
| Guided gate blocks intended perturbations | incomplete sensitivity data | treat failures as sensitivity evidence; never weaken production gate |
| One person and one device | no generalizability | label pilot scope and require later multi-person/device study |
| Provider model changes silently | session comparability loss | capture app/API/protocol versions and seek provider model metadata |
| Session order or fatigue | time trend mistaken for drift | counterbalanced pairs, bounded blocks, session timestamps |
| Unusual values tempt manual exclusion | biased noise estimate | no value-based exclusions; retain every finite conforming score |
| Raw timestamps or metadata identify a person | privacy leakage | coarse structured metadata, no free text, allowlist export |
| Vendor image retention unknown | overstated privacy claim | separate application storage claim from provider processing |
| Calibration report influences verdict prematurely | scientific governance breach | separate implementation and threshold-governance PRs |

## 16. Proposed build phases

### Phase 0: Freeze the plan

1. merge this document;
2. resolve the deployment, provider retention, lighting, angle, metadata, and pilot-access decisions;
3. assign protocol and recommendation rule owners.

### Phase 1: Pure redness calibration core

1. add redness-specific types;
2. add runtime validation;
3. implement per-session, pooled, drift, RC, paired-shift, and threshold-comparison functions;
4. implement deterministic recommendation rules;
5. add reference fixture tests.

No camera, provider, route, UI, or storage work in this phase.

### Phase 2: Protected acquisition boundary

1. add explicit live and test provider injection;
2. add calibration-specific camera orchestration;
3. map failures to canonical outcome codes;
4. implement cancellation, replacement linkage, sequence slots, and attempt caps;
5. add route and deployment gating.

No statistics presentation beyond test output is required to prove the acquisition boundary.

### Phase 3: Calibration workflow and report

1. implement three controlled sessions;
2. implement six paired perturbation blocks;
3. show completion and protocol-deviation state;
4. generate the face-free in-memory report;
5. show raw inputs beside derived metrics and rule IDs.

### Phase 4: Export and privacy hardening

1. add explicit versioned JSON export;
2. add allowlist serialization and forbidden-key scanning;
3. prove no production storage writes;
4. prove route and markers are absent from ordinary builds;
5. document provider-processing limitations.

### Phase 5: Exact-head pilot

1. deploy a protected immutable build;
2. collect the full required dataset on one physical device;
3. inspect the export independently;
4. run the deterministic report;
5. record protocol deviations and operational friction;
6. do not change thresholds.

### Phase 6: Review and decision

Review the report against the current 5-point and 10-point boundaries.

Possible outcomes:

1. collect more data;
2. improve capture standardization;
3. broaden to multiple devices or participants;
4. retain current provisional behavior;
5. open a separate threshold-governance proposal.

Any threshold or verdict change requires a new issue and PR with explicit scientific, product, privacy, and migration review. It is not part of the calibration harness PR.

## 17. Exact acceptance criteria for the future implementation PR

The future implementation PR is acceptable only when every item below is true.

### Repository and scope

- [ ] The branch is based on the then-current `origin/main`.
- [ ] The PR explicitly states that it is engineering calibration, not clinical validation.
- [ ] The implementation supports only YouCam v2.1 `hd_redness.raw_score`.
- [ ] No universal skin-signal calibration abstraction is introduced.
- [ ] No production threshold, hash, effect classification, verdict, confidence, action, safety, attribution, copy, reducer, or saved-record behavior changes.
- [ ] The existing 5-point and 10-point configuration is read and snapshotted by version and hash, never mutated.

### Access and provider provenance

- [ ] Ordinary production builds do not expose the calibration route, controls, storage key, or bundle markers.
- [ ] Calibration requires an explicit build flag and protected server session.
- [ ] Human pilot sessions can run only with explicit `live` provider mode.
- [ ] Fixture mode is restricted to automated tests and cannot produce a pilot recommendation.
- [ ] The report and export include visible provider-mode provenance.
- [ ] The existing directly routed calibration utility is removed, replaced, or gated so there is one canonical calibration path.

### Protocol execution

- [ ] Three separate controlled sessions are supported.
- [ ] Each controlled session requires exactly ten usable captures.
- [ ] Each controlled session stops at 20 total attempts and becomes incomplete if the target is not reached.
- [ ] The same device setup, environment setup, camera profile, app build, and frozen signal protocol are enforced across controlled sessions.
- [ ] Brighter light, dimmer light, closer distance, farther distance, one frozen angle side, and expression change are implemented as separate one-condition perturbations.
- [ ] Each required perturbation requires five usable matched pairs.
- [ ] Pair order is counterbalanced as specified.
- [ ] Each perturbation block stops at 20 total attempts and becomes incomplete if five pairs are not reached.
- [ ] Production Camera Kit quality gates are not weakened.

### Inclusion, failure, and replacement

- [ ] All seven exact outcome codes are implemented.
- [ ] Every attempt is retained.
- [ ] Failed attempts may be replaced only under the documented rules.
- [ ] Replacement records receive new IDs and valid `replacesCaptureId` links.
- [ ] Unusual finite protocol-conforming scores are never excluded or replaced based on value.
- [ ] Protocol deviations remain in the export and remain separate from primary summaries.
- [ ] Provider-specific codes are safe optional metadata only.

### Statistics and rules

- [ ] Minimum, maximum, mean, median, sample standard deviation, unscaled MAD, range, and largest absolute change from session median are correct.
- [ ] Pooled within-session standard deviation uses degrees-of-freedom weighting.
- [ ] Between-session mean drift is the maximum pairwise session-mean difference.
- [ ] Repeatability coefficient is exactly `1.96 × sqrt(2) × pooled within-session SD`.
- [ ] Every perturbation reports paired mean, median, SD, MAD, min, max, range, largest absolute shift, and failure rate.
- [ ] Coefficient of variation is absent as a primary metric.
- [ ] Boundary comparison labels use the exact rules in Section 9.
- [ ] Recommendation states and precedence use the exact rules in Section 12.
- [ ] Equality cases at 2.5, 5, 10, and 40 percent failure are covered by tests.
- [ ] Reports show raw metrics, ratios, triggered rule IDs, assumptions, and limitations.

### Privacy and persistence

- [ ] No face image, Blob, File, base64 data, object URL, signed URL, upload URL, provider file ID, provider task ID, credential, cookie, raw payload, personal identifier, or free-form personal note enters persistence or export.
- [ ] Capture records are built by allowlist.
- [ ] Export uses `redness-calibration-export-v1` and passes runtime validation.
- [ ] The first implementation is memory-only unless a separately reviewed resume requirement is approved.
- [ ] Any later storage is isolated from production trial and Demo Lab storage.
- [ ] Existing production persistence remains byte-compatible.
- [ ] The PR clearly states that provider-side retention is not proven by application code.

### Verification

- [ ] Unit tests cover every required statistic and invalid input.
- [ ] Unit tests cover all recommendation states, exact boundaries, and precedence.
- [ ] Integration tests cover every outcome code, cancellation, replacement, stale completion, duplicate activation, and attempt cap.
- [ ] Architecture checks prevent imports into the production evaluator, reducer, evidence snapshot, verdict view model, and trial persistence.
- [ ] Privacy checks recursively reject forbidden keys and scan ordinary production bundles.
- [ ] Existing `npm run check` passes.
- [ ] Existing E2E tests pass without updated verdict or threshold snapshots.
- [ ] A protected exact-head deployment is recorded.
- [ ] A physical-device live-provider pilot completes the three controlled sessions and six required perturbation blocks.
- [ ] The exported JSON is manually inspected and attached as face-free verification evidence.
- [ ] Browser storage and console output are inspected for forbidden data.
- [ ] No threshold is committed or activated in the PR.

## Review conclusion

The current repository has a sound narrow provider boundary, durable normalization, deterministic redness evaluator, architecture guards, and application-side face-image exclusion. It also has a small legacy calibration utility that is not sufficient for the requested protocol and has two critical hardening issues: direct route exposure and silent fixture-provider selection in development.

The recommended next move is to merge this plan only, resolve the open deployment and provider-retention decisions, then implement a pure redness-specific statistics core before touching camera workflow. The calibration harness and any later threshold-governance decision must remain separate changes.
