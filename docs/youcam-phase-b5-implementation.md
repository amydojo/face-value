# YouCam Phase B.5 implementation record

> **Historical record — superseded for current production behavior.**
>
> This file preserves the architecture and decisions implemented on the former `feat/phase-b5-show-the-car` branch. It must not be used as current camera, scientific, completion, or product-journey authority.
>
> Current production truth is defined by `README.md`, `docs/README.md`, `product-contract.md`, `architecture.md`, `state-model.md`, `production-journey-integration.md`, `camera-contract.md`, `redness-evidence-engine-v1.md`, and `oracle-reveal-v1.md`.
>
> In particular, PR #62 replaced the production Camera Kit renderer with `NativeBrowserCameraAdapter`, the canonical redness evaluator superseded the pre-calibration sign-only result, the Oracle now creates the durable record at `EVIDENCE_COLLECTED`, and the archive is presented as Previous Trials.

**Historical status:** Implemented on `feat/phase-b5-show-the-car`, when it was stacked on the Phase B head and PR #44 was still open.  
**Related historical work:** #40, #45, PR #44.

## Product journey at that revision

Phase B.5 turned the then-current Phase B engine into this trial:

```text
register a real product
→ confirm Reduce visible redness
→ guided baseline auto-capture
→ optional context
→ Baseline locked
→ wait until the 14-day product interval is eligible
→ guided follow-up auto-capture
→ optional context
→ compare the frozen raw-score protocol
→ keep the result sealed
→ reveal verdict, limitation, and TEST LONGER together
→ press amber once
→ collect one durable Evidence Record
→ detail
→ Past Results
→ face-free refresh restoration
```

The first-time action was `START A PRODUCT TRIAL`. `Your trials` remained secondary and no longer sat between a new person and registration.

## Durable authority at that revision

The existing Phase B reducer wrapper remained the single durable product authority. Phase B.5 added:

- `registeredProduct`
- `baselineLockedAt`
- `followUpEligibleAt`
- `baselineContext`
- `followUpContext`
- `demoTimelineAdvanced`
- `resultRevealed`

The same persistence key was used. Live camera quality, SDK instances, streams, blobs, files, object URLs, upload URLs, task IDs, and provider payloads were not durable fields.

The new legal events were:

- `START_PRODUCT_REGISTRATION`
- `REGISTER_PRODUCT`
- `CAPTURE_CONTEXT_RECORDED`
- `FINISH_BASELINE_SESSION`
- `CHECK_FOLLOWUP_ELIGIBILITY`
- `ADVANCE_DEMO_TIMELINE`
- `REVEAL_RESULT`
- `COMMIT_RESULT_AND_RELEASE`

Provider events remained:

- `BASELINE_ANALYSIS_STARTED`
- `BASELINE_ANALYSIS_ACCEPTED`
- `BASELINE_ANALYSIS_FAILED`
- `FOLLOWUP_ANALYSIS_STARTED`
- `FOLLOWUP_ANALYSIS_ACCEPTED`
- `FOLLOWUP_ANALYSIS_FAILED`
- `COMPARISON_CREATED`
- `COMPARISON_REJECTED`
- `ANALYSIS_CANCELLED`

## Registered product boundary

`RegisteredProduct` was reducer-owned and became the canonical production identity. It included the user’s brand and product name, optional strength and volume, the one supported job, the frozen protocol identifier, and its registration timestamp.

`specimenFromRegisteredProduct` was the single adapter into the existing specimen presentation contract. Fixture products remained only behind explicit legacy, development, calibration, and test boundaries. Canonical presentation code had no positional fixture fallback.

YouCam eligibility was:

```ts
registeredProduct?.protocolId === 'youcam-redness-v1'
```

It did not depend on a marketing fixture ID.

## Historical Camera Kit boundary

At that revision, the dedicated boundary lived under `src/adapters/camera/youcam-camera-kit/` and attempted to use the Perfect Corp JavaScript Camera Kit surface with:

- SDK: `https://plugins-media.makeupar.com/v2.5-camera-kit/sdk.js`
- mode: `hdskincare`
- output: `blob`
- quality: `moderate`
- iPhone Safari video target: `1080p`
- stable auto-capture interval: `800` ms
- flip control hidden
- vendor events including `loaded`, `cameraOpened`, `cameraFailed`, `unsupportedResolution`, `faceQualityChanged`, and `faceDetectionCaptured`

The SDK opened only from the `START GUIDED CAPTURE` click handler. The implementation attempted to distinguish camera-opened from preview-ready state, harden descendant video playback, wait for `YMK.isLoaded()`, suppress duplicates, reject stale sessions, and close the SDK on teardown.

That production architecture is retired. PR #62 documented physical-iPhone failures in the vendor renderer and replaced the production path with the exact visible first-party browser video surface. Camera Kit remains diagnostic only.

## Context and timing law

The optional context surface asked about makeup, recent heat or exercise, recent cleansing or skincare, routine or treatment change, and one short note.

Context could append an attribution limitation and could not increase confidence, change protocol validation, or manufacture a claim.

An accepted baseline recorded its immutable capture time and calculated `followUpEligibleAt` with the fourteen-day launch scheduling rule. Both `BEGIN_CAPTURE` and `FOLLOWUP_ANALYSIS_STARTED` rejected early follow-up work.

The explicit demo event changed only `demoTimelineAdvanced`, marked the record as demo-originated, and made the current trial eligible through the reviewed demo rule. It did not rewrite baseline time or claim that fourteen real days passed.

## Historical sealed result and release

At that revision, the comparison could exist durably while its contents remained absent from the rendered and accessible tree. Before `REVEAL_RESULT`, the UI contained only:

```text
Your result is ready.
Pull to reveal.
```

The reveal exposed the then-current directional finding, support, normal-variation limitation, `TEST LONGER`, optional `SEE WHY`, and optional next-step override.

The pre-calibration placement defaulted to `paused` and confidence remained `possible`.

`COMMIT_RESULT_AND_RELEASE` delegated to the older `SAVE_RESULT` transition. That completion boundary is superseded by the current Oracle reducer, where explicit collection and `EVIDENCE_COLLECTED` create the durable record.

## Failure and restoration law

Camera initialization, permission, resolution, provider, network, protocol, cancellation, Back, and stale-completion paths preserved accepted evidence. Camera teardown ran on completion, navigation, and unmount.

Restoration resolved transient work to a legal stable state:

- interrupted baseline camera returned to the registered specimen
- interrupted follow-up camera returned to follow-up ready
- accepted baseline restored to context, locked, waiting, or ready
- accepted paired scans resumed deterministic comparison
- sealed result remained sealed
- revealed result remained revealed
- committed record restored as presented
- collected record and archive restored with the same record ID
- no image was restored

These invariants remain important even though the current camera and Oracle implementations differ.

## Accessibility at that revision

- stage changes focused the logical heading without stealing user-owned form focus
- registration errors focused the first invalid named control
- camera guidance announced meaningful normalized changes
- auto-capture was announced before analysis
- sealed result content remained absent from DOM and accessibility snapshots
- reveal supported pointer drag, tap, Enter, and Space
- amber and record collection used native buttons
- touch controls retained a 44 CSS-pixel minimum
- Escape and pointer cancellation were deterministic
- reduced motion preserved causal state
- status was not communicated by color alone

These remain design principles, but current exact behavior is defined by the current authority documents and tests.

## Privacy proof at that revision

Durable normalization reconstructed only the frozen YouCam signal. Runtime assertions inspected the persistence payload after baseline, demo advancement, record creation, archive, and refresh.

The compiled-client scan rejected credentials, provider task markers, data images, blob URLs, object URL persistence, signed provider fields, raw payload markers, and production demo-control labels.

The accepted image was discarded after analysis or cancellation. Camera diagnostics contained lifecycle and profile information only.

## Why this record remains

This document preserves design and implementation provenance for:

- reducer-owned product registration
- protocol-based provider eligibility
- first-time registration priority
- optional context and timing rules
- sealed-result accessibility
- failure/restoration invariants
- privacy constraints

It must not be used to revive the retired production Camera Kit path, sign-only comparison, `SAVE_RESULT` completion flow, or Past Results vocabulary.