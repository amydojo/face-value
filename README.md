# Face Value

> **Your shelf is full of claims. Put them on trial.**

Face Value is a longitudinal skincare product trial machine. A person registers one product, assigns it one explicit job, captures a baseline and an eligible follow-up under a frozen protocol, and receives one evidence-bounded result about whether that product is earning its place.

The hackathon production slice is deliberately narrow:

> **One product. One job: reduce visible redness. One honest result.**

## Current repository truth

This implementation is based on `main` at merged PR #69
(`f95b051f6c562919c23da0d08728fff124d27d48`) and implements issue #65 on top
of merged issues #63 and #64.

Current production behavior includes:

- reducer-owned product registration and trial continuity
- a first-party browser camera surface with the Face Value acquisition sequence
- one continuous three-measurement baseline and follow-up acquisition ritual
- three distinct decoded frames and three independent YouCam analyses per period
- secure YouCam Skin Analysis v2.1 requests through server-only API routes
- `hd_redness.raw_score` as the deciding optical signal
- a frozen baseline/follow-up protocol
- deterministic, versioned redness evaluation
- provisional operating boundaries of 5 and 10 raw-score points
- explicit measurement, attribution, evidence, safety, and action dimensions
- reducer-owned adherence, tolerance, symptom, and participant-observed redness evidence
- a sealed Oracle result reveal and exactly-once Evidence Record collection
- a saved-snapshot Redness Response Signature inside progressive Evidence Record detail
- face-free local persistence, Previous Trials, and reload continuity
- protected Demo Lab and provider engineering-session boundaries
- a protected, isolated preliminary redness-calibration instrument

Current limitations are equally important:

- each ordinary period requires three accepted provider observations but still
  represents one short acquisition session
- measurement quality remains limited because cross-session pose, facial
  registration, segmentation, crop, face size, color cast, and skin-tone
  properties are not measured
- mask, registration, segmentation, measured skin-tone, and provider model-version evidence remain unavailable
- the 5/10 boundaries are provisional Face Value operating thresholds, not clinical significance thresholds
- the provider does not currently report an analysis-model version
- live calibration collection is blocked by YouCam `CreditInsufficiency`; only explicitly synthetic face-free calibration fixtures are verified
- Face Value does not diagnose skin disease or establish clinical product efficacy

See [`docs/README.md`](docs/README.md) for the authority and supersession index.

## Current product journeys

### First trial

```text
empty instrument
→ register product identity
→ assign Reduce visible redness
→ specimen loads and identity locks
→ guided baseline evidence burst
→ optional capture context
→ baseline locked
→ trial pending
```

### Follow-up and result

```text
follow-up ready
→ guided follow-up evidence burst
→ optional capture context
→ trial truth: adherence, tolerance, symptoms, and participant-observed direction
→ deterministic comparison
→ sealed Oracle
→ reveal result and recommendation
→ accept or deliberately change the next step
→ collect one Evidence Record
→ Home / Previous Trials
```

The current archive label is **Previous Trials**. Internal compatibility names such as `archive`, `placement`, and legacy reducer events may remain in code and saved-state migration paths; they are not alternate product journeys.

## Evidence model

YouCam measures the skin. Face Value judges the trial.

```text
three distinct in-memory frames
→ three independent YouCam Skin Analysis v2.1 requests
→ three normalized hd_redness.raw_score observations
→ frozen protocol and face-free capture metadata
→ reducer-owned trial-truth evidence
→ canonical redness evidence adapter
→ deterministic median, direction agreement, and evaluation
→ immutable RednessEvaluationSnapshot
→ verdict presentation
→ exactly-once Evidence Record
```

The evaluator keeps these concepts separate:

- effect classification
- measurement quality
- attribution quality
- evidence quality
- safety status
- recommended action

The canonical action set is:

- `keep`
- `test_longer`
- `retry_alone`
- `not_proving_job`
- `safety_interruption`

No React component, animation callback, provider response, or language model may create or upgrade a scientific result.

## Privacy and security

Raw face images remain memory-only. They are not written to reducer state, local storage, Evidence Records, analytics, logs, or committed verification artifacts.

Durable evidence excludes:

- image bytes, `File`, and `Blob` values
- base64 and data URLs
- object URLs
- signed upload URLs
- provider task identifiers
- API credentials and authorization headers
- raw provider payloads

`YOUCAM_API_KEY` remains server-only. The protected engineering token is exchanged for a signed `Secure`, `HttpOnly`, `SameSite=Strict` cookie. It is not a consumer authentication system.

## Camera architecture

Production uses `NativeBrowserCameraAdapter`: the visible first-party `<video>` surface is the frame Face Value captures. The app measures only whole-frame exposure and movement locally and does not claim native face detection, pose estimation, skin-tone classification, or facial registration.

The external Perfect Corp Camera Kit renderer is retained as a development diagnostic harness only. It is not the production acquisition surface.

See [`docs/camera-contract.md`](docs/camera-contract.md).

## Phase C status

1. **#63 — Evidence Burst (merged)**

   Three independently analyzed current frames per baseline and follow-up,
   reducer-owned atomic period commit, evaluator-owned aggregation, bounded
   rejected-attempt evidence, and face-free persistence.

2. **#64 — Trial Truth (merged)**

   Explicit adherence, tolerance, symptoms, and participant-observed redness direction mapped into the existing evaluator without UI-side verdict logic.

3. **#65 — Preliminary Calibration Harness (implemented in this change)**

   A protected internal repeatability instrument, deterministic exploratory
   report/registry, and saved-snapshot Redness Response Signature. Production
   trials continue using the provisional 5/10 configuration unless a future
   separately reviewed graduation process approves otherwise.

Planned work does not become repository truth until its pull request is merged
and the authority docs are updated in the same change.

## Local setup

```bash
npm install
npm run dev
```

Validation:

```bash
npm run check
npx playwright install --with-deps webkit
npm run test:e2e
```

Key scripts:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run verify:redness-architecture`
- `npm run verify:docs`
- `npm run build`
- `npm run verify:privacy`
- `npm run check`
- `npm run test:e2e`

## Architecture

The application uses Vite, React, strict TypeScript, one reducer-owned product state machine, a separate pure Oracle mechanical reducer, CSS Modules, Vitest, React Testing Library, Playwright WebKit, serverless YouCam routes, and local face-free persistence.

Start with:

- [`docs/README.md`](docs/README.md)
- [`docs/product-contract.md`](docs/product-contract.md)
- [`docs/architecture.md`](docs/architecture.md)
- [`docs/state-model.md`](docs/state-model.md)
- [`docs/camera-contract.md`](docs/camera-contract.md)
- [`docs/redness-evidence-engine-v1.md`](docs/redness-evidence-engine-v1.md)
- [`docs/redness-calibration-harness.md`](docs/redness-calibration-harness.md)
- [`docs/oracle-reveal-v1.md`](docs/oracle-reveal-v1.md)
- [`docs/source-of-truth-manifest.md`](docs/source-of-truth-manifest.md)

## Verification status

Issue #65's method, synthetic verification boundary, and remaining physical
checks are recorded in
[`docs/redness-calibration-harness.md`](docs/redness-calibration-harness.md).
Issue #63 acquisition evidence remains in
[`docs/verification/redness-evidence-burst-63/README.md`](docs/verification/redness-evidence-burst-63/README.md).

A final exact-head provider-backed physical-iPhone acceptance pass remains
blocked by `CreditInsufficiency` and must be recorded explicitly after credits
return rather than inferred from synthetic browser evidence.
