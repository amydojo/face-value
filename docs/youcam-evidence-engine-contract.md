# YouCam Longitudinal Evidence Engine Contract

> Phase B.5 extension: the provider and evidence laws in this contract remain
> frozen. The canonical product identity is now a reducer-owned
> `RegisteredProduct` using protocol `youcam-redness-v1`; `02 / ONE THING`
> remains legacy/test compatibility only. The current experience, capture,
> timing, seal, and release contract is recorded in
> `docs/youcam-phase-b5-implementation.md`.

**Status:** Frozen implementation authority

**Version:** 1.2

**Effective date:** July 27, 2026

**Repository:** `amydojo/face-value`

> **July 28, 2026 supersession:** This file remains authoritative for the
> secure YouCam provider workflow, HD/raw-score protocol, privacy, and error
> boundary. Its former `calibration: pending`, sign-only verdict derivation,
> prototype copy, and result mapping are superseded by
> `docs/redness-evidence-engine-v1.md` and the connected canonical redness
> documents recorded there. They are not an alternate production engine.

## 1. Objective

Replace Face Value's fixture-backed optical comparison with one secure, testable, longitudinal YouCam integration without creating a second source of trial truth.

The Phase B production slice is deliberately narrow:

```text
02 / ONE THING
→ assigned job: reduce visible redness
→ accepted baseline capture
→ YouCam HD redness raw score
→ frozen evidence protocol
→ trial in progress
→ matched follow-up capture
→ identical YouCam analysis protocol
→ deterministic Face Value comparison
→ existing result reveal
→ existing next-step choice
→ existing Evidence Machine release
→ existing Evidence Record
→ detail
→ Past Results
→ refresh restoration
```

This contract governs implementation, tests, demo behavior, privacy, security, and change control for Phase B.

## 2. Product boundary

> YouCam measures the skin. Face Value judges the trial.

The provider may:

- securely analyze an in-memory capture
- return a normalized optical signal
- report provider task state
- return provider errors
- expose temporary protected engineering diagnostics

The provider may not:

- generate a Face Value verdict
- choose the next step
- control cassette or Evidence Machine state
- create an Evidence Record
- write localStorage or sessionStorage
- create a second production state store
- decide whether the product worked
- promote score movement to clinical evidence

The Human Butter reducer remains the single durable authority for product, assigned job, trial stage, baseline, follow-up, protocol, comparison, confidence, limitations, result, next step, Evidence Record, restoration, and Past Results.

## 3. Frozen Phase B protocol

| Field | Frozen value |
| --- | --- |
| Product | `02 / ONE THING` |
| Assigned job | Reduce visible redness |
| Provider | YouCam Skin Analysis |
| API version | `2.1` |
| Mode | `hd` |
| Concern | `hd_redness` |
| Region | `null` |
| Score type | `raw_score` |
| Capture protocol | `face-value-youcam-1` |
| Calibration | `pending` |
| Result owner | Face Value reducer |

Phase B does not use SD fallback. Unsupported-HD evaluation belongs to a later reviewed phase and may not alter an accepted baseline protocol.

Once a baseline is accepted, these fields are immutable for the life of the trial:

```text
provider
API version
mode
concern
region
score type
capture protocol version
```

A follow-up mismatch must be rejected locally before any upload slot or provider task is created.

## 4. Official provider workflow

The server integration uses YouCam Skin Analysis v2.1:

```text
POST /s2s/v2.1/file/skin-analysis
→ browser uploads image bytes to returned signed URL
→ POST /s2s/v2.1/task/skin-analysis
→ GET /s2s/v2.1/task/skin-analysis/{task_id}
→ validate and normalize success or translate failure
```

YouCam authentication uses the server-only environment variable `YOUCAM_API_KEY`. It must never use a client-exposed prefix such as `VITE_` and must never enter browser code, storage, logs, or responses.

The application must not depend on undocumented endpoint names or inferred response fields.

## 5. Typed provider boundary

The browser and reducer must not consume raw YouCam JSON directly.

