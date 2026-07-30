# Face Value YouCam provider and security contract

**Status:** Current provider authority  
**Version:** 2.0  
**Effective date:** July 30, 2026  
**Implementation baseline:** `main` after PR #62 (`e0173ee`)

This document governs the secure YouCam Skin Analysis integration, durable normalization, engineering-session authorization, provider failures, and image lifecycle.

Scientific classification is governed by `redness-evidence-engine-v1.md`. Product journey behavior is governed by `product-contract.md` and `production-journey-integration.md`.

Historical Phase B and Phase B.5 behavior is preserved in `youcam-phase-b5-implementation.md` and old issues/PRs. It is not an alternate current engine.

## 1. Architecture law

> **YouCam measures the skin. Face Value judges the trial.**

The provider may:

- accept a temporary in-memory image
- return provider task state
- return a normalized optical measurement
- return provider-specific failure information
- support protected engineering diagnostics

The provider may not:

- create or select a Face Value result
- choose the next step
- change trial timing or eligibility
- override confounders or safety evidence
- create an Evidence Record
- control Oracle state
- write durable browser storage
- create a second product or evidence store
- turn score movement into a clinical claim

## 2. Frozen current protocol

The supported production protocol is:

| Field | Value |
| --- | --- |
| Provider | YouCam Skin Analysis |
| API version | `2.1` |
| Mode | `hd` |
| Concern | `hd_redness` |
| Region | `null` |
| Score type | `raw_score` |
| Capture protocol version | `face-value-youcam-1` |
| Product protocol ID | `youcam-redness-v1` |
| Result owner | Face Value canonical evaluator |

Once baseline is accepted, the protocol fields are immutable for that trial.

A mismatched follow-up must fail locally before a new upload slot or provider task is created whenever the mismatch is knowable locally.

No SD fallback, concern substitution, `all` request, skin age, or `ui_score` fallback is permitted.

## 3. Official server workflow

The server integration uses the YouCam Skin Analysis v2.1 sequence:

```text
POST /s2s/v2.1/file/skin-analysis
→ upload image bytes to the returned temporary signed URL
→ POST /s2s/v2.1/task/skin-analysis
→ GET /s2s/v2.1/task/skin-analysis/{task_id}
→ bounded polling
→ validate success or translate failure
→ normalize one durable raw-score signal
```

The implementation must depend only on reviewed endpoint and response contracts. Undocumented fields may appear in protected diagnostics but may not become durable product dependencies.

## 4. Authentication and engineering session

`YOUCAM_API_KEY` is server-only.

It must never:

- use a `VITE_` prefix
- enter client JavaScript
- appear in browser storage
- appear in rendered HTML
- appear in API responses
- appear in logs or committed fixtures

The hackathon/internal application uses a protected engineering session:

1. the user submits `YOUCAM_SPIKE_TOKEN` to `POST /api/youcam/session`
2. the server compares it using timing-safe equality
3. the server issues the `fv_youcam_demo` cookie
4. the cookie is signed, `Secure`, `HttpOnly`, and `SameSite=Strict`
5. the cookie has a thirty-minute lifetime
6. the cookie currently uses `Path=/` so the same protected session can authorize provider and internal tool routes
7. protected responses use `Cache-Control: no-store`
8. unauthorized requests fail closed

This is a temporary engineering boundary. It is not a consumer identity, account, medical-record, or multi-user authorization system.

The compatibility `x-face-value-spike-token` header may remain accepted only where explicitly retained by the server helper. New production client code must use the signed cookie and must not send the raw token.

## 5. Typed provider boundary

The browser and reducer must not consume raw YouCam JSON directly.

The provider boundary accepts an in-memory image, frozen protocol, capture role, capture time, and abort signal. It returns a validated provider signal or a typed provider failure.

Conceptually:

```ts
interface AnalyzeCaptureInput {
  image: Blob;
  protocol: AnalysisProtocol;
  capturedAt: string;
  role: 'baseline' | 'followup';
  signal?: AbortSignal;
}

interface SkinAnalysisSignal {
  provider: 'youcam';
  apiVersion: '2.1';
  mode: 'hd';
  concern: 'hd_redness';
  region: null;
  rawScore: number;
  capturedAt: string;
  captureQuality: 'accepted';
  ephemeralTaskReference: string;
}
```

The ephemeral task reference exists only during active provider work and protected diagnostics. It must not enter durable normalization.

## 6. Durable normalization

Durable normalization reconstructs an allowed signal by value:

```ts
interface DurableSkinSignal {
  provider: 'youcam';
  apiVersion: '2.1';
  mode: 'hd';
  concern: 'hd_redness';
  region: null;
  scoreType: 'raw_score';
  captureProtocolVersion: 'face-value-youcam-1';
  rawScore: number;
  capturedAt: string;
  captureQuality: 'accepted';
}
```

Normalization must reject:

- missing or non-finite scores
- wrong concern or mode
- unexpected region
- `ui_score`
- protocol mismatch
- malformed success payloads
- provider success without the required redness signal

Durable state must never contain:

- provider task identity
- upload or download URLs
- image bytes
- `File` or `Blob` values
- base64 or data URLs
- object URLs
- raw provider payloads
- credentials or authorization headers
- temporary mask URLs

The exclusion must be achieved by construction, not by serializing a broad provider object and deleting fields later.

## 7. Score meaning

Face Value uses `hd_redness.raw_score` only.

For the current provider contract:

- a higher score is a more favorable or less severe visible-redness condition
- delta equals follow-up minus baseline
- positive delta is favorable direction
- negative delta is unfavorable direction
- delta is a point difference, not a percentage
- raw score is not a diagnosis or direct amount of redness

