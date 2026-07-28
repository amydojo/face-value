# YouCam Phase B.5 implementation record

Status: Implemented on `feat/phase-b5-show-the-car`, stacked on the exact
Phase B head while PR #44 remains open.

Related work: #40, #45, PR #44.

## Product journey

Phase B.5 turns the Phase B engine into the canonical Face Value trial:

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

The first-time action is `START A PRODUCT TRIAL`. `Your trials` remains
secondary and no longer sits between a new person and registration.

## Durable authority

The existing Phase B reducer wrapper remains the single durable product
authority. Phase B.5 adds only:

- `registeredProduct`
- `baselineLockedAt`
- `followUpEligibleAt`
- `baselineContext`
- `followUpContext`
- `demoTimelineAdvanced`
- `resultRevealed`

The same persistence key is used. Live camera quality, SDK instances, streams,
blobs, files, object URLs, upload URLs, task IDs, and provider payloads are not
durable fields.

The new legal events are:

- `START_PRODUCT_REGISTRATION`
- `REGISTER_PRODUCT`
- `CAPTURE_CONTEXT_RECORDED`
- `FINISH_BASELINE_SESSION`
- `CHECK_FOLLOWUP_ELIGIBILITY`
- `ADVANCE_DEMO_TIMELINE`
- `REVEAL_RESULT`
- `COMMIT_RESULT_AND_RELEASE`

Provider events remain the Phase B events:

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

`RegisteredProduct` is reducer-owned and is the canonical production identity.
It includes the user’s brand and product name, optional strength and volume,
the one supported job, the frozen protocol identifier, and its registration
timestamp.

`specimenFromRegisteredProduct` is the single adapter into the existing
specimen presentation contract. Fixture products remain only behind explicit
legacy, development, calibration, and test boundaries. Canonical presentation
code has no positional fixture fallback.

YouCam eligibility is:

```ts
registeredProduct?.protocolId === 'youcam-redness-v1'
```

It does not depend on a marketing fixture ID.

## Camera Kit boundary

The dedicated boundary lives under
`src/adapters/camera/youcam-camera-kit/`.

The implementation follows the current official Perfect Corp JavaScript
Camera Kit surface:

- SDK: `https://plugins-media.makeupar.com/v2.5-camera-kit/sdk.js`
- mode: `hdskincare`
- output: `blob`
- quality: `moderate`
- iPhone Safari video target: `1080p`
- stable auto-capture interval: `800` ms
- flip control: hidden through the documented option
- events: `loaded`, `cameraOpened`, `cameraFailed`,
  `unsupportedResolution`, `faceQualityChanged`, and
  `faceDetectionCaptured`

The SDK is opened only from the native `START GUIDED CAPTURE` button's click
handler. Mounting the screen does not request camera access. The loader is
singleton-scoped, while each explicit capture session owns listener
installation, listener removal, stable-quality timing, duplicate suppression,
stale-session rejection, cancellation, and camera closure.

`cameraOpened` means only that permission and the underlying camera opened. It
does not mark capture ready. Before `openCameraKit`, a `MutationObserver`
hardens every descendant video for muted, autoplaying inline playback,
including `webkit-playsinline`, and retries `play()` on `loadedmetadata`.

Readiness requires `YMK.isLoaded()`. When the SDK creates a video, that video
must also have current frame data and non-zero dimensions. Only then does the
adapter emit `preview-live`, accept resolution, and let Face Value quality
guidance progress. A 3-second opened-but-not-live watchdog tears down the SDK,
listeners, observer, timers, and owned tracks before offering the focused
`RESTART CAMERA` action. Restart always requires a fresh user tap.

The accepted baseline stores only the selected profile identifier as face-free
metadata. A guided follow-up reuses that exact profile. The 1920p profile
remains available only behind an explicit proven-capability boundary; it is not
forced on iPhone Safari.

Provider-specific quality is normalized to:

- face
- accepted position plus frontal pose
- accepted lighting
- accepted resolution
- one Face Value guidance value

The supported path has no shutter and no approval screen. A capture is accepted
only after the preview is live, every required quality condition has remained
accepted for 800 ms, and `faceDetectionCaptured` supplies one valid Blob for
the current session. Teardown happens before the Blob is emitted exactly once.
The Blob is handed to the existing `analyzeLongitudinalCapture` path and is
marked with the existing YouCam `pf_camera_kit` request flag. JPEG/PNG file
selection is the single recoverable fallback.

## Context and timing law

The camera verifies observable capture quality. The optional context surface
asks only about makeup, recent heat or exercise, recent cleansing or skincare,
routine or treatment change, and one short note.

Context can append the reviewed attribution limitation and cannot increase
confidence, change provider protocol validation, or manufacture a claim.

An accepted baseline records its immutable capture time and calculates
`followUpEligibleAt` with the 14-day product scheduling rule. This interval is
not described as clinical validation. Both the `BEGIN_CAPTURE` and
`FOLLOWUP_ANALYSIS_STARTED` reducer transitions reject early follow-up work.

The explicit demo event changes only `demoTimelineAdvanced`, marks the record
as demo-originated, and makes the current trial eligible through the reviewed
demo rule. It never rewrites the baseline time or claims that fourteen real
days passed. Its UI label is compiled out unless
`VITE_SHOW_DEMO_CONTROLS=true`.

## Sealed result and atomic release

The comparison can exist durably while its contents remain absent from the
rendered and accessible tree. Before `REVEAL_RESULT`, the UI contains only:

```text
Your result is ready.
Pull to reveal.
```

The reveal creates no second result model. It exposes the existing Face Value
result in one scene:

- directional finding
- plain-language support
- normal-variation limitation
- `TEST LONGER`
- optional `SEE WHY`
- optional next-step override

The default pre-calibration placement is `paused`; confidence remains
`possible`.

One `COMMIT_RESULT_AND_RELEASE` reducer event sets the selected placement and
delegates exactly once to the existing `SAVE_RESULT` transition. The existing
record generator remains the only record generator. Duplicate amber
activation is rejected, and the same record ID is used for dispensing,
collection, detail, archive, and restoration.

## Failure and restoration law

Camera initialization, permission, resolution, provider, network, protocol,
cancel, back, and stale-completion paths preserve accepted evidence. Camera
teardown runs on completion, navigation, and unmount.

Restoration resolves transient work to a legal stable state:

- an interrupted baseline camera returns to the registered specimen
- an interrupted follow-up camera returns to follow-up ready
- accepted baseline restores to context, locked, waiting, or ready
- accepted paired scans resume deterministic comparison
- a sealed result remains sealed
- a revealed result remains revealed
- a committed record restores as presented
- a collected record and archive restore with the same record ID

No image is restored.

## Accessibility

- Stage changes focus the logical heading without stealing user-owned form
  focus.
- Registration errors focus the first invalid named control.
- Camera guidance announces only meaningful normalized changes.
- Auto-capture is announced before analysis.
- The sealed result contains no verdict text in DOM or accessibility snapshots.
- Reveal supports pointer drag, tap, Enter, and Space.
- Amber and record collection are native buttons.
- Touch controls retain a 44 CSS-pixel minimum.
- Escape and pointer-cancellation behavior are deterministic.
- Reduced motion preserves every causal state while shortening ceremony.
- Status is never communicated by color alone.

## Privacy proof

Durable normalization reconstructs only the frozen YouCam signal. Runtime
golden-path assertions inspect the single persistence payload after baseline,
demo advancement, record creation, archive, and refresh.

The compiled-client scan rejects credentials, provider task markers, data
images, blob URLs, object URL creation, data-URL readers, media streams, signed
provider fields, raw payload markers, and production demo-control labels.

The Camera Kit SDK is loaded only inside a component-local capture session.
The accepted Blob is discarded after analysis or cancellation. Camera
diagnostics contain only a lifecycle stage and capture-profile identifier;
they never contain image bytes, object URLs, provider payloads, task IDs,
signed URLs, or credentials.