```ts
export interface SkinAnalysisProvider {
  analyzeCapture(input: AnalyzeCaptureInput): Promise<SkinAnalysisSignal>;
}

export interface AnalyzeCaptureInput {
  image: Blob;
  protocol: AnalysisProtocol;
  capturedAt: string;
  role: "baseline" | "followup";
  signal?: AbortSignal;
}

export interface AnalysisProtocol {
  provider: "youcam";
  apiVersion: "2.1";
  mode: "hd";
  concern: "hd_redness";
  region: null;
  scoreType: "raw_score";
  captureProtocolVersion: "face-value-youcam-1";
}

export interface SkinAnalysisSignal {
  provider: "youcam";
  apiVersion: "2.1";
  mode: "hd";
  concern: "hd_redness";
  region: null;
  rawScore: number;
  capturedAt: string;
  captureQuality: "accepted";
  ephemeralTaskReference: string;
}
```

Required implementations:

- `YouCamSkinAnalysisProvider` for deployed provider work
- `FixtureSkinAnalysisProvider` for deterministic unit, integration, and mobile WebKit tests

The ephemeral task reference exists only inside the provider boundary and protected diagnostics. It must not enter durable normalization.

## 6. Durable normalization contract

One explicit function reconstructs the allowed durable signal by value:

```ts
type DurableSkinSignal = {
  provider: "youcam";
  apiVersion: "2.1";
  mode: "hd";
  concern: "hd_redness";
  region: null;
  scoreType: "raw_score";
  captureProtocolVersion: "face-value-youcam-1";
  rawScore: number;
  capturedAt: string;
  captureQuality: "accepted";
};
```

Normalization must reject non-finite scores and any signal that does not match the frozen contract.

Durable state must never contain:

- provider task identity
- image bytes
- `File` or `Blob` values
- base64 or `data:image` values
- blob URLs
- signed upload URLs
- temporary mask URLs
- API credentials
- authorization headers
- raw provider payloads

This exclusion must be achieved by construction rather than manual deletion.

## 7. Demo authorization boundary

The temporary hackathon demo uses a protected engineering gate, not a consumer account system.

1. `/youcam-spike` accepts `YOUCAM_SPIKE_TOKEN` only long enough to exchange it.
2. `POST /api/youcam/session` validates the token using timing-safe comparison.
3. The server issues a 30-minute signed cookie scoped to `/api/youcam`.
4. The cookie is `Secure`, `HttpOnly`, and `SameSite=Strict`.
5. Canonical product analysis uses the cookie and never reads the raw token.
6. No token enters localStorage or sessionStorage.
7. Unauthorized analysis requests fail closed with `401`.
8. Provider API responses use `Cache-Control: no-store`.

The Phase A header remains temporarily accepted only for protected engineering compatibility. The canonical Phase B product path does not send it.

## 8. Baseline and follow-up state law

Required reducer semantics include:

```text
baseline analysis started
baseline analysis accepted
baseline analysis failed
baseline retry requested
follow-up analysis started
follow-up analysis accepted
follow-up analysis failed
comparison created
comparison rejected
analysis cancelled
```

Legal-transition rules:

- trial progression waits for accepted baseline analysis
- an accepted baseline cannot be silently overwritten
- follow-up acceptance requires an accepted baseline and frozen protocol
- a provider failure cannot erase accepted evidence
- duplicate activation creates one logical attempt
- stale completion cannot overwrite a newer retry or cancellation
- navigation and unmount cancel provider polling
- restoration cannot manufacture a result from incomplete evidence
- complete restored signals resume comparison through the reducer
- an accepted result cannot revert to processing after refresh

## 9. Score and comparison semantics

Face Value uses `raw_score` only. `ui_score`, skin age, and provider-wide beauty scores must not drive evidence or appear in the Evidence Record.

For YouCam `hd_redness`, a higher `raw_score` represents a more favorable redness-related skin condition. It is not an amount of redness. Consumer wording must make this polarity explicit whenever scores are displayed.

```ts
const delta = followUp.rawScore - baseline.rawScore;
```

Before calibration:

- positive delta means `favorable`
- negative delta means `unfavorable`
- zero delta means `unchanged`
- calibration remains `pending`
- confidence never exceeds `possible`
- limitations always include `Prototype noise boundary has not been calibrated.`
- no point threshold may be invented
- delta is a numeric difference, never a percentage
- direction is not efficacy, clinical significance, treatment, cure, proof, or guarantee

