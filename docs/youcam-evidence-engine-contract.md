# YouCam Longitudinal Evidence Engine Contract

**Status:** Frozen implementation authority

**Version:** 1.0

**Effective date:** July 26, 2026

**Repository:** `amydojo/face-value`

## 1. Objective

Replace Face Value's fixture-backed optical comparison with one secure, testable, longitudinal YouCam integration without creating a second source of trial truth.

The production slice is deliberately narrow:

```text
02 / ONE THING
→ assigned job: reduce visible redness
→ valid baseline capture
→ YouCam HD redness analysis
→ trial in progress
→ matched follow-up capture
→ identical YouCam analysis protocol
→ Face Value comparison and confidence
→ existing result reveal
→ existing Evidence Record release
```

This contract governs implementation, tests, demo behavior, privacy, and change control for the YouCam integration.

## 2. Product boundary

> YouCam measures the skin. Face Value judges the trial.

YouCam is the optical evidence provider. It may return scores, masks, task state, and provider errors.

Face Value remains the authority for:

- selected product
- assigned job
- baseline and follow-up identity
- trial timing
- notes and adherence context
- overlapping-product context
- capture comparability
- score comparison
- confidence
- result language
- next-step recommendation
- Evidence Record creation

A provider response must never directly become a user-facing verdict.

## 3. Frozen launch protocol

The first real production protocol is:

| Field | Frozen value |
| --- | --- |
| Product | `02 / ONE THING` |
| Assigned job | Reduce visible redness |
| Provider | YouCam API |
| API version | `v2.1` |
| Preferred mode | `hd` |
| Preferred concern | `hd_redness` |
| Pre-baseline fallback | `sd` / `redness` only when HD capture is unsupported |
| Score used for evidence | `raw_score` |
| Response format | `json` |
| Capture mode | Camera Kit `hdskincare` for HD, `skincare` for SD |
| Capture quality | `moderate` initially |
| Completion mechanism | polling |
| Result owner | Face Value reducer |

Once the baseline is accepted, these fields are immutable for the life of the trial:

```text
provider
API version
analysis mode
concern
region
score type
capture protocol version
```

A follow-up that does not match the frozen baseline protocol is not comparable and must not produce a result.

## 4. Official API workflow

The integration uses the YouCam Skin Analysis v2.1 workflow:

```text
POST /s2s/v2.1/file/skin-analysis
→ upload image bytes to returned signed URL
→ POST /s2s/v2.1/task/skin-analysis
→ GET /s2s/v2.1/task/skin-analysis/{task_id}
→ normalize success or map error
```

Authentication uses a server-only bearer token:

```http
Authorization: Bearer <YOUCAM_API_KEY>
```

Official references:

- https://docs.perfectcorp.com/reference/ai_skin_analysis/v2.1
- https://docs.perfectcorp.com/reference/ai_skin_analysis/section/overview/file-specs-and-errors
- https://docs.perfectcorp.com/develop/quick_start_guide
- https://docs.perfectcorp.com/release/changelog

The application must not depend on undocumented endpoint names or inferred response fields.

## 5. Provider architecture

The browser and reducer must not consume raw YouCam JSON directly.

```ts
export interface SkinAnalysisProvider {
  analyzeCapture(input: AnalyzeCaptureInput): Promise<SkinAnalysisSignal>;
}

export interface AnalyzeCaptureInput {
  image: Blob;
  protocol: AnalysisProtocol;
  capturedAt: string;
}

export interface AnalysisProtocol {
  provider: "youcam";
  apiVersion: "2.1";
  mode: "hd" | "sd";
  concern: "hd_redness" | "redness";
  region: null;
  scoreType: "raw_score";
  captureProtocolVersion: string;
}

export interface SkinAnalysisSignal {
  provider: "youcam";
  apiVersion: "2.1";
  mode: "hd" | "sd";
  concern: "hd_redness" | "redness";
  region: null;
  rawScore: number;
  capturedAt: string;
  captureQuality: "accepted";
  providerTaskId?: string;
}
```

Required implementations:

- `YouCamSkinAnalysisProvider` for production
- `FixtureSkinAnalysisProvider` for deterministic unit, component, and end-to-end tests

The Human Butter reducer remains the single durable application authority. Provider adapters may not create a parallel trial store, result store, navigation model, or Evidence Record.

## 6. Server boundary

The YouCam API key must exist only in a server environment variable:

```text
YOUCAM_API_KEY
```

It must never use a client-exposed prefix such as `VITE_`.

The preferred upload flow is:

1. the browser requests an authenticated upload slot from a Face Value server endpoint
2. the server calls the YouCam File API
3. the browser uploads the image directly to the returned signed URL
4. the server creates and polls the analysis task using the returned file identifier
5. the server returns a validated, minimal provider result

Suggested server routes:

```text
POST /api/youcam/upload-slot
POST /api/youcam/tasks
GET  /api/youcam/tasks/:taskId
```

Names may change to match repository conventions. Security and ownership may not.

## 7. Score semantics

Face Value uses `raw_score` only.

The official YouCam documentation describes `raw_score` as the underlying model score and `ui_score` as a consumer-facing score adjusted toward more favorable presentation. Therefore:

- `ui_score` must not be persisted as evidence
- `ui_score` must not drive comparison
- `ui_score` must not appear in the Evidence Record
- `skin_age` must not be requested or displayed
- the provider-wide `all` score must not be used

For supported score-based concerns, higher `raw_score` represents a healthier or more favorable condition.

```ts
const delta = followUp.rawScore - baseline.rawScore;
```

A positive redness delta is a favorable direction. It is not a percentage improvement, efficacy percentage, clinical outcome, or medical conclusion.

## 8. Comparison contract

YouCam supplies measurements. Face Value combines four evidence layers:

```text
raw-score change
+ capture comparability
+ trial behavior
+ confounding-product context
= result and confidence
```

The comparison engine initially returns one of:

```ts
type OpticalChange =
  | "favorable_direction_detected"
  | "no_clear_change"
  | "unreliable_comparison";
```

The user-facing result remains governed by the Face Value product contract:

- Earning its place
- Too early to tell
- Test it alone
- Not proving its job

No fixed point threshold may be presented as clinically validated.

Before a numeric change threshold is used in production, the team must run repeated same-session captures under unchanged conditions and estimate concern-specific measurement variation. Any initial threshold must be documented as a prototype calibration heuristic.

A valid prototype approach is:

```text
noise floor = typical same-session absolute raw-score variation
clear change = absolute longitudinal delta exceeds the documented noise boundary
```

The exact formula remains blocked until calibration evidence exists.

## 9. Confidence contract

### Likely

Use only when:

- baseline and follow-up use the identical frozen protocol
- both captures pass quality validation
- the comparison exceeds the documented prototype noise boundary
- no meaningful overlapping product remains
- the trial interval is sufficient for the assigned job

### Possible

Use when a direction appears but one material limitation remains, such as:

- retained product overlap
- weaker capture comparability
- incomplete adherence context
- a result near the noise boundary

### Insufficient

Use when:

- provider mode, concern, region, or score type differs
- a capture fails quality requirements
- the provider does not return the required concern
- the task fails or expires
- the delta remains inside expected measurement variation
- required trial context is missing

No API confidence value may silently upgrade Face Value confidence.

## 10. Capture contract

Preferred capture uses JavaScript Camera Kit:

- `hdskincare` for HD trials
- `skincare` for SD trials
- blob output
- moderate quality preset initially
- front-facing, neutral expression
- even lighting
- face centered and large enough

The UI translates provider quality state into Face Value language:

| Provider condition | Face Value instruction |
| --- | --- |
| no face or out of bounds | Center your face |
| face too small | Move closer |
| pose invalid | Face the camera |
| lighting too dark or uneven | Find more even light |
| unsupported HD resolution before baseline | Use standard scan mode |
| all conditions accepted | Hold still |

The system may fall back from HD to SD only before baseline acceptance. It may never downgrade a follow-up independently.

## 11. Image requirements and validation

Before upload, validate:

- JPEG or PNG
- less than 10 MB
- SD short side at least 480 px
- HD short side at least 1080 px
- portrait orientation preferred
- face unobstructed and in focus

The official service requires a front-facing image and reports that the face should occupy approximately 60–80% of image width, with face width greater than 60%.

Known provider errors must map to recoverable actions, including:

| Provider error | Recovery |
| --- | --- |
| `error_below_min_image_size` | Capture again in higher quality |
| `error_src_face_too_small` | Move closer and retake |
| `error_src_face_out_of_bound` | Center your face and retake |
| `error_lighting_dark` | Find more even light and retake |
| invalid mixed HD and SD actions | Treat as implementation defect; do not retry automatically |
| unknown concern | Treat as implementation defect; do not retry automatically |
| task timeout or expired task | Retry analysis without losing the trial capture when allowed |

Provider errors must never produce fabricated evidence.

## 12. Polling and task lifecycle

Task creation is asynchronous. The application must:

1. persist enough transient request state to avoid duplicate task creation during one active attempt
2. poll until `success`, `error`, or a documented client timeout
3. respect any provider-recommended polling interval returned by the API
4. stop polling on unmount, cancellation, navigation, or terminal state
5. prevent duplicate units from rapid repeated activation
6. preserve the trial when analysis fails
7. offer one clear retry path

Polling must not be implemented as an unbounded interval.

The June 29, 2026 provider release notes announce deletion of a completed task and associated resources. The exact current operation must be verified from the official OpenAPI description before implementation. Do not invent a deletion endpoint.

## 13. Privacy and persistence

Persist only what the product needs:

- frozen protocol
- normalized baseline signal
- normalized follow-up signal
- capture metadata
- comparison outcome
- confidence and limitations
- result and next step

Do not persist:

- face image bytes
- base64 images
- Blob URLs
- signed upload URLs
- bearer credentials
- temporary mask URLs

The Evidence Record remains face-free by default.

Tests must assert that structured browser storage contains none of:

```text
blob:
data:image
Authorization: Bearer
signed upload URLs
raw image bytes
```

The capture screen must disclose that an image is sent to Perfect Corp for analysis before upload. Provider cleanup behavior must be documented accurately; no unsupported retention promise may appear in product copy.

## 14. Mask boundary

Concern masks are optional explanatory media, not evidence themselves.

For the first real integration:

- request JSON results
- keep mask display behind `See why`
- do not persist temporary mask URLs
- do not block the result when a mask is unavailable
- never display unrelated concerns

The mask-based Evidence Aperture is a Phase C enhancement after the live longitudinal score path passes.

## 15. Required tests

### Provider contract

Replay official-shaped success and error fixtures and prove normalization.

### Protocol immutability

Reject any follow-up whose provider, version, mode, concern, region, score type, or capture protocol differs from baseline.

### Score semantics

Prove that only `raw_score` enters comparison and persistence.

### Failure recovery

Prove that provider failure preserves the trial and exposes one retry path without fabricating a result.

### Duplicate protection

Prove that rapid activation creates at most one upload slot and one active analysis task.

### Privacy

Prove that no face bytes, base64, Blob URL, signed URL, or API key enters durable browser storage or Evidence Records.

### Production journey

Prove that real normalized provider values enter the existing reducer and flow through result, next step, record release, collection, detail, and Past Results.

### Physical-device smoke test

Complete one real baseline and follow-up on an iPhone through the production deployment.

## 16. Delivery slices

### Phase A: live-score spike

- secure server key
- upload-slot endpoint
- binary upload
- task creation
- bounded polling
- response validation
- one real `hd_redness` raw score
- protected debug evidence only

**Exit condition:** one production image returns one normalized real score without exposing credentials or persisting the image.

### Phase B: longitudinal integration

- freeze protocol at baseline
- store normalized baseline signal
- repeat identical follow-up protocol
- compare raw scores
- introduce calibrated prototype noise boundary
- dispatch the existing analysis success or failure events
- preserve one durable result through the existing Evidence Machine

**Exit condition:** changing normalized YouCam values changes the real Face Value result without parallel state.

### Phase C: effortless capture and hardening

- Camera Kit quality guidance
- HD capability detection and pre-baseline fallback
- provider error translation
- task cancellation and timeout recovery
- verified resource cleanup
- mask-based Evidence Aperture
- physical iPhone proof

**Exit condition:** a person can complete the real trial without understanding API mechanics or performing skincare homework.

## 17. Explicit non-goals

This epic does not include:

- multi-product brand dashboards
- cross-user aggregation
- verification badges
- official packaging partnerships
- authentication or cloud accounts
- every YouCam skin concern
- a universal skin score
- `skin_age`
- medical diagnosis
- AI-generated verdicts from an LLM
- skin simulation presented as evidence
- a redesigned reducer or second production store

## 18. Definition of done

The YouCam evidence engine is complete when:

> A real baseline and follow-up image use the same frozen YouCam protocol, the normalized raw scores materially affect the Face Value comparison, and the resulting confidence and limitations survive through the existing cassette, Evidence Record, and Past Results without persisting a face image or exposing the API key.

The first implementation must also pass:

- lint
- strict TypeScript
- unit and component tests
- production build
- mobile WebKit end-to-end tests
- exact-head preview deployment
- physical iPhone smoke test
- zero unhandled runtime errors in the canonical journey

## 19. Change control

Changes to the launch product, assigned job, YouCam concern, score semantics, protocol immutability, privacy boundary, confidence rules, or reducer ownership require an explicit amendment to this document in the same pull request as the implementation change.
