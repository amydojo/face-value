# Face Value

> **Your shelf is full of claims. Put them on trial.**

Face Value is a longitudinal skincare product trial machine. A person registers one product, assigns it one explicit job, captures a baseline and an eligible follow-up under a frozen protocol, and receives one evidence-bounded result about whether that product is earning its place.

The hackathon production slice is deliberately narrow:

> **One product. One job: reduce visible redness. One honest result.**

## Current repository truth

This README describes `main` after merged PR #62 (`e0173ee`). Planned work in issues #63–#65 is listed separately and is not represented as already implemented.

Current production behavior includes:

- reducer-owned product registration and trial continuity
- a first-party browser camera surface with the Face Value acquisition sequence
- secure YouCam Skin Analysis v2.1 requests through server-only API routes
- `hd_redness.raw_score` as the deciding optical signal
- a frozen baseline/follow-up protocol
- deterministic, versioned redness evaluation
- provisional operating boundaries of 5 and 10 raw-score points
- explicit measurement, attribution, evidence, safety, and action dimensions
- a sealed Oracle result reveal and exactly-once Evidence Record collection
- face-free local persistence, Previous Trials, Evidence Record detail, and reload continuity
- protected Demo Lab and provider engineering-session boundaries

Current limitations are equally important:

- one accepted baseline score and one accepted follow-up score are stored per ordinary trial period
- measurement quality remains limited because repeated burst evidence and several cross-session comparability signals are not yet collected
- adherence, tolerance, and participant-observed redness change are not yet collected in the ordinary path
- the 5/10 boundaries are provisional Face Value operating thresholds, not clinical significance thresholds
- the provider does not currently report an analysis-model version
- Face Value does not diagnose skin disease or establish clinical product efficacy

See [`docs/README.md`](docs/README.md) for the authority and supersession index.

## Current product journeys

### First trial

```text
empty instrument
→ register product identity
→ assign Reduce visible redness
→ specimen loads and identity locks
→ guided baseline capture
→ optional capture context
→ baseline locked
→ trial pending
```

### Follow-up and result

```text
follow-up ready
→ guided follow-up capture
→ optional capture context
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
in-memory capture
→ YouCam Skin Analysis v2.1
→ normalized hd_redness.raw_score
→ frozen protocol and face-free capture metadata
→ canonical redness evidence adapter
→ deterministic evaluator
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

## Planned Phase C work

The remaining implementation is dependency ordered:

1. **#63 — Evidence Burst**  
   Three independently analyzed frames per baseline and follow-up, median aggregation, direction agreement, bounded rejection evidence, and face-free persistence.

2. **#64 — Trial Truth**  
   Explicit adherence, tolerance, and participant-observed redness direction mapped into the existing evaluator without UI-side verdict logic.

3. **#65 — Preliminary Calibration Harness**  
   A protected internal repeatability instrument and exploratory technical report. Production trials continue using the provisional 5/10 configuration unless a future separately reviewed graduation process approves otherwise.

Planned work does not become repository truth until its pull request is merged and the authority docs are updated in the same change.

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
- [`docs/oracle-reveal-v1.md`](docs/oracle-reveal-v1.md)
- [`docs/source-of-truth-manifest.md`](docs/source-of-truth-manifest.md)

## Verification status

Automated CI and Vercel checks passed for the PR #62 merge head. WebKit fixture evidence and the physical-iPhone observations that motivated the native-camera correction are recorded in the repository.

A final exact-head physical-iPhone acceptance pass for the merged production journey remains a release gate and must be recorded explicitly rather than inferred from synthetic browser screenshots.