The canonical evaluator applies the current provisional 5/10 operating boundaries and all evidence-quality rules. This provider contract does not classify results.

## 8. Current evidence volume

At the current baseline, one provider analysis settles the ordinary baseline period and one settles the ordinary follow-up period.

#63 will change orchestration so one consumer scan produces three independently analyzed frames. That PR must preserve:

- one frozen protocol
- one abort authority per burst
- bounded provider concurrency
- no score duplication
- no median disguised as a provider signal
- face-free accepted/rejected frame evidence
- release of each image after its request settles

The provider endpoints and durable signal contract remain unchanged unless the PR explicitly updates this authority.

## 9. Provider polling and cancellation

Polling must be bounded by:

- maximum elapsed time
- maximum attempts or an equivalent deterministic limit
- terminal success and failure states
- request identity
- abort signal

Cancellation occurs on:

- user Back or route exit
- retry generation replacement
- component unmount
- timeout
- terminal provider state
- protocol rejection

Stale provider completion must be a no-op. A late success cannot overwrite a newer retry, cancelled generation, accepted baseline, or saved result.

## 10. Error translation

Provider codes belong in protected engineering evidence and safe logs only. Consumer copy must be deterministic and action-oriented.

| Provider or local condition | Consumer guidance |
| --- | --- |
| face too small | Move closer so your face fills more of the guide. |
| lighting rejection | Find more even light and try again. |
| face outside bounds | Center your full face inside the guide. |
| invalid image | Use a clear front-facing JPEG or PNG. |
| timeout | Analysis took too long. Retry without losing this trial. |
| unauthorized session | Analysis access expired. Reopen the protected session. |
| protocol mismatch | This scan cannot be compared with the saved baseline protocol. |
| unknown provider failure | This scan could not be analyzed. Existing evidence is unchanged. |

Provider failure must never delete previously accepted evidence or create a fallback result.

## 11. Camera/provider separation

The production camera is `NativeBrowserCameraAdapter`. It captures the exact first-party video surface.

The external Camera Kit renderer is a development diagnostic harness only. The provider analysis still runs through the YouCam Skin Analysis API after native capture.

These are separate concepts:

- production acquisition: first-party browser camera
- protected optical analysis: YouCam Skin Analysis v2.1 server workflow
- diagnostic vendor renderer: Camera Kit development harness

Documentation and environment comments must not describe Camera Kit `hdskincare` as the current production camera.

## 12. Image lifecycle

Image bytes remain temporary.

The active capture/analysis boundary may hold:

- one captured `Blob`
- a private preview object URL
- provider upload bytes
- local luma/movement samples

Resources must be released after:

- provider success
- provider failure
- cancellation
- retry
- route exit
- unmount

Camera tracks must stop on every terminal path. Object URLs must be revoked. No raw face image is restored after reload.

## 13. Safe observability

Safe diagnostics may record:

- route or analysis stage
- baseline/follow-up role
- protocol version
- request generation ID that is local and non-provider-derived
- normalized terminal outcome
- provider error code
- cancellation or stale rejection
- duration and attempt counts

Logs must not contain:

- image bytes or metadata that identifies the image
- signed URLs
- cookies, tokens, or authorization headers
- provider task IDs in ordinary logs
- raw provider payloads
- face thumbnails

## 14. Compiled-client and storage verification

CI must scan durable serialization and compiled assets for prohibited material.

The verification should fail on evidence of:

- API credentials
- bearer/token literals
- provider task identifiers in durable client paths
- data-image or base64 markers
- object URL persistence
- signed provider URL fields
- raw provider payload markers
- temporary mask URLs

Tests must prove that real and fixture provider flows normalize through the same typed boundary.

## 15. Protected development tools

### Provider spike

The historical `/youcam-spike` route may remain as protected engineering evidence. It is not the ordinary consumer journey.

### Demo Lab

Demo Lab uses the same signed engineering session and isolated synthetic storage. It cannot write arbitrary production verdicts.

### Calibration

The full calibration harness is planned in #65. The current repository does not yet implement the protected `/calibration/redness` route or persistent calibration observations.

The future harness must:

- reuse the real provider and burst boundary
- persist face-free observations only
- calculate exploratory repeatability estimates outside React
- keep production thresholds provisional
- prevent exploratory registry entries from loading as production threshold configurations

## 16. Claims boundary

The provider integration may be described as:

- YouCam Skin Analysis v2.1 powered
- HD visible-redness measurement
- raw-score based
- longitudinal and protocol-frozen
- deterministically interpreted by Face Value

It may not be described as:

- clinically validated
- medical-grade accuracy
- dermatologist approved
- diagnosis of redness cause or disease
- proof that a product works
- validated for every device or skin tone
- 95 percent clinically certain

## 17. Required verification

Current or future provider changes require:

- typed contract tests using official-shaped fixtures
- protocol preflight and immutability tests
- success, rejection, timeout, cancellation, and stale-response tests
- signed-cookie tests
- raw-score-only architecture tests
- reducer idempotency tests
- durable storage privacy tests
- compiled-client privacy scan
- exact-head deployed provider proof when behavior changes
- physical iPhone proof for camera/provider integration claims

## 18. Non-goals

This contract does not add:

- consumer authentication
- cloud accounts
- permanent image storage
- all YouCam concerns
- skin age or beauty scoring
- masks as deciding evidence
- an LLM interpretation layer
- product recommendations
- clinical validation

See `camera-contract.md`, `redness-evidence-engine-v1.md`, `architecture.md`, and `youcam-phase-b5-implementation.md`.