The Phase A values `93.3356` and `100.0000` may be used only as synthetic deterministic test values. They came from unrelated images and are not a valid longitudinal trial.

## 10. Existing result mapping

Phase B uses the existing Face Value result reveal and Evidence Machine. It does not add a YouCam-specific verdict screen.

Favorable direction:

- title: `Favorable direction detected`
- support: `The redness condition score increased from {baseline} to {followUp}. Higher scores indicate a more favorable skin condition.`
- confidence: `Possible`
- context: `This comparison may reflect normal scan variation. The prototype noise boundary has not been calibrated.`
- default next step: `Test longer`

Unfavorable direction:

- title: `No favorable direction yet`
- support: `The redness condition score decreased from {baseline} to {followUp}. Higher scores indicate a more favorable skin condition.`
- confidence: `Possible`
- default next step: `Test longer`

Unchanged direction:

- title: `No favorable direction yet`
- support: `The redness condition score remained at {baseline}. No directional movement was detected.`
- confidence: `Possible`
- default next step: `Test longer`

Protocol incompatibility:

- title: `Comparison unavailable`
- support: `These scans could not be compared under the same conditions.`
- default next step: `Retry under matched conditions`

Primary product UI must not expose provider field names, task IDs, polling language, API version strings, raw payloads, or provider error codes. Technical provenance belongs in existing detail surfaces.

## 11. Evidence Record contract

The existing Evidence Record model may preserve:

- product
- assigned job
- trial dates
- comparison direction
- confidence
- limitations
- selected next step
- `YouCam Skin Analysis v2.1` provenance
- formatted baseline and follow-up raw scores in evidence detail

It must remain face-free and survive result, next-step selection, cassette release, collection, detail, Past Results, and browser refresh. Saved trial windows must use human-readable local dates and times in consumer archive surfaces. Production archives must not expose demo-clearing controls. No parallel record type is permitted.

## 12. Provider error translation

Consumer copy must be deterministic and must not expose provider codes.

| Provider condition | Consumer guidance |
| --- | --- |
| face too small | Move closer so your face fills more of the frame. |
| lighting rejection | Find more even light and try again. |
| face outside bounds | Center your full face inside the guide. |
| invalid image | Choose a clear front-facing JPEG or PNG. |
| timeout | Analysis took too long. Retry without losing this trial. |
| unauthorized session | Analysis access expired. Reopen the protected demo session. |
| unknown failure | This scan could not be analyzed. Your existing trial is safe. |

Provider codes may appear only in protected development diagnostics and safe logs.

## 13. Calibration utility

The protected development calibration utility:

- accepts repeated same-session matched scans
- uses the frozen HD redness protocol
- keeps scores in component memory only
- reports scores, consecutive deltas, absolute consecutive deltas, median absolute delta, maximum absolute delta, minimum, and maximum
- is labeled `Prototype engineering calibration, not clinical validation.`
- writes no images or scores to production trial state
- commits no threshold
- does not influence Phase B comparison logic

## 14. Observability and privacy verification

Safe diagnostics may record stage, baseline or follow-up role, request outcome, terminal state, normalized success, provider error code, local protocol rejection, cancellation, and stale response rejection.

Logs must not contain images, signed URLs, access tokens, authorization headers, full provider payloads, or identifying image metadata.

CI must verify both durable serialization and compiled client assets. The compiled client scan fails on credentials, bearer strings, provider task IDs, image data URLs, blob URLs, signed provider URL markers, temporary mask URL markers, and raw provider payload markers.

## 15. Acceptance gates

Automated Phase B proof requires:

- typed contract tests
- protocol preflight tests
- deterministic comparison tests
- reducer legality and idempotency tests
- durable serialization privacy tests
- signed-cookie security tests
- fixture-backed integration through the real reducer
- mobile WebKit proof through baseline, follow-up, result, next step, Evidence Machine release, collection, detail, Past Results, and refresh
- production build
- compiled-client privacy scan
- exact-head Vercel preview in `READY`
- no unhandled runtime errors

Final live completion additionally requires one genuine matched baseline and follow-up pair against the exact-head preview under the identical frozen protocol. The PR remains draft until that evidence exists. Unrelated images, fixture values, or fabricated screenshots cannot satisfy this gate.
