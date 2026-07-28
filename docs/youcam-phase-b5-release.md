# YouCam Phase B.5 release evidence

Phase B.5 is implemented on the stacked branch
`feat/phase-b5-show-the-car`. PR #44 remains the open Phase B dependency, so
Phase B.5 must target `feat/youcam-phase-b-longitudinal-evidence` until Phase B
merges.

## Before and after

Before:

```text
fixed fixture
→ ten manual confirmations
→ request camera
→ press shutter
→ approve image
→ immediate follow-up
→ result content leaks before reveal
→ repeated next-step screen
```

After:

```text
real registered product
→ one supported job
→ quiet guided auto-capture
→ optional context
→ decisive baseline lock
→ reducer-enforced return timing
→ one sealed result
→ one complete reveal
→ one atomic amber release
→ one continuous face-free Evidence Record
```

## Architecture preserved

- YouCam Skin Analysis v2.1
- HD `hd_redness`
- `raw_score`
- direct signed upload
- bounded polling and cancellation
- durable normalization
- frozen baseline protocol
- deterministic comparison
- calibration pending
- confidence capped at possible
- the Phase B reducer wrapper
- the Human Butter reducer and existing `SAVE_RESULT`
- idempotent record generation
- the single persistence boundary and Past Results restoration

## Verification evidence

The deterministic mobile WebKit golden path runs at:

- 390 × 844
- 430 × 932
- 390 × 650 reduced browser height
- 390 × 844 with reduced motion

It asserts registration, one supported job, user-initiated camera opening,
true preview-live transition, three normalized quality indicators, one
auto-capture, no manual contract, no shutter, no approval, baseline lock,
early follow-up rejection, an identical frozen capture profile, explicit demo
advancement, sealed DOM and accessibility tree, one reveal, default paused
placement, one amber record, record-ID continuity, face-free persistence,
horizontal overflow, scroll ownership, camera cleanup, duplicate suppression,
stale completion, navigation stability, page errors, and console errors.

The Camera Kit suite separately proves that `cameraOpened` and `isLoaded() ===
false` cannot mark the preview ready, SDK-created videos receive the Safari
inline-playback attributes, `loadedmetadata` attempts playback, the 3-second
black-preview watchdog closes all owned resources, and one fresh restart tap
creates one fresh session. The deterministic WebKit suite covers the same
stalled-preview recovery and Back cleanup through the fixture boundary.

Selected Playwright evidence is captured for:

- Baseline locked
- result sealed
- complete one-scene reveal
- record presented

Final exact-head command results, deployment evidence, and the external
physical-device status are recorded in the pull request after the final gates.

## Physical iPhone gate

Automated mobile WebKit validates browser behavior but is not a substitute for
physical iPhone Safari. A physical-device result must be recorded separately;
it must never be inferred from Playwright.

The previously deployed head `2050ce80b57604f207cc13df4362ac9b41ef51cb`
failed this gate: permission succeeded and Camera Kit rendered, but the preview
remained black, quality never progressed, and no capture event arrived. This
failure supersedes the earlier generic physical-device blocker.

The current fix is not complete until its exact deployed head is retested on a
real iPhone Safari and proves live pixels, FACE/POSITION/LIGHT progression,
single automatic capture, camera shutdown, existing YouCam analysis handoff,
face-free persistence, Back/restart cleanup, and a clean runtime.

Relates to #40. Closes #45 when merged. Depends on #44 while stacked.
