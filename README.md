# Face Value

> **Your shelf is full of claims. Put them on trial.**

Face Value is a longitudinal skincare product trial machine. A person registers one product, assigns it one explicit job, captures a baseline and an eligible follow-up under a frozen protocol, and receives one evidence-bounded result about whether that product is earning its place.

The hackathon production slice is deliberately narrow:

> **One product. One job: reduce visible redness. One honest result.**

## Current status

Face Value is in **hackathon pre-submission hardening**.

The core evidence architecture is implemented and protected. The active work is not another scientific or provider rewrite. It is turning the already-verified pieces into one coherent submission candidate, validating the full flow without wasting provider credits, and then completing one deliberate physical-device acceptance run.

### Repository truth vs active submission work

`main` contains the currently merged production path and remains the authority for behavior that has actually landed.

Two active draft pull requests are the current submission integration candidates:

- **PR #73 · canonical Face Value Actuator V1.1**
  - open, draft, mergeable
  - preserves the existing machine control behavior while replacing its visual actuator and adding the current brand/icon surface
  - previously passed its full validation set, including strict TypeScript, unit tests, production build, privacy verification, and targeted mobile WebKit checks
- **PR #74 · updated Result Experience**
  - open, draft, mergeable
  - current head: `346f17aaa7c3f715ee9ffded4775f772b8d8bd38`
  - implements the approved Result → Evidence sheet → Technical record → detail hierarchy
  - includes Demo Lab wiring for the new result experience
  - does not change provider behavior, evaluator logic, thresholds, camera acquisition, persistence semantics, privacy behavior, or authentication

If the production-style `main` deployment still shows the older large Evidence Record, that is expected until PR #74 is integrated. Validate the new result experience on the PR #74 preview rather than judging it from stale `main` UI.

## Current production behavior

The merged production path includes:

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

## Provider status

The previous YouCam quota blocker is resolved.

Perfect Corp restored **500 complimentary API units on August 5, 2026**. The earlier `CreditInsufficiency` failure remains useful historical evidence, but it is no longer the active blocker.

Physical iPhone Safari has already proven native camera preview and capture, and upload-slot creation has succeeded. The remaining provider proof is one fresh **baseline → follow-up** physical-device acceptance run through the genuine provider path after the integrated submission candidate is green.

Do not reopen provider architecture, retry policy, thresholds, evaluator logic, persistence, privacy, or camera acquisition unless a verified failing acceptance test proves it is necessary.

## Current limitations

- each ordinary period requires three accepted provider observations but still represents one short acquisition session
- measurement quality remains limited because cross-session pose, facial registration, segmentation, crop, face size, color cast, and skin-tone properties are not measured
- mask, registration, segmentation, measured skin-tone, and provider model-version evidence remain unavailable
- the 5/10 boundaries are provisional Face Value operating thresholds, not clinical significance thresholds
- the provider does not currently report an analysis-model version
- a final provider-backed physical baseline-to-follow-up acceptance run still needs to be completed and recorded after the current integration/hardening pass
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
→ collect one Evidence Record
→ Home / Previous Trials
```

The current archive label is **Previous Trials**. Internal compatibility names such as `archive`, `placement`, and legacy reducer events may remain in code and saved-state migration paths; they are not alternate product journeys.

## Pre-submission flow hardening

An August 11 flow audit identified four bounded presentation/continuity issues that should be resolved without changing the evidence architecture:

1. **Strength normalization**
   - registration accepts plain numeric strength such as `10`
   - the specimen/bottle presentation currently recognizes percentage strength only when `%` is present
   - numeric strength should normalize to percentage presentation instead of requiring secret punctuation from the user

2. **Pre-camera clarity**
   - before guided capture starts, the current UI can say `Position your face` / `Looking for a stable frame`
   - pre-start copy should explain that guided capture starts below and camera permission will be requested
   - positioning/stability guidance should appear only after the live camera preview exists

3. **Baseline continuity**
   - the standalone baseline completion screen creates an unnecessary break in the machine model
   - after baseline capture, the same trial cassette should become `BASELINE LOCKED`, show the follow-up date, and clearly tell the user they are done for now

4. **Comparison continuity**
   - the standalone `Comparing against your baseline…` screen weakens the single-machine mental model
   - keep the underlying asynchronous analysis state, but present comparison progress inside the cassette/machine before the verdict reveal

North-star rule:

> **The cassette should become the state of the trial wherever possible.**

These are pre-submission flow-coherence fixes, not a provider or evaluator redesign.

## Hackathon execution order

1. Validate the new Result Experience on the PR #74 Vercel preview and Demo Lab.
2. Integrate PR #74 and PR #73 deliberately; do not merge blindly or mix unrelated changes.
3. Run one bounded trial-continuity hardening pass for the four findings above.
4. Exhaust zero-credit validation first:
   - Demo Lab preview and journey states
   - `npm run check`
   - targeted Playwright/WebKit flow checks
   - persistence/reload behavior
   - accessibility and reduced-motion behavior
   - Result → Evidence sheet → Technical record → detail inspection
5. Only after the synthetic/automated candidate is green, run one fresh physical iPhone Safari baseline → follow-up provider acceptance using restored credits.
6. Confirm genuine provider completion, truthful analysis progression, no partial durable evidence on failure, camera cleanup, and the correct saved result.
7. If green, freeze product code for submission and move into the nine-beat hackathon storyboard, capture, and edit.

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

## Evidence-engine milestones

The evidence-engine work that established the current scientific/product boundary includes:

1. **#63 · Evidence Burst — merged**

   Three independently analyzed current frames per baseline and follow-up, reducer-owned atomic period commit, evaluator-owned aggregation, bounded rejected-attempt evidence, and face-free persistence.

2. **#64 · Trial Truth — merged**

   Explicit adherence, tolerance, symptoms, and participant-observed redness direction mapped into the existing evaluator without UI-side verdict logic.

3. **#65 · Preliminary Calibration Harness — implemented**

   A protected internal repeatability instrument, deterministic exploratory report/registry, and saved-snapshot Redness Response Signature. Production trials continue using the provisional 5/10 configuration unless a future separately reviewed graduation process approves otherwise.

   Issue #65 was implemented from exact base `f95b051f6c562919c23da0d08728fff124d27d48`.

Planned or draft work does not become `main` repository truth until its pull request is merged and the authority docs are updated in the same change.

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

The repository currently has strong synthetic and browser verification for the evidence engine, Demo Lab, persistence, privacy boundaries, and the active presentation work in PRs #73 and #74.

The remaining irreversible acceptance gate is intentionally narrow:

> **One fresh physical iPhone Safari baseline → follow-up run through the genuine provider path after integration and continuity hardening are green.**

That physical result should be recorded explicitly. It must not be inferred from synthetic browser evidence, and live provider credits should not be spent repeatedly on UI or flow debugging that Demo Lab can cover for